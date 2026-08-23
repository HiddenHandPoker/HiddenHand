# Devnet remaining cut — 2026-08-23

**Goal:** Unblock live deals on program `GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`, then finish the leftover product work without mixing toolchains.

**Stack freeze:** Arcium crates `=0.11.1`, CLI `0.11.2`, `@arcium-hq/client ^0.11.2`, cluster **456**. No 0.13 bump in this cut.

## Why deals are dead right now

The upgraded program's `deal_to_seat` computation definition (`DEX1a…`, offset `2978190981`) was **deactivated** so we could re-init it against the muxed circuit. Deactivation is irreversible.

Close then failed with `ComputationDefinitionHasActiveComputations` (6308) and still fails after TTL (3,000+ slots). Cluster-456 **execpool** holds 10 **other-MXE** computations, all `Queued`, all ~28 days old. Close only sees execpool metadata (`queued_slot`), not MXE identity, so those zombies look like in-flight work. `reclaim_expired_computation_fee` is not a usable drain from our wallet.

**Consequence:** we cannot re-init the same offset. GitHub already has the new `.arcis` bytes, so even a hash rollback would not help — the def is deactivated, so new queues are rejected.

## Approach

Ship a **new encrypted-instruction name** (`deal_to_seat_v2`) → new `comp_def_offset` → init a fresh OffChain def. Keep the public Anchor instruction `deal_to_seat` so the player-facing IDL method does not move.

Leave the old def deactivated (cannot close until Arcium drains cluster 456). Do **not** bump 0.13. Do **not** persist x25519 on `PlayerSeat` (layout change). Do **not** add in-MPC muck.

## Gates

- All 9 live tables are `Waiting` before any upgrade.
- `arcium --version` is 0.11.2; crates stay 0.11.1.
- Hosted `deal_to_seat_v2.arcis` sha256 == `circuit_hash!("deal_to_seat_v2")` == on-chain def hash after init.
- `cargo test -p hiddenhand` green before deploy.
- Smoke: fresh table, 2 players, shuffle + deal, decrypt matches.

## Out of this cut

- Arcium 0.13.2 pin
- `claimComputationRent` (not in 0.11.2 client)
- Persist x25519 on `PlayerSeat`
- In-MPC muck
- Merge to `main`
