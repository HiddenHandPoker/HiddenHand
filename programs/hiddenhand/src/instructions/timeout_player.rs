use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::ActionTaken;
use crate::state::{DeckState, GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

/// Timeout a player who hasn't acted within the time limit
/// Anyone can call this - not just the authority
/// This prevents games from getting stuck when a player goes AFK
#[derive(Accounts)]
pub struct TimeoutPlayer<'info> {
    /// Anyone can trigger a timeout (doesn't need to be authority or the timed-out player)
    pub caller: Signer<'info>,

    #[account(
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

    /// The seat of the player being timed out
    #[account(
        mut,
        seeds = [SEAT_SEED, table.key().as_ref(), &[player_seat.seat_index]],
        bump = player_seat.bump
    )]
    pub player_seat: Account<'info, PlayerSeat>,
}

/// Timeout a player who hasn't acted in time
/// Auto-checks if no bet to call, otherwise auto-folds
pub fn handler(ctx: Context<TimeoutPlayer>) -> Result<()> {
    let table = &ctx.accounts.table;
    let hand_state = &mut ctx.accounts.hand_state;
    let deck_state = &ctx.accounts.deck_state;
    let player_seat = &mut ctx.accounts.player_seat;
    let clock = Clock::get()?;
    let phase_num = hand_state.phase as u8;

    // Validate game is in progress
    require!(
        table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );

    // Validate we're in a betting phase
    require!(
        matches!(
            hand_state.phase,
            GamePhase::PreFlop | GamePhase::Flop | GamePhase::Turn | GamePhase::River
        ),
        HiddenHandError::InvalidPhase
    );

    // Validate it's this player's turn
    require!(
        hand_state.action_on == player_seat.seat_index,
        HiddenHandError::NotPlayersTurn
    );

    // Validate player is active and can act
    require!(
        hand_state.is_player_active(player_seat.seat_index),
        HiddenHandError::PlayerFolded
    );

    require!(
        player_seat.status == PlayerStatus::Playing,
        HiddenHandError::InvalidAction
    );

    // Check timeout has elapsed (60 seconds)
    let current_time = clock.unix_timestamp;
    let elapsed = current_time - hand_state.last_action_time;

    require!(
        elapsed >= ACTION_TIMEOUT_SECONDS,
        HiddenHandError::ActionNotTimedOut
    );

    msg!(
        "Player at seat {} timed out after {} seconds",
        player_seat.seat_index,
        elapsed
    );

    // Determine action: Check if possible, otherwise Fold
    let can_check = player_seat.current_bet >= hand_state.current_bet;

    if can_check {
        // Auto-CHECK - player doesn't lose anything
        msg!("Auto-CHECK for timed out player");

        // Mark as acted
        hand_state.mark_acted(player_seat.seat_index);
        player_seat.has_acted = true;
    } else {
        // Auto-FOLD - player forfeits hand but keeps remaining chips
        msg!(
            "Auto-FOLD for timed out player (had {} chips, bet was {})",
            player_seat.chips,
            hand_state.current_bet
        );

        // Fold the player
        hand_state.fold_player(player_seat.seat_index);
        player_seat.status = PlayerStatus::Folded;
    }

    // Update timestamp for next action
    hand_state.last_action_time = current_time;
    let action_type_num: u8 = if can_check { 6 } else { 5 };

    // Check if only one player remains (winner by default)
    if hand_state.active_count == 1 {
        hand_state.phase = GamePhase::Showdown;
        msg!("Only one player remains - advancing to showdown");

        emit!(ActionTaken {
            table_id: table.table_id,
            hand_number: hand_state.hand_number,
            seat_index: player_seat.seat_index,
            action_type: action_type_num,
            amount: 0,
            pot_after: hand_state.pot,
            phase: phase_num,
            timestamp: current_time,
            next_action_on: 255,
        });

        return Ok(());
    }

    // Find next active player
    let next_player = hand_state.next_active_player(player_seat.seat_index, table.max_players);

    if let Some(next) = next_player {
        // Skip all-in players
        let mut action_seat = next;
        for _ in 0..table.max_players {
            if !hand_state.is_player_all_in(action_seat) {
                break;
            }
            if let Some(n) = hand_state.next_active_player(action_seat, table.max_players) {
                action_seat = n;
            } else {
                break;
            }
        }
        hand_state.action_on = action_seat;
    }

    // Check if betting round is complete
    if hand_state.is_betting_complete() || !hand_state.can_anyone_bet() {
        msg!("Betting round complete, advancing phase");

        // Check if any more betting is possible
        if hand_state.can_anyone_bet() {
            // Normal phase advancement with card reveal
            advance_phase_with_cards(hand_state, deck_state, table.max_players);
        } else {
            // All remaining players are all-in - run out to showdown
            run_out_to_showdown(hand_state, deck_state);
        }
    }

    msg!(
        "Timeout processed. Action now on seat {}. Phase: {:?}",
        hand_state.action_on,
        hand_state.phase
    );

    let next_action_on = if matches!(hand_state.phase, GamePhase::Settled | GamePhase::Showdown)
        || hand_state.awaiting_community_reveal
    {
        255u8
    } else {
        hand_state.action_on
    };

    emit!(ActionTaken {
        table_id: table.table_id,
        hand_number: hand_state.hand_number,
        seat_index: player_seat.seat_index,
        action_type: action_type_num,
        amount: 0,
        pot_after: hand_state.pot,
        phase: phase_num,
        timestamp: current_time,
        next_action_on,
    });

    Ok(())
}

/// Advance to next phase after betting round completes.
/// Community cards are encrypted in deck_state — we cannot extract them directly.
/// Instead, signal that reveal_community must be called (with Ed25519 verification).
fn advance_phase_with_cards(hand_state: &mut HandState, _deck_state: &DeckState, _max_players: u8) {
    match hand_state.phase {
        GamePhase::PreFlop | GamePhase::Flop | GamePhase::Turn => {
            hand_state.awaiting_community_reveal = true;
            msg!("Betting round complete after timeout - awaiting community card reveal");
        }
        GamePhase::River => {
            hand_state.phase = GamePhase::Showdown;
            msg!("Advancing to Showdown");
        }
        _ => {}
    }
}

/// Run out to showdown when no more betting is possible (all players all-in).
/// Community cards are encrypted — signal reveal_community to handle decryption.
fn run_out_to_showdown(hand_state: &mut HandState, _deck_state: &DeckState) {
    if hand_state.phase == GamePhase::River {
        // All community cards already revealed, go directly to showdown
        hand_state.phase = GamePhase::Showdown;
        msg!("Advancing to Showdown - all community cards already revealed");
    } else {
        // Need community cards revealed via Ed25519-verified reveal_community
        hand_state.awaiting_community_reveal = true;
        msg!("All players all-in after timeout - awaiting community card reveal for runout");
    }
}
