# HiddenHand Privacy Architecture Decision (June 2026)

> Status: **DRAFT for review.** Author: engineering analysis pass, 2026-06-30.
> Goal restated: *maximum privacy and security with minimal trust, fully on-chain*, with strong UI/UX as a close second.

---

## 0. TL;DR

1. **There is a critical, pre-existing privacy break in the current design** (deck is reconstructable from the public VRF callback). This is independent of which encryption vendor we use, and it is the most urgent thing in this document.
2. The landscape shifted under us: **Inco dropped FHE for TEE**, and **MagicBlock added a TEE privacy product**. So our original "FHE + VRF + Ed25519" complementarity story no longer holds as written.
3. **Recommended strongest move: migrate the confidential card logic (shuffle / deal / reveal) to Arcium (Cerberus MPC)**, which structurally eliminates the deck-reconstruction break, removes hardware-vendor trust, and needs no external VRF. Keep MagicBlock **session keys** for UX; optionally add MagicBlock **Ephemeral Rollups (non-private)** for a fast betting hot path. Retire the standalone VRF and the Inco dependency.
4. This is a **real rewrite of the crypto core** — phase it, prototype first, and verify the audit/decentralization claims before a real-money mainnet launch.

---

## 1. The critical finding: deck reconstruction (SEV-HIGH)

**Where:** `programs/hiddenhand/src/instructions/callback_shuffle.rs`, `handler()`.

**Mechanism:**
- `randomness: [u8; 32]` is the instruction argument supplied by the MagicBlock VRF oracle when it CPIs the callback.
- The deck is shuffled by a **deterministic** Fisher-Yates / LCG seeded *solely* from `randomness` (lines ~130–150). `deck[]` is a pure function of `randomness`.
- `deck[0..4]` = community cards; `deck[5..]` = hole cards dealt in seat order. The index→seat/community mapping is fully determined by public on-chain state (`dealer_position`, `occupied_seats`, `current_players`) plus our open-source dealing logic.

**Why it breaks privacy:** VRF callback **instruction data is public and permanent on-chain**. Any observer can:
1. `getSignaturesForAddress` on the table / hand / deck PDA → find the `callback_shuffle` tx.
2. Decode its instruction data → recover `randomness`.
3. Re-run the (open-source) shuffle → reconstruct **every** community and hole card **before any reveal**.

The Inco encryption stores card *values* as encrypted handles in account state, but those values are derivable from public data without ever decrypting anything. **The encryption provides no privacy against a chain observer.**

**Note on the README claim:** "the VRF seed is never stored on-chain" refers only to *account state*. The seed is present in the *transaction*, which is equally public and archived forever. This distinction is the whole vulnerability.

**Confirm empirically (first task):** pull a real devnet `callback_shuffle` tx, extract `randomness`, re-run Fisher-Yates, and confirm the output matches a hand whose cards were later revealed. Expected: exact match.

**Implication for the decision:** the shuffle's randomness must never be public. With an on-chain VRF callback, it *inherently* is. The only robust fix is to **perform the shuffle inside confidential compute**, where the randomness and resulting order are never materialized in any public transaction or account. This is the decisive criterion below.

---

## 2. What changed in the ecosystem (2025–2026)

| Provider | Then (when HiddenHand was built) | Now (mid-2026) |
|---|---|---|
| **Inco** | FHE ("always encrypted, even in compute") | **Repositioned to TEE-based confidential compute.** No longer FHE. Solana = **devnet beta only**, single covalidator, no published mainnet path or audit. JS SDK still `0.0.2`. |
| **MagicBlock** | VRF + session keys + (public) Ephemeral Rollups | Added **Private Ephemeral Rollups (TEE / Intel TDX)** — *programmable path is devnet-only*; Payments API mainnet. VRF crate `0.2.1`→`0.4.1` (old versions **yanked**). ER now mainnet, sub-50ms. |
| **Arcium** | (not on our radar) | **MPC (Cerberus, dishonest-majority) — Mainnet Alpha (permissioned) since Feb 2026.** Official **blackjack example** = near-complete template for shuffle/deal/reveal. Built-in `ArcisRNG` (no external VRF). |

**Key consequence:** our marketing/code calling Inco "FHE" is factually wrong now (being corrected separately). And "minimal trust" deserves an honest definition (below).

---

## 3. Trust models compared (the heart of "minimal trust")

| | **Inco (TEE)** | **MagicBlock PER (TEE)** | **Arcium (MPC / Cerberus)** |
|---|---|---|---|
| Root of trust | Hardware vendor + Inco covalidator/operator | Intel TDX + node operator's enclave (single) | **1-of-N cluster nodes honest** — no hardware root |
| Who must stay honest | The enclave + the one covalidator key | The one enclave + its operator | **At least one** of N independent operators |
| Compromise blast radius | Enclave break → all cards | Enclave break → all cards (single point) | Need **all N** to collude **and** break MPC |
| Deck-order exposure | Depends on where shuffle runs (today: **public**, §1) | Hidden in enclave during session; **public on L1 after commit** | **Never in plaintext anywhere** (secret-shared) |
| Randomness | External VRF (today, exposed) or enclave RNG | Enclave RNG | **In-MPC `ArcisRNG`, never exposed** |
| Reveal integrity | Ed25519 covalidator sig (current design) | Enclave attestation | `.reveal()` on MAC-authenticated shares |
| Solana mainnet (mid-2026) | **Devnet beta only** | Programmable path **devnet only** | **Mainnet Alpha (permissioned)** |
| Latency | FHE/TEE compute (unbenched) | **Sub-50ms (fastest)** | ~1s+/op (warm-cached lower), async callback |
| Audits | Not found (beta) | Not detailed | "Multiple" claimed — **firms/reports unverified** |

**Honest "minimal trust" ranking for our use case:** Arcium (1-of-N honest) > Inco/PER (single enclave + vendor). TEE = trust Intel + one operator; MPC = trust that not *everyone* colludes. For a real-money poker product whose entire pitch is "the house can't cheat," MPC is the materially stronger and more defensible claim.

---

## 4. Recommendation: Arcium as the confidential core

**Target architecture:**

```
Shuffle + deal + community reveal + showdown   ->  Arcium MPC circuits (Arcis)
                                                    - ArcisRNG shuffle (no VRF, order never exposed)
                                                    - Enc<Mxe, Deck>      = deck/undealt cards: NO party can read
                                                    - Enc<Shared, Hand>   = hole cards: only that player decrypts
                                                    - .reveal()           = community cards + showdown
Betting actions (fold/check/call/raise/all-in) ->  Public on-chain (chips are not secret)
                                                    - MagicBlock session keys (popup-free)  [KEEP, already built]
                                                    - OPTIONAL: MagicBlock Ephemeral Rollups (non-private) for sub-50ms betting + on-chain timers
Settlement / pot / rake / USDC                  ->  Solana L1 (unchanged)
```

**Why this is the strongest move:**
- **Fixes §1 by construction.** The shuffle runs inside MPC; the order is secret-shared and never appears in any public tx or account. No "reconstruct from randomness" attack exists.
- **Removes hardware-vendor trust.** Privacy holds as long as 1 of N nodes is honest — no Intel/covalidator dependency.
- **Eliminates the VRF entirely.** `ArcisRNG::shuffle` is provably fair *and* private. One fewer dependency, one fewer trust assumption, and the yanked-crate problem disappears.
- **Strongest reveal integrity.** A player cannot substitute a false card — reveals come from authenticated ciphertext, no extra Ed25519 layer needed.
- **Template exists.** Arcium's official **blackjack** example already does shuffle-in-MPC + private deal + selective reveal; it's a near-complete scaffold for Hold'em.
- **Clearer mainnet path** than Inco-on-Solana (which is devnet-only with no timeline).

**What it costs / risks (be honest):**
- **Real rewrite** of shuffle/deal/reveal into Arcis circuits + queue/callback model; replaces Inco CPI and VRF. Moderate-to-high effort.
- **Latency ~1s+/op** for MPC. Fine for once-per-hand deal and showdown (a dealer "shuffling" pause is natural UX). **Keep betting off the MPC path** — it stays public + fast.
- **Permissioned cluster today.** The "1-of-N honest" set is a curated allowlist until Arcium's TGE/permissionless phase. Still strictly better than single-TEE, but "trustless" is partly aspirational short-term — say so.
- **Engineering constraints:** 1232-byte callback limit (use `Pack<T>` for the 52-card deck), fixed-loop circuit model (no early return/break), both `if` branches execute. Workable but rigid; matters for a 9-handed table.
- **Unverified:** Arcium's specific audit firms/reports, TGE date, and hard latency numbers. **Get these from Arcium before committing to mainnet real money.**

**Why not the alternatives:**
- **Stay on Inco:** doesn't fix §1 (you'd still need to move the shuffle off the public VRF path anyway), keeps hardware+covalidator trust, devnet-only, no audit. Lowest effort but doesn't deliver the goal.
- **MagicBlock PER:** best UX (sub-50ms) but **weakest trust** (single enclave/vendor), **programmable path is devnet-only**, and privacy is **session-scoped** (public again on L1 commit). Good for speed, wrong for "minimal trust."

---

## 5. Things no technology can fix (must be honest in the pitch)

- **Player collusion:** once a player legitimately decrypts their *own* cards, nothing cryptographic stops them from sharing them (screenshot, second screen). True for Inco, PER, **and** Arcium. Mitigate via detection/heuristics, table limits, and ToS — not crypto. Don't claim otherwise.
- **Client-side endpoint risk:** cards are decrypted in the browser; malware/extensions could read them. Inherent to any "only you see your cards" design.
- **Side channels:** TEE microarchitectural attacks (Inco/PER) and circuit-shape/timing leaks (Arcium). Arcium's fixed-shape circuits mitigate the latter; TEE side-channels depend on the vendor.

---

## 6. Proposed sequencing (low-regret first)

1. **[now] Empirically confirm §1** (reconstruct a devnet hand from its callback tx). Documents the severity; informs urgency.
2. **[now] Housekeeping already in flight:** crates off yanked versions (`ephemeral-vrf-sdk 0.4.1`, `session-keys 3.1.1`); fix the "FHE→TEE" wording; fix the local `cargo-build-sbf` toolchain so a deployable build is possible; locate/secure the deploy keypair for `5fcckjDn...` (not on this machine).
3. **[spike] Build a standalone Arcium proof-of-concept**: one table, shuffle-in-MPC + private deal of 2 hole cards + a flop reveal + a 2-player showdown. Measure real latency and callback-size behavior. This de-risks the rewrite before touching the main program.
4. **[decision gate] Review the spike + Arcium's audit/TGE answers.** If green, plan the phased migration of `callback_shuffle` / `reveal_*` / `showdown` onto Arcium and rip out the VRF + Inco CPI.
5. **[parallel/optional] Evaluate Ephemeral Rollups** for the betting hot path (mainnet, sub-50ms) independent of the privacy decision.

---

## 7. Open questions to take to the vendors

- **Arcium:** named audit firms + report links; TGE / permissionless timeline; hard per-op latency and cost at a 6–9 player table; max practical encrypted-state size vs. the 1232-byte callback limit for a full deck + N hands.
- **MagicBlock:** is there a mainnet timeline for the *programmable* PER path?; enclave-compromise / malicious-operator threat model; ER protocol fees at our hand cadence.
- **Inco:** any Solana mainnet timeline + audit — for completeness, even though we're likely moving off it.
