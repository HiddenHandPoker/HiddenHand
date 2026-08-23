//! MPC deal — Arcium circuit `deal_to_seat`.
//!
//! Deals ONE seat's two hole cards from the persisted MXE deck, sealed to that
//! seat's client x25519 key. Called once per seated player. `seat_index` is public
//! (which deck positions to read: 2i, 2i+1); the card *values* stay secret. The
//! callback emits a single `HoleDealt` event that the caller decrypts with their
//! own key. The deck is unchanged, so it is not re-persisted.
//!
//! Blind posting and the Dealing→PreFlop transition run in the **callback**,
//! after MPC succeeds. Queue time only sets `deal_queued` so a failed computation
//! does not open betting or lock the seat without cards.

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::circuit_hash;

use crate::ArciumSignerAccount;
use crate::{ID, ID_CONST};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::HandStarted;
use crate::state::{DeckState, GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

pub const COMP_DEF_OFFSET_DEAL_TO_SEAT: u32 = comp_def_offset("deal_to_seat");

const URL_DEAL_TO_SEAT: &str =
    "https://raw.githubusercontent.com/criptocbas/hiddenhand-arcium-circuit/main/deal_to_seat.arcis";

// DeckState layout: [8 discriminator][64 deck][16 deck_nonce][...]. deck is the
// first field, so the ciphertext lives at byte offset 8 for the `.account()` re-feed.
const DECK_OFFSET: u32 = 8;
const DECK_LEN: u32 = 32 * 2;

pub fn init_deal_to_seat_comp_def(ctx: Context<InitDealToSeatCompDef>) -> Result<()> {
    init_computation_def(
        ctx.accounts,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: URL_DEAL_TO_SEAT.to_string(),
            hash: circuit_hash!("deal_to_seat"),
        })),
    )?;
    Ok(())
}

pub fn handler(
    ctx: Context<DealToSeat>,
    computation_offset: u64,
    seat_index: u8,
    seat_pubkey: [u8; 32],
    seat_nonce: u128,
) -> Result<()> {
    require!(
        ctx.accounts.table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );
    require!(
        ctx.accounts.hand_state.phase == GamePhase::Dealing,
        HiddenHandError::InvalidPhase
    );
    require!(
        ctx.accounts.deck_state.is_shuffled,
        HiddenHandError::DeckNotShuffled
    );
    require!(
        ctx.accounts.player_seat.seat_index == seat_index,
        HiddenHandError::InvalidSeat
    );
    // This seat must be one dealt into the hand and not yet queued.
    require!(
        ctx.accounts.hand_state.is_player_active(seat_index),
        HiddenHandError::PlayerNotInHand
    );
    require!(
        (ctx.accounts.hand_state.deal_queued & (1 << seat_index)) == 0,
        HiddenHandError::AlreadyDealt
    );

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    // Mark queued now so a second queue is rejected. Blinds, dealt_players, and
    // PreFlop wait for the callback — if MPC aborts, timeout_deal can still fire.
    let clock = Clock::get()?;
    let hand_state = &mut ctx.accounts.hand_state;
    hand_state.deal_queued |= 1 << seat_index;
    hand_state.last_action_time = clock.unix_timestamp;

    // --- Queue the MPC deal for this seat ---
    // deck (Enc<Mxe>), then the seat's Shared key + nonce, then plaintext seat_index.
    let args = ArgBuilder::new()
        .plaintext_u128(ctx.accounts.deck_state.deck_nonce)
        .account(ctx.accounts.deck_state.key(), DECK_OFFSET, DECK_LEN)
        .x25519_pubkey(seat_pubkey)
        .plaintext_u128(seat_nonce)
        .plaintext_u8(seat_index)
        .build();

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![DealToSeatCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: ctx.accounts.table.key(),
                    is_writable: false,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.hand_state.key(),
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.player_seat.key(),
                    is_writable: true,
                },
            ],
        )?],
        1,
        0,
        0,
    )?;
    Ok(())
}

pub fn callback(
    ctx: Context<DealToSeatCallback>,
    output: SignedComputationOutputs<DealToSeatOutput>,
) -> Result<()> {
    let hole = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(DealToSeatOutput { field_0 }) => field_0,
        Err(e) => {
            msg!("verify_output failed: {}", e);
            return Err(HiddenHandError::AbortedComputation.into());
        }
    };

    let table = &ctx.accounts.table;
    let seat_index = ctx.accounts.player_seat.seat_index;
    let already = (ctx.accounts.hand_state.dealt_players & (1 << seat_index)) != 0;
    if !already {
        commit_deal(
            table,
            &mut ctx.accounts.hand_state,
            &mut ctx.accounts.player_seat,
        )?;
    }

    emit!(crate::events::HoleDealt {
        enc_pubkey: hole.encryption_key,
        nonce: hole.nonce.to_le_bytes(),
        card0: hole.ciphertexts[0],
        card1: hole.ciphertexts[1],
        table_id: table.table_id,
        hand_number: ctx.accounts.hand_state.hand_number,
        seat_index,
    });
    Ok(())
}

/// Seat reset, blinds, dealt bit, and PreFlop transition. Runs in the callback
/// so a failed MPC does not open betting or consume AlreadyDealt without cards.
fn commit_deal(table: &Table, hand_state: &mut HandState, seat: &mut PlayerSeat) -> Result<()> {
    let clock = Clock::get()?;
    let seat_index = seat.seat_index;
    let (sb_pos, bb_pos) = blind_positions(table);

    seat.current_bet = 0;
    seat.total_bet_this_hand = 0;
    seat.has_acted = false;
    seat.cards_revealed = false;
    seat.revealed_card_1 = 255;
    seat.revealed_card_2 = 255;
    seat.status = PlayerStatus::Playing;

    let mut blind_posted: u64 = 0;
    if seat_index == sb_pos {
        blind_posted = seat.place_bet(table.small_blind);
        msg!("SB (seat {}) posts {}", seat_index, blind_posted);
    } else if seat_index == bb_pos {
        blind_posted = seat.place_bet(table.big_blind);
        msg!("BB (seat {}) posts {}", seat_index, blind_posted);
    }

    hand_state.pot = hand_state.pot.saturating_add(blind_posted);
    hand_state.dealt_players |= 1 << seat_index;
    hand_state.last_action_time = clock.unix_timestamp;

    if hand_state.dealt_players == hand_state.active_players {
        hand_state.phase = GamePhase::PreFlop;

        emit!(HandStarted {
            table_id: table.table_id,
            hand_number: hand_state.hand_number,
            timestamp: clock.unix_timestamp,
            dealer_position: hand_state.dealer_position,
            small_blind_seat: sb_pos,
            big_blind_seat: bb_pos,
            small_blind_amount: table.small_blind,
            big_blind_amount: table.big_blind,
            active_players: hand_state.active_players,
            player_count: hand_state.active_count,
        });
        msg!(
            "All seats dealt — phase PreFlop, action on seat {}",
            hand_state.action_on
        );
    }
    Ok(())
}

/// Re-derive the small/big-blind seat positions from the table, matching the
/// exact logic used by `start_hand`.
fn blind_positions(table: &Table) -> (u8, u8) {
    let dealer_pos = table.dealer_position;
    let max_players = table.max_players;
    let is_seat_occupied = |seat: u8| -> bool { (table.occupied_seats & (1 << seat)) != 0 };

    if table.current_players == 2 {
        // Heads-up: dealer is SB.
        let sb = dealer_pos;
        let mut bb = (dealer_pos + 1) % max_players;
        while !is_seat_occupied(bb) && bb != dealer_pos {
            bb = (bb + 1) % max_players;
        }
        (sb, bb)
    } else {
        let mut sb = (dealer_pos + 1) % max_players;
        while !is_seat_occupied(sb) {
            sb = (sb + 1) % max_players;
        }
        let mut bb = (sb + 1) % max_players;
        while !is_seat_occupied(bb) {
            bb = (bb + 1) % max_players;
        }
        (sb, bb)
    }
}

#[queue_computation_accounts("deal_to_seat", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64, seat_index: u8)]
pub struct DealToSeat<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut, address = derive_mempool_pda!(mxe_account))]
    /// CHECK: mempool_account, checked by the arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account))]
    /// CHECK: executing_pool, checked by the arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account))]
    /// CHECK: computation_account, checked by the arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEAL_TO_SEAT))]
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Box<Account<'info, Cluster>>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,

    #[account(
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump
    )]
    pub table: Box<Account<'info, Table>>,
    #[account(
        mut,
        seeds = [HAND_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = hand_state.bump
    )]
    pub hand_state: Box<Account<'info, HandState>>,
    #[account(
        seeds = [DECK_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = deck_state.bump
    )]
    pub deck_state: Box<Account<'info, DeckState>>,
    #[account(
        mut,
        seeds = [SEAT_SEED, table.key().as_ref(), &[seat_index]],
        bump = player_seat.bump,
        constraint = player_seat.table == table.key() @ HiddenHandError::PlayerNotAtTable,
        // C-1 fix: only the seat's own owner may deal this seat. Without this, any
        // wallet could deal a victim's hole cards sealed to an attacker-chosen
        // x25519 key (`seat_pubkey` is a caller-supplied arg) and decrypt them.
        constraint = player_seat.player == payer.key() @ HiddenHandError::NotYourSeat,
    )]
    pub player_seat: Box<Account<'info, PlayerSeat>>,
}

#[callback_accounts("deal_to_seat")]
#[derive(Accounts)]
pub struct DealToSeatCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_DEAL_TO_SEAT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: validated by the Arcium program.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::arcium_anchor::solana_instructions_sysvar::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint.
    pub instructions_sysvar: UncheckedAccount<'info>,
    pub table: Account<'info, Table>,
    #[account(mut, constraint = hand_state.table == table.key() @ HiddenHandError::InvalidPhase)]
    pub hand_state: Account<'info, HandState>,
    #[account(mut, constraint = player_seat.table == table.key() @ HiddenHandError::PlayerNotAtTable)]
    pub player_seat: Account<'info, PlayerSeat>,
}

#[init_computation_definition_accounts("deal_to_seat", payer)]
#[derive(Accounts)]
pub struct InitDealToSeatCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program (not initialized yet).
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table, checked by arcium program.
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program is the Address Lookup Table program.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}
