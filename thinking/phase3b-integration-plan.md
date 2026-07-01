# Phase 3b — Integrate the proven Arcium circuits into HiddenHand

Branch: `arcium-migration`. Goal: replace HiddenHand's VRF+Inco card layer with the 6 MPC circuits proven in Phase 3a (`arcium_poker_spike` @ full-lifecycle), while keeping ALL betting/pot/showdown-eval logic and the 48 unit tests green.

## Scaffolding (additive, safe — do first)
1. Copy `encrypted-ixs/` (6 circuits: shuffle, deal_to_seat, reveal_flop/turn/river, showdown_reveal) into repo root.
2. Add `"encrypted-ixs"` to root `Cargo.toml` workspace members.
3. Add `Arcium.toml` (clusters.devnet offset=456).
4. Program `Cargo.toml`: add `arcium-anchor`/`arcium-client`/`arcium-macros = "=0.11.1"`, `arcium-macros`; add `idl-build` feature `arcium-anchor/idl-build`.

## Instruction surgery (`programs/hiddenhand/src/`)
`#[program]` → `#[arcium_program]` (lib.rs:21).

**REMOVE (VRF):** `request_shuffle`, `callback_shuffle` + their instruction files + `ephemeral-vrf-sdk` dep + VRF accounts.
**REMOVE (Inco):** `encrypt_hole_cards`, `grant_card_allowance`, `grant_own_allowance`, `grant_community_allowances` + `src/inco_cpi.rs` + the Inco reveal path.
**REPLACE:** `reveal_cards` (Ed25519) → `showdown_reveal` (MPC); `reveal_community` (Ed25519) → `reveal_flop`/`reveal_turn`/`reveal_river` (MPC).
**ADD:** `shuffle` + `deal_to_seat` (from spike) — plus the init/queue/callback triples + account structs for all 6, adapted to HiddenHand PDAs (table/hand-scoped, not the spike's flat `poker_hand`).
**KEEP UNTOUCHED:** `create_table`, `join_table`, `leave_table`, `start_hand`, `player_action` (betting), `showdown` (eval+payout), `collect_rake`, `timeout_player`, `close_inactive_table`, rake, side-pots, hand_eval.

## State changes
- `DeckState` (`[u128;52]` Inco handles) → deck fields on the hand/deck account: `deck: [[u8;32];2]` (FIRST field, offset 8, for `.account()` re-feed) + `deck_nonce: u128`. Keep `deal_cursor`/phase in the public state.
- `PlayerSeat`: drop the `u128` Inco hole-card handles; revealed showdown cards stay as plaintext `u8`. Hole cards live client-side (decrypted from the `HoleDealt` event per `deal_to_seat`).
- Wire the MPC phase gates into HiddenHand's existing `GamePhase` machine (shuffle after `start_hand`; deal_to_seat per seated player; reveals gated by betting-round completion; showdown_reveal before `showdown` eval).
- Update `Table::SIZE`/`DeckState` size consts + the frontend `dataSize: 177` lobby filter if Table changes.

## Dep cleanup
- Remove `ephemeral-vrf-sdk`. Re-evaluate `sha2` + `solana-instructions-sysvar` (were for Ed25519 reveals — likely removable once reveals are MPC). KEEP `session-keys` (still wanted for popup-free `player_action` betting).
- Delete `src/inco_cpi.rs`.

## Validation
- `anchor build` / `arcium build` clean.
- 48 unit tests still pass (betting/eval untouched).
- Frontend IDL regen (3c handles the client swap to `@arcium-hq/client`).

## Risks / notes
- Dependency co-resolution: arcium 0.11.1 + session-keys 3.1.1 + anchor 1.0.2 — validate early with a `cargo check`. (VRF dep is removed, so no conflict there.)
- The spike used a flat `poker_hand` PDA; HiddenHand is table+hand scoped — adapt seeds. The deck account can live under the existing hand/deck PDA.
- Latency: shuffle + N deals + 3 reveals + showdown are separate MPC round-trips; the frontend (3c) needs the optimistic-UI treatment. Consider pre-shuffling the next hand during current betting.
- This is a big surgical change — do it in compiling increments (scaffold → build encrypted-ixs → swap program macro+deps → replace instructions one group at a time → state → tests).
