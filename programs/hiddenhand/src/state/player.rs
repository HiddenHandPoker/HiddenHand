use anchor_lang::prelude::*;

#[derive(
    AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace, Default,
)]
pub enum PlayerStatus {
    /// Seated but not in current hand
    #[default]
    Sitting,
    /// Active in current hand
    Playing,
    /// Folded this hand
    Folded,
    /// All-in this hand
    AllIn,
}

#[account]
#[derive(InitSpace)]
pub struct PlayerSeat {
    /// Reference to table
    pub table: Pubkey,

    /// Player's wallet
    pub player: Pubkey,

    /// Seat index (0 to max_players-1)
    pub seat_index: u8,

    /// Player's chip stack at this table
    pub chips: u64,

    /// Amount bet in current betting round
    pub current_bet: u64,

    /// Total amount invested in current hand
    pub total_bet_this_hand: u64,

    // Hole cards live CLIENT-SIDE now: each player decrypts them from the
    // `HoleDealt` event of their own `deal_to_seat` MPC computation. They are
    // proven on-chain only at showdown, via the `showdown_reveal` circuit, which
    // writes the plaintext values into `revealed_card_1/2` below.
    /// Revealed plaintext card 1 (0-51, or 255 if not revealed).
    /// Written by the `showdown_reveal` MPC callback.
    pub revealed_card_1: u8,

    /// Revealed plaintext card 2 (0-51, or 255 if not revealed)
    pub revealed_card_2: u8,

    /// Whether player has revealed their cards for showdown
    pub cards_revealed: bool,

    /// Current status
    pub status: PlayerStatus,

    /// Has acted in current betting round
    pub has_acted: bool,

    /// PDA bump
    pub bump: u8,
}

impl PlayerSeat {
    pub const SIZE: usize = 8 + // discriminator
        32 + // table
        32 + // player
        1 +  // seat_index
        8 +  // chips
        8 +  // current_bet
        8 +  // total_bet_this_hand
        1 +  // revealed_card_1
        1 +  // revealed_card_2
        1 +  // cards_revealed
        1 +  // status
        1 +  // has_acted
        1; // bump

    /// Reset for new hand
    pub fn reset_for_new_hand(&mut self) {
        self.current_bet = 0;
        self.total_bet_this_hand = 0;
        self.revealed_card_1 = 255; // Not revealed
        self.revealed_card_2 = 255; // Not revealed
        self.cards_revealed = false;
        self.status = PlayerStatus::Playing;
        self.has_acted = false;
    }

    /// Reset for new betting round
    pub fn reset_for_betting_round(&mut self) {
        self.current_bet = 0;
        self.has_acted = false;
    }

    /// Place a bet (returns actual amount bet, handles all-in)
    pub fn place_bet(&mut self, amount: u64) -> u64 {
        let actual_bet = amount.min(self.chips);
        self.chips = self.chips.saturating_sub(actual_bet);
        self.current_bet = self.current_bet.saturating_add(actual_bet);
        self.total_bet_this_hand = self.total_bet_this_hand.saturating_add(actual_bet);

        if self.chips == 0 {
            self.status = PlayerStatus::AllIn;
        }

        actual_bet
    }

    /// Award chips (from winning pot)
    pub fn award_chips(&mut self, amount: u64) {
        self.chips = self.chips.saturating_add(amount);
    }

    /// Check if player can act (not folded or all-in)
    pub fn can_act(&self) -> bool {
        matches!(self.status, PlayerStatus::Playing)
    }

    /// Fold the hand
    pub fn fold(&mut self) {
        self.status = PlayerStatus::Folded;
    }
}
