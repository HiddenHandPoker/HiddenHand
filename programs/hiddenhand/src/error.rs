use anchor_lang::prelude::*;

#[error_code]
pub enum HiddenHandError {
    #[msg("Table is full")]
    TableFull,

    #[msg("Table is not full enough to start")]
    NotEnoughPlayers,

    #[msg("Player is not at this table")]
    PlayerNotAtTable,

    #[msg("Player is already at this table")]
    PlayerAlreadyAtTable,

    #[msg("Invalid seat index")]
    InvalidSeatIndex,

    #[msg("Seat is already occupied")]
    SeatOccupied,

    #[msg("Seat is empty")]
    SeatEmpty,

    #[msg("Not player's turn")]
    NotPlayersTurn,

    #[msg("Invalid action for current game state")]
    InvalidAction,

    #[msg("Insufficient chips")]
    InsufficientChips,

    #[msg("Buy-in amount out of range")]
    InvalidBuyIn,

    #[msg("Hand is not in progress")]
    HandNotInProgress,

    #[msg("Hand is already in progress")]
    HandAlreadyInProgress,

    #[msg("Cannot fold - no bet to fold from")]
    CannotFold,

    #[msg("Cannot check - must call or raise")]
    CannotCheck,

    #[msg("Raise amount too small")]
    RaiseTooSmall,

    #[msg("Betting round not complete")]
    BettingRoundNotComplete,

    #[msg("Invalid phase for this action")]
    InvalidPhase,

    #[msg("Player action timeout")]
    ActionTimeout,

    #[msg("Player has not timed out yet - must wait 60 seconds")]
    ActionNotTimedOut,

    #[msg("Only table authority can perform this action")]
    UnauthorizedAuthority,

    #[msg("Showdown requires at least 2 active players")]
    ShowdownRequiresPlayers,

    #[msg("Invalid card index")]
    InvalidCardIndex,

    #[msg("Deck already shuffled for this hand")]
    DeckAlreadyShuffled,

    #[msg("Deck not yet shuffled - shuffle the deck (MPC) first")]
    DeckNotShuffled,

    #[msg("Cards not yet dealt")]
    CardsNotDealt,

    #[msg("All community cards already revealed")]
    AllCardsRevealed,

    #[msg("Player has already folded")]
    PlayerFolded,

    #[msg("Player is already all-in")]
    PlayerAlreadyAllIn,

    #[msg("Table is not in waiting state")]
    TableNotWaiting,

    #[msg("Cannot leave during active hand")]
    CannotLeaveDuringHand,

    #[msg("Arithmetic overflow")]
    Overflow,

    #[msg("Duplicate accounts provided")]
    DuplicateAccount,

    #[msg("Invalid remaining accounts")]
    InvalidRemainingAccounts,

    // Retired (Inco era) — kept for error-code stability, see note below.
    #[msg("Invalid account count - expected multiple of 3 for encryption")]
    InvalidAccountCount,

    #[msg("Cards have already been revealed")]
    CardsAlreadyRevealed,

    #[msg("Player is not active (folded or not playing)")]
    PlayerNotActive,

    #[msg("Invalid card value - must be 0-51")]
    InvalidCard,

    // Retired (Inco/Ed25519 era) — kept because removing a variant renumbers every
    // subsequent Anchor error code (6000 + index) and would break the deployed
    // program's error mapping. Do not remove or reorder.
    #[msg("Signature verification failed")]
    Ed25519VerificationFailed,

    #[msg("All active players must reveal before showdown can complete")]
    PlayersNotRevealed,

    #[msg("Timeout not reached - must wait longer")]
    TimeoutNotReached,

    #[msg("This is not your seat")]
    NotYourSeat,

    // Retired (Inco era) — kept for error-code stability, see note above.
    #[msg("Cards are not encrypted yet")]
    CardsNotEncrypted,

    #[msg("Cannot perform this action while hand is in progress")]
    HandInProgress,

    #[msg("Waiting for community cards to be revealed - authority must call reveal_community")]
    AwaitingCommunityReveal,

    #[msg("Community cards not ready for reveal - betting round not complete")]
    CommunityNotReady,

    #[msg("Invalid community cards for current phase")]
    InvalidCommunityCards,

    #[msg("Rake basis points exceeds maximum (1000 = 10%)")]
    RakeExceedsLimit,

    #[msg("No accumulated rake to collect")]
    NoRakeToCollect,

    #[msg("Token mint does not match table's configured token")]
    InvalidTokenMint,

    #[msg("The MPC computation was aborted")]
    AbortedComputation,

    #[msg("Seat index does not match the player seat account")]
    InvalidSeat,

    #[msg("Player was not dealt into this hand")]
    PlayerNotInHand,

    #[msg("This seat has already been dealt its hole cards")]
    AlreadyDealt,

    #[msg("Not all players in the hand were provided — every active seat and every contributor to the pot must be included")]
    IncompletePlayerAccounts,

    #[msg("Hand is not stuck — it can still be settled via showdown, so it cannot be aborted")]
    HandNotStuck,
}
