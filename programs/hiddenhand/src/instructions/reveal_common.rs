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
use crate::state::{GamePhase, HandState, Table, TableStatus};

/// Authority may reveal immediately; anyone else must wait for the AFK timeout.
/// Mirrors the old `reveal_community` auth check.
pub fn authorize_reveal(
    table: &Account<Table>,
    hand_state: &HandState,
    caller: &Signer,
) -> Result<()> {
    require!(
        table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );

    let is_authority = table.authority == caller.key();
    if !is_authority {
        let clock = Clock::get()?;
        let elapsed = clock.unix_timestamp - hand_state.last_action_time;
        require!(
            elapsed >= ALLOWANCE_TIMEOUT_SECONDS,
            HiddenHandError::TimeoutNotReached
        );
        msg!("Non-authority revealing community cards after {} seconds", elapsed);
    }
    Ok(())
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
