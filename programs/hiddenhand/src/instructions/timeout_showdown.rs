//! Showdown / community-reveal AFK recovery (emergency abort).
//!
//! A hand can get permanently stuck if the MPC reveal for a multiway showdown (or
//! a community street) never completes: `showdown` reverts with `PlayersNotRevealed`
//! and — because `leave_table` correctly forbids exiting mid-hand — every player's
//! stake is then locked in the vault. `showdown_reveal` / `reveal_*` are re-queueable,
//! so this only happens under a sustained MPC-network failure; this instruction is
//! the last-resort backstop for it.
//!
//! `timeout_showdown` lets ANYONE, after `REVEAL_TIMEOUT_SECONDS` of no progress,
//! ABORT such a stuck hand: every seat's stake this hand is refunded to its chip
//! stack, seats reset, and the table returned to `Waiting`. Because a stuck reveal
//! means the hands can't be evaluated fairly, the only safe resolution is to refund
//! everyone (no player is advantaged) — the same approach as `timeout_deal`.
//!
//! Guards that keep this from being abused:
//!  - `active_count > 1`: a lone winner is always payable via `showdown`, never stuck.
//!  - In the `Showdown` phase, at least one active player must still be UNREVEALED —
//!    if everyone has revealed, the hand is settleable via `showdown`, so a losing
//!    player must not be able to force a refund instead of taking the loss.
//!  - Refund completeness (`refunded_total == pot`) + per-seat de-duplication, so no
//!    stake can be destroyed or double-credited (mirrors `timeout_deal`).
//!
//! Pass every seat that staked into this hand as `remaining_accounts` (any order).

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::HandAborted;
use crate::state::{GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

/// Validate a remaining account is a genuine PlayerSeat PDA of this table.
fn validate_seat_account(
    account_info: &AccountInfo,
    table_key: &Pubkey,
    program_id: &Pubkey,
) -> Option<PlayerSeat> {
    if account_info.owner != program_id {
        return None;
    }
    let data = account_info.try_borrow_data().ok()?;
    if data.len() < 8 {
        return None;
    }
    let seat = PlayerSeat::try_deserialize(&mut &data[..]).ok()?;
    if seat.table != *table_key {
        return None;
    }
    let (expected_pda, _) = Pubkey::find_program_address(
        &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
        program_id,
    );
    if *account_info.key != expected_pda {
        return None;
    }
    Some(seat)
}

pub fn handler(ctx: Context<TimeoutShowdown>) -> Result<()> {
    let clock = Clock::get()?;
    let program_id = crate::ID;
    let table_key = ctx.accounts.table.key();

    require!(
        ctx.accounts.table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );

    // Only a hand stuck at the final showdown reveal, or waiting on a community-card
    // reveal that never landed, is abortable here. Betting-phase stalls are handled
    // by `timeout_player`; the Dealing stall by `timeout_deal`.
    let phase = ctx.accounts.hand_state.phase;
    let awaiting = ctx.accounts.hand_state.awaiting_community_reveal;
    require!(
        phase == GamePhase::Showdown || awaiting,
        HiddenHandError::InvalidPhase
    );

    // A single remaining player is always paid immediately by `showdown` (no reveal
    // needed), so such a hand is never genuinely stuck.
    require!(
        ctx.accounts.hand_state.active_count > 1,
        HiddenHandError::ShowdownRequiresPlayers
    );

    let elapsed = clock.unix_timestamp - ctx.accounts.hand_state.last_action_time;
    require!(
        elapsed >= REVEAL_TIMEOUT_SECONDS,
        HiddenHandError::TimeoutNotReached
    );

    // Snapshot the fields we need so the seat loop doesn't borrow hand_state.
    let active_players = ctx.accounts.hand_state.active_players;
    let pot = ctx.accounts.hand_state.pot;

    // Refund + reset every staked seat; along the way verify (a) no duplicate seat,
    // (b) which active seats are present, and (c) whether any active seat is still
    // unrevealed (i.e. the showdown genuinely can't be settled).
    let mut seen_seats: u8 = 0;
    let mut refunded_total: u64 = 0;
    let mut present_active_bits: u8 = 0;
    let mut any_active_unrevealed = false;
    for account_info in ctx.remaining_accounts.iter() {
        if let Some(validated) = validate_seat_account(account_info, &table_key, &program_id) {
            let bit = 1u8 << validated.seat_index;
            if seen_seats & bit != 0 {
                return Err(HiddenHandError::DuplicateAccount.into());
            }
            seen_seats |= bit;

            if active_players & bit != 0 {
                present_active_bits |= bit;
                if !validated.cards_revealed {
                    any_active_unrevealed = true;
                }
            }

            let mut data = account_info.try_borrow_mut_data()?;
            if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                refunded_total = refunded_total.saturating_add(seat.total_bet_this_hand);
                seat.chips = seat.chips.saturating_add(seat.total_bet_this_hand);
                seat.current_bet = 0;
                seat.total_bet_this_hand = 0;
                seat.revealed_card_1 = 255;
                seat.revealed_card_2 = 255;
                seat.cards_revealed = false;
                seat.has_acted = false;
                seat.status = PlayerStatus::Sitting;
                seat.try_serialize(&mut *data)?;
            }
        }
    }

    // Every active seat must be present (so the "is it stuck" check below is sound)
    // and every staked seat must be refunded before the pot is zeroed.
    require!(
        present_active_bits == active_players,
        HiddenHandError::IncompletePlayerAccounts
    );
    require!(
        refunded_total == pot,
        HiddenHandError::IncompletePlayerAccounts
    );

    // In the Showdown phase, if every active player has already revealed, `showdown`
    // can settle the hand normally — refuse to abort so a losing player can't dodge
    // a decided showdown by forcing a refund. (In the awaiting-community-reveal case
    // the blocker is the community card, so this check does not apply.)
    if phase == GamePhase::Showdown {
        require!(any_active_unrevealed, HiddenHandError::HandNotStuck);
    }

    let hand_state = &mut ctx.accounts.hand_state;
    hand_state.phase = GamePhase::Settled;
    hand_state.pot = 0;
    hand_state.awaiting_community_reveal = false;
    hand_state.last_action_time = clock.unix_timestamp;

    let table = &mut ctx.accounts.table;
    table.status = TableStatus::Waiting;
    table.last_ready_time = clock.unix_timestamp;

    emit!(HandAborted {
        table_id: table.table_id,
        hand_number: hand_state.hand_number,
        reason: 1, // reveal stall
        refunded_total,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Hand #{} force-aborted after {}s stuck at reveal/showdown; all stakes refunded, table ready for a new hand.",
        hand_state.hand_number,
        elapsed
    );

    Ok(())
}

#[derive(Accounts)]
pub struct TimeoutShowdown<'info> {
    /// Anyone can call once the reveal timeout has elapsed.
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
    // remaining_accounts: every seat that staked into this hand (to refund + reset).
}
