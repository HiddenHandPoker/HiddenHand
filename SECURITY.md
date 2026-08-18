# HiddenHand Security

HiddenHand is a privacy-preserving Texas Hold'em program on Solana. Card privacy is
provided by [Arcium](https://arcium.com) MPC; all funds logic is public Anchor code.
This document describes the trust model, the internal audit performed in August 2026,
and every finding with its fix.

## Trust model

### What the MPC guarantees

- The deck is shuffled inside Arcium's MPC network (Cerberus protocol — dishonest
  majority, one honest node suffices). Randomness never touches the chain.
- The deck exists on-chain only as an opaque MXE ciphertext (`DeckState.deck`). No
  chain observer — including the table authority — can reconstruct it.
- Hole cards are sealed to each player's x25519 key (`HoleDealt` event). Only that
  player can decrypt them, client-side.
- Board cards and showdown holes become public only through explicit `.reveal()`
  circuits (`reveal_flop/turn/river`, `showdown_reveal`).

### What the program guarantees

- Betting, pot accounting, side pots, rake, and hand evaluation are deterministic
  public logic, unit-tested (46 tests).
- Real token transfers happen only at 4 entry/exit points: `join_table`,
  `leave_table`, `collect_rake`, `close_inactive_table`. Gameplay instructions
  manipulate an internal chip ledger and never touch the vault.
- Liveness: any hand that stalls has a permissionless recovery path (see table
  below). Player funds can never be locked indefinitely by an AFK player, an AFK
  authority, or a sustained MPC-network failure.

| Stall | Backstop | Timeout | Outcome |
|---|---|---|---|
| Player won't act (betting) | `timeout_player` | 60 s | Auto-check/fold that seat |
| Seat never deals in | `timeout_deal` | 30 s | Abort hand, refund all stakes |
| MPC reveal never completes | `timeout_showdown` | 180 s | Abort hand, refund all stakes |
| Table abandoned | `close_inactive_table` | 1 h | Close table, return all funds |

### Session keys

Gameplay uses MagicBlock session keys scoped to this program only. A compromised
session key cannot withdraw funds (`leave_table` requires the real wallet); worst
case is bad in-hand decisions bounded by the table buy-in.

## Internal audit (August 2026)

A full-program review was performed against the Arcium-MPC architecture. All
findings below are fixed. Severity: C = critical, H = high, M = medium, L = low.

### C-1 — Anyone could deal (and decrypt) a victim's hole cards

`deal_to_seat` takes a caller-supplied x25519 public key and seals the seat's hole
cards to it. The instruction did not require the payer to own the seat, so an
attacker could deal a victim's seat with the attacker's own key and decrypt the
victim's cards.

**Fix:** constraint `player_seat.player == payer` (`NotYourSeat`) in
`deal_to_seat.rs`.

### H-1 — Showdown accepted an incomplete set of player accounts

`showdown` evaluated whichever seats the caller passed as `remaining_accounts`. A
caller could omit the true winner (auto-scooping as the "sole eligible" hand) or
omit a folded contributor to bias side-pot math.

**Fix:** `showdown.rs` now requires (1) every seat still active in the hand to be
present (bitmask comparison against `hand_state.active_players`) and (2) the summed
`total_bet_this_hand` across all passed seats to equal the pot
(`IncompletePlayerAccounts`). Duplicates were already rejected.

### H-2 — Duplicate shuffle callback could swap a committed deck

The queue-time guard only checks `is_shuffled`, which is set in the callback —
several shuffles could be queued before the first callback lands, and a late second
callback would overwrite the committed deck under already-dealt cards.

**Fix:** `shuffle.rs` callback is a no-op once `deck_state.is_shuffled` is true.

### H-3 — A lone winner's hole cards could be force-exposed

Two paths routed a hand with one remaining player to the `Showdown` phase
(`timeout_player` lone-survivor, all-in runout after folds), where the
permissionless `showdown_reveal` would expose the uncontested winner's cards.

**Fix:** lone-winner hands settle without showdown (`GamePhase::Settled`) in both
paths, plus a defense-in-depth `active_count > 1` guard in `showdown_reveal`.

### M-1 — `timeout_deal` refunds trusted the caller-supplied account set

Duplicate seats could be refunded twice; omitted seats would have their stake
silently destroyed when the pot was zeroed.

**Fix:** per-seat de-duplication and a `refunded_total == pot` completeness check
(`DuplicateAccount` / `IncompletePlayerAccounts`).

### M-2 — Action timeout could fire during a community-reveal wait

Calling `timeout_player` while `awaiting_community_reveal` auto-checked a player and
reset `last_action_time`, letting a griefer push back the non-authority reveal
deadline indefinitely.

**Fix:** `timeout_player` rejects while `awaiting_community_reveal`
(`AwaitingCommunityReveal`), mirroring `player_action`.

### L-1 — All-in players could leave mid-hand

`leave_table` allowed exit when `chips == 0`, letting an all-in player close their
seat, forfeit pot equity, and strand their contribution in the vault (also breaking
the H-1 completeness invariant).

**Fix:** leaving is forbidden whenever `table.status == Playing`. Join is only
possible while `Waiting`, so every seated player is a hand participant.

### L-2 — Rake stranded after emergency table close

`collect_rake` required `TableStatus::Waiting`; a table closed via
`close_inactive_table` (which refunds chips but leaves rake in the vault) made the
accumulated rake permanently uncollectable.

**Fix:** collection is allowed for `Waiting` or `Closed` tables.

### New instruction: `timeout_showdown`

A hand whose `showdown_reveal` (or community reveal) MPC never completes was
previously unrecoverable: `showdown` reverts with `PlayersNotRevealed` and
`leave_table` correctly forbids exiting mid-hand. `timeout_showdown` lets anyone,
after 180 s without progress, abort such a hand with a full refund of every stake.
Guards: all active seats must be passed and de-duplicated, refunds must equal the
pot, and — in the `Showdown` phase — at least one active seat must still be
unrevealed, so a losing player cannot dodge a decided showdown (`HandNotStuck`).

Both abort paths emit a `HandAborted` event for the on-chain audit trail.

## Verification

- `app/scripts/devnet-exploit-checks.cjs` — runs a real hand on devnet and asserts
  the C-1, L-1, and H-1 attacks are rejected with the exact expected errors, then
  completes the hand legitimately with chip conservation.
- `app/scripts/devnet-timeout-showdown.cjs` — drives a hand into a stuck showdown,
  asserts the early abort fails (`TimeoutNotReached`), then verifies the post-180 s
  abort refunds every stake.
- `app/scripts/devnet-full-hand.cjs` — end-to-end happy path through live MPC.
- `app/scripts/test-timeout-deal.cjs` — deal-stall abort with refund completeness.

## Known limitations

- Error-code stability: retired Inco-era error variants are kept in
  `error.rs` because removing enum variants renumbers Anchor error codes.
- `GamePhase` variant order is part of the event ABI (`phase as u8`); do not
  reorder.
- The frontend's `useHandHistory.ts` hardcodes event discriminators; any event
  schema change must regenerate them (see `CLAUDE.md`).

## Reporting a vulnerability

Open a private security advisory on GitHub
(`HiddenHandPoker/HiddenHand` → Security → Advisories) or contact the maintainer.
Please do not open public issues for exploitable findings.
