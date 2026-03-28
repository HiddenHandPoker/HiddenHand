use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::state::{PlayerSeat, Table, TableStatus};

#[derive(Accounts)]
pub struct LeaveTable<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump
    )]
    pub table: Account<'info, Table>,

    #[account(
        mut,
        close = player,
        seeds = [SEAT_SEED, table.key().as_ref(), &[player_seat.seat_index]],
        bump = player_seat.bump,
        has_one = player @ HiddenHandError::PlayerNotAtTable
    )]
    pub player_seat: Account<'info, PlayerSeat>,

    /// Player's token account to receive chips
    #[account(
        mut,
        token::mint = mint,
        token::authority = player,
        token::token_program = token_program,
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Table's token vault
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<LeaveTable>) -> Result<()> {
    // Read-only checks first (immutable borrow)
    let table = &ctx.accounts.table;
    let player_seat = &ctx.accounts.player_seat;

    require!(
        table.status != TableStatus::Playing || player_seat.chips == 0,
        HiddenHandError::CannotLeaveDuringHand
    );

    let chips_to_return = player_seat.chips;
    let seat_index = player_seat.seat_index;
    let table_id = table.table_id;
    let table_bump = table.bump;
    let mint_decimals = ctx.accounts.mint.decimals;

    // Transfer chips back to player from vault using table PDA as signer
    if chips_to_return > 0 {
        let signer_seeds: &[&[u8]] = &[
            TABLE_SEED,
            table_id.as_ref(),
            &[table_bump],
        ];

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.player_token_account.to_account_info(),
                    authority: ctx.accounts.table.to_account_info(),
                },
                &[signer_seeds],
            ),
            chips_to_return,
            mint_decimals,
        )?;
    }

    // Now mutate table state (separate borrow scope)
    ctx.accounts.table.vacate_seat(seat_index);

    msg!(
        "Player {} left table, returned {} tokens",
        ctx.accounts.player.key(),
        chips_to_return
    );

    Ok(())
}
