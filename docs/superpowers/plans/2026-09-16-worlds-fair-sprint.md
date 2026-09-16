# HiddenHand World's Fair Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** By 2026-10-08, ship a frozen, always-on, two-wallet exhibit of HiddenHand as Arcium-MPC Hold'em with no host chrome, named showdown, honest privacy visualization, a clean public repo, and two new Colosseum videos.

**Architecture:** Keep the six existing Arcis circuits and the public betting/pot engine. Add a permissionless crank for protocol steps on a pinned demo table; widen `start_hand` / community reveal / `showdown` so any seated player may call immediately; delete Authority Controls from the felt; bind existing MPC flags to felt theater and `HandCompleted` to a results overlay. No new circuits on the critical path. No session keys on `deal_to_seat`.

**Tech Stack:** Anchor 1.0.2 / Solana 3.x, arcis/arcium-anchor `=0.11.1`, Arcium CLI `0.11.2`, `@arcium-hq/client` `0.11.2`, cluster offset **456**, Next.js 16, program `GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`.

**Spec:** `docs/superpowers/specs/2026-09-16-worlds-fair-sprint-design.md`

## Global Constraints

- Stack freeze: do not bump arcis/arcium past 0.11.1 or CLI past 0.11.2.
- Cluster offset is 456. Encrypted ix for dealing is `deal_to_seat_v2`; public ix stays `deal_to_seat`.
- Never remove or reorder `HiddenHandError` variants; append only.
- Never reorder `GamePhase` variants (`Dealing=0` … `Settled=6`).
- `DeckState.deck` stays the first field (byte offset 8, len 64).
- `Table::SIZE` stays 177; `app/hooks/useLobby.ts` `dataSize: 177` must match.
- Do not add fields to `PlayerSeat` (long-lived across hands).
- Hole layout: seat `i` → `deck[2i], deck[2i+1]`; flop 18–20; turn 21; river 22; `HIDDEN = 53`. Circuit loops `0..9` even though `MAX_PLAYERS = 6`.
- OffChain circuit URLs + `circuit_hash!()` stay pinned to `github.com/criptocbas/hiddenhand-arcium-circuit`. Critical path does not edit circuits.
- C-1 remains: `deal_to_seat` requires `player_seat.player == payer`. Do not pass `sessionToken` into deal.
- H-2 remains: shuffle and street callbacks are one-shot no-ops if already committed.
- Spectator invariant: `useTableState` hole cards stay `[null, null]` until public `revealedCards`.
- Public RPC drops Arcium txs. All live paths use `NEXT_PUBLIC_SOLANA_RPC` (Helius or equivalent).
- Upgrade the program only when demo/live tables are `Waiting`, or accept in-flight hands stay on the old binary.
- Copy rules: never say Inco, FHE, VRF-as-current, "a few seconds", "popup-free gameplay" as a headline, "any stakes", "$60B", "trustless", "no house", "first private poker". Latency is **15–20s per MPC round**. Session keys are **betting only**.
- Do not reuse `https://youtu.be/6WgATb6sfp4`.
- Never `solana-keygen new --force` onto `~/.config/solana/id.json` or `~/.config/solana/hiddenhand/{program,upgrade-authority}.json`.
- Every PR that touches the program: `cargo fmt -p hiddenhand -- --check`, `cargo clippy -p hiddenhand -- -D warnings`, `cargo test -p hiddenhand`.
- Every PR that touches `app/`: `cd app && npm run build`. Lint is non-blocking in CI; do not add new `any` or exhaustive-deps debt in files you touch.
- If you change an event struct, regenerate discriminators (`echo -n "event:<EventName>" | sha256sum`, first 8 bytes) and update `app/hooks/useHandHistory.ts` in the same PR.
- Play-money only. No mainnet, no real USDC as the demo path (HHC faucet is the demo path).

---

## File map (locked)

| File | Responsibility this sprint |
|---|---|
| `CLAUDE.md` | Banner stays. Historical Inco/VRF half becomes a one-line tombstone pointing at `thinking/privacy-backend-decision-2026.md`. |
| `SECURITY.md` | Session-key paragraph = betting path only. |
| `README.md` | Keep VRF→MPC story. Align latency/session claims with the product. |
| `COMPETITIVE.md` | **Create.** Honest census vs CerberusPoker / arcium_poker / FastPoker / CoinPoker. |
| `thinking/inco-fhe-vs-magicblock-analysis.md` | Banner at top: HISTORICAL, superseded. |
| `scripts/test-inco-cpi.mjs`, `scripts/test-inco-from-er.mjs`, `scripts/test-vrf-oracle.mjs` | Delete or move to `scripts/historical/` with a README that says do not run. |
| `tests/hiddenhand.ts` (and siblings if they still call `requestShuffle`) | Tombstone: skip with a message, or remove from `Anchor.toml` test glob. Do not leave a landmine `anchor test`. |
| `app/README.md` | Replace create-next-app stub with how to run the app + required env vars. |
| `app/app/page.tsx` | Watch CTA, honest latency, faucet, Quick Play. |
| `app/app/lobby/page.tsx` | Empty state → demo table / Quick Play, not "No tables found" as the product. |
| `app/app/table/[tableId]/page.tsx` | Delete Authority Controls; auto-orchestration; showdown overlay; click-seat sit. |
| `app/hooks/usePokerGame.ts` | `collectRake`; seated-immediate callers; HoleDealt `hand_number` match; optional leader auto-queue. |
| `app/hooks/useTableState.ts` | Strip Inco comments. Privacy invariant unchanged. |
| `app/hooks/useHandHistory.ts` | Live `ActionTaken` already parsed — export a feed the felt can subscribe to. |
| `app/hooks/useLobby.ts` | Keep `dataSize: 177`. Pin/filter `judge-demo` if needed. |
| `app/lib/arcium.ts` | `findHoleDealtForKey` matches `handNumber`. Scan table PDA. |
| `app/components/PokerTable.tsx` | Felt theater, winner rings, last-action slot. |
| `app/components/PlayerSeat.tsx` | `lastAction` bubble; hand-rank line at showdown; encrypted default for opponents. |
| `app/components/Card.tsx` | Use existing `encrypted` state as opponent default. |
| `app/components/GameStatusBar.tsx` | Circuit-named MPC copy; no "host". |
| `app/components/ActionPanel.tsx` | Pot-fraction presets (P1). |
| `app/components/ProvablyFairBadge.tsx` | Visible during compute. |
| `app/components/WinCelebration.tsx` | Either use it from the overlay or delete the dead import path. Do not leave both. |
| `app/app/api/faucet/route.ts` | Unchanged mint path; add a cheap GET health if missing. |
| `app/scripts/demo-crank.cjs` | **Create.** Keeper for the pinned table. |
| `app/scripts/devnet-full-hand.cjs` | Regression after program upgrade. |
| `app/scripts/devnet-exploit-checks.cjs` | Regression after program upgrade. |
| `programs/hiddenhand/src/instructions/start_hand.rs` | Seated-player-immediate. |
| `programs/hiddenhand/src/instructions/reveal_common.rs` | Seated-player-immediate for `authorize_reveal`. |
| `programs/hiddenhand/src/instructions/showdown.rs` | Seated-player-immediate. |
| `programs/hiddenhand/src/error.rs` | Only if EncKey stretch: append `EncKeyMismatch` at the **end**. |
| `encrypted-ixs/src/lib.rs` | **Do not touch** on the critical path. |

---

### Task 0: Narrative freeze (public commit #1)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `SECURITY.md` (session-key section ~lines 39–43)
- Modify: `README.md` (Status & honest tradeoffs ~lines 191–198; landing claims if any contradict 15–20s)
- Create: `COMPETITIVE.md`
- Modify: `thinking/inco-fhe-vs-magicblock-analysis.md` (historical banner)
- Modify: `app/README.md`
- Modify: `app/hooks/useTableState.ts` (file-header comment only)
- Delete or move: `scripts/test-inco-cpi.mjs`, `scripts/test-inco-from-er.mjs`, `scripts/test-vrf-oracle.mjs`
- Modify: `tests/hiddenhand.ts` — skip the whole file or the VRF/Inco describes
- Modify: `Anchor.toml` `[scripts] test` if the TS suite cannot run against this program

**Interfaces:**
- Consumes: nothing
- Produces: a public repo that greps as Arcium-current

- [ ] **Step 1: Confirm the Inco grep surface**

Run:

```bash
rg -n "Inco|inco_cpi|requestShuffle|MagicBlock VRF|lib/inco" --glob '!node_modules/**' --glob '!target/**' --glob '!app/node_modules/**' --glob '!marketing/**' --glob '!_local_assessment/**' | head -80
```

Expected: hits in `CLAUDE.md` historical half, `thinking/`, `scripts/test-inco*`, `tests/hiddenhand.ts`, comments in `useTableState.ts` / `error.rs` retired variants (those stay).

- [ ] **Step 2: Truncate `CLAUDE.md` historical half**

Keep the Arcium banner (the "CURRENT STATE (2026)" block through the frontend/RPC paragraph). Replace everything from `## Conversation Context` through the old "Current Instructions (18 total)" / Inco file tree with:

```markdown
## Historical note

The sections that used to follow this banner described the retired
MagicBlock VRF + Inco TEE design (Solana Privacy Hack, 2025). That
design had a SEV-HIGH flaw: the deck was reconstructable from public
VRF callback randomness. The rewrite is documented in
`thinking/privacy-backend-decision-2026.md`. Do not treat any
Inco / VRF / `inco_cpi.rs` / `lib/inco.ts` text as current.
```

Keep the rest of the file only if it is still true (PDAs, token vault, events table, `useHandHistory` discriminator gotcha, `Table::SIZE` / lobby `dataSize`). If a later paragraph still says Inco handles, rewrite that sentence to Arcium `HoleDealt` / `revealed_card_*`.

- [ ] **Step 3: Fix `SECURITY.md` session-key claim**

Replace the "Session keys" subsection with:

```markdown
### Session keys

`player_action` may be signed by a MagicBlock session key scoped to
this program. A compromised session key cannot withdraw funds
(`leave_table` requires the real wallet); worst case is bad in-hand
decisions bounded by the table buy-in.

Shuffle, deal, community reveal, and showdown reveal are **not**
session-signed in the client. Each of those queues uses the real
wallet as fee payer. Do not describe gameplay as popup-free.
```

- [ ] **Step 4: Write `COMPETITIVE.md`**

Create `COMPETITIVE.md` with these sections, no $60B, no "first":

1. **Claim we can defend:** live Arcium-MPC Hold'em on Solana devnet; deck is Enc\<Mxe\> ciphertext; holes sealed to player x25519; board/showdown via `.reveal()` from the same deck; we found and retired our own VRF reconstruction bug.
2. **Claim we will not make:** first private poker; trustless; no house; any stakes; popup-free; mainnet.
3. **Census (named occupants):** CoinPoker / ACR (custodial crypto rooms, server-side cards); FastPoker (MagicBlock ER + TEE dealer-service — different trust); CerberusPoker / `ANAVHEOBA/arcium_poker` (same Arcium thesis; we differentiate on live program id `GAc5rZPE…`, 6 circuits actually hosted, internal audit, E2E script). Arcium blackjack example (template, not a product).
4. **Trust model one-liner:** Cerberus 1-of-N honest, permissioned cluster 456. Enc\<Shared\> is a viewing key; the MXE deck is the commitment.

- [ ] **Step 5: Tombstone historical tests/scripts**

Move the three Inco/VRF scripts into `scripts/historical/` with `scripts/historical/README.md`:

```markdown
Retired Inco TEE / MagicBlock VRF probes. They target old program
IDs and must not be run against GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz.
```

At the top of `tests/hiddenhand.ts`:

```ts
describe("hiddenhand (retired VRF/Inco suite)", function () {
  it("is not the Arcium program — skip", function () {
    this.skip();
  });
});
```

Remove or comment the old `describe` bodies so `anchor test` cannot call `.requestShuffle()`. Prefer changing `Anchor.toml` test script to a no-op note if the file still assumes native SOL vaults.

- [ ] **Step 6: Replace `app/README.md`**

```markdown
# HiddenHand app

Next.js 16 client for the Arcium-MPC poker program
`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz` (Solana devnet).

## Run

cp .env.example .env.local   # if present; otherwise export:
# NEXT_PUBLIC_SOLANA_RPC=https://<helius-or-equivalent>/devnet
# FAUCET_SECRET=<base58 mint authority>   # server only, never NEXT_PUBLIC_

npm install
npm run dev
```

Add `app/.env.example` listing `NEXT_PUBLIC_SOLANA_RPC` and `FAUCET_SECRET` with comments. No secrets.

- [ ] **Step 7: Banner `thinking/inco-fhe-vs-magicblock-analysis.md`**

First lines:

```markdown
> **HISTORICAL (pre-Arcium).** Superseded by
> `thinking/privacy-backend-decision-2026.md` and the current
> `encrypted-ixs/` circuits. Do not implement anything in this file.
```

- [ ] **Step 8: Strip Inco comments in `useTableState.ts`**

Replace the file-header "PRIVACY INVARIANT: … encrypted u128 card handles" with:

```ts
 * PRIVACY INVARIANT: live hole cards are not on-chain. This hook
 * always returns holeCards: [null, null]. Spectators may only see
 * revealedCards after showdown_reveal writes plaintext 0–51.
```

- [ ] **Step 9: Grep again and commit**

```bash
rg -n "Inco Lightning|inco_cpi|lib/inco|requestShuffle" --glob '!node_modules/**' --glob '!target/**' --glob '!app/node_modules/**' --glob '!scripts/historical/**' --glob '!thinking/**'
```

Expected: retired variants in `error.rs` only (keep), plus the CLAUDE historical pointer.

```bash
git add CLAUDE.md SECURITY.md README.md COMPETITIVE.md thinking/inco-fhe-vs-magicblock-analysis.md app/README.md app/.env.example app/hooks/useTableState.ts scripts tests/hiddenhand.ts Anchor.toml
git commit -m "docs: freeze World's Fair narrative on Arcium MPC, tombstone Inco/VRF"
```

**Acceptance:** a technical judge opening GitHub does not see Inco as the current stack. This commit is public on `main` (or the branch you will PR to `main` this week).

---

### Task 1: Landing truth + Watch CTA

**Files:**
- Modify: `app/app/page.tsx`
- Modify: `app/app/lobby/page.tsx`
- Modify: `app/components/lobby/TableList.tsx` (empty state)
- Modify: `app/components/FaucetButton.tsx` if it only renders in the lobby — reuse on landing
- Modify: `app/app/api/faucet/route.ts` — add GET health if missing

**Interfaces:**
- Consumes: Task 0 copy rules
- Produces: `WATCH_TABLE_ID` constant (string table name, e.g. `judge-demo`) used by Task 2

- [ ] **Step 1: Add a single demo-table constant**

Create `app/lib/demo.ts`:

```ts
/** Pinned table the landing "Watch live" CTA and the crank both target. */
export const DEMO_TABLE_ID = "judge-demo";
```

- [ ] **Step 2: Landing CTAs**

In `app/app/page.tsx`:

- Remove any "a few seconds" copy. Replace with: "Each MPC step takes about 15–20 seconds on devnet. That wait is the dealer — randomness never hits the chain."
- Primary button: `Link` to `/table/${encodeURIComponent(DEMO_TABLE_ID)}` labeled "Watch a live hand" (no wallet required).
- Secondary: existing WalletButton + "Get free chips and sit" → `/lobby?quick=1` once wallet is connected.
- Badge row: `Play-money · Solana devnet · Arcium MPC`.
- Do **not** auto-`router.push("/lobby")` on connect before the user has seen Watch. If that effect stays, it steals the spectator path. Change it so connect goes to lobby only when the user clicked Play, not Watch.

- [ ] **Step 3: Faucet health**

If `app/app/api/faucet/route.ts` is POST-only, add:

```ts
export async function GET() {
  const configured = Boolean(process.env.FAUCET_SECRET);
  return Response.json({ ok: configured, token: "HHC" });
}
```

Do not return the secret. Landing may show "Faucet offline" when `ok === false`.

- [ ] **Step 4: Lobby empty state**

When `filteredTables.length === 0` and not loading, render a CTA: "Open the live demo table" linking to `/table/judge-demo`, plus Quick Play. Do not render a dead "No tables found" as the only child.

- [ ] **Step 5: Build and commit**

```bash
cd app && npx tsc --noEmit && npm run build
git add app/lib/demo.ts app/app/page.tsx app/app/lobby/page.tsx app/components/lobby/TableList.tsx app/app/api/faucet/route.ts
git commit -m "feat: landing Watch CTA, honest MPC latency, faucet health"
```

**Acceptance:** unconnected browser, landing, one click, table route loads in spectator mode. Copy never says "a few seconds."

---

### Task 2: Demo table crank

**Files:**
- Create: `app/scripts/demo-crank.cjs`
- Create: `app/scripts/README.md` (how to run crank + required env)
- Modify: `app/lib/demo.ts` if the on-chain table id bytes need documenting

**Interfaces:**
- Consumes: `DEMO_TABLE_ID` from Task 1; crank wallet = table authority or any funded key with SOL
- Produces: a process that keeps `judge-demo` in `Playing` or `Waiting` with ≥2 seated bots/wallets

The crank is a **Node script**, not a new on-chain program. Pattern: clone the account-resolution and ix-building from `app/scripts/devnet-full-hand.cjs` (already talks to live MPC). Poll the table/hand/deck/seats every 2s. Fire at most one protocol ix per tick.

State machine (must match program gates):

```
if table.status == Waiting && occupied_with_chips >= 2
    && no in-flight start → start_hand
if phase == Dealing && !deck.is_shuffled && !in-flight shuffle → shuffle
if phase == Dealing && is_shuffled → do not deal for players (C-1)
if awaiting_community_reveal && phase in {PreFlop, Flop, Turn} → reveal matching street
if phase == Showdown && some active seat !cards_revealed → showdown_reveal
if phase == Showdown && all remaining revealed → showdown
if phase == Settled && pot == 0 && table.Waiting → loop
```

Never call `deal_to_seat` as the crank unless the crank key *is* that seat's `player`. For the pinned demo, two funded keypairs sit as players; the crank is a third key (authority) or one of the two for protocol steps only.

- [ ] **Step 1: Document env**

`app/scripts/README.md`:

```
RPC_URL           Helius (required)
CRANK_KEYPAIR     path to json (authority)
PLAYER_A_KEYPAIR  path to json
PLAYER_B_KEYPAIR  path to json
DEMO_TABLE_ID     judge-demo
```

- [ ] **Step 2: Implement the poll loop**

Reuse: `queueAccounts` equivalent from the CJS full-hand script, `awaitFinalization`, existing IDL at `app/lib/idl/hiddenhand.json`. Log every ix signature. On `AbortedComputation` / timeout, call `timeout_deal` or `timeout_showdown` per phase rather than wedging the table.

- [ ] **Step 3: Sit A and B if the table is empty**

On boot: if `current_players < 2`, `join_table` for A and B with min buy-in in HHC. Create the table once if the PDA does not exist (`create_table` with HHC mint `59JzBXJybnMs1HaWGXqVL9LS7eiHYcicbuUL78GGYVjC`, 6-max, modest blinds).

- [ ] **Step 4: Dry-run against devnet**

```bash
cd app && RPC_URL=$RPC_URL node scripts/demo-crank.cjs
```

Expected: table `judge-demo` exists; two seats occupied; a shuffle queues; after both players have been dealt (you may deal from A/B in another terminal or auto-deal in their clients), streets advance.

- [ ] **Step 5: Commit**

```bash
git add app/scripts/demo-crank.cjs app/scripts/README.md
git commit -m "feat: permissionless crank for the pinned judge-demo table"
```

**Acceptance:** 10-minute unattended run produces at least one `HandCompleted` (or a clearly logged stall with timeout abort, not a wedged `Playing` forever). Spectator landing from Task 1 shows card backs during the hand.

---

### Task 3: Seated-player-immediate (program)

**Files:**
- Modify: `programs/hiddenhand/src/instructions/start_hand.rs`
- Modify: `programs/hiddenhand/src/instructions/reveal_common.rs` (`authorize_reveal`)
- Modify: `programs/hiddenhand/src/instructions/showdown.rs`
- Test: add unit tests next to the existing timeout tests in those files; do not add LiteSVM unless already wired

**Interfaces:**
- Consumes: remaining occupied `PlayerSeat` PDAs (already required on `start_hand`; reveal/showdown already take seats)
- Produces: any signer who occupies a seat on this table may call immediately; authority still can; 60s anyone-path remains

Helper to add in `reveal_common.rs` (single implementation, used by all three):

```rust
pub fn signer_is_seated(
    signer: &Pubkey,
    table_key: &Pubkey,
    remaining: &[AccountInfo],
    program_id: &Pubkey,
) -> bool {
    remaining.iter().any(|ai| {
        if ai.owner != program_id {
            return false;
        }
        let Ok(data) = ai.try_borrow_data() else {
            return false;
        };
        let Ok(seat) = PlayerSeat::try_deserialize(&mut &data[..]) else {
            return false;
        };
        if seat.table != *table_key || seat.player != *signer {
            return false;
        }
        let (expected, _) = Pubkey::find_program_address(
            &[SEAT_SEED, table_key.as_ref(), &[seat.seat_index]],
            program_id,
        );
        expected == *ai.key
    })
}
```

Authorization becomes:

```
is_authority || signer_is_seated(...) || elapsed >= TIMEOUT
```

`start_hand` already iterates remaining seats for occupancy — reuse that set. `showdown` already validates remaining seats (H-1) — check the signer against that set **before** distribution. Community reveal: pass occupied seats as remaining accounts if they are not already there; if the current reveal ix does not include seats, add them as remaining **readonly** rather than changing the circuit callback account list.

- [ ] **Step 1: Write a pure unit test for `signer_is_seated` logic**

If wiring real `AccountInfo` in unit tests is painful, extract the PDA + owner + `seat.player` checks into a function that takes already-deserialized `(Pubkey /*ai.key*/, PlayerSeat)` and test that.

Test cases: matching player + matching PDA → true; wrong player → false; wrong table → false; duplicate ignored.

- [ ] **Step 2: Run the new test — expect fail, then implement, then pass**

```bash
cargo test -p hiddenhand signer_is_seated -- --nocapture
```

- [ ] **Step 3: Wire `start_hand`, `authorize_reveal`, `showdown`**

Do not change `deal_to_seat` or `shuffle`. Do not add session accounts.

- [ ] **Step 4: fmt, clippy, full unit tests**

```bash
cargo fmt -p hiddenhand
cargo clippy -p hiddenhand -- -D warnings
cargo test -p hiddenhand
```

Expected: 60 existing tests still pass plus the new ones.

- [ ] **Step 5: Deploy only after Task 2 table is Waiting**

```bash
# confirm all occupied tables you care about are Waiting
# then arcium deploy with the existing 0.11.2 toolchain, cluster-offset 456,
# upgrade-authority ~/.config/solana/hiddenhand/upgrade-authority.json
# reliable RPC — never public devnet
```

Re-run:

```bash
cd app && RPC_URL=$RPC_URL node scripts/devnet-exploit-checks.cjs
cd app && RPC_URL=$RPC_URL node scripts/devnet-full-hand.cjs
```

C-1 / L-1 / H-1 must still fail with the same error names.

- [ ] **Step 6: Copy IDL into the app if the ix account lists changed**

```bash
cp target/idl/hiddenhand.json app/lib/idl/hiddenhand.json
# regenerate app/lib/idl/hiddenhand.ts the same way the last IDL refresh did
```

Commit:

```bash
git commit -m "feat: seated players may start, reveal, and settle immediately"
```

**Acceptance:** a non-authority seated wallet can `start_hand` at t=0. A non-seated wallet still waits 60s. Exploit script still green.

---

### Task 4: Delete host chrome; client auto-orchestration

**Files:**
- Modify: `app/app/table/[tableId]/page.tsx` (Authority Controls block ~1132–1305; host copy ~496–497, ~1679–1680; Deal-me-in leftover card if auto-deal already runs)
- Modify: `app/hooks/usePokerGame.ts` (leader auto-queue for start/shuffle/showdown; keep existing auto-deal, auto-community for authority — extend to seated-immediate)
- Modify: `app/components/GameStatusBar.tsx` copy
- Modify: `app/components/AuthorityTimeoutPanel.tsx` — hide when the local player can now act immediately; keep as fallback for unseated spectators

**Interfaces:**
- Consumes: Task 3 program behavior; Task 2 crank on `judge-demo`
- Produces: `isProtocolLeader: boolean` — true if `isAuthority || currentPlayerSeat !== null` for protocol ixs that Task 3 opened

Leader client rules (browser tables without a crank):

```
if Waiting && playersWithChips >= 2 && isProtocolLeader → startHand()
if Dealing && !isDeckShuffled && isProtocolLeader → shuffleDeck()
# deal: existing autoDealRef
# community: existing auto-reveal, now any seated player (remove 60s wait in the effect)
if Showdown && all remaining revealed && isProtocolLeader → showdown()
if Settled && Waiting && playersWithChips >= 2 && isProtocolLeader → startHand() after 3s
```

Use the existing `*InProgressRef` guards. On error `DeckAlreadyShuffled` / `HandAlreadyInProgress` / `CommunityNotReady`, swallow and refresh — the other client or crank won the race.

- [ ] **Step 1: Remove Authority Controls JSX**

Delete the gold "Authority Controls" strip. Replace with nothing; `GameStatusBar.mpcLabel` carries the state.

- [ ] **Step 2: Replace host copy**

`mpcLabel` examples:

- shuffling: `Shuffling 52 cards in Arcium MPC…`
- dealing: `Waiting for Seat N to deal in`
- awaiting board: `Revealing the flop from the sealed deck…` (never "Waiting for host")
- showdown reveal: `Publishing remaining hands from the sealed deck…`
- award: `Settling the pot…`

- [ ] **Step 3: Auto-queue effects**

Mirror the existing community auto-reveal effect. Authority-only branches become `isProtocolLeader`. Keep the 60s path only for `!isProtocolLeader` (spectators with a wallet who are not seated — they should not pay protocol fees by default).

- [ ] **Step 4: Keep Deal-me-in as a fallback button only when auto-deal failed**

If `isDeckShuffled && !queued && decryptedCards[0] === null && error` includes `HoleDealt`, show Retry decrypt (already exists). Do not show a primary "Deal me in" when auto-deal is in flight.

- [ ] **Step 5: Two-browser rehearsal**

Sit two wallets on a throwaway table (not only `judge-demo`). Confirm: no Shuffle button, shuffle still happens, both holes decrypt, flop auto-reveals, showdown auto-settles.

```bash
cd app && npm run build
git commit -m "feat: protocol crank in the client; remove host dealer chrome"
```

**Acceptance:** a 3-minute screen recording of two wallets contains zero clicks on Start / Shuffle / Award Pot.

---

### Task 5: Privacy visualization + MPC felt theater

**Files:**
- Modify: `app/components/PokerTable.tsx`
- Modify: `app/components/Card.tsx` (only if opponent default is not already `encrypted`)
- Modify: `app/components/ProvablyFairBadge.tsx`
- Modify: `app/components/PlayerSeat.tsx`
- Modify: `app/components/GameStatusBar.tsx`
- Modify: `app/app/table/[tableId]/page.tsx` (pass deck ciphertext prefix + explorer URL)

**Interfaces:**
- Consumes: `gameState.deckState.deck`, `gameState.isShuffling`, `isDecrypting`, `isRevealingCommunity`, `isRevealing`, `isDeckShuffled`
- Produces: felt-center stage bound to those flags; `houseSees` strip

Explorer URL:

```ts
const DECK_EXPLORER = (deckPda: PublicKey) =>
  `https://explorer.solana.com/address/${deckPda.toBase58()}?cluster=devnet`;
```

Ciphertext prefix: first 8 bytes of `deck[0]` as hex, ellipsis, never dump 64 bytes into the DOM.

- [ ] **Step 1: Badge during compute**

`ProvablyFairBadge` currently returns null when `!isActive`. Pass `isActive={isShuffling || isDeckShuffled || isRevealingCommunity || isRevealing}`. Label while shuffling: "MPC shuffle in flight". After: "Deck sealed to MXE".

- [ ] **Step 2: Oval animations**

Bind `isShuffling` to the existing riffle sound `riffle-shuffle.mp3` and a CSS shuffle on the oval (reuse felt, do not add a new page). Bind community reveal to card-flip on board slots. Do not complete the animation until the corresponding flag clears **and** state shows the cards — completing early is a lie Julian will clock.

- [ ] **Step 3: House-sees strip**

40px row under `GameStatusBar`:

```
House sees: deck ciphertext 0xAB12CD…  [Explorer]
You see: A♠ K♦   Table sees: 🂠 🂠
```

Spectator path: `You see` is empty; `Table sees` is backs until showdown.

- [ ] **Step 4: Opponent cards**

`PlayerSeat` for non-hero, non-revealed: `Card` `encrypted` / face-down. Hero: decrypted holes only when `p.player === publicKey`.

- [ ] **Step 5: Build, both viewports, commit**

Desktop and a mobile landscape width (existing `useIsMobileLandscape`). 

```bash
cd app && npm run build
git commit -m "feat: felt-center MPC theater and house-sees ciphertext strip"
```

**Acceptance:** split-screen screenshot: same table, two hole pairs, identical ciphertext prefix, explorer link opens the deck PDA.

---

### Task 6: Showdown theater + rake collect

**Files:**
- Modify: `app/app/table/[tableId]/page.tsx` (kill chip-delta winner ~318–386)
- Modify: `app/components/PokerTable.tsx` / `PlayerSeat.tsx` (hand name + winner ring)
- Modify: `app/components/WinCelebration.tsx` — use from overlay **or** delete unused component
- Modify: `app/hooks/usePokerGame.ts` — add `collectRake`
- Modify: `app/lib/handEval.ts` — already exists; call it

**Interfaces:**
- Consumes: `revealedCards` after `showdown_reveal`; `HandCompleted` via `useHandHistory`; `table.rakeBps`, `table.rakeCap`, `table.accumulatedRake`
- Produces: `collectRake(): Promise<string>`

Winner detection:

```ts
function namedHands(players: Player[], board: number[]) {
  return players
    .filter((p) => p.cardsRevealed && isRealCard(p.revealedCards[0]) && isRealCard(p.revealedCards[1]))
    .map((p) => ({
      seatIndex: p.seatIndex,
      description: getHandDescription(evaluateHand(
        [p.revealedCards[0]!, p.revealedCards[1]!, ...board]
      )),
    }));
}
```

After `HandCompleted` arrives, overlay uses `chipsWon` from the event, not chip delta.

Rake line without an event field change:

```
Rake {rakeBps/100}% · cap {display(rakeCap)} · collected this table {display(accumulatedRake)}
```

`collectRake` builds the same accounts as `leave_table` but authority ATA + `collect_rake` ix. Button only if `isAuthority && accumulatedRake > 0 && tableStatus !== "Playing"`.

- [ ] **Step 1: Delete chip-delta heuristic**
- [ ] **Step 2: Seat labels at showdown**
- [ ] **Step 3: Overlay + rake line**
- [ ] **Step 4: `collectRake` + button**
- [ ] **Step 5: Do not add `rake_taken` to `HandCompleted` in this PR** (parser tax). Revisit only as a follow-up with discriminator regen.
- [ ] **Step 6: Build and commit**

```bash
git commit -m "feat: named showdown overlay and collect_rake"
```

**Acceptance:** a split pot shows two named hands and two winner rings. Authority can collect rake on a Waiting table. Chip-delta code is gone.

---

### Task 7: Live action language

**Files:**
- Modify: `app/hooks/useHandHistory.ts` — export latest `ActionTaken` for the current `handNumber`
- Modify: `app/components/PlayerSeat.tsx` — `lastAction?: { type: string; amount?: number }`
- Modify: `app/components/PokerTable.tsx` — pass through
- Modify: `app/app/table/[tableId]/page.tsx` — subscribe
- Modify: `app/components/GameHistory.tsx` — either feed it `ActionTaken` for all seats or hide it in favor of on-chain history (do not keep a hero-only local log as if it were the table)

**Interfaces:**
- Consumes: existing `addEventListener` / `onLogs` path in `useHandHistory.ts`
- Produces: `liveActions: ActionTakenTimelineEvent[]` for the current hand

- [ ] **Step 1: Expose current-hand actions from `useHandHistory`**
- [ ] **Step 2: Seat bubble** for 2.5s on Fold/Check/Call/Raise/AllIn/Timeout*
- [ ] **Step 3: One scrolling line** under the oval: `Seat 4 raises 2.00`
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: live ActionTaken bubbles on seats"
```

**Acceptance:** opponent fold appears on the seat before the 3s poll refreshes chips.

---

### Task 8: One-click sit, faucet on landing, raise pad

**Files:**
- Modify: `app/app/table/[tableId]/page.tsx` (empty seat click)
- Modify: `app/components/ActionPanel.tsx` (presets)
- Modify: `app/app/page.tsx` / lobby (faucet placement — Task 1 may have done landing faucet)

Empty seat: if connected and `tableStatus === "Waiting"` and seat empty, open a sheet: stack = min buy-in default, Sit → existing `joinTable(seatIndex, buyIn)`. Do not scroll to a `<select>`.

Raise presets: compute `pot = gameState.pot`, `toCall = currentBet - myBet`. Buttons: ½ pot, ⅔ pot, pot, all-in. Disable those below on-chain `minRaise`. Keep a numeric input.

- [ ] **Step 1: Click-seat sit**
- [ ] **Step 2: Pot-fraction pad**
- [ ] **Step 3: Build, mobile landscape, commit**

```bash
git commit -m "feat: click-to-sit and pot-fraction raise pad"
```

**Acceptance:** faucet → click empty seat → seated in one sheet. No `<select>` on the happy path.

---

### Task 9: Client crypto hygiene (P1, same week as 5 if cheap)

**Files:**
- Modify: `app/lib/arcium.ts` (`findHoleDealtForKey`)
- Modify: `app/hooks/usePokerGame.ts` (`scanAndDecryptHoleCards`, `saveHoleCards` / `loadHoleCards`)

`findHoleDealtForKey` must require `handNumber` when provided. `scanAndDecryptHoleCards` passes `gameState.table.handNumber`. Scan signatures of the **table PDA**, not `program.programId`.

`saveHoleCards` stores `{ card0, card1, nonce, encPubkey }` (public log shape). `loadHoleCards` decrypts with the in-memory SK from `ensureCrypto()`. If SK is missing, prompt `signMessage` once, then decrypt. Never JSON-store plaintext ranks.

- [ ] **Step 1: Tests as a pure function** if you extract match logic; otherwise a small node assert in a script
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit**

```bash
git commit -m "fix: HoleDealt matched by hand and table; do not persist plaintext holes"
```

**Acceptance:** two hands at the same table cannot attach hand N-1 cards to hand N. sessionStorage inspector does not show `"decrypted":[12,25]`.

---

### Task 10: Videos, freeze, submit

**Files:**
- Create: `docs/superpowers/plans/worlds-fair-demo-script.md` (camera script, not gitignored marketing)
- Modify: `app/app/page.tsx` — embed or link the two new videos once they exist
- No program changes after 2026-10-08

**Pitch (≤2:45) — voice + B-roll**

0:00–0:20 UltimateBet / Absolute Poker: the house saw hole cards.  
0:20–0:40 We shipped VRF "provably fair." We then proved the deck is reconstructable from the public callback.  
0:40–1:10 Cut to `encrypted-ixs/src/lib.rs` shuffle + Enc\<Mxe\>. Randomness never hits the chain.  
1:10–2:00 Split-screen live hand (no host buttons). Fold bubble. Flop theater.  
2:00–2:30 Named showdown + rake line. Play-money. Dealing engine / licensed operator later.  
2:30–2:45 "Don't trust the dealer. There isn't one."

**Technical (≤2:30)**

- Six circuits, deck layout 18–22, `deal_to_seat_v2` name, C-1 owner check, H-2 one-shot, explorer on `DeckState`, honest 15–20s, `SECURITY.md` one finding + fix.

- [ ] **Step 1: Record raw gameplay after Tasks 4–7** (week of Sept 28). Two Phantoms. Helius. Crank running. 10 takes, keep 1.
- [ ] **Step 2: Edit dead waits** (cut 15s shuffles to 3s with a caption "real wait ~18s"). Never fake cards.
- [ ] **Step 3: Freeze 2026-10-08.** No circuit, no program upgrade, no IDL copy after freeze except break-glass faucet/RPC/crank.
- [ ] **Step 4: Submit on Colosseum 2026-10-08** (buffer to Oct 12). Solana track. Do not attach `6WgATb6sfp4`. Do not paste gitignored Inco `PITCH.md`.
- [ ] **Step 5: Commit the public demo script and video links**

```bash
git commit -m "docs: World's Fair demo script and video links"
```

**Acceptance:** both videos watched once without wincing; live link still plays the same day.

---

## Stretch tasks (do not start before 2026-09-29 demo table is live)

### Task S1: Prefetch shuffle

Reuse circuit `shuffle`. New ix `prefetch_shuffle` inits `DeckState` for `table.hand_number + 1` while `TableStatus::Playing`, queues shuffle. Callback is existing H-2. `start_hand` uses `init_if_needed` and **must not zero** `is_shuffled` / `deck`. Frontend queues after current PreFlop. No new comp-def. Waiting-gate deploy.

### Task S2: EncKey PDA

Seeds `["enc_key", player]`. `register_enc_key` from the real wallet. `deal_to_seat` `require!(seat_pubkey == stored)`. Append `EncKeyMismatch` at the **end** of `HiddenHandError`. Do not touch `Table` or `PlayerSeat` layout. After this, session-on-deal may be discussed — still not required for Oct 12.

### Task S3: `reveal_runout`

New tiny circuit, unique name, OffChain host, `circuit_hash!("reveal_runout")`. Gate: `awaiting_community_reveal && !can_anyone_bet()`. One callback writes five board cards. Skip if cluster 456 execpool looks sticky. Do not replace flop/turn/river for the betting path.

---

## Week calendar

| When | Work | Exit |
|---|---|---|
| Sep 16–17 | Task 0 public commit | Repo greps Arcium-current |
| Sep 18–19 | Tasks 1–2 | Watch CTA + crank on `judge-demo` |
| Sep 20–22 | Task 3 deploy + Task 4 | No host chrome on a throwaway table |
| Sep 23–25 | Tasks 5–6 | Split-screen aha + named showdown |
| Sep 26–27 | Tasks 7–9 | Bubbles, click-sit, hygiene |
| Sep 28–29 | Raw gameplay recording | 10 takes |
| Sep 30–Oct 5 | Task 10 videos | Pitch + technical cut |
| Oct 6 | `COMPETITIVE.md` already in; pin videos on landing | Packet complete |
| **Oct 7–8** | **Freeze. Submit.** | Break-glass only |
| Oct 9–11 | Crank/faucet/RPC watch | Do not feature-creep |
| Oct 12 | Deadline | Already submitted |

If Task 3 deploy slips past Sep 22, **do not wait**: ship Task 4 auto-orchestration for shuffle (already permissionless) and keep Award Pot as a single button rather than slipping videos.

---

## Self-review

**Spec coverage:** P0 items 1–12 map to Tasks 0–10. P1 items 13–16 map to Tasks 8–9 (sit/raise + hygiene; hero hand-strength is a one-liner inside Task 6 if time). Stretch 17–19 map to S1–S3. Kill list is in Global Constraints + spec §5.

**Placeholder scan:** no TBD/TODO implement-later in task steps. Stretch is explicit and gated.

**Type consistency:** `DEMO_TABLE_ID` / `judge-demo` is the single demo name. `isProtocolLeader` is the client name for Task 4. Encrypted ix remains `deal_to_seat_v2`.

**Intentionally not 2-minute TDD for the whole sprint:** this is a 10-PR program. Each task has a test cycle (unit tests for the program PR; `npm run build` + two-wallet rehearsal for client PRs; `devnet-full-hand.cjs` + exploit checks after deploy). Do not open S1–S3 until the demo table survives a 10-minute unattended watch.
