//! Deal-phase AFK recovery.
//!
//! Covers both Dealing stalls:
//! - the shuffle MPC never committed (`!deck_state.is_shuffled`)
//! - a seated player never ran `deal_to_seat` (shuffle committed, blinds may
//!   have been posted)
//!
//! Under Arcium MPC each seated player must run `deal_to_seat` themselves (their
//! hole cards seal to a key only they hold), so nobody can deal for an AFK
//! player. If shuffle never lands, or a player never deals in, the hand is stuck
//! in `Dealing` with `table.status = Playing` and no leave/close path.
//!
//! `timeout_deal` lets ANYONE, after `DEAL_TIMEOUT_SECONDS` of no progress,
//! cleanly ABORT such a stuck hand: any blinds that were posted (during the
//! deals that did happen) are refunded, seats reset, and the table returned to
//! `Waiting` so a fresh hand can be started. Aborting (vs. proceeding with a
//! partial table) avoids blind/fairness edge cases and is the correct call for a
//! hand that never finished dealing.
//!
//! Pass every occupied `PlayerSeat` account as `remaining_accounts` (any order)
//! so their blinds can be refunded and their per-hand state reset. When the
//! stall is pre-shuffle the pot is still 0, so an empty remaining set is valid.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::HandAborted;
use crate::state::{DeckState, GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

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

pub fn handler(ctx: Context<TimeoutDeal>) -> Result<()> {
    let clock = Clock::get()?;
    let program_id = crate::ID;
    let table_key = ctx.accounts.table.key();

    require!(
        ctx.accounts.table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );
    // Dealing-phase stall: either the shuffle MPC never committed the deck, or a
    // seated player never ran deal_to_seat. There is no separate shuffle-abort
    // instruction — both cases leave the table `Playing` with no leave/close
    // path, so this is the permissionless refund. Once every seat has dealt in,
    // the program advances to PreFlop, so phase == Dealing already implies the
    // hand never opened betting.
    require!(
        ctx.accounts.hand_state.phase == GamePhase::Dealing,
        HiddenHandError::InvalidPhase
    );
    let elapsed = clock.unix_timestamp - ctx.accounts.hand_state.last_action_time;
    require!(
        dealing_hand_is_abortable(ctx.accounts.hand_state.phase, elapsed, DEAL_TIMEOUT_SECONDS),
        HiddenHandError::TimeoutNotReached
    );

    // Abort: refund any posted blinds and reset every seat to Sitting.
    // M-1 fix: the refund set is caller-supplied, so we must (a) reject duplicate
    // seats — otherwise one seat could be refunded twice to fake the total — and
    // (b) require that the refunded stake equals the pot, so no seat that posted a
    // blind can be omitted and have its funds permanently destroyed when the pot
    // is zeroed below.
    let mut seen_seats: u8 = 0;
    let mut refunded_total: u64 = 0;
    for account_info in ctx.remaining_accounts.iter() {
        if let Some(validated) = validate_seat_account(account_info, &table_key, &program_id) {
            let bit = 1u8 << validated.seat_index;
            if seen_seats & bit != 0 {
                return Err(HiddenHandError::DuplicateAccount.into());
            }
            seen_seats |= bit;

            let mut data = account_info.try_borrow_mut_data()?;
            if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                // Refund whatever this seat put in this hand (blinds posted during
                // deal_to_seat). Undealt seats posted nothing, so this is a no-op.
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

    // Every seat that staked into this hand must have been refunded before we zero
    // the pot, or those tokens would be stranded in the vault forever.
    require!(
        refunded_total == ctx.accounts.hand_state.pot,
        HiddenHandError::IncompletePlayerAccounts
    );

    let hand_state = &mut ctx.accounts.hand_state;
    hand_state.phase = GamePhase::Settled;
    hand_state.pot = 0;
    hand_state.last_action_time = clock.unix_timestamp;

    let table = &mut ctx.accounts.table;
    table.status = TableStatus::Waiting;
    table.last_ready_time = clock.unix_timestamp;

    emit!(HandAborted {
        table_id: table.table_id,
        hand_number: hand_state.hand_number,
        reason: 0, // dealing stall (shuffle never landed, or a seat never dealt in)
        refunded_total,
        timestamp: clock.unix_timestamp,
    });

    msg!(
        "Hand #{} aborted after {}s: a seated player never dealt in. Blinds refunded, table ready for a new hand.",
        hand_state.hand_number,
        elapsed
    );

    Ok(())
}

#[derive(Accounts)]
pub struct TimeoutDeal<'info> {
    /// Anyone can call once the deal timeout has elapsed.
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

    #[account(
        seeds = [DECK_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = deck_state.bump
    )]
    pub deck_state: Account<'info, DeckState>,
    // remaining_accounts: every occupied PlayerSeat (to refund blinds + reset).
    // Pre-shuffle abort has pot == 0, so an empty set is complete.
}

/// Dealing-phase abort is allowed once the timeout elapses, whether or not
/// the shuffle callback has landed. PreFlop+ is a different backstop.
pub fn dealing_hand_is_abortable(phase: GamePhase, elapsed: i64, timeout: i64) -> bool {
    phase == GamePhase::Dealing && elapsed >= timeout
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abort_allowed_before_shuffle_once_timeout_elapses() {
        assert!(dealing_hand_is_abortable(
            GamePhase::Dealing,
            DEAL_TIMEOUT_SECONDS,
            DEAL_TIMEOUT_SECONDS
        ));
        assert!(!dealing_hand_is_abortable(
            GamePhase::Dealing,
            DEAL_TIMEOUT_SECONDS - 1,
            DEAL_TIMEOUT_SECONDS
        ));
    }

    #[test]
    fn abort_rejected_once_betting_has_opened() {
        assert!(!dealing_hand_is_abortable(
            GamePhase::PreFlop,
            DEAL_TIMEOUT_SECONDS * 4,
            DEAL_TIMEOUT_SECONDS
        ));
        assert!(!dealing_hand_is_abortable(
            GamePhase::Showdown,
            DEAL_TIMEOUT_SECONDS * 4,
            DEAL_TIMEOUT_SECONDS
        ));
    }
}
