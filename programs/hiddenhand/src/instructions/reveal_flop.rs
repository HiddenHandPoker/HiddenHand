//! MPC reveal flop — Arcium circuit `reveal_flop`.
//!
//! Re-feeds the persisted MXE deck and reveals the flop (deck[18], deck[19],
//! deck[20]) in the clear. The callback writes the three plaintext cards into
//! `HandState.community_cards[0..3]` and advances the hand `PreFlop -> Flop`,
//! honoring the same `awaiting_community_reveal` / all-in-runout contract that
//! the old Ed25519 `reveal_community` did (so the untouched `player_action`
//! betting flow keeps working).

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::circuit_hash;

use crate::ArciumSignerAccount;
use crate::{ID, ID_CONST};

use session_keys::{Session, SessionError, SessionToken};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::instructions::reveal_common::{
    authorize_reveal, community_already_committed, community_reset_and_advance, FLOP_REVEALED,
};
use crate::state::{DeckState, GamePhase, HandState, Table};

pub const COMP_DEF_OFFSET_REVEAL_FLOP: u32 = comp_def_offset("reveal_flop");

const URL_REVEAL_FLOP: &str =
    "https://raw.githubusercontent.com/criptocbas/hiddenhand-arcium-circuit/main/reveal_flop.arcis";

const DECK_OFFSET: u32 = 8;
const DECK_LEN: u32 = 32 * 2;

pub fn init_reveal_flop_comp_def(ctx: Context<InitRevealFlopCompDef>) -> Result<()> {
    init_computation_def(
        ctx.accounts,
        Some(CircuitSource::OffChain(OffChainCircuitSource {
            source: URL_REVEAL_FLOP.to_string(),
            hash: circuit_hash!("reveal_flop"),
        })),
    )?;
    Ok(())
}

#[session_keys::session_auth_or(true, HiddenHandError::UnauthorizedAuthority)]
pub fn handler(ctx: Context<RevealFlop>, computation_offset: u64) -> Result<()> {
    require!(
        ctx.accounts.hand_state.phase == GamePhase::PreFlop,
        HiddenHandError::InvalidPhase
    );
    require!(
        ctx.accounts.hand_state.awaiting_community_reveal,
        HiddenHandError::CommunityNotReady
    );
    authorize_reveal(
        &ctx.accounts.table,
        &ctx.accounts.hand_state,
        &ctx.accounts.caller,
    )?;

    ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

    let args = ArgBuilder::new()
        .plaintext_u128(ctx.accounts.deck_state.deck_nonce)
        .account(ctx.accounts.deck_state.key(), DECK_OFFSET, DECK_LEN)
        .build();

    queue_computation(
        ctx.accounts,
        computation_offset,
        args,
        vec![RevealFlopCallback::callback_ix(
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
            ],
        )?],
        1,
        0,
        0,
    )?;
    Ok(())
}

pub fn callback(
    ctx: Context<RevealFlopCallback>,
    output: SignedComputationOutputs<RevealFlopOutput>,
) -> Result<()> {
    let flop = match output.verify_output(
        &ctx.accounts.cluster_account,
        &ctx.accounts.computation_account,
    ) {
        Ok(RevealFlopOutput { field_0 }) => field_0,
        Err(e) => {
            msg!("verify_output failed: {}", e);
            return Err(HiddenHandError::AbortedComputation.into());
        }
    };

    let table = &ctx.accounts.table;
    let hand_state = &mut ctx.accounts.hand_state;
    // Duplicate callback (two queues before the first lands): do not rewind
    // the phase machine or reset an already-open betting round.
    if community_already_committed(hand_state.community_revealed, FLOP_REVEALED) {
        msg!("Flop already committed; ignoring duplicate reveal_flop callback");
        return Ok(());
    }
    hand_state.community_cards[0] = flop[0];
    hand_state.community_cards[1] = flop[1];
    hand_state.community_cards[2] = flop[2];
    hand_state.community_revealed = FLOP_REVEALED;

    community_reset_and_advance(
        table,
        hand_state,
        GamePhase::Flop,
        vec![flop[0], flop[1], flop[2]],
    )?;
    Ok(())
}

#[queue_computation_accounts("reveal_flop", payer)]
#[derive(Accounts, Session)]
#[instruction(computation_offset: u64)]
pub struct RevealFlop<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The account whose authority/timeout is checked to reveal.
    #[account(mut)]
    pub caller: Signer<'info>,
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
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_FLOP))]
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
    /// Session token — optional. Lets the table authority reveal popup-free.
    #[session(signer = caller, authority = table.authority)]
    pub session_token: Option<Account<'info, SessionToken>>,
}

#[callback_accounts("reveal_flop")]
#[derive(Accounts)]
pub struct RevealFlopCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_REVEAL_FLOP))]
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
}

#[init_computation_definition_accounts("reveal_flop", payer)]
#[derive(Accounts)]
pub struct InitRevealFlopCompDef<'info> {
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
