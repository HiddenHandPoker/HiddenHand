//! MPC showdown reveal — Arcium circuit `showdown_reveal`.
//!
//! Reveals the true hole cards for every seat still in the hand (non-folded),
//! straight from the persisted MXE deck, in ONE MPC round-trip. `reveal_mask[i]`
//! is public, built here from on-chain fold tracking: true = seat i is still in
//! the hand → reveal it; false = folded → its cards stay hidden (circuit returns
//! sentinel 53).
//!
//! The callback writes the revealed plaintext cards into each seat's
//! `revealed_card_1/2` + `cards_revealed`, exactly the fields the untouched
//! `showdown` eval instruction reads. Gated at `GamePhase::Showdown`, before
//! `showdown` runs.
//!
//! Seat accounts (the ones to reveal) are passed BOTH as `remaining_accounts` on
//! the queue call (to build the mask) and as writable callback accounts (so the
//! callback can write their revealed cards). Pass them in ascending seat order.

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::circuit_hash;

use crate::ArciumSignerAccount;
use crate::{ID, ID_CONST};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::ShowdownReveal as ShowdownRevealEvent;
use crate::state::{DeckState, GamePhase, HandState, PlayerSeat, PlayerStatus, Table, TableStatus};

pub const COMP_DEF_OFFSET_SHOWDOWN_REVEAL: u32 = comp_def_offset("showdown_reveal");

const URL_SHOWDOWN_REVEAL: &str =
    "https://raw.githubusercontent.com/criptocbas/hiddenhand-arcium-circuit/main/showdown_reveal.arcis";

const DECK_OFFSET: u32 = 8;
const DECK_LEN: u32 = 32 * 2;

/// Sentinel the circuit returns for hidden (folded) seats.
const HIDDEN: u8 = 53;

pub fn init_showdown_reveal_comp_def(ctx: Context<InitShowdownRevealCompDef>) -> Result<()> {
    init_computation_def(
        ctx.accounts,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: URL_SHOWDOWN_REVEAL.to_string(),
            hash: circuit_hash!("showdown_reveal"),
        })),
    )?;
    Ok(())
}

pub fn handler(ctx: Context<ShowdownRevealAccounts>, computation_offset: u64) -> Result<()> {
    require!(
        ctx.accounts.table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );
    require!(
        ctx.accounts.hand_state.phase == GamePhase::Showdown,
        HiddenHandError::InvalidPhase
    );

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let table_key = ctx.accounts.table.key();
    let program_id = crate::ID;

    // Build the public reveal mask from the seat accounts. A seat is revealed if
    // it is still active in the hand and not folded.
    let mut reveal_mask = [false; 9];
    let mut callback_accounts: Vec<CallbackAccount> = Vec::new();
    for account_info in ctx.remaining_accounts.iter() {
        if account_info.owner != &program_id {
            continue;
        }
        let data = account_info.try_borrow_data()?;
        let seat = match PlayerSeat::try_deserialize(&mut &data[..]) {
            Ok(s) => s,
            Err(_) => continue,
        };
        if seat.table != table_key {
            continue;
        }
        let (expected_pda, _) = Pubkey::find_program_address(
            &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
            &program_id,
        );
        if *account_info.key != expected_pda {
            continue;
        }
        let idx = seat.seat_index as usize;
        if idx < 9 {
            let still_in = ctx.accounts.hand_state.is_player_active(seat.seat_index)
                && seat.status != PlayerStatus::Folded;
            reveal_mask[idx] = still_in;
        }
        callback_accounts.push(CallbackAccount {
            pubkey: *account_info.key,
            is_writable: true,
        });
    }

    // deck (Enc<Mxe>) first, then the 9 mask bools — matches circuit param order.
    let mut b = ArgBuilder::new()
        .plaintext_u128(ctx.accounts.deck_state.deck_nonce)
        .account(ctx.accounts.deck_state.key(), DECK_OFFSET, DECK_LEN);
    for i in 0..9 {
        b = b.plaintext_bool(reveal_mask[i]);
    }
    let args = b.build();

    // Callback accounts: table (readonly, for table_id in events) + hand_state
    // (writable) + the seat accounts (writable, to write revealed cards).
    let mut cbs: Vec<CallbackAccount> = vec![
        CallbackAccount {
            pubkey: ctx.accounts.table.key(),
            is_writable: false,
        },
        CallbackAccount {
            pubkey: ctx.accounts.hand_state.key(),
            is_writable: true,
        },
    ];
    cbs.extend(callback_accounts);

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![ShowdownRevealCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &cbs,
        )?],
        1,
        0,
        0,
    )?;
    Ok(())
}

pub fn callback(
    ctx: Context<ShowdownRevealCallback>,
    output: SignedComputationOutputs<ShowdownRevealOutput>,
) -> Result<()> {
    let hole = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(ShowdownRevealOutput { field_0 }) => field_0,
        Err(e) => {
            msg!("verify_output failed: {}", e);
            return Err(HiddenHandError::AbortedComputation.into());
        }
    };

    let table_id = ctx.accounts.table.table_id;
    let table_key = ctx.accounts.table.key();
    let hand_number = ctx.accounts.hand_state.hand_number;
    let program_id = crate::ID;
    let clock = Clock::get()?;

    // Write revealed cards into each seat account and emit per-seat events.
    for account_info in ctx.remaining_accounts.iter() {
        if account_info.owner != &program_id {
            continue;
        }
        let (seat_index, is_seat) = {
            let data = account_info.try_borrow_data()?;
            match PlayerSeat::try_deserialize(&mut &data[..]) {
                Ok(s) if s.table == table_key => (s.seat_index, true),
                _ => (0u8, false),
            }
        };
        if !is_seat {
            continue;
        }
        let idx = seat_index as usize;
        if idx >= 9 {
            continue;
        }
        // Revealed struct fields are renamed to field_0 / field_1 in the output.
        let c0 = hole[idx].field_0;
        let c1 = hole[idx].field_1;
        if c0 == HIDDEN || c1 == HIDDEN {
            continue; // folded seat — leave hidden
        }

        let mut data = account_info.try_borrow_mut_data()?;
        let mut seat = PlayerSeat::try_deserialize(&mut &data[..])?;
        seat.revealed_card_1 = c0;
        seat.revealed_card_2 = c1;
        seat.cards_revealed = true;
        seat.try_serialize(&mut *data)?;

        emit!(ShowdownRevealEvent {
            table_id,
            hand_number,
            seat_index,
            card_1: c0,
            card_2: c1,
            timestamp: clock.unix_timestamp,
        });
    }

    Ok(())
}

#[queue_computation_accounts("showdown_reveal", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ShowdownRevealAccounts<'info> {
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHOWDOWN_REVEAL))]
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
        seeds = [HAND_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = hand_state.bump
    )]
    pub hand_state: Box<Account<'info, HandState>>,
    #[account(
        seeds = [DECK_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = deck_state.bump
    )]
    pub deck_state: Box<Account<'info, DeckState>>,
    // remaining_accounts: PlayerSeat accounts (ascending seat_index) to reveal.
}

#[callback_accounts("showdown_reveal")]
#[derive(Accounts)]
pub struct ShowdownRevealCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHOWDOWN_REVEAL))]
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
    #[account(mut)]
    pub hand_state: Account<'info, HandState>,
    // remaining_accounts: the writable PlayerSeat accounts registered in the queue.
}

#[init_computation_definition_accounts("showdown_reveal", payer)]
#[derive(Accounts)]
pub struct InitShowdownRevealCompDef<'info> {
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
