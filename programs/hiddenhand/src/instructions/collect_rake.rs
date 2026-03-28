use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::state::{Table, TableStatus};

#[derive(Accounts)]
pub struct CollectRake<'info> {
    /// Only the table authority can collect rake
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump,
        constraint = table.authority == authority.key() @ HiddenHandError::UnauthorizedAuthority
    )]
    pub table: Account<'info, Table>,

    /// Authority's token account to receive rake
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = token_program,
    )]
    pub authority_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Table's token vault holding player chips + accumulated rake
    #[account(
        mut,
        token::mint = mint,
        token::authority = table,
        token::token_program = token_program,
        seeds = [VAULT_SEED, table.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// Token mint — must match the table's configured mint
    #[account(
        constraint = mint.key() == table.token_mint @ HiddenHandError::InvalidTokenMint
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
}

/// Collect accumulated rake from the table vault.
/// Only the table authority can call this.
/// Table must be in Waiting status (not mid-hand).
pub fn handler(ctx: Context<CollectRake>) -> Result<()> {
    // Read-only checks first (immutable borrow)
    let table = &ctx.accounts.table;
    require!(
        table.status == TableStatus::Waiting,
        HiddenHandError::HandInProgress
    );

    let rake_amount = table.accumulated_rake;
    require!(rake_amount > 0, HiddenHandError::NoRakeToCollect);

    let table_id = table.table_id;
    let table_bump = table.bump;
    let mint_decimals = ctx.accounts.mint.decimals;

    // Build signer seeds — table PDA is the vault authority
    let signer_seeds: &[&[u8]] = &[
        TABLE_SEED,
        table_id.as_ref(),
        &[table_bump],
    ];

    // Transfer rake from vault to authority's token account
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.authority_token_account.to_account_info(),
                authority: ctx.accounts.table.to_account_info(),
            },
            &[signer_seeds],
        ),
        rake_amount,
        mint_decimals,
    )?;

    // Now mutate table state (separate borrow scope)
    ctx.accounts.table.accumulated_rake = 0;

    msg!("Collected {} tokens in rake", rake_amount);

    Ok(())
}
