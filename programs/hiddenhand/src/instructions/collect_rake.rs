use anchor_lang::prelude::*;
use anchor_lang::system_program;

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

    /// Vault holding player chips + accumulated rake
    #[account(
        mut,
        seeds = [VAULT_SEED, table.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

/// Collect accumulated rake from the table vault.
/// Only the table authority can call this.
/// Table must be in Waiting status (not mid-hand).
pub fn handler(ctx: Context<CollectRake>) -> Result<()> {
    let table = &mut ctx.accounts.table;

    // Can only collect when not mid-hand
    require!(
        table.status == TableStatus::Waiting,
        HiddenHandError::HandInProgress
    );

    let rake_amount = table.accumulated_rake;
    require!(rake_amount > 0, HiddenHandError::NoRakeToCollect);

    let table_key = table.key();
    let vault_bump = ctx.bumps.vault;
    let vault_seeds: &[&[u8]] = &[
        VAULT_SEED,
        table_key.as_ref(),
        &[vault_bump],
    ];

    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.authority.to_account_info(),
            },
            &[vault_seeds],
        ),
        rake_amount,
    )?;

    table.accumulated_rake = 0;

    msg!("Collected {} lamports in rake", rake_amount);

    Ok(())
}
