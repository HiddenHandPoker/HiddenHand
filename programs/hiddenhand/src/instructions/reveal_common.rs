//! Shared helpers for the three MPC community-reveal instructions
//! (`reveal_flop`, `reveal_turn`, `reveal_river`).
//!
//! These reproduce the exact authorization + phase-transition behavior of the
//! retired Ed25519 `reveal_community` instruction, so the untouched
//! `player_action` betting flow (which sets `awaiting_community_reveal` and
//! expects a reveal to advance the phase) keeps working.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::CommunityCardsRevealed;
use crate::state::{GamePhase, HandState, PlayerSeat, Table, TableStatus};

fn parsed_seat_matches(
    signer: &Pubkey,
    table_key: &Pubkey,
    program_id: &Pubkey,
    account_key: &Pubkey,
    seat: &PlayerSeat,
) -> bool {
    if seat.table != *table_key || seat.player != *signer {
        return false;
    }
    let (expected, _) = Pubkey::find_program_address(
        &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
        program_id,
    );
    expected == *account_key
}

/// PDA + player + table checks extracted from `signer_is_seated` so unit tests
/// do not need live `AccountInfo`.
pub fn signer_is_seated_from_parsed(
    signer: &Pubkey,
    table_key: &Pubkey,
    remaining: &[(Pubkey, PlayerSeat)],
    program_id: &Pubkey,
) -> bool {
    remaining
        .iter()
        .any(|(key, seat)| parsed_seat_matches(signer, table_key, program_id, key, seat))
}

/// True if `signer` occupies a valid `PlayerSeat` PDA in `remaining`.
pub fn signer_is_seated(
    signer: &Pubkey,
    table_key: &Pubkey,
    remaining: &[AccountInfo],
    program_id: &Pubkey,
) -> bool {
    remaining.iter().any(|ai| {
        if ai.owner != program_id {
            return false;
        }
        let Ok(data) = ai.try_borrow_data() else {
            return false;
        };
        let Ok(seat) = PlayerSeat::try_deserialize(&mut &data[..]) else {
            return false;
        };
        parsed_seat_matches(signer, table_key, program_id, ai.key, &seat)
    })
}

/// Authority and seated players may reveal immediately; anyone else must wait
/// for the AFK timeout. Occupied seats are passed as remaining accounts
/// (readonly) — not as circuit callback accounts.
pub fn authorize_reveal(
    table: &Account<Table>,
    hand_state: &HandState,
    caller: &Signer,
    remaining: &[AccountInfo],
    program_id: &Pubkey,
) -> Result<()> {
    require!(
        table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );

    let is_authority = table.authority == caller.key();
    let seated = signer_is_seated(&caller.key(), &table.key(), remaining, program_id);
    if !(is_authority || seated) {
        let clock = Clock::get()?;
        let elapsed = clock.unix_timestamp - hand_state.last_action_time;
        require!(
            elapsed >= ALLOWANCE_TIMEOUT_SECONDS,
            HiddenHandError::TimeoutNotReached
        );
        msg!(
            "Non-authority revealing community cards after {} seconds",
            elapsed
        );
    }
    Ok(())
}

/// Target `community_revealed` counts written by each street callback.
pub const FLOP_REVEALED: u8 = 3;
pub const TURN_REVEALED: u8 = 4;
pub const RIVER_REVEALED: u8 = 5;

/// H-2 equivalent for community streets: a duplicate callback must not rewind
/// the phase machine once this street's cards are already committed.
pub fn community_already_committed(community_revealed: u8, target: u8) -> bool {
    community_revealed >= target
}

/// After the callback writes the revealed plaintext cards, advance the phase.
///
/// `new_phase` is the street this reveal opens (Flop/Turn/River). If no one can
/// bet (all-in runout) we keep `awaiting_community_reveal = true` so the frontend
/// can immediately request the next street; otherwise we clear it and open the
/// new betting round. Once the River is revealed we move straight to Showdown.
pub fn community_reset_and_advance(
    table: &Account<Table>,
    hand_state: &mut HandState,
    new_phase: GamePhase,
    revealed_cards: Vec<u8>,
) -> Result<()> {
    let clock = Clock::get()?;
    let all_in_runout = !hand_state.can_anyone_bet();

    if new_phase == GamePhase::River && all_in_runout {
        // River is the last street — nothing left to bet, go to showdown.
        hand_state.phase = GamePhase::Showdown;
        hand_state.awaiting_community_reveal = false;
    } else if all_in_runout {
        // More streets to run out; stay in reveal mode so the next reveal can fire.
        hand_state.phase = new_phase;
        hand_state.awaiting_community_reveal = true;
    } else {
        // Normal path: open a fresh betting round on the new street.
        hand_state.phase = new_phase;
        hand_state.reset_betting_round();
        hand_state.action_on = first_active_left_of_dealer(hand_state, table.max_players);
        hand_state.awaiting_community_reveal = false;
    }

    hand_state.last_action_time = clock.unix_timestamp;

    let action_on_val = if hand_state.phase == GamePhase::Showdown {
        255u8
    } else {
        hand_state.action_on
    };

    emit!(CommunityCardsRevealed {
        table_id: table.table_id,
        hand_number: hand_state.hand_number,
        new_phase: hand_state.phase as u8,
        cards: revealed_cards,
        timestamp: clock.unix_timestamp,
        action_on: action_on_val,
    });
    Ok(())
}

/// First active (non-all-in) player left of the dealer — post-flop betting order.
fn first_active_left_of_dealer(hand_state: &HandState, max_players: u8) -> u8 {
    let dealer = hand_state.dealer_position;
    let mut pos = (dealer + 1) % max_players;
    for _ in 0..max_players {
        if hand_state.is_player_active(pos) && !hand_state.is_player_all_in(pos) {
            return pos;
        }
        pos = (pos + 1) % max_players;
    }
    // Fallback: first active player even if all-in.
    pos = (dealer + 1) % max_players;
    for _ in 0..max_players {
        if hand_state.is_player_active(pos) {
            return pos;
        }
        pos = (pos + 1) % max_players;
    }
    dealer
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duplicate_flop_is_noop_once_three_cards_committed() {
        assert!(!community_already_committed(0, FLOP_REVEALED));
        assert!(!community_already_committed(2, FLOP_REVEALED));
        assert!(community_already_committed(3, FLOP_REVEALED));
        assert!(community_already_committed(4, FLOP_REVEALED));
        assert!(community_already_committed(5, FLOP_REVEALED));
    }

    #[test]
    fn duplicate_turn_is_noop_once_four_cards_committed() {
        assert!(!community_already_committed(3, TURN_REVEALED));
        assert!(community_already_committed(4, TURN_REVEALED));
        assert!(community_already_committed(5, TURN_REVEALED));
    }

    #[test]
    fn duplicate_river_is_noop_once_five_cards_committed() {
        assert!(!community_already_committed(4, RIVER_REVEALED));
        assert!(community_already_committed(5, RIVER_REVEALED));
    }

    fn sample_seat(table: Pubkey, player: Pubkey, seat_index: u8) -> PlayerSeat {
        PlayerSeat {
            table,
            player,
            seat_index,
            chips: 100,
            current_bet: 0,
            total_bet_this_hand: 0,
            revealed_card_1: 255,
            revealed_card_2: 255,
            cards_revealed: false,
            status: crate::state::PlayerStatus::Sitting,
            has_acted: false,
            bump: 0,
        }
    }

    fn seat_pda(table: &Pubkey, seat_index: u8) -> Pubkey {
        Pubkey::find_program_address(&[SEAT_SEED, table.as_ref(), &[seat_index]], &crate::ID).0
    }

    #[test]
    fn signer_is_seated_matching_player_and_pda() {
        let table = Pubkey::new_unique();
        let player = Pubkey::new_unique();
        let seat = sample_seat(table, player, 2);
        let key = seat_pda(&table, 2);
        assert!(signer_is_seated_from_parsed(
            &player,
            &table,
            &[(key, seat)],
            &crate::ID
        ));
    }

    #[test]
    fn signer_is_seated_wrong_player() {
        let table = Pubkey::new_unique();
        let player = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        let seat = sample_seat(table, player, 1);
        let key = seat_pda(&table, 1);
        assert!(!signer_is_seated_from_parsed(
            &other,
            &table,
            &[(key, seat)],
            &crate::ID
        ));
    }

    #[test]
    fn signer_is_seated_wrong_table() {
        let table = Pubkey::new_unique();
        let other_table = Pubkey::new_unique();
        let player = Pubkey::new_unique();
        let seat = sample_seat(other_table, player, 0);
        let key = seat_pda(&table, 0);
        assert!(!signer_is_seated_from_parsed(
            &player,
            &table,
            &[(key, seat)],
            &crate::ID
        ));
    }

    #[test]
    fn signer_is_seated_duplicate_ignored() {
        let table = Pubkey::new_unique();
        let player = Pubkey::new_unique();
        let other = Pubkey::new_unique();
        let matching = sample_seat(table, player, 0);
        let matching_dup = sample_seat(table, player, 0);
        let extra = sample_seat(table, other, 1);
        let key0 = seat_pda(&table, 0);
        let key1 = seat_pda(&table, 1);
        assert!(signer_is_seated_from_parsed(
            &player,
            &table,
            &[(key0, matching), (key0, matching_dup), (key1, extra)],
            &crate::ID
        ));
    }
}
