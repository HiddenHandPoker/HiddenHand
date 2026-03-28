use anchor_lang::prelude::*;
use std::collections::BTreeSet;

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::{HandCompleted, PlayerHandResult};
use crate::state::{evaluate_hand, find_winners, GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

/// Helper to validate a seat account from remaining_accounts
/// Returns Some(seat) if valid, None if should be skipped
fn validate_seat_account(
    account_info: &AccountInfo,
    table_key: &Pubkey,
    program_id: &Pubkey,
) -> Option<PlayerSeat> {
    // Security check 1: Verify account is owned by our program
    if account_info.owner != program_id {
        return None;
    }

    // Try to borrow and deserialize
    let data = account_info.try_borrow_data().ok()?;
    if data.len() < 8 {
        return None;
    }

    // Try to deserialize as PlayerSeat
    let seat = PlayerSeat::try_deserialize(&mut &data[..]).ok()?;

    // Security check 2: Verify table matches
    if seat.table != *table_key {
        return None;
    }

    // Security check 3: Verify PDA derivation
    let (expected_pda, _) = Pubkey::find_program_address(
        &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
        program_id,
    );
    if *account_info.key != expected_pda {
        return None;
    }

    Some(seat)
}

/// A side pot calculated from player contributions
struct SidePot {
    /// Amount in this side pot
    amount: u64,
    /// Seat indices of active (non-folded) players eligible for this pot
    eligible: Vec<u8>,
}

/// Calculate side pots from all player bets.
/// This correctly handles multi-way all-in with different stack sizes.
///
/// Algorithm: Sort players by total_bet ascending. For each distinct bet level,
/// calculate the incremental contribution from all players who bet at least that amount.
/// Only active (non-folded) players are eligible to win each pot.
fn calculate_side_pots(all_bets: &[(u8, u64, bool)]) -> Vec<SidePot> {
    if all_bets.is_empty() {
        return Vec::new();
    }

    let mut sorted: Vec<(u8, u64, bool)> = all_bets.to_vec();
    sorted.sort_by_key(|b| b.1); // sort by bet amount ascending

    let mut side_pots = Vec::new();
    let mut prev_level = 0u64;

    for i in 0..sorted.len() {
        let (_, bet, _) = sorted[i];
        if bet <= prev_level {
            continue; // skip duplicate bet levels
        }

        let contribution = bet - prev_level;

        // Count ALL players who bet at least this level (including folded)
        let num_contributors = sorted.iter().filter(|(_, b, _)| *b >= bet).count() as u64;
        let pot_amount = contribution * num_contributors;

        // Only ACTIVE players who bet enough are eligible to win
        let eligible: Vec<u8> = sorted
            .iter()
            .filter(|(_, b, active)| *active && *b >= bet)
            .map(|(seat, _, _)| *seat)
            .collect();

        if pot_amount > 0 {
            side_pots.push(SidePot {
                amount: pot_amount,
                eligible,
            });
        }

        prev_level = bet;
    }

    side_pots
}

#[derive(Accounts)]
pub struct Showdown<'info> {
    /// Anyone can call showdown, but non-authority must wait for timeout
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump
    )]
    pub table: Account<'info, Table>,

    #[account(
        mut,
        seeds = [HAND_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = hand_state.bump
    )]
    pub hand_state: Account<'info, HandState>,
}

pub fn handler(ctx: Context<Showdown>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    let hand_state = &mut ctx.accounts.hand_state;
    let caller = &ctx.accounts.caller;
    let clock = Clock::get()?;

    // Authorization check:
    // - Authority can call showdown immediately
    // - Anyone else can call after timeout (prevents authority from abandoning game)
    let is_authority = table.authority == caller.key();

    if !is_authority {
        let elapsed = clock.unix_timestamp - hand_state.last_action_time;
        require!(
            elapsed >= ACTION_TIMEOUT_SECONDS,
            HiddenHandError::UnauthorizedAuthority
        );
        msg!("Non-authority calling showdown after {} seconds timeout", elapsed);
    }

    // Security: Check for duplicate accounts in remaining_accounts
    let mut seen_keys: BTreeSet<Pubkey> = BTreeSet::new();
    for account in ctx.remaining_accounts.iter() {
        if !seen_keys.insert(*account.key) {
            return Err(HiddenHandError::DuplicateAccount.into());
        }
    }

    // Validate game phase
    require!(
        hand_state.phase == GamePhase::Showdown ||
        (hand_state.phase == GamePhase::Settled && hand_state.active_count == 1),
        HiddenHandError::InvalidPhase
    );

    // Get community cards
    let community_cards: Vec<u8> = hand_state.community_cards
        .iter()
        .filter(|&&c| c != 255)
        .copied()
        .collect();

    require!(
        community_cards.len() == 5 || hand_state.active_count == 1,
        HiddenHandError::InvalidPhase
    );

    // Collect player seats from remaining accounts
    let mut active_seats: Vec<(u8, usize)> = Vec::new(); // (seat_idx, acc_idx)
    let program_id = crate::ID;

    // === EARLY: Collect ALL player data for event emission BEFORE any modifications ===
    let mut event_results: [PlayerHandResult; 6] = Default::default();
    let mut results_count: u8 = 0;

    // Also collect ALL bets for side pot calculation (including folded players)
    let mut all_bets: Vec<(u8, u64, bool)> = Vec::new(); // (seat_idx, total_bet, is_active)

    for (idx, account_info) in ctx.remaining_accounts.iter().enumerate() {
        if results_count >= 6 {
            break;
        }
        if let Some(seat) = validate_seat_account(account_info, &table.key(), &program_id) {
            let is_active = seat.status == PlayerStatus::Playing || seat.status == PlayerStatus::AllIn;

            // Track active seats for hand evaluation
            if is_active {
                active_seats.push((seat.seat_index, idx));
            }

            // Track ALL players' bets for side pot calculation (including folded)
            if seat.total_bet_this_hand > 0 {
                all_bets.push((seat.seat_index, seat.total_bet_this_hand, is_active));
            }

            // Collect event data for ALL seats
            let hole_1 = if seat.cards_revealed {
                seat.revealed_card_1
            } else if seat.status == PlayerStatus::Folded {
                255
            } else {
                (seat.hole_card_1 & 0xFF) as u8
            };
            let hole_2 = if seat.cards_revealed {
                seat.revealed_card_2
            } else if seat.status == PlayerStatus::Folded {
                255
            } else {
                (seat.hole_card_2 & 0xFF) as u8
            };

            let hand_rank = if hole_1 != 255 && hole_2 != 255 && community_cards.len() == 5 {
                let eval = evaluate_hand(&[
                    hole_1, hole_2,
                    community_cards[0], community_cards[1], community_cards[2],
                    community_cards[3], community_cards[4],
                ]);
                eval.rank as u8
            } else {
                255
            };

            event_results[results_count as usize] = PlayerHandResult {
                player: seat.player,
                seat_index: seat.seat_index,
                hole_card_1: hole_1,
                hole_card_2: hole_2,
                hand_rank,
                chips_won: 0,
                chips_bet: seat.total_bet_this_hand,
                folded: seat.status == PlayerStatus::Folded,
                all_in: seat.status == PlayerStatus::AllIn,
            };
            results_count += 1;
        }
    }

    let pot = hand_state.pot;

    // Check that all active players have revealed their cards (required for secure showdown)
    // Skip this check if only one player remains (they win by default)
    if hand_state.active_count > 1 {
        for (seat_idx, acc_idx) in active_seats.iter() {
            if hand_state.is_player_active(*seat_idx) {
                let account_info = &ctx.remaining_accounts[*acc_idx];
                let data = account_info.try_borrow_data()?;
                if let Ok(seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                    if !seat.cards_revealed {
                        msg!("Seat {} has not revealed cards yet", seat_idx);
                        return Err(HiddenHandError::PlayersNotRevealed.into());
                    }
                }
            }
        }
    }

    // === RAKE CALCULATION ===
    let total_rake = if table.rake_bps > 0 && pot > 0 {
        let r = pot.saturating_mul(table.rake_bps as u64) / 10000;
        if table.rake_cap > 0 { r.min(table.rake_cap) } else { r }
    } else {
        0
    };

    let pot_after_rake = pot.saturating_sub(total_rake);
    if total_rake > 0 {
        table.accumulated_rake = table.accumulated_rake.saturating_add(total_rake);
        msg!("Rake: {} lamports ({}bps, cap {})", total_rake, table.rake_bps, table.rake_cap);
    }

    // === POT DISTRIBUTION ===
    // Track total chips awarded to update event data
    let mut chips_awarded: Vec<(u8, u64)> = Vec::new(); // (seat_idx, amount)

    if hand_state.active_count == 1 {
        // Single winner (everyone else folded) — award entire pot after rake
        for (seat_idx, acc_idx) in active_seats.iter() {
            if hand_state.is_player_active(*seat_idx) {
                let account_info = &ctx.remaining_accounts[*acc_idx];
                let mut data = account_info.try_borrow_mut_data()?;
                if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                    seat.award_chips(pot_after_rake);
                    seat.try_serialize(&mut *data)?;
                    chips_awarded.push((*seat_idx, pot_after_rake));
                    msg!("Player at seat {} wins {} (all others folded)", seat_idx, pot_after_rake);
                }
                break;
            }
        }
    } else {
        // === SIDE POT CALCULATION ===
        let side_pots = calculate_side_pots(&all_bets);

        msg!("Calculated {} side pot(s) from {} player bets", side_pots.len(), all_bets.len());

        // Deduct rake from side pots (from the main pot first)
        let mut rake_remaining = total_rake;
        let mut adjusted_pots: Vec<(u64, Vec<u8>)> = Vec::new();

        for sp in side_pots.iter() {
            let deduction = rake_remaining.min(sp.amount);
            rake_remaining = rake_remaining.saturating_sub(deduction);
            let adjusted = sp.amount.saturating_sub(deduction);
            if adjusted > 0 {
                adjusted_pots.push((adjusted, sp.eligible.clone()));
            }
        }

        // Distribute each side pot to its winners
        for (pot_idx, (pot_amount, eligible)) in adjusted_pots.iter().enumerate() {
            if eligible.is_empty() {
                // No eligible active players — shouldn't happen but handle gracefully
                continue;
            }

            if eligible.len() == 1 {
                // Only one eligible player — auto-win (their own uncallable excess)
                let winner_seat_idx = eligible[0];
                for (seat_idx, acc_idx) in active_seats.iter() {
                    if *seat_idx == winner_seat_idx {
                        let account_info = &ctx.remaining_accounts[*acc_idx];
                        let mut data = account_info.try_borrow_mut_data()?;
                        if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                            seat.award_chips(*pot_amount);
                            seat.try_serialize(&mut *data)?;
                            chips_awarded.push((*seat_idx, *pot_amount));
                            msg!("Side pot {}: seat {} wins {} (sole eligible)", pot_idx, seat_idx, pot_amount);
                        }
                        break;
                    }
                }
                continue;
            }

            // Evaluate hands among eligible players for this side pot
            let mut player_hands: Vec<(u8, [u8; 7])> = Vec::new();

            for winner_seat_idx in eligible.iter() {
                for (seat_idx, acc_idx) in active_seats.iter() {
                    if seat_idx == winner_seat_idx {
                        let account_info = &ctx.remaining_accounts[*acc_idx];
                        let data = account_info.try_borrow_data()?;
                        if let Ok(seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                            let hole_card_1 = if seat.cards_revealed {
                                seat.revealed_card_1
                            } else {
                                (seat.hole_card_1 & 0xFF) as u8
                            };
                            let hole_card_2 = if seat.cards_revealed {
                                seat.revealed_card_2
                            } else {
                                (seat.hole_card_2 & 0xFF) as u8
                            };

                            let seven_cards: [u8; 7] = [
                                hole_card_1,
                                hole_card_2,
                                community_cards.get(0).copied().unwrap_or(0),
                                community_cards.get(1).copied().unwrap_or(0),
                                community_cards.get(2).copied().unwrap_or(0),
                                community_cards.get(3).copied().unwrap_or(0),
                                community_cards.get(4).copied().unwrap_or(0),
                            ];

                            player_hands.push((*seat_idx, seven_cards));
                        }
                        break;
                    }
                }
            }

            // Find winners for this side pot
            let winners = find_winners(&player_hands);
            let winner_count = winners.len() as u64;

            if winner_count == 0 {
                continue;
            }

            let share = pot_amount / winner_count;
            let remainder = pot_amount % winner_count;

            msg!("Side pot {}: {} - {} winner(s), share: {}", pot_idx, pot_amount, winner_count, share);

            for (i, winner_seat_idx) in winners.iter().enumerate() {
                for (seat_idx, acc_idx) in active_seats.iter() {
                    if seat_idx == winner_seat_idx {
                        let account_info = &ctx.remaining_accounts[*acc_idx];
                        let mut data = account_info.try_borrow_mut_data()?;
                        if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                            let winnings = if i == 0 { share + remainder } else { share };
                            seat.award_chips(winnings);
                            seat.try_serialize(&mut *data)?;
                            chips_awarded.push((*seat_idx, winnings));

                            let hole_1 = if seat.cards_revealed {
                                seat.revealed_card_1
                            } else {
                                (seat.hole_card_1 & 0xFF) as u8
                            };
                            let hole_2 = if seat.cards_revealed {
                                seat.revealed_card_2
                            } else {
                                (seat.hole_card_2 & 0xFF) as u8
                            };
                            let hand_eval = evaluate_hand(&[
                                hole_1, hole_2,
                                community_cards[0], community_cards[1], community_cards[2],
                                community_cards[3], community_cards[4],
                            ]);
                            msg!("Seat {} wins {} with {:?}", seat_idx, winnings, hand_eval.rank);
                        }
                        break;
                    }
                }
            }
        }
    }

    // Update event results with actual winnings
    for (seat_idx, amount) in chips_awarded.iter() {
        for result in event_results.iter_mut().take(results_count as usize) {
            if result.seat_index == *seat_idx {
                result.chips_won = result.chips_won.saturating_add(*amount);
            }
        }
    }

    // Emit the hand completed event
    emit!(HandCompleted {
        table_id: table.table_id,
        hand_number: hand_state.hand_number,
        timestamp: clock.unix_timestamp,
        community_cards: [
            community_cards.get(0).copied().unwrap_or(255),
            community_cards.get(1).copied().unwrap_or(255),
            community_cards.get(2).copied().unwrap_or(255),
            community_cards.get(3).copied().unwrap_or(255),
            community_cards.get(4).copied().unwrap_or(255),
        ],
        total_pot: pot,
        player_count: results_count,
        results: event_results,
        results_count,
    });

    msg!("HandCompleted event emitted for hand #{}", hand_state.hand_number);

    // Reset all player states for next hand (including folded players)
    for account_info in ctx.remaining_accounts.iter() {
        if let Some(_seat) = validate_seat_account(account_info, &table.key(), &program_id) {
            let mut data = account_info.try_borrow_mut_data()?;
            if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                seat.status = PlayerStatus::Sitting;
                seat.current_bet = 0;
                seat.total_bet_this_hand = 0;
                seat.hole_card_1 = 255;
                seat.hole_card_2 = 255;
                seat.revealed_card_1 = 255;
                seat.revealed_card_2 = 255;
                seat.cards_revealed = false;
                seat.has_acted = false;
                seat.try_serialize(&mut *data)?;
            }
        }
    }

    // Mark hand as settled
    hand_state.phase = GamePhase::Settled;
    hand_state.pot = 0;

    // Return table to waiting state
    table.status = TableStatus::Waiting;
    table.last_ready_time = clock.unix_timestamp;

    msg!("Hand #{} complete", hand_state.hand_number);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_side_pots_basic() {
        // 3 players: A(100, folded), B(300, active), C(500, active)
        let bets = vec![(0u8, 100u64, false), (1, 300, true), (2, 500, true)];
        let pots = calculate_side_pots(&bets);

        assert_eq!(pots.len(), 3);

        // Main pot: 100 * 3 = 300, eligible: B, C
        assert_eq!(pots[0].amount, 300);
        assert_eq!(pots[0].eligible, vec![1, 2]);

        // Side pot 1: 200 * 2 = 400, eligible: B, C
        assert_eq!(pots[1].amount, 400);
        assert_eq!(pots[1].eligible, vec![1, 2]);

        // Side pot 2: 200 * 1 = 200, eligible: C only
        assert_eq!(pots[2].amount, 200);
        assert_eq!(pots[2].eligible, vec![2]);

        // Total should equal sum of all bets
        let total: u64 = pots.iter().map(|p| p.amount).sum();
        assert_eq!(total, 900);
    }

    #[test]
    fn test_side_pots_equal_bets() {
        // All players bet the same: no side pots needed
        let bets = vec![(0u8, 200u64, true), (1, 200, true), (2, 200, true)];
        let pots = calculate_side_pots(&bets);

        assert_eq!(pots.len(), 1);
        assert_eq!(pots[0].amount, 600);
        assert_eq!(pots[0].eligible, vec![0, 1, 2]);
    }

    #[test]
    fn test_side_pots_heads_up() {
        // 2 players, different bets
        let bets = vec![(0u8, 100u64, true), (1, 300, true)];
        let pots = calculate_side_pots(&bets);

        assert_eq!(pots.len(), 2);
        // Main: 100 * 2 = 200
        assert_eq!(pots[0].amount, 200);
        assert_eq!(pots[0].eligible, vec![0, 1]);
        // Excess: 200 * 1 = 200 (returned to player 1)
        assert_eq!(pots[1].amount, 200);
        assert_eq!(pots[1].eligible, vec![1]);
    }

    #[test]
    fn test_side_pots_three_way_all_in() {
        // Classic 3-way all-in with different stacks
        // A: 100, B: 300, C: 500 (all active)
        let bets = vec![(0u8, 100u64, true), (1, 300, true), (2, 500, true)];
        let pots = calculate_side_pots(&bets);

        assert_eq!(pots.len(), 3);

        // Main pot: 100 * 3 = 300, all eligible
        assert_eq!(pots[0].amount, 300);
        assert_eq!(pots[0].eligible, vec![0, 1, 2]);

        // Side pot 1: 200 * 2 = 400, B and C
        assert_eq!(pots[1].amount, 400);
        assert_eq!(pots[1].eligible, vec![1, 2]);

        // Side pot 2: 200 * 1 = 200, C only
        assert_eq!(pots[2].amount, 200);
        assert_eq!(pots[2].eligible, vec![2]);

        let total: u64 = pots.iter().map(|p| p.amount).sum();
        assert_eq!(total, 900);
    }

    #[test]
    fn test_side_pots_with_multiple_folds() {
        // A folds at 50, B folds at 100, C all-in 200, D all-in 500
        let bets = vec![
            (0u8, 50u64, false),  // A folded
            (1, 100, false),      // B folded
            (2, 200, true),       // C active
            (3, 500, true),       // D active
        ];
        let pots = calculate_side_pots(&bets);

        // Level 50: 50 * 4 = 200, eligible active: C, D
        assert_eq!(pots[0].amount, 200);
        assert_eq!(pots[0].eligible, vec![2, 3]);

        // Level 100: 50 * 3 = 150, eligible active: C, D
        assert_eq!(pots[1].amount, 150);
        assert_eq!(pots[1].eligible, vec![2, 3]);

        // Level 200: 100 * 2 = 200, eligible active: C, D
        assert_eq!(pots[2].amount, 200);
        assert_eq!(pots[2].eligible, vec![2, 3]);

        // Level 500: 300 * 1 = 300, eligible active: D only
        assert_eq!(pots[3].amount, 300);
        assert_eq!(pots[3].eligible, vec![3]);

        let total: u64 = pots.iter().map(|p| p.amount).sum();
        assert_eq!(total, 850); // 50 + 100 + 200 + 500
    }

    #[test]
    fn test_side_pots_duplicate_bets() {
        // Two players with same bet amount
        let bets = vec![
            (0u8, 100u64, true),
            (1, 100, true),
            (2, 300, true),
        ];
        let pots = calculate_side_pots(&bets);

        assert_eq!(pots.len(), 2);
        // Level 100: 100 * 3 = 300
        assert_eq!(pots[0].amount, 300);
        assert_eq!(pots[0].eligible, vec![0, 1, 2]);
        // Level 300: 200 * 1 = 200
        assert_eq!(pots[1].amount, 200);
        assert_eq!(pots[1].eligible, vec![2]);
    }
}
