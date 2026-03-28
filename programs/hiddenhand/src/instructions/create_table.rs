use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::state::{Table, TableStatus};

#[derive(Accounts)]
#[instruction(table_id: [u8; 32])]
pub struct CreateTable<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = Table::SIZE,
        seeds = [TABLE_SEED, table_id.as_ref()],
        bump
    )]
    pub table: Account<'info, Table>,

    /// SPL token mint for this table (e.g. USDC)
    pub mint: InterfaceAccount<'info, Mint>,

    /// Token vault to hold player buy-ins — PDA owned by the table
    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = table,
        token::token_program = token_program,
        seeds = [VAULT_SEED, table.key().as_ref()],
        bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateTable>,
    table_id: [u8; 32],
    small_blind: u64,
    big_blind: u64,
    min_buy_in: u64,
    max_buy_in: u64,
    max_players: u8,
    rake_bps: u16,
    rake_cap: u64,
) -> Result<()> {
    require!(
        max_players >= MIN_PLAYERS && max_players <= MAX_PLAYERS,
        HiddenHandError::InvalidSeatIndex
    );

    require!(
        big_blind >= small_blind,
        HiddenHandError::InvalidBuyIn
    );

    require!(
        min_buy_in <= max_buy_in,
        HiddenHandError::InvalidBuyIn
    );

    require!(
        min_buy_in >= big_blind * 10, // Minimum 10 big blinds
        HiddenHandError::InvalidBuyIn
    );

    require!(
        rake_bps <= MAX_RAKE_BPS,
        HiddenHandError::RakeExceedsLimit
    );

    let table = &mut ctx.accounts.table;
    let clock = Clock::get()?;
    let mint = &ctx.accounts.mint;

    table.authority = ctx.accounts.authority.key();
    table.table_id = table_id;
    table.small_blind = small_blind;
    table.big_blind = big_blind;
    table.min_buy_in = min_buy_in;
    table.max_buy_in = max_buy_in;
    table.max_players = max_players;
    table.current_players = 0;
    table.status = TableStatus::Waiting;
    table.hand_number = 0;
    table.occupied_seats = 0;
    table.dealer_position = 0;
    table.last_ready_time = clock.unix_timestamp;
    table.rake_bps = rake_bps;
    table.rake_cap = rake_cap;
    table.accumulated_rake = 0;
    table.token_mint = mint.key();
    table.token_decimals = mint.decimals;
    table.bump = ctx.bumps.table;

    msg!(
        "Table created: {:?} (mint: {}, decimals: {}, rake: {} bps, cap: {})",
        table_id, mint.key(), mint.decimals, rake_bps, rake_cap
    );

    Ok(())
}
