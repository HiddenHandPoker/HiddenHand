//! Program events for on-chain audit trail
//!
//! Events are emitted to transaction logs and can be indexed
//! for displaying hand history to players.

use anchor_lang::prelude::*;

/// Emitted when a hand completes (showdown or everyone folds)
/// Contains all information needed to reconstruct and verify the hand
#[event]
pub struct HandCompleted {
    /// Table identifier
    pub table_id: [u8; 32],

    /// Sequential hand number
    pub hand_number: u64,

    /// Unix timestamp when hand completed
    pub timestamp: i64,

    /// Community cards (5 cards, 255 = not dealt)
    pub community_cards: [u8; 5],

    /// Total pot that was distributed
    pub total_pot: u64,

    /// Number of players who participated
    pub player_count: u8,

    /// Results for each player (up to 6)
    /// Using fixed array because Vec has variable size issues with events
    pub results: [PlayerHandResult; 6],

    /// How many results are valid (rest are zeroed)
    pub results_count: u8,
}

/// Individual player's result in a hand
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct PlayerHandResult {
    /// Player's wallet pubkey
    pub player: Pubkey,

    /// Seat index (0-5)
    pub seat_index: u8,

    /// Hole cards (255 = not shown / folded)
    pub hole_card_1: u8,
    pub hole_card_2: u8,

    /// Hand rank (0=HighCard, 1=Pair, ..., 9=RoyalFlush, 255=folded/not evaluated)
    pub hand_rank: u8,

    /// Chips won this hand (0 if lost)
    pub chips_won: u64,

    /// Total bet this hand (chips put into pot)
    pub chips_bet: u64,

    /// Whether player folded
    pub folded: bool,

    /// Whether player was all-in
    pub all_in: bool,
}

/// Emitted when a new hand starts (MPC shuffle complete, all seats dealt in, phase set to PreFlop)
#[event]
pub struct HandStarted {
    /// Table identifier
    pub table_id: [u8; 32],
    /// Sequential hand number
    pub hand_number: u64,
    /// Unix timestamp
    pub timestamp: i64,
    /// Dealer button seat index
    pub dealer_position: u8,
    /// Small blind seat index
    pub small_blind_seat: u8,
    /// Big blind seat index
    pub big_blind_seat: u8,
    /// Small blind amount posted
    pub small_blind_amount: u64,
    /// Big blind amount posted
    pub big_blind_amount: u64,
    /// Bitmap of players dealt into this hand
    pub active_players: u8,
    /// Number of active players
    pub player_count: u8,
}

/// Emitted when a player acts or is timed out
#[event]
pub struct ActionTaken {
    /// Table identifier
    pub table_id: [u8; 32],
    /// Sequential hand number
    pub hand_number: u64,
    /// Seat index of the player who acted
    pub seat_index: u8,
    /// 0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn, 5=TimeoutFold, 6=TimeoutCheck
    pub action_type: u8,
    /// Amount bet in this action (0 for fold/check)
    pub amount: u64,
    /// Total pot after this action
    pub pot_after: u64,
    /// Game phase (0=Dealing, 1=PreFlop, 2=Flop, 3=Turn, 4=River, 5=Showdown, 6=Settled)
    pub phase: u8,
    /// Unix timestamp
    pub timestamp: i64,
    /// Next player to act (255 if round/hand ended)
    pub next_action_on: u8,
}

/// Emitted when community cards are revealed (flop/turn/river)
#[event]
pub struct CommunityCardsRevealed {
    /// Table identifier
    pub table_id: [u8; 32],
    /// Sequential hand number
    pub hand_number: u64,
    /// The phase entering (Flop=2, Turn=3, River=4, Showdown=5 for all-in runout)
    pub new_phase: u8,
    /// Card values revealed in this step (3 for flop, 1 for turn, 1 for river)
    pub cards: Vec<u8>,
    /// Unix timestamp
    pub timestamp: i64,
    /// Next player to act in new betting round (255 if showdown)
    pub action_on: u8,
}

/// Emitted when the MPC `shuffle` circuit finishes and the encrypted deck is
/// persisted on-chain. Signals the frontend that seats can now be dealt.
#[event]
pub struct DeckShuffled {
    /// Sequential hand number
    pub hand_number: u64,
}

/// Emitted per seat by the `deal_to_seat` MPC callback. The sealed hole cards are
/// addressed to a single client key; only the seat that owns `enc_pubkey` can
/// decrypt `card0`/`card1` (via the Arcium client RescueCipher).
#[event]
pub struct HoleDealt {
    /// The client x25519 public key the cards were sealed to.
    pub enc_pubkey: [u8; 32],
    /// Nonce used for the sealed ciphertext (little-endian u128).
    pub nonce: [u8; 16],
    /// Sealed first hole card (one field element).
    pub card0: [u8; 32],
    /// Sealed second hole card (one field element).
    pub card1: [u8; 32],
    /// Table this deal belongs to (clients must not attach a foreign HoleDealt).
    pub table_id: [u8; 32],
    /// Hand number this deal belongs to.
    pub hand_number: u64,
    /// Seat that was dealt.
    pub seat_index: u8,
}

/// Emitted when a stuck hand is force-aborted by a liveness backstop
/// (`timeout_deal` or `timeout_showdown`) and every seat's stake is refunded.
#[event]
pub struct HandAborted {
    /// Table identifier
    pub table_id: [u8; 32],
    /// Sequential hand number
    pub hand_number: u64,
    /// 0 = dealing stall (shuffle never landed, or a seat never dealt in);
    /// 1 = reveal stall (MPC reveal never completed)
    pub reason: u8,
    /// Total stake refunded across all seats (equals the pot that was voided)
    pub refunded_total: u64,
    /// Unix timestamp
    pub timestamp: i64,
}

/// Emitted when a player reveals their hole cards at showdown
#[event]
pub struct ShowdownReveal {
    /// Table identifier
    pub table_id: [u8; 32],
    /// Sequential hand number
    pub hand_number: u64,
    /// Seat index of the revealing player
    pub seat_index: u8,
    /// First hole card (0-51)
    pub card_1: u8,
    /// Second hole card (0-51)
    pub card_2: u8,
    /// Unix timestamp
    pub timestamp: i64,
}
