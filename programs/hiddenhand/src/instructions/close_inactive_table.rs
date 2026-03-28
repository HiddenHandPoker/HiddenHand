//! Close inactive table and return funds
//!
//! If a table has been inactive for TABLE_INACTIVE_TIMEOUT_SECONDS (1 hour),
//! anyone can call this instruction to close it and return all deposited tokens
//! to the players.
//!
//! Requirements:
//! - Table must be in Waiting status (not mid-hand)
//! - Table must be inactive for the timeout period
//!
//! remaining_accounts format: [seat0, player_token_account0, seat1, player_token_account1, ...]
//! Each player_token_account must be the player's token account for the table's mint.
//!
//! This prevents tokens from being stuck in abandoned tables.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::state::{PlayerSeat, Table, TableStatus};

/// Deserialize and validate a player's token account from remaining_accounts
fn validate_player_token_account(
    account_info: &AccountInfo,
    expected_owner: &Pubkey,
    expected_mint: &Pubkey,
) -> Result<()> {
    let ta = TokenAccount::try_deserialize(
        &mut &account_info.try_borrow_data()?[..],
    ).map_err(|_| HiddenHandError::InvalidRemainingAccounts)?;

    require!(
        ta.owner == *expected_owner,
        HiddenHandError::PlayerNotAtTable
    );
    require!(
        ta.mint == *expected_mint,
        HiddenHandError::InvalidTokenMint
    );

    Ok(())
}

#[derive(Accounts)]
pub struct CloseInactiveTable<'info> {
    /// Anyone can call this after timeout
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        mut,
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump
    )]
    pub table: Account<'info, Table>,

    /// The token vault holding player funds
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

/// Close an inactive table and return funds to all players
/// remaining_accounts should contain player seats and their corresponding token accounts
/// Format: [seat0, player_token_account0, seat1, player_token_account1, ...]
pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, CloseInactiveTable<'info>>,
) -> Result<()> {
    let table = &ctx.accounts.table;
    let clock = Clock::get()?;

    // Validate table is in Waiting status (not mid-hand)
    require!(
        table.status == TableStatus::Waiting,
        HiddenHandError::HandInProgress
    );

    // Check timeout - must be inactive for TABLE_INACTIVE_TIMEOUT_SECONDS
    let elapsed = clock.unix_timestamp - table.last_ready_time;
    require!(
        elapsed >= TABLE_INACTIVE_TIMEOUT_SECONDS,
        HiddenHandError::TimeoutNotReached
    );

    msg!(
        "Closing inactive table after {} seconds of inactivity",
        elapsed
    );

    // Extract values from immutable borrow before processing
    let table_key = table.key();
    let table_id = table.table_id;
    let table_bump = table.bump;
    let program_id = crate::ID;
    let mint_decimals = ctx.accounts.mint.decimals;

    let signer_seeds: &[&[u8]] = &[
        TABLE_SEED,
        table_id.as_ref(),
        &[table_bump],
    ];

    // Process remaining_accounts in pairs: [seat, player_token_account, ...]
    let remaining = ctx.remaining_accounts;
    require!(
        remaining.len() % 2 == 0,
        HiddenHandError::InvalidRemainingAccounts
    );

    let mut total_returned: u64 = 0;

    for chunk in remaining.chunks(2) {
        let seat_info = &chunk[0];
        let player_token_info = &chunk[1];

        // Security check 1: Verify seat account is owned by our program
        if seat_info.owner != &program_id {
            continue;
        }

        // Deserialize the seat
        let seat_data = seat_info.try_borrow_data()?;
        if seat_data.len() < 8 {
            drop(seat_data);
            continue;
        }

        let seat = match PlayerSeat::try_deserialize(&mut &seat_data[..]) {
            Ok(s) => s,
            Err(_) => { drop(seat_data); continue; }
        };

        // Security check 2: Verify seat belongs to this table
        if seat.table != table_key {
            drop(seat_data);
            continue;
        }

        // Security check 3: Verify PDA derivation
        let (expected_pda, _) = Pubkey::find_program_address(
            &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
            &program_id,
        );
        if *seat_info.key != expected_pda {
            drop(seat_data);
            continue;
        }

        let transfer_amount = seat.chips;
        let seat_index = seat.seat_index;
        let player_key = seat.player;
        drop(seat_data);

        // Return chips to player via token transfer
        if transfer_amount > 0 {
            // Security: Verify token account belongs to the player and matches table mint
            validate_player_token_account(player_token_info, &player_key, &ctx.accounts.mint.key())?;

            token_interface::transfer_checked(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: player_token_info.clone(),
                        authority: ctx.accounts.table.to_account_info(),
                    },
                    &[signer_seeds],
                ),
                transfer_amount,
                mint_decimals,
            )?;

            total_returned += transfer_amount;

            msg!(
                "Returned {} tokens to player {} from seat {}",
                transfer_amount,
                player_key,
                seat_index
            );
        }

        // Clear the seat
        if seat_info.owner == &program_id {
            let mut seat_data = seat_info.try_borrow_mut_data()?;
            if seat_data.len() >= 8 {
                if let Ok(mut seat) = PlayerSeat::try_deserialize(&mut &seat_data[..]) {
                    if seat.table == table_key {
                        let (expected_pda, _) = Pubkey::find_program_address(
                            &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
                            &program_id,
                        );
                        if *seat_info.key == expected_pda {
                            seat.chips = 0;
                            seat.player = Pubkey::default();
                            seat.try_serialize(&mut *seat_data)?;
                        }
                    }
                }
            }
        }
    }

    // Now mutate table state (separate borrow scope after CPI loops complete)
    let table = &mut ctx.accounts.table;
    table.status = TableStatus::Closed;
    table.current_players = 0;
    table.occupied_seats = 0;

    msg!(
        "Table closed. Total {} tokens returned to players.",
        total_returned
    );

    Ok(())
}
