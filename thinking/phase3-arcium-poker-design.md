# Phase 3 — Arcium Poker Circuit Design

**Goal:** Replace the card-privacy core (shuffle, deal, hole/community reveal, showdown reveal) with Arcium MPC circuits. Retire MagicBlock VRF (`ephemeral-vrf-sdk`) and Inco (`inco_cpi.rs`) entirely. Keep everything else (seating, blinds, betting, pot/side-pots, fold tracking, rake, hand evaluation) on the public Solana path.

**Why:** the current design has a SEV-HIGH flaw — the deck is reconstructable from the public VRF callback randomness (see `deck-reconstruction-vuln.md`). MPC shuffle fixes this by construction: the shuffle happens inside the MPC, randomness never touches the chain, and the deck lives on-chain only as an opaque MXE ciphertext.

## Version stack (LOCKED — from the working spike)

| Component | Version | Note |
|-----------|---------|------|
| `arcis` (circuits) | `0.11.1` | crate is `arcis`, not `arcis_imports` |
| `arcium-anchor` / `-client` / `-macros` | `=0.11.1` | exact pin |
| `anchor-lang` | `1.0.2` (→1.1.2) | **matches HiddenHand post-Phase-2** ✅ |
| `arcium` CLI | `0.11.2` | installed |
| `solana` CLI | `3.1.9` | installed |
| `@arcium-hq/client` | `0.11.2` | frontend |
| cluster offset | `456` | devnet |

**The skill's "Anchor 0.32.1 / Solana 2.3.0 exact" guidance is for Arcium 0.9.x and is STALE. Build against 0.11.x APIs (init_computation_def takes `Some(source)`; queue_computation ends `..., 1, 0, 0`; `derive_*_pda!` dropped an arg; offchain CircuitSource).** No version conflict with HiddenHand's Phase-2 stack.

## Circuit architecture (5 circuits)

Design constants: `MAX_PLAYERS = 9`, `Deck = Pack<[u8;52]>` (52 bytes → 2 field elements → `[[u8;32];2]`, 64 bytes on-chain). Game-phase state machine stays in the Anchor program (Arcis has no enums); each queue is gated by `require!`.

### 1. `shuffle_and_deal` (once per hand)
```rust
fn shuffle_and_deal(players: [Shared; 9], num_players: u8)
    -> (Enc<Mxe, Deck>, [Enc<Shared, HoleCards>; 9])
```
- `ArcisRNG::shuffle(&mut deck)` in-MPC on `[u8;52]`.
- Hole cards at deck indices `2i, 2i+1` sealed to seat i's key (`players[i].from_arcis(..)`). Seats `>= num_players` get sealed junk the program ignores.
- Full deck sealed to the **MXE** (`Mxe::get().from_arcis(Pack::new(deck))`) for persistence.
- Callback stores `deck: [[u8;32];2]` + `deck_nonce: u128`; emits per-player `HoleDealt` events (each client decrypts only its own).

### 2–4. Community reveals (re-feed the same `Enc<Mxe,Deck>`)
```rust
fn reveal_flop(deck_ctxt: Enc<Mxe, Deck>, num_players: u8) -> [u8; 3]
fn reveal_turn(deck_ctxt: Enc<Mxe, Deck>, num_players: u8) -> u8
fn reveal_river(deck_ctxt: Enc<Mxe, Deck>, num_players: u8) -> u8
```
- `deck_ctxt.to_arcis().unpack()`, compute community indices from `num_players` (arithmetic only), `.reveal()` the card(s) **outside any conditional**.
- Program re-feeds the deck via `ArgBuilder….plaintext_u128(deck_nonce).account(hand.key(), <deck_offset>, 32*2)`. No `.x25519_pubkey()` for `Enc<Mxe>`.
- Deck bytes unchanged → these don't re-persist the deck (skip a callback write). 3 separate computations because betting happens between streets.

### 5. `showdown_reveal` (reveal only non-folded hole cards)
```rust
fn showdown_reveal(players: [Enc<Shared, HoleCards>; 9], reveal_mask: [bool; 9], num_players: u8)
    -> [HoleCards; 9]   // folded seats → sentinel [53,53]
```
- `reveal_mask` from public fold-tracking. Compute-then-`.reveal()` outside the loop; folded cards never revealed. Batched (one round-trip) beats per-player reveal for UX.

### Deck flow
```
shuffle_and_deal → Enc<Mxe,Deck> on-chain (deck + deck_nonce) + 9× Enc<Shared,HoleCards> to clients
      │ re-feed .account + deck_nonce (nonce auto-increments each MPC decrypt)
      ▼
reveal_flop → [u8;3].reveal()   reveal_turn → u8   reveal_river → u8   (public board)
      ▼
showdown_reveal → non-folded hole cards revealed → Anchor hand-eval on public cards
```

## On-chain state changes
- **Delete** `DeckState` (the `[u128;52]` Inco-handle account) and its PDA.
- **Add** to `HandState` (or a slim deck account): `deck: [[u8;32];2]`, `deck_nonce: u128`, `deal_cursor: u8`. Only *positions* consumed are public; card *values* never are.
- `PlayerSeat` hole-card fields: drop the `u128` Inco-handle mode; hole cards live client-side (decrypted from `HoleDealt`) and are proven at showdown via the reveal circuit. Keep the plaintext `u8` fields for the revealed/showdown values.
- Retire: `request_shuffle`, `callback_shuffle` (VRF), `encrypt_hole_cards`, `grant_card_allowance`, `grant_own_allowance`, `grant_community_allowances` (Inco). Replace `reveal_cards`/`reveal_community` Ed25519-attestation path with MPC `.reveal()`.

## Key risks (with mitigations)
1. **Latency — the big one.** ~13–21s per MPC computation on devnet. A full hand = shuffle_and_deal + 3 reveals + showdown = **5 round-trips ≈ 60–100s of MPC wall-time** on top of betting. Inherent to the privacy model. Mitigations: pre-shuffle/pre-deal hand N+1 during hand N's betting (removes deal from critical path); optimistic UI with clear "dealing… / revealing flop…" states; re-measure on mainnet. **The board pause (~15s/street) is the unavoidable in-hand cost of provable privacy.**
2. **Callback 1232-byte limit** on `shuffle_and_deal` (9 players × cards+nonce+pubkey + deck ≈ tight). Size empirically; fall back to `EncData<T>` (drops pubkey/nonce metadata) or split the deal into two callbacks.
3. **Offchain CircuitSource is mandatory** — a 52-card `.arcis` is multi-MB; on-chain upload is ~34.5 SOL + RPC 429s that silently truncate → MPC aborts. Host `.arcis` at a public URL + `circuit_hash!("name")`.
4. **Arcis constraints:** fixed `0..9` loops (no variable len), no `break`/`return`/`match` on secrets, no enums (phase machine → Anchor), no `Option`, no `<<`. Per-seat logic uses boolean masks for empty/folded seats.
5. **`.reveal()` cannot be inside a conditional** — compute-then-reveal; gate via masks/sentinels.
6. **Nonce discipline:** store the *output* deck nonce from each callback, feed current back; fresh `randomBytes(16)` per client encryption.
7. **Devnet flakiness:** retry MXE-pubkey fetch; parse events from callback tx logs (WS unreliable); use the Helius Dev-plan RPC.

Canonical reference: `github.com/arcium-hq/examples` **blackjack** (does the exact Enc<Mxe>-deck re-feed via `.account(...)`).

## Phased plan
- **3a — Prove the full lifecycle in isolation (de-risk).** Build the 5 real circuits (52-card) + `Enc<Mxe>` deck re-feed in a clean Arcium project, test on devnet: shuffle_and_deal → store deck → reveal_flop/turn/river → showdown_reveal. The re-feed across 5 sequential computations is the #1 UNPROVEN risk (spike only did one-shot deal). Also measures real callback sizes + latency. **Gate: green before touching HiddenHand.**
- **3b — Integrate into HiddenHand.** Make `hiddenhand` an `#[arcium_program]`; add `encrypted-ixs/` + `Arcium.toml`; swap the retired instructions for the 5 MPC ones; migrate state; drop `ephemeral-vrf-sdk` + `inco_cpi.rs`. Keep 48 unit tests green (betting/eval untouched).
- **3c — Frontend cutover.** Replace Inco SDK (`lib/inco.ts`) with `@arcium-hq/client` (x25519/RescueCipher); wire the 5 MPC steps + latency UX; parse `HoleDealt`/reveal events.
- **3d — Retire & document.** Remove VRF/Inco deps + dead code; update CLAUDE.md + memories; devnet deploy.
