use arcis::*;

/// HiddenHand — full Texas Hold'em card lifecycle as Arcium MPC circuits.
///
/// DESIGN: the shuffled 52-card deck is the single source of truth. It is shuffled
/// once in-MPC (`shuffle`), sealed to the MXE (`Enc<Mxe, Deck>`), stored
/// on-chain as opaque ciphertext, and re-fed into every later circuit. No party —
/// not even a chain observer — can read the deck. Card *positions* consumed are
/// public; card *values* never are. This closes the deck-reconstruction hole that
/// the old VRF design had (randomness was public in the callback).
///
/// Deck layout (fixed positions, so community indices don't depend on player count):
///   hole cards:  player i => deck[2i], deck[2i+1]   (i in 0..9  => positions 0..17)
///   flop:        deck[18], deck[19], deck[20]
///   turn:        deck[21]
///   river:       deck[22]
///   (positions 23..51 are muck. Burns omitted — they're pure convention and add
///    nothing to fairness since the deck is already uniformly shuffled. Trivial to
///    add as index offsets later if we want visual parity with live poker.)
///
/// Hole slots 0..8 are reserved so community indices stay at 18–22 regardless of
/// table size. Empty seats are not dealt; their slots stay in the MXE deck.
#[encrypted]
mod circuits {
    use arcis::*;

    /// Standard 52-card deck as indices 0-51 (suit = card/13, rank = card%13).
    const INITIAL_DECK: [u8; 52] = [
        0u8, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
        25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
        48, 49, 50, 51,
    ];

    /// Sentinel written into a hole-card slot that must stay hidden (folded seat).
    /// 53 is outside the valid 0-51 card range, so the client can detect "not revealed".
    const HIDDEN: u8 = 53;

    /// 52 cards packed into 2 field elements (`[[u8;32];2]`, 64 bytes on-chain).
    type Deck = Pack<[u8; 52]>;

    #[derive(Copy, Clone)]
    pub struct HoleCards {
        pub card0: u8,
        pub card1: u8,
    }

    /// Circuit 1a — shuffle the deck in-MPC and persist it to the MXE. That's all:
    /// no per-player sealing here (the combined shuffle+seal-to-9 circuit was 5.5 MB
    /// and aborted in-MPC). Returns just the MXE-sealed deck, the authoritative source
    /// re-fed into every later circuit. Tiny circuit, in the proven-working size class.
    #[instruction]
    pub fn shuffle() -> Enc<Mxe, Deck> {
        let mut deck: [u8; 52] = INITIAL_DECK;
        ArcisRNG::shuffle(&mut deck);
        Mxe::get().from_arcis(Pack::new(deck))
    }

    /// Circuit 1b — deal ONE seat's two hole cards from the persisted deck, sealed to
    /// that seat's key. Called once per active player. `seat_index` is public (which
    /// deck positions to read: 2i and 2i+1); the card *values* stay secret. This is a
    /// small re-feed circuit, same size class as the reveals.
    #[instruction]
    pub fn deal_to_seat(
        deck_ctxt: Enc<Mxe, Deck>,
        seat: Shared,
        seat_index: u8,
    ) -> Enc<Shared, HoleCards> {
        let deck = deck_ctxt.to_arcis().unpack();
        // Public mux over the 9 hole slots so a bad seat_index cannot alias the
        // board (2*9 = 18 is the flop) or abort on OOB. Out-of-range seats get
        // the HIDDEN sentinel, which the client already treats as "not a card".
        let mut card0 = HIDDEN;
        let mut card1 = HIDDEN;
        for s in 0..9 {
            let is_seat = seat_index == s as u8;
            if is_seat {
                card0 = deck[2 * s];
                card1 = deck[2 * s + 1];
            }
        }
        seat.from_arcis(HoleCards { card0, card1 })
    }

    /// Circuit 2 — reveal the flop (deck[18..21]) from the persisted deck.
    #[instruction]
    pub fn reveal_flop(deck_ctxt: Enc<Mxe, Deck>) -> [u8; 3] {
        let deck = deck_ctxt.to_arcis().unpack();
        [deck[18], deck[19], deck[20]].reveal()
    }

    /// Circuit 3 — reveal the turn (deck[21]).
    #[instruction]
    pub fn reveal_turn(deck_ctxt: Enc<Mxe, Deck>) -> u8 {
        let deck = deck_ctxt.to_arcis().unpack();
        deck[21].reveal()
    }

    /// Circuit 4 — reveal the river (deck[22]).
    #[instruction]
    pub fn reveal_river(deck_ctxt: Enc<Mxe, Deck>) -> u8 {
        let deck = deck_ctxt.to_arcis().unpack();
        deck[22].reveal()
    }

    /// Circuit 5 — showdown. Reveal the true hole cards for non-folded seats only,
    /// straight from the authoritative deck. `reveal_mask[i]` is PUBLIC (from on-chain
    /// fold tracking): true = seat i is still in the hand, reveal it; false = folded,
    /// stay hidden.
    ///
    /// The mask is plaintext (public), so the per-seat `if` is allowed (constant-time
    /// is only required for secret conditions). `.reveal()` is called once on the whole
    /// array, outside the loop.
    #[instruction]
    pub fn showdown_reveal(
        deck_ctxt: Enc<Mxe, Deck>,
        reveal_mask: [bool; 9],
    ) -> [HoleCards; 9] {
        let deck = deck_ctxt.to_arcis().unpack();

        let mut out = [HoleCards { card0: HIDDEN, card1: HIDDEN }; 9];
        for i in 0..9 {
            let c0 = if reveal_mask[i] { deck[2 * i] } else { HIDDEN };
            let c1 = if reveal_mask[i] { deck[2 * i + 1] } else { HIDDEN };
            out[i] = HoleCards { card0: c0, card1: c1 };
        }

        out.reveal()
    }
}
