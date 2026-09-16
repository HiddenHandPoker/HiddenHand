# HiddenHand — Colosseum Crypto World's Fair Sprint

**Date:** 2026-09-16  
**Deadline:** product submissions 2026-10-12 (freeze target 2026-10-08)  
**Competition:** Colosseum Crypto World's Fair — startup contest, not a bounty hackathon  
**Track:** Solana ecosystem ($100k / 10 × $10k) plus general pool (grand $30k, next 20 × $15k, accelerator interviews at $250k)  
**Audience that matters:** Clay Robbins / Matty Taylor / Nate Levine (winners); Julian Deschler (Arcium cofounder) and Milian (Arcium marketing) on the track panel

This spec is the product decision for the next 26 days. It is not a backlog of poker features. Three specialist passes (game, MPC/crypto, GTM) independently concluded the same thing: **the engine is ahead of the exhibit.** We do not win by adding a second game. We win by making the existing Arcium-MPC hand inevitable on camera, honest in the repo, and running when a judge clicks the live link.

---

## 1. Problem

HiddenHand already has what most World's Fair teams will not: a live, audited, 6-max Texas Hold'em loop on Solana whose cards are shuffled and dealt inside Arcium MPC. Program `GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz` on devnet. Full hand proven. Internal audit (C-1 through L-2) documented in `SECURITY.md`.

What a judge actually sees in eight minutes is weaker than that:

1. **Pitch video does not exist for this stack.** The only recorded demo (`youtu.be/6WgATb6sfp4`) and the gitignored `marketing/PITCH.md` still sell Inco TEE + MagicBlock VRF. Submitting either is a disqualification in front of Julian.
2. **The table still has a human dealer.** `app/app/table/[tableId]/page.tsx` renders Authority Controls: Start Hand, Shuffle, Award Pot. Non-authority copy is "Waiting for the host." Shuffle is already permissionless on-chain (`shuffle.rs`); the host is a frontend fiction.
3. **The money shot is missing.** `HandCompleted` already carries hand ranks and chips won. The live felt shows a 2-second "YOU WIN!" from a chip-delta heuristic. Seats never say "Two Pair."
4. **Privacy is a status chip, not a picture.** Opponent cards can shimmer, but there is no split-view, no ciphertext, no explorer link on `DeckState.deck`. Latency copy on the landing still says "a few seconds" while README says 15–20s.
5. **The public repo still greps as Inco.** `CLAUDE.md` historical half, `thinking/inco-fhe-vs-magicblock-analysis.md`, `scripts/test-inco-*.mjs`, `scripts/test-vrf-oracle.mjs`, and `tests/hiddenhand.ts` (`requestShuffle`, native SOL). `marketing/` is gitignored; these files are not.
6. **Last public commit is 2026-08-23.** Colosseum scores velocity during the sprint. A flat GitHub pulse from kickoff (Sept 14) looks like a recycled Privacy Hack.
7. **Empty lobby is an instant bounce.** Spectator mode exists. There is no pinned, always-on demo table.

Colosseum judging (Frontier rules, still the operating model): Functionality, Potential Impact, Novelty, UX, Open-source, Business Plan. Workshop order is **pitch video → live site → repo**. If any of those three is Inco-era or empty, the other two do not get read.

---

## 2. Goal

By 2026-10-08, HiddenHand is a frozen, always-on, two-wallet exhibit of **the only poker hand in the field whose dealer is six Arcium circuits**, with:

- a new ≤3:00 pitch video and a new ≤3:00 technical demo (do not reuse `6WgATb6sfp4`);
- a live path a judge can watch without a wallet, and play with free HHC in under 60 seconds to a seat;
- no host chrome on the felt — protocol steps are cranked, players only deal themselves in and bet;
- showdown that names hands and shows rake;
- a public repo that greps as Arcium MPC, not Inco/VRF;
- a defensible business sentence (play-money now, dealing engine / licensed operator later) with no "$60B / any stakes / zero counterparty" claims.

---

## 3. Approaches considered

### Approach A — Submission-grade cash table (recommended)

Make the existing hand the exhibit. Narrative freeze, always-on demo table, privacy visualization, auto-orchestration (crank + seated-player-immediate program change), showdown theater, live action language, two new videos. **No new Arcis circuits. No Arcium 0.13. No session keys on `deal_to_seat` this sprint.**

- **Wins:** Functionality + UX + Novelty in the 8-minute funnel; public commits start this week; Julian sees the Enc\<Mxe\> deck, not a host button.
- **Loses:** Prefetch-shuffle and `reveal_runout` (the two best crypto upgrades) are stretch, not load-bearing.
- **Risk:** Medium. Program upgrade for seated-immediate is small and does not touch circuits. Crank is a script we already almost have (`devnet-full-hand.cjs`).

### Approach B — Crypto-forward

Ship prefetch shuffle (reuse `shuffle` for hand N+1 during hand N), EncKey PDA to finish C-1, and `reveal_runout` (new tiny circuit, all-in board in one MPC round). Proof panel for Julian.

- **Wins:** README's own promised latency hide; residual C-1 closed; all-in demo is 15s not 45–60s.
- **Loses:** Host chrome and empty lobby still kill the 8-minute test. New comp-def on cluster 456 has already burned us once (`deal_to_seat` → `deal_to_seat_v2`).
- **Risk:** High. Upgrade + new def + live-table gate. A sticky execpool zombie in week 3 has no recovery path before Oct 8.

### Approach C — Product-forward

Click-to-sit, rebuy instruction, session keys on every MPC queue, pot-fraction raise pad, sit-and-go, tournaments-lite.

- **Wins:** Looks more like a company.
- **Loses:** Session-on-deal without EncKey reopens C-1 via a compromised ephemeral key. Tournaments do not appear in a 3-minute tape. Freeze date slips.
- **Risk:** High schedule, medium security.

**Decision: Approach A**, with Approach B items as **stretch PRs only if the demo table is live by Sept 29**. Approach C is killed except click-to-sit and pot-fraction raises (small, frontend, in the buffer).

---

## 4. What we will ship

Ordered by what a judge sees, not by engineering fun.

### P0 — Submission integrity (week 1, public commits)

1. **Narrative freeze.** Rewrite gitignored pitch for our use (not committed if still private). In the **public** repo: truncate `CLAUDE.md` historical half to a one-line pointer; tombstone Inco/VRF scripts and the stale Anchor TS suite; fix `SECURITY.md` session-key paragraph (betting path only); replace `app/README.md` boilerplate; add `COMPETITIVE.md`. Keep `thinking/privacy-backend-decision-2026.md` — that file *is* the founder story. Tombstone `thinking/inco-fhe-vs-magicblock-analysis.md` as historical.
2. **Landing truth.** Kill "a few seconds in MPC." Primary CTA: Watch a live hand (spectator). Secondary: Get chips → Quick Play. Badge: play-money, Solana devnet, Arcium MPC.
3. **Always-on `judge-demo` table** plus a keeper/crank so the lobby is never empty at judge o'clock. Spectator deep-link on the landing.
4. **Faucet on the landing**, health-checked. If faucet/RPC/MPC is down, the landing says so.

### P0 — The protocol is the dealer (weeks 1–2)

5. **Keeper/crank** for protocol steps on the pinned demo table: `start_hand` → `shuffle` → wait deals → `reveal_*` → `showdown_reveal` → `showdown` → next hand. Players only sign `deal_to_seat` (C-1 requires the seat owner) and `player_action` (already session-signed). Model: a permissionless crank, not a privileged dealer. Script derived from `app/scripts/devnet-full-hand.cjs`.
6. **Program change (small):** `start_hand`, `reveal_flop/turn/river`, and `showdown` become **seated-player-immediate** (any occupied seat, not only `table.authority`). Keep the 60s permissionless fallback for empty-authority. Do not change shuffle (already permissionless). Do not add `#[session]` to `deal_to_seat` this sprint.
7. **Delete Authority Controls and host copy** from the player felt. Status becomes "Shuffling in MPC…" / "Waiting for Seat 3 to deal in…" / "Revealing flop from the sealed deck…".

### P0 — The aha (week 2)

8. **Privacy visualization.** Encrypted card backs as the default opponent state. Felt-center shuffle/deal/street theater bound to real flags (`isShuffling`, `isDecrypting`, `isRevealingCommunity`, `isRevealing`) — do not fake completion. Truncated `DeckState.deck` hex + Solscan link. One strip: "what the house sees" (ciphertext) vs "what you see" (your holes). `ProvablyFairBadge` visible **during** compute, not only after.
9. **Showdown theater.** Consume `HandCompleted` / client `evaluateHand` for remaining seats. Named hands on seats. Winner ring. Rake line. Kill the chip-delta heuristic in `page.tsx`. Wire `collect_rake` for the table authority (one button). Optional additive `rake_taken` on `HandCompleted` only if we also update `useHandHistory.ts` parsers in the same PR.
10. **Live action language.** `ActionTaken` (already parsed in `useHandHistory.ts`) → seat bubbles + one live feed. Do not wait 3s polling to show "Seat 4 folds."

### P0 — The two rocks (weeks 3–4)

11. **Technical demo ≤3:00.** Circuits, Enc\<Mxe\> re-feed, split-screen, C-1, honest 15–20s, explorer.
12. **Pitch ≤3:00.** UltimateBet → we found our own VRF reconstruction → MPC. Play-money now; dealing engine / licensed operator later. No $60B. No "any stakes." No "popup-free" as a headline.

### P1 — Buffer (only after P0 demo path is rehearsed)

13. Click-empty-seat sit (kill the `<select>` join form).
14. Pot-fraction raise pad (½ / ⅔ / Pot / All-in) — on-chain min-raise math unchanged.
15. Hero-only live hand strength under hole cards (`evaluateHand` is already imported).
16. Client crypto hygiene: `findHoleDealtForKey` must match `hand_number`; scan the **table PDA** not `programId`; sessionStorage stores the public `HoleDealt` blob, not plaintext cards.

### Stretch (only if demo table is live by 2026-09-29)

17. **Prefetch shuffle** for hand N+1 during hand N betting. Reuse circuit `shuffle`. `start_hand` becomes `init_if_needed` on next `DeckState` and **must not zero** an already-shuffled deck. H-2 one-shot on the next deck. No new comp-def.
18. **EncKey PDA** `["enc_key", player]` so `deal_to_seat` rejects a foreign `seat_pubkey`. Append-only error. **Do not** add fields to `Table` (lobby `dataSize: 177`) or `PlayerSeat`. After this, session-on-deal becomes thinkable — still not required for Oct 12.
19. **`reveal_runout`** — new tiny circuit, unique name (do not reuse a burned offset), all-in board in one MPC round. Skip if cluster 456 looks sticky.

---

## 5. Kill list

Do not spend the 26 days on:

| Temptation | Why it dies |
|---|---|
| Real-money, KYC, licensing work as a feature | Legal swamp; one slide is enough |
| Full MTT / SNG / Omaha / short deck / bomb pot | New rules; the cash hand is not inevitable yet |
| Native iOS/Android | Landscape CSS exists; judges are on laptops |
| Arcium 0.13 bump | Stack freeze 0.11.1; a toolchain migration is not a demo |
| Combined shuffle+seal circuit | Already aborted at 5.5MB |
| In-MPC 7-card eval | Circuit bomb; public eval after `.reveal()` is the correct split |
| Persist x25519 on `PlayerSeat` or `Table` | Breaks `Table::SIZE == 177` lobby filter; seats persist across hands |
| Rename `deal_to_seat_v2` back | Cluster 456 original def is deactivated and uncloseable |
| Session keys on `deal_to_seat` before EncKey PDA | Reopens C-1 via ephemeral key choosing `seat_pubkey` |
| Session keys on MXE queues as the flagship | L-sized footgun; not visible as "popup-free" in the tape if deal still needs the real wallet |
| Encrypted bet amounts / C-SPL | We correctly kept pot math public |
| MagicBlock PER / TEE for cards | Weaker trust; confuses the Arcium story |
| Token / HHC mainnet / points | Securities and attention trap |
| Chat, avatars, ENS, AI opponent | Not the thesis |
| More RG, Jupiter, leaderboard polish | Already built; clutter the demo |
| Reusing `youtu.be/6WgATb6sfp4` or current `PITCH.md` | Inco/VRF; Julian will stop |
| Claiming "first private poker", "trustless", "nobody can cheat", "no house" while `collect_rake` exists, "a few seconds", "popup-free gameplay" as a headline | Laugh-out claims |

---

## 6. Architecture

### 6.1 Two roles at the table

```
Player wallet (or MagicBlock session for player_action only)
  └─ deal_to_seat     (must be seat owner — C-1)
  └─ player_action    (session-signed today)

Crank (authority keypair or any seated player after P0.6)
  └─ start_hand, shuffle, reveal_flop/turn/river,
     showdown_reveal, showdown, timeout_* , next start_hand
```

The crank is not a dealer. It cannot choose cards, cannot seal a victim's holes (C-1), cannot withdraw (leave_table is the real wallet). Worst case if the crank key is public: it advances a stalled table. That is the liveness model we already documented.

Pinned `judge-demo` table: a long-running process (`app/scripts/demo-crank.cjs`) funded with SOL + HHC, watching that table PDA, firing protocol ixs when state allows. Quick Play tables: the **leader client** (table authority if connected, else lowest occupied seat) auto-queues the same ixs from the browser. Duplicate queues are safe where H-2 / `community_already_committed` already no-op the callback; the client still uses in-progress refs so we do not spam fees.

### 6.2 Seated-player-immediate (program)

Today: `start_hand`, community reveal, and `showdown` allow `table.authority` immediately and everyone else after `ACTION_TIMEOUT_SECONDS` / `ALLOWANCE_TIMEOUT_SECONDS`.

Change: a signer whose remaining-accounts / seat PDA proves they occupy a seat on this table may call immediately. Authority remains a valid caller. The 60s path remains for a totally AFK table (anyone). This is an authorization widening, not a new circuit.

Shuffle stays as it is (any payer). `deal_to_seat` stays owner-only.

### 6.3 Privacy visualization (client)

No new accounts. Bind existing state:

| Flag | Felt |
|---|---|
| `isShuffling` | Riffle on the oval + "Shuffling 52 cards in Arcium MPC · randomness never hits the chain" + truncated `deck` once `is_shuffled` |
| `isDecrypting` / auto-deal | Two backs land on the hero seat, then flip to decrypted holes |
| Opponent holes | Encrypted `Card` state until `cardsRevealed` |
| `isRevealingCommunity` | Board slots fill with flip, not a spinner under the table |
| `isRevealing` | Remaining holes flip from the sealed deck |

`useTableState` continues to return `[null, null]` for spectators. Connected-but-unseated players must not receive anyone's decrypted holes.

### 6.4 Showdown theater (client)

Source of truth for names: after `showdown_reveal`, `revealedCard1/2` are public — run `evaluateHand` per remaining seat plus board. After `showdown`, prefer `HandCompleted.results[]`. Do not use chip-delta. Split pots: every winner gets a ring; overlay lists shares.

Rake: show `table.rakeBps` / cap on the overlay from current table config even without a new event field. Wire `collect_rake` in `usePokerGame.ts` (IDL already has it).

### 6.5 Invariants we will not break

- `HiddenHandError` variant order — append only
- `GamePhase` variant order (`Dealing=0` … `Settled=6`)
- `DeckState.deck` first field, offset 8, len 64
- `Table::SIZE == 177` and lobby `dataSize: 177`
- Encrypted ix name `deal_to_seat_v2` (public ix stays `deal_to_seat`)
- Hole layout 9×2, board 18–22, `HIDDEN = 53`
- OffChain URL + `circuit_hash!()` pin; stack freeze arcis/arcium `=0.11.1`, CLI `0.11.2`, cluster **456**
- Event discriminator parsers in `useHandHistory.ts` if any event field changes
- C-1: `player_seat.player == payer` on deal
- H-2: shuffle / street callbacks remain one-shot
- Spectator hole-card invariant
- Upgrade only when all live tables are `Waiting` (or we accept that in-flight hands on old binary stay old)

---

## 7. Business plan (what we say on camera)

**Now:** play-money Texas Hold'em on Solana. HHC faucet. Card privacy via Arcium Cerberus (1-of-N honest, permissioned cluster 456). Proof that confidential compute can run a real hidden-information game, not a DeFi loop.

**12 months:** white-label dealing engine. The asset is six MXE circuits that shuffle, seal to a player key, and reveal from the same deck. Operators (clubs, on-chain rooms, later a licensed house) buy the dealing layer so they can say the house cannot see hole cards. Revenue is B2B circuit/hosting plus a cut of operator rake — not "we are PokerStars."

**Later, optional:** real-money only with a **licensed operator** in a jurisdiction that allows online poker. HiddenHand stays the primitive. We do not become the house in the US in 2026.

**Do not say:** any stakes, zero counterparty, $60B TAM as if we take it, no house, trustless, first private poker, popup-free, a few seconds, FHE.

---

## 8. Success criteria

A stranger with a laptop and 8 minutes can:

1. Watch the pitch and understand UltimateBet → VRF hole → MPC without jargon pile-up.
2. Open hiddenhand.netlify.app with **no wallet** and see a hand in progress, card backs that do not flip, ciphertext on the felt.
3. Connect Phantom, faucet, sit, play at least one betting round with session-signed actions, see named showdown.
4. Open GitHub, grep `Inco` in current docs, and find only historical tombstones plus the rewrite story.
5. Open `encrypted-ixs/src/lib.rs` and `SECURITY.md` and believe the author knows the difference between Enc\<Mxe\> commitment and Enc\<Shared\> viewing keys.

Internal: `cargo test -p hiddenhand` green; `devnet-full-hand.cjs` and `devnet-exploit-checks.cjs` pass against the deployed program after any upgrade; crank keeps `judge-demo` moving for a 30-minute watch.

---

## 9. Key decisions

1. **Approach A over B and C.** The 8-minute funnel is the bottleneck, not circuit count.
2. **Crank + seated-immediate, not session-on-deal.** C-1 residual (caller-supplied x25519) makes session-on-deal unsafe until EncKey PDA. A keeper is the honest liveness model.
3. **No new circuits on the critical path.** Cluster 456 already forced `deal_to_seat_v2`. Prefetch reuses `shuffle` (stretch). `reveal_runout` is stretch-only.
4. **Do not persist keys on `Table` or `PlayerSeat`.** New PDA if we do EncKey (stretch).
5. **Videos are P0, not a wrap-up.** Record raw gameplay in week 2; edit in week 3; submit Oct 8.
6. **Public commits this week.** Velocity is a judging signal.
7. **Play-money is a feature of the pitch, not an apology.** Licensed operator is the later sentence.

---

## 10. Open questions (resolved in this spec unless you override)

| Question | Default in this spec |
|---|---|
| Which approach? | A |
| Program upgrade this sprint? | Yes, seated-player-immediate only on the critical path. Prefetch / EncKey / runout are stretch. |
| Session keys on MPC queues? | No this sprint |
| New circuits? | No on the critical path |
| Real-money language in the pitch? | No. Licensed-operator optionality only |
| Commit design/plan to git? | Yes, as the first public commit of the sprint (you confirm) |

---

## 11. PR plan

| PR | Title | Depends | Independently demoable |
|---|---|---|---|
| 0 | Narrative freeze + landing truth + COMPETITIVE.md | — | Repo greps clean; landing doesn't lie |
| 1 | Always-on demo table + crank script + spectator CTA | 0 | Judge watches without a wallet |
| 2 | Seated-player-immediate program change | 0 | Any seated player can start/reveal/settle now |
| 3 | Felt auto-orchestration + delete host chrome | 1, 2 | Hand runs without Authority Controls |
| 4 | Privacy visualization + honest MPC theater | 3 | Split-screen aha |
| 5 | Showdown theater + rake collect | 3 | Named hands, visible vig |
| 6 | Live action bubbles from ActionTaken | 3 | Seats speak poker |
| 7 | One-click sit + faucet on landing + raise pad | 1 | Under 60s to a seat |
| 8 | Videos + freeze checklist | 4, 5, 6 | Submission packet |
| S1 | Prefetch shuffle | 2, 3 | Stretch |
| S2 | EncKey PDA | 2 | Stretch |
| S3 | reveal_runout | S1 or 2 | Stretch |

Each PR is a separate implementation-plan task group in `docs/superpowers/plans/2026-09-16-worlds-fair-sprint.md`.
