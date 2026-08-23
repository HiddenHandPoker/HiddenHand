use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::*;
use crate::error::HiddenHandError;
use crate::state::{PlayerSeat, PlayerStatus, Table, TableStatus};

#[derive(Accounts)]
#[instruction(seat_index: u8)]
pub struct JoinTable<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [TABLE_SEED, table.table_id.as_ref()],
        bump = table.bump
    )]
    pub table: Account<'info, Table>,

    #[account(
        init,
        payer = player,
        space = PlayerSeat::SIZE,
        seeds = [SEAT_SEED, table.key().as_ref(), &[seat_index]],
        bump
    )]
    pub player_seat: Account<'info, PlayerSeat>,

    /// Player's token account (source of buy-in funds)
    #[account(
        mut,
        token::mint = mint,
        token::authority = player,
        token::token_program = token_program,
    )]
    pub player_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Table's token vault (destination for buy-in)
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
    // remaining_accounts: every currently occupied PlayerSeat PDA (readonly).
    // Empty when the table has no one seated yet. Used to enforce one wallet
    // per table and to reject incomplete occupancy sets.
}

pub fn handler(ctx: Context<JoinTable>, seat_index: u8, buy_in: u64) -> Result<()> {
    let table = &mut ctx.accounts.table;

    // Validate table state
    require!(
        table.status == TableStatus::Waiting,
        HiddenHandError::TableNotWaiting
    );

    require!(
        seat_index < table.max_players,
        HiddenHandError::InvalidSeatIndex
    );

    require!(
        !table.is_seat_occupied(seat_index),
        HiddenHandError::SeatOccupied
    );

    require!(
        table.current_players < table.max_players,
        HiddenHandError::TableFull
    );

    // Validate buy-in
    require!(
        buy_in >= table.min_buy_in && buy_in <= table.max_buy_in,
        HiddenHandError::InvalidBuyIn
    );

    // One wallet per table. Remaining accounts must be every currently occupied
    // PlayerSeat PDA; none of them may belong to the joining wallet.
    let program_id = crate::ID;
    let table_key = table.key();
    let joining = ctx.accounts.player.key();
    let mut present: Vec<(u8, Pubkey)> = Vec::new();
    for account_info in ctx.remaining_accounts.iter() {
        let seat = validate_seat_account(account_info, &table_key, &program_id)
            .ok_or(HiddenHandError::InvalidRemainingAccounts)?;
        present.push((seat.seat_index, seat.player));
    }
    assert_join_occupancy(table.occupied_seats, joining, &present)?;

    // Transfer buy-in tokens to vault
    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.player_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        buy_in,
        ctx.accounts.mint.decimals,
    )?;

    // Update table
    table.occupy_seat(seat_index);

    // Initialize player seat
    let player_seat = &mut ctx.accounts.player_seat;
    player_seat.table = table.key();
    player_seat.player = ctx.accounts.player.key();
    player_seat.seat_index = seat_index;
    player_seat.chips = buy_in;
    player_seat.current_bet = 0;
    player_seat.total_bet_this_hand = 0;
    player_seat.revealed_card_1 = 255; // Not revealed
    player_seat.revealed_card_2 = 255; // Not revealed
    player_seat.cards_revealed = false;
    player_seat.status = PlayerStatus::Sitting;
    player_seat.has_acted = false;
    player_seat.bump = ctx.bumps.player_seat;

    msg!(
        "Player {} joined table at seat {} with {} tokens",
        ctx.accounts.player.key(),
        seat_index,
        buy_in
    );

    Ok(())
}

/// Validate a remaining account is a genuine PlayerSeat PDA of this table.
fn validate_seat_account(
    account_info: &AccountInfo,
    table_key: &Pubkey,
    program_id: &Pubkey,
) -> Option<PlayerSeat> {
    if account_info.owner != program_id {
        return None;
    }
    let data = account_info.try_borrow_data().ok()?;
    if data.len() < 8 {
        return None;
    }
    let seat = PlayerSeat::try_deserialize(&mut &data[..]).ok()?;
    if seat.table != *table_key {
        return None;
    }
    let (expected_pda, _) = Pubkey::find_program_address(
        &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
        program_id,
    );
    if *account_info.key != expected_pda {
        return None;
    }
    Some(seat)
}

/// Occupied-seat completeness + one-wallet-per-table for `join_table`.
/// `present` is `(seat_index, player)` for every remaining account passed.
pub fn assert_join_occupancy(
    occupied_seats: u8,
    joining: Pubkey,
    present: &[(u8, Pubkey)],
) -> Result<()> {
    let mut bits: u8 = 0;
    for (idx, player) in present {
        require!(*idx < 8, HiddenHandError::InvalidSeatIndex);
        let bit = 1u8 << idx;
        require!(bits & bit == 0, HiddenHandError::DuplicateAccount);
        bits |= bit;
        require!(*player != joining, HiddenHandError::PlayerAlreadyAtTable);
    }
    require!(
        bits == occupied_seats,
        HiddenHandError::IncompletePlayerAccounts
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pk(n: u8) -> Pubkey {
        Pubkey::new_from_array([n; 32])
    }

    #[test]
    fn first_join_with_empty_table_needs_no_remaining() {
        assert!(assert_join_occupancy(0, pk(1), &[]).is_ok());
    }

    #[test]
    fn second_join_must_pass_the_occupied_seat() {
        let seated = pk(1);
        let joining = pk(2);
        assert!(assert_join_occupancy(0b0000_0001, joining, &[(0, seated)]).is_ok());
    }

    #[test]
    fn same_wallet_cannot_take_a_second_seat() {
        let wallet = pk(1);
        let err = assert_join_occupancy(0b0000_0001, wallet, &[(0, wallet)]).unwrap_err();
        assert_eq!(err, HiddenHandError::PlayerAlreadyAtTable.into());
    }

    #[test]
    fn omitted_occupied_seat_is_incomplete() {
        let err = assert_join_occupancy(0b0000_0001, pk(2), &[]).unwrap_err();
        assert_eq!(err, HiddenHandError::IncompletePlayerAccounts.into());
    }

    #[test]
    fn duplicate_remaining_seat_is_rejected() {
        let seated = pk(1);
        let err =
            assert_join_occupancy(0b0000_0001, pk(2), &[(0, seated), (0, seated)]).unwrap_err();
        assert_eq!(err, HiddenHandError::DuplicateAccount.into());
    }
}
