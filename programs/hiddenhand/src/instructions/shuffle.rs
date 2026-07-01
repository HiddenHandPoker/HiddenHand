//! MPC shuffle — Arcium circuit `shuffle`.
//!
//! Shuffles the 52-card deck in-MPC and persists it to the MXE as an opaque
//! `Enc<Mxe, Pack<[u8;52]>>` ciphertext, stored on-chain in `DeckState.deck`
//! (+ `deck_nonce`). No party — not even a chain observer — can read the deck.
//! This closes the deck-reconstruction hole the old public-VRF design had.
//!
//! Gated at `GamePhase::Dealing` (right after `start_hand`). After the callback
//! stores the deck, clients call `deal_to_seat` (once per seat) to receive their
//! sealed hole cards; blinds are posted then and the phase advances to PreFlop.

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::circuit_hash;

// The arcium account macros expand referencing these unqualified names, which
// live at the crate root / inside the #[arcium_program] module. Bring them in.
use crate::ArciumSignerAccount;
use crate::{ID, ID_CONST};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::events::DeckShuffled;
use crate::state::{DeckState, GamePhase, HandState, Table, TableStatus};

pub const COMP_DEF_OFFSET_SHUFFLE: u32 = comp_def_offset("shuffle");

const URL_SHUFFLE: &str =
    "https://raw.githubusercontent.com/criptocbas/hiddenhand-arcium-circuit/main/shuffle.arcis";

pub fn init_shuffle_comp_def(ctx: Context<InitShuffleCompDef>) -> Result<()> {
    init_computation_def(
        ctx.accounts,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: URL_SHUFFLE.to_string(),
            hash: circuit_hash!("shuffle"),
        })),
    )?;
    Ok(())
}

pub fn handler(ctx: Context<Shuffle>, computation_offset: u64) -> Result<()> {
    require!(
        ctx.accounts.table.status == TableStatus::Playing,
        HiddenHandError::HandNotInProgress
    );
    require!(
        ctx.accounts.hand_state.phase == GamePhase::Dealing,
        HiddenHandError::InvalidPhase
    );
    require!(
        !ctx.accounts.deck_state.is_shuffled,
        HiddenHandError::DeckAlreadyShuffled
    );

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    // shuffle() takes no MPC inputs.
    let args = ArgBuilder::new().build();

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![ShuffleCallback::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[CallbackAccount {
                pubkey: ctx.accounts.deck_state.key(),
                is_writable: true,
            }],
        )?],
        1,
        0,
        0,
    )?;
    Ok(())
}

pub fn callback(
    ctx: Context<ShuffleCallback>,
    output: SignedComputationOutputs<ShuffleOutput>,
) -> Result<()> {
    let deck = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(ShuffleOutput { field_0 }) => field_0,
        Err(e) => {
            msg!("verify_output failed: {}", e);
            return Err(HiddenHandError::AbortedComputation.into());
        }
    };

    let deck_state = &mut ctx.accounts.deck_state;
    deck_state.deck = deck.ciphertexts;
    deck_state.deck_nonce = deck.nonce;
    deck_state.is_shuffled = true;

    emit!(DeckShuffled {
        hand_number: deck_state.hand_number,
    });
    Ok(())
}

#[queue_computation_accounts("shuffle", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct Shuffle<'info> {
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHUFFLE))]
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
        mut,
        seeds = [DECK_SEED, table.key().as_ref(), &table.hand_number.to_le_bytes()],
        bump = deck_state.bump
    )]
    pub deck_state: Box<Account<'info, DeckState>>,
}

#[callback_accounts("shuffle")]
#[derive(Accounts)]
pub struct ShuffleCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHUFFLE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: validated by the Arcium program; verify_output reads slot data from it.
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::arcium_anchor::solana_instructions_sysvar::ID)]
    /// CHECK: instructions_sysvar, checked by the account constraint.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub deck_state: Account<'info, DeckState>,
}

#[init_computation_definition_accounts("shuffle", payer)]
#[derive(Accounts)]
pub struct InitShuffleCompDef<'info> {
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
