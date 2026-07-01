use anchor_lang::prelude::*;

/// Deck state for a hand — Arcium MPC edition.
///
/// The whole 52-card deck is shuffled once in-MPC (`shuffle` circuit) and stored
/// here as an opaque `Enc<Mxe, Pack<[u8;52]>>` ciphertext (`deck` + `deck_nonce`).
/// No party — not even a chain observer — can read it. It is re-fed unchanged into
/// every later circuit (`deal_to_seat`, `reveal_flop/turn/river`, `showdown_reveal`)
/// via `.account(deck_state.key(), 8, 64)` + `deck_nonce`.
///
/// `deck` is the FIRST field so it sits at byte offset 8 (right after the 8-byte
/// discriminator), which the `.account()` re-feed requires.
#[account]
pub struct DeckState {
    /// Enc<Mxe, Pack<[u8;52]>> — the whole shuffled deck as opaque ciphertext.
    /// 52 bytes pack into 2 field elements (`[[u8;32];2]`, 64 bytes on-chain).
    /// MUST be the first field (byte offset 8) for the `.account()` re-feed.
    pub deck: [[u8; 32]; 2],

    /// Nonce the deck was sealed with (re-fed on every read; never changes here).
    pub deck_nonce: u128,

    /// Reference to the hand this deck belongs to.
    pub hand: Pubkey,

    /// Hand number (mirrors HandState.hand_number; used in DeckShuffled event).
    pub hand_number: u64,

    /// Whether the MPC shuffle has completed and `deck` is populated.
    pub is_shuffled: bool,

    /// PDA bump.
    pub bump: u8,
}

impl DeckState {
    pub const SIZE: usize = 8 + // discriminator
        (32 * 2) + // deck (2 field elements)
        16 + // deck_nonce (u128)
        32 + // hand
        8 +  // hand_number
        1 +  // is_shuffled
        1;   // bump
}

/// Helper functions for card encoding
/// Card value: 0-51
/// Suit: value / 13 (0=Hearts, 1=Diamonds, 2=Clubs, 3=Spades)
/// Rank: value % 13 (0=2, 1=3, ..., 8=10, 9=J, 10=Q, 11=K, 12=A)
pub mod card_utils {
    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Suit {
        Hearts = 0,
        Diamonds = 1,
        Clubs = 2,
        Spades = 3,
    }

    #[derive(Clone, Copy, Debug, PartialEq, Eq)]
    pub enum Rank {
        Two = 0,
        Three = 1,
        Four = 2,
        Five = 3,
        Six = 4,
        Seven = 5,
        Eight = 6,
        Nine = 7,
        Ten = 8,
        Jack = 9,
        Queen = 10,
        King = 11,
        Ace = 12,
    }

    pub fn card_to_suit(card: u8) -> Suit {
        match card / 13 {
            0 => Suit::Hearts,
            1 => Suit::Diamonds,
            2 => Suit::Clubs,
            _ => Suit::Spades,
        }
    }

    pub fn card_to_rank(card: u8) -> Rank {
        match card % 13 {
            0 => Rank::Two,
            1 => Rank::Three,
            2 => Rank::Four,
            3 => Rank::Five,
            4 => Rank::Six,
            5 => Rank::Seven,
            6 => Rank::Eight,
            7 => Rank::Nine,
            8 => Rank::Ten,
            9 => Rank::Jack,
            10 => Rank::Queen,
            11 => Rank::King,
            _ => Rank::Ace,
        }
    }

    pub fn encode_card(suit: Suit, rank: Rank) -> u8 {
        (suit as u8) * 13 + (rank as u8)
    }

    /// Display card as string (for debugging/UI)
    pub fn card_to_string(card: u8) -> String {
        let rank = match card % 13 {
            0 => "2",
            1 => "3",
            2 => "4",
            3 => "5",
            4 => "6",
            5 => "7",
            6 => "8",
            7 => "9",
            8 => "T",
            9 => "J",
            10 => "Q",
            11 => "K",
            12 => "A",
            _ => "?",
        };
        let suit = match card / 13 {
            0 => "h", // hearts
            1 => "d", // diamonds
            2 => "c", // clubs
            3 => "s", // spades
            _ => "?",
        };
        format!("{}{}", rank, suit)
    }
}
