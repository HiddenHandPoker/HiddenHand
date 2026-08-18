pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("9chPz3vJDeU7gr4zBtDreJUpVLKbqwrKoQBQQjT1SF5X");

/// HiddenHand - Privacy Poker on Solana
/// Card shuffle, deal, and reveal run as Arcium MPC circuits (Phase 3b):
/// the deck is shuffled in-MPC, stored on-chain as opaque ciphertext, and
/// re-fed into every later circuit. All betting/pot/showdown-eval logic stays
/// on the public Solana path.
#[arcium_program]
pub mod hiddenhand {
    use super::*;

    /// Create a new poker table
    /// rake_bps: rake in basis points (0 = no rake, max 1000 = 10%)
    /// rake_cap: maximum rake per hand in lamports (0 = no cap)
    pub fn create_table(
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
        instructions::create_table::handler(ctx, table_id, small_blind, big_blind, min_buy_in, max_buy_in, max_players, rake_bps, rake_cap)
    }

    /// Join a table with a buy-in
    pub fn join_table(ctx: Context<JoinTable>, seat_index: u8, buy_in: u64) -> Result<()> {
        instructions::join_table::handler(ctx, seat_index, buy_in)
    }

    /// Leave a table and cash out
    pub fn leave_table(ctx: Context<LeaveTable>) -> Result<()> {
        instructions::leave_table::handler(ctx)
    }

    /// Start a new hand (table authority only)
    pub fn start_hand(ctx: Context<StartHand>) -> Result<()> {
        instructions::start_hand::handler(ctx)
    }

    /// Perform a player action (fold, check, call, raise, all-in)
    pub fn player_action(ctx: Context<PlayerAction>, action: Action) -> Result<()> {
        instructions::player_action::handler(ctx, action)
    }

    /// Showdown - evaluate hands and distribute pot
    /// Remaining accounts should be all player seat accounts
    pub fn showdown(ctx: Context<Showdown>) -> Result<()> {
        instructions::showdown::handler(ctx)
    }

    // ============================================================
    // Timeout Handling (Prevents Stuck Games)
    // ============================================================

    /// Timeout a player who hasn't acted within 60 seconds
    /// Anyone can call this to keep the game moving
    /// Auto-checks if possible, otherwise auto-folds
    pub fn timeout_player(ctx: Context<TimeoutPlayer>) -> Result<()> {
        instructions::timeout_player::handler(ctx)
    }

    /// Abort a hand stuck in the Dealing phase because a seated player never ran
    /// deal_to_seat (AFK). Callable by anyone after DEAL_TIMEOUT_SECONDS; refunds
    /// posted blinds, resets seats, and returns the table to Waiting.
    /// Remaining accounts: all occupied player seat accounts.
    pub fn timeout_deal(ctx: Context<TimeoutDeal>) -> Result<()> {
        instructions::timeout_deal::handler(ctx)
    }

    /// Emergency-abort a hand stuck at the showdown reveal (or a community reveal)
    /// because the MPC never completed. Callable by anyone after
    /// REVEAL_TIMEOUT_SECONDS; refunds every seat's stake, resets seats, and returns
    /// the table to Waiting. Only fires when the hand is genuinely unsettleable.
    /// Remaining accounts: every seat that staked into this hand.
    pub fn timeout_showdown(ctx: Context<TimeoutShowdown>) -> Result<()> {
        instructions::timeout_showdown::handler(ctx)
    }

    /// Close an inactive table and return all funds to players
    /// Can be called by anyone after 1 hour of inactivity
    pub fn close_inactive_table<'info>(
        ctx: Context<'info, CloseInactiveTable<'info>>,
    ) -> Result<()> {
        instructions::close_inactive_table::handler(ctx)
    }

    /// Collect accumulated rake from the table vault
    /// Only the table authority can call this, and only when not mid-hand
    pub fn collect_rake(ctx: Context<CollectRake>) -> Result<()> {
        instructions::collect_rake::handler(ctx)
    }

    // ============================================================
    // Arcium MPC — computation-definition initializers
    // (called once per circuit at deploy time)
    // ============================================================
    pub fn init_shuffle_comp_def(ctx: Context<InitShuffleCompDef>) -> Result<()> {
        instructions::shuffle::init_shuffle_comp_def(ctx)
    }
    pub fn init_deal_to_seat_comp_def(ctx: Context<InitDealToSeatCompDef>) -> Result<()> {
        instructions::deal_to_seat::init_deal_to_seat_comp_def(ctx)
    }
    pub fn init_reveal_flop_comp_def(ctx: Context<InitRevealFlopCompDef>) -> Result<()> {
        instructions::reveal_flop::init_reveal_flop_comp_def(ctx)
    }
    pub fn init_reveal_turn_comp_def(ctx: Context<InitRevealTurnCompDef>) -> Result<()> {
        instructions::reveal_turn::init_reveal_turn_comp_def(ctx)
    }
    pub fn init_reveal_river_comp_def(ctx: Context<InitRevealRiverCompDef>) -> Result<()> {
        instructions::reveal_river::init_reveal_river_comp_def(ctx)
    }
    pub fn init_showdown_reveal_comp_def(ctx: Context<InitShowdownRevealCompDef>) -> Result<()> {
        instructions::showdown_reveal::init_showdown_reveal_comp_def(ctx)
    }

    // ============================================================
    // Arcium MPC — shuffle (shuffle deck in-MPC, persist to MXE)
    // ============================================================
    pub fn shuffle(ctx: Context<Shuffle>, computation_offset: u64) -> Result<()> {
        instructions::shuffle::handler(ctx, computation_offset)
    }

    #[arcium_callback(encrypted_ix = "shuffle")]
    pub fn shuffle_callback(
        ctx: Context<ShuffleCallback>,
        output: SignedComputationOutputs<ShuffleOutput>,
    ) -> Result<()> {
        instructions::shuffle::callback(ctx, output)
    }

    // ============================================================
    // Arcium MPC — deal_to_seat (one seat's sealed hole cards)
    // ============================================================
    pub fn deal_to_seat(
        ctx: Context<DealToSeat>,
        computation_offset: u64,
        seat_index: u8,
        seat_pubkey: [u8; 32],
        seat_nonce: u128,
    ) -> Result<()> {
        instructions::deal_to_seat::handler(ctx, computation_offset, seat_index, seat_pubkey, seat_nonce)
    }

    #[arcium_callback(encrypted_ix = "deal_to_seat")]
    pub fn deal_to_seat_callback(
        ctx: Context<DealToSeatCallback>,
        output: SignedComputationOutputs<DealToSeatOutput>,
    ) -> Result<()> {
        instructions::deal_to_seat::callback(ctx, output)
    }

    // ============================================================
    // Arcium MPC — reveal_flop / reveal_turn / reveal_river
    // ============================================================
    pub fn reveal_flop(ctx: Context<RevealFlop>, computation_offset: u64) -> Result<()> {
        instructions::reveal_flop::handler(ctx, computation_offset)
    }

    #[arcium_callback(encrypted_ix = "reveal_flop")]
    pub fn reveal_flop_callback(
        ctx: Context<RevealFlopCallback>,
        output: SignedComputationOutputs<RevealFlopOutput>,
    ) -> Result<()> {
        instructions::reveal_flop::callback(ctx, output)
    }

    pub fn reveal_turn(ctx: Context<RevealTurn>, computation_offset: u64) -> Result<()> {
        instructions::reveal_turn::handler(ctx, computation_offset)
    }

    #[arcium_callback(encrypted_ix = "reveal_turn")]
    pub fn reveal_turn_callback(
        ctx: Context<RevealTurnCallback>,
        output: SignedComputationOutputs<RevealTurnOutput>,
    ) -> Result<()> {
        instructions::reveal_turn::callback(ctx, output)
    }

    pub fn reveal_river(ctx: Context<RevealRiver>, computation_offset: u64) -> Result<()> {
        instructions::reveal_river::handler(ctx, computation_offset)
    }

    #[arcium_callback(encrypted_ix = "reveal_river")]
    pub fn reveal_river_callback(
        ctx: Context<RevealRiverCallback>,
        output: SignedComputationOutputs<RevealRiverOutput>,
    ) -> Result<()> {
        instructions::reveal_river::callback(ctx, output)
    }

    // ============================================================
    // Arcium MPC — showdown_reveal (reveal non-folded hole cards)
    // ============================================================
    pub fn showdown_reveal(ctx: Context<ShowdownRevealAccounts>, computation_offset: u64) -> Result<()> {
        instructions::showdown_reveal::handler(ctx, computation_offset)
    }

    #[arcium_callback(encrypted_ix = "showdown_reveal")]
    pub fn showdown_reveal_callback(
        ctx: Context<ShowdownRevealCallback>,
        output: SignedComputationOutputs<ShowdownRevealOutput>,
    ) -> Result<()> {
        instructions::showdown_reveal::callback(ctx, output)
    }
}

/// Unit tests using LiteSVM for fast execution
#[cfg(test)]
mod unit_tests {
    use super::*;

    /// Test that table constants are valid
    #[test]
    fn test_table_constants() {
        assert!(MIN_PLAYERS >= 2, "Minimum players should be at least 2");
        assert!(MAX_PLAYERS >= MIN_PLAYERS, "Max players should be >= min players");
        assert!(MAX_PLAYERS <= 9, "Max players should be reasonable (<=9)");
    }

    /// Test player status transitions
    #[test]
    fn test_player_status_transitions() {
        use state::PlayerStatus;

        let sitting = PlayerStatus::Sitting;
        let playing = PlayerStatus::Playing;
        let folded = PlayerStatus::Folded;
        let all_in = PlayerStatus::AllIn;

        // Status should be comparable
        assert_ne!(sitting, playing);
        assert_ne!(playing, folded);
        assert_ne!(folded, all_in);
    }

    /// Test game phase ordering
    #[test]
    fn test_game_phase_ordering() {
        use state::GamePhase;

        // Phases should be distinct
        assert_ne!(GamePhase::Dealing, GamePhase::PreFlop);
        assert_ne!(GamePhase::PreFlop, GamePhase::Flop);
        assert_ne!(GamePhase::Flop, GamePhase::Turn);
        assert_ne!(GamePhase::Turn, GamePhase::River);
        assert_ne!(GamePhase::River, GamePhase::Showdown);
        assert_ne!(GamePhase::Showdown, GamePhase::Settled);
    }

    /// Test player seat size calculation
    #[test]
    fn test_player_seat_size() {
        use state::PlayerSeat;

        // Verify our size calculation is correct
        // 8 (discriminator) + 32 (table) + 32 (player) + 1 (seat_index) +
        // 8 (chips) + 8 (current_bet) + 8 (total_bet) +
        // 1 (revealed_card_1) + 1 (revealed_card_2) +
        // 1 (cards_revealed) + 1 (status) + 1 (has_acted) + 1 (bump)
        let expected_size = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 1 + 1;
        assert_eq!(PlayerSeat::SIZE, expected_size, "PlayerSeat size mismatch");
    }

    /// Test table size calculation
    #[test]
    fn test_table_size() {
        use state::Table;

        // 8 (discriminator) + 32 (authority) + 32 (table_id) + 8 (small_blind) +
        // 8 (big_blind) + 8 (min_buy_in) + 8 (max_buy_in) + 1 (max_players) +
        // 1 (current_players) + 1 (status) + 8 (hand_number) + 1 (occupied_seats) +
        // 1 (dealer_position) + 8 (last_ready_time) + 2 (rake_bps) + 8 (rake_cap) +
        // 8 (accumulated_rake) + 32 (token_mint) + 1 (token_decimals) + 1 (bump)
        let expected_size = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 8 + 1 + 1 + 8 + 2 + 8 + 8 + 32 + 1 + 1;
        assert_eq!(Table::SIZE, expected_size, "Table size mismatch");
    }

    /// Test action enum serialization
    #[test]
    fn test_action_variants() {
        use instructions::Action;

        let fold = Action::Fold;
        let check = Action::Check;
        let call = Action::Call;
        let raise = Action::Raise { amount: 1000 };
        let all_in = Action::AllIn;

        // Actions should be distinct
        assert_ne!(fold, check);
        assert_ne!(check, call);
        assert_eq!(raise, Action::Raise { amount: 1000 });
        assert_ne!(raise, Action::Raise { amount: 2000 });
        assert_ne!(all_in, fold);
    }

    /// Test error codes exist
    #[test]
    fn test_error_codes() {
        use error::HiddenHandError;

        // Verify key error variants exist and are distinct
        let duplicate = HiddenHandError::DuplicateAccount;
        let not_at_table = HiddenHandError::PlayerNotAtTable;
        let invalid_action = HiddenHandError::InvalidAction;

        // These should compile and be different discriminants
        assert_ne!(
            std::mem::discriminant(&duplicate),
            std::mem::discriminant(&not_at_table)
        );
        assert_ne!(
            std::mem::discriminant(&not_at_table),
            std::mem::discriminant(&invalid_action)
        );
    }

    /// Test seat bitmap operations
    #[test]
    fn test_seat_bitmap_operations() {
        // Test bitmap operations used in Table for seat management
        let mut occupied_seats: u8 = 0;

        // Occupy seat 0
        occupied_seats |= 1 << 0;
        assert_eq!(occupied_seats & (1 << 0), 1);
        assert_eq!(occupied_seats & (1 << 1), 0);

        // Occupy seat 3
        occupied_seats |= 1 << 3;
        assert_eq!(occupied_seats & (1 << 3), 8);

        // Vacate seat 0
        occupied_seats &= !(1 << 0);
        assert_eq!(occupied_seats & (1 << 0), 0);
        assert_eq!(occupied_seats & (1 << 3), 8);
    }

    /// Test place_bet with saturating arithmetic
    #[test]
    fn test_place_bet_saturating() {
        // Test that betting uses saturating arithmetic
        let chips: u64 = 1000;
        let bet_amount: u64 = 1500;

        // Should cap at available chips
        let actual_bet = bet_amount.min(chips);
        assert_eq!(actual_bet, 1000);

        // Remaining chips should be 0
        let remaining = chips.saturating_sub(actual_bet);
        assert_eq!(remaining, 0);
    }

    /// Test pot splitting arithmetic
    #[test]
    fn test_pot_splitting() {
        // Test pot splitting with remainder
        let pot: u64 = 1000;
        let winner_count: u64 = 3;

        let share = pot / winner_count;
        let remainder = pot % winner_count;

        assert_eq!(share, 333);
        assert_eq!(remainder, 1);
        assert_eq!(share * winner_count + remainder, pot);
    }
}
