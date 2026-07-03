//! Deal-phase AFK recovery.
//!
//! Under Arcium MPC each seated player must run `deal_to_seat` themselves (their
//! hole cards seal to a key only they hold), so nobody can deal for an AFK
//! player. If a player never deals in, `dealt_players` never reaches
//! `active_players` and the hand is stuck in `Dealing` forever.
//!
//! `timeout_deal` lets ANYONE, after `DEAL_TIMEOUT_SECONDS` of no progress,
//! cleanly ABORT such a stuck hand: any blinds that were posted (during the
//! deals that did happen) are refunded, seats reset, and the table returned to
//! `Waiting` so a fresh hand can be started. Aborting (vs. proceeding with a
//! partial table) avoids blind/fairness edge cases and is the correct call for a
//! hand that never finished dealing.
//!
//! Pass every occupied `PlayerSeat` account as `remaining_accounts` (any order)
//! so their blinds can be refunded and their per-hand state reset.

use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HiddenHandError;
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
    let (expected_pda, _) =
        Pubkey::find_program_address(&[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]], program_id);
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
    // Only the deal-in stall (deck already shuffled, still in Dealing). The
    // pre-shuffle stall is handled by the shuffle/start-hand timeouts. Once every
    // seat has dealt in, the program advances to PreFlop, so phase == Dealing
    // here already implies at least one seat is still undealt.
    require!(
        ctx.accounts.hand_state.phase == GamePhase::Dealing,
        HiddenHandError::InvalidPhase
    );
    require!(
        ctx.accounts.deck_state.is_shuffled,
        HiddenHandError::DeckNotShuffled
    );
    let elapsed = clock.unix_timestamp - ctx.accounts.hand_state.last_action_time;
    require!(
        elapsed >= DEAL_TIMEOUT_SECONDS,
        HiddenHandError::TimeoutNotReached
    );

    // Abort: refund any posted blinds and reset every seat to Sitting.
    for account_info in ctx.remaining_accounts.iter() {
        if validate_seat_account(account_info, &table_key, &program_id).is_some() {
            let mut data = account_info.try_borrow_mut_data()?;
            if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &data[..]) {
                // Refund whatever this seat put in this hand (blinds posted during
                // deal_to_seat). Undealt seats posted nothing, so this is a no-op.
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

    let hand_state = &mut ctx.accounts.hand_state;
    hand_state.phase = GamePhase::Settled;
    hand_state.pot = 0;
    hand_state.last_action_time = clock.unix_timestamp;

    let table = &mut ctx.accounts.table;
    table.status = TableStatus::Waiting;
    table.last_ready_time = clock.unix_timestamp;

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
}
