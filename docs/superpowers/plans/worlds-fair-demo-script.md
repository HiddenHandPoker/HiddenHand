# World's Fair demo camera script

Camera-ready scripts for Colosseum World's Fair (Solana track). Two videos:

| Video | Cap | Purpose |
|---|---|---|
| Pitch | ≤2:45 | Why private poker matters; live Arcium-MPC Hold'em exhibit |
| Technical | ≤2:30 | Six circuits, deck layout, audit findings, explorer proof |

**Pin URLs on landing after recording.** Do not add placeholder embeds to `app/app/page.tsx` until real YouTube (or equivalent) URLs exist. After upload, link both videos from the landing Watch section in a follow-up commit.

---

## Hard rules (read before every take)

- **Never** reuse `https://youtu.be/6WgATb6sfp4` (old Inco/VRF cut). Shoot new footage only.
- **Never** fake cards, splice a plaintext hole into an opponent seat, or overlay a pre-dealt board. Live MPC ciphertext → reveal only.
- **Never** say: `$60B`, `any stakes`, `popup-free`, `a few seconds`, `trustless`, `no house`, `first private poker`, or treat **Inco** / VRF as the current stack.
- Latency copy is always **15–20 seconds per MPC round**. When editing, cut a ~15s shuffle wait to ~3s on screen and burn in caption: **`real wait ~18s`**.
- Demo path is **play-money** (HHC faucet) on **Solana devnet**. Program id `GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`. Cluster offset **456**.
- Closing line for pitch: **"Don't trust the dealer. There isn't one."** (do not substitute "Trust the math" as the closer).

---

## Recording setup (both videos)

Do this before Step 1 of either script.

1. **RPC:** set `NEXT_PUBLIC_SOLANA_RPC` to a reliable Helius (or equivalent) HTTPS endpoint. Public Solana devnet drops Arcium txs — do not record on the public RPC.
2. **Wallets:** two Phantom profiles (or two browsers). Call them **Seat A** and **Seat B**. Fund both with enough SOL for fees + HHC from the faucet.
3. **Demo table:** open `/table/judge-demo` (`DEMO_TABLE_ID`). Crank must be running against that table (`app/scripts/demo-crank.cjs` or the deployed keeper). Confirm Authority Controls are gone from the felt.
4. **Screen layout for live-hand B-roll:**
   - Split-screen: Seat A left, Seat B right (same `judge-demo` URL).
   - Optional third pane (technical video only): Solana Explorer on the `DeckState` PDA for the current hand (`["deck", table, hand_number]`), showing the 64-byte ciphertext blob — not plaintext cards.
5. **Capture:** 1080p, 30 or 60 fps. Mic for VO. Disable OS notifications. Zoom browser to ~110% so cards/bubbles read on a phone screen.
6. **Takes:** shoot **10** full hands (or 10 attempts). Keep **1** clean take where: both seats deal in, at least one fold bubble fires, flop theater shows, named showdown lands, pot + rake line look correct. Never stitch cards from take 3 onto take 7.

### Edit policy for MPC waits

| Beat | Raw | On-screen | Caption |
|---|---|---|---|
| Shuffle | ~15–20s | ~3s | `real wait ~18s` |
| Each deal_to_seat | ~15–20s | ~3s | same caption OK once per deal block |
| Flop / turn / river / showdown_reveal | ~15–20s each | ~3s | same |

Keep the **start** of the wait (status bar / Provably Fair badge / circuit name) and the **callback landing** (cards or phase advance). Jump-cut the middle. Audio: soft whoosh or silence under the caption — do not invent card-flip SFX before the callback.

---

## Pitch video (≤2:45) — voice + B-roll

**Target runtime:** 2:30–2:45. Prefer cutting down, not padding.

### Beat sheet

| TC | Visual | VO (speak this) |
|---|---|---|
| **0:00–0:20** | Still / archival B-roll of classic online poker UI, or simple title card: "UltimateBet · Absolute Poker". Cut to black with "the house saw every hole card". | "Online poker already had its scandal era. At UltimateBet and Absolute Poker, the house — or someone inside it — could see hole cards. Players were never playing the game they thought they were." |
| **0:20–0:40** | Repo flash: old VRF callback path or a one-line diagram "public randomness → reconstructable deck". Then strike-through / red X. Do **not** name Inco as current. | "We shipped a VRF 'provably fair' shuffle ourselves. Then we proved the deck was reconstructable from the public callback. Encryption that a chain observer can undo is theater. So we threw that design out." |
| **0:40–1:10** | Code: `encrypted-ixs/src/lib.rs` — zoom `fn shuffle() -> Enc<Mxe, Deck>`, `ArcisRNG::shuffle`, return sealed to MXE. Optional cut to Explorer `DeckState.deck` as opaque bytes. | "HiddenHand shuffles inside Arcium MPC. The deck lands on-chain only as an MXE ciphertext — Enc M-X-E. Randomness never hits the chain. There is no dealer process holding your cards." |
| **1:10–2:00** | **Split-screen live hand** on `judge-demo`. No host buttons. Seat A folds or calls; fold/action bubble visible. Crank advances protocol. Flop theater: encrypted opponents, then three board cards after `reveal_flop`. Caption on any cut wait: `real wait ~18s`. | "This is a live hand on Solana devnet. Two wallets. No host chrome. Hole cards are sealed to each player's key — spectators see ciphertext until showdown. When the flop lands, it is revealed from the same sealed deck, not a second random source." |
| **2:00–2:30** | Named showdown overlay (hand rank lines). Pot awarded. Brief rake / play-money badge (`Play-money · Solana devnet · Arcium MPC`). | "Showdown names the hands. Rake is on-chain and explicit. Today this is play-money — a dealing engine for a licensed operator later, not a casino pitch." |
| **2:30–2:45** | Felt + logo. End card: product name + "Watch a live hand" URL placeholder for editors. | "Don't trust the dealer. There isn't one." |

### Pitch shot list (practical)

1. Title / scandal beat (0:00–0:20) — can be static graphics; no need for gameplay.
2. "We broke our own VRF design" beat (0:20–0:40) — 5–8s of code or diagram max.
3. `shuffle` + `Enc<Mxe, Deck>` (0:40–1:10) — screen-record the file with cursor; 15–20s raw, keep ~20s edited with VO.
4. Live split-screen (1:10–2:00) — from the kept take: sit/dealt → one fold bubble → flop reveal. Trim MPC waits per edit policy.
5. Showdown + rake (2:00–2:30) — end of same take.
6. Closer (2:30–2:45) — VO only over logo; leave 0.5s silence after the line.

### Pitch VO — continuous read (for teleprompter)

> Online poker already had its scandal era. At UltimateBet and Absolute Poker, the house — or someone inside it — could see hole cards. Players were never playing the game they thought they were.
>
> We shipped a VRF "provably fair" shuffle ourselves. Then we proved the deck was reconstructable from the public callback. Encryption that a chain observer can undo is theater. So we threw that design out.
>
> HiddenHand shuffles inside Arcium MPC. The deck lands on-chain only as an MXE ciphertext. Randomness never hits the chain. There is no dealer process holding your cards.
>
> This is a live hand on Solana devnet. Two wallets. No host chrome. Hole cards are sealed to each player's key — spectators see ciphertext until showdown. When the flop lands, it is revealed from the same sealed deck, not a second random source.
>
> Showdown names the hands. Rake is on-chain and explicit. Today this is play-money — a dealing engine for a licensed operator later, not a casino pitch.
>
> Don't trust the dealer. There isn't one.

---

## Technical video (≤2:30)

**Audience:** engineers / hackathon judges who will open the repo. Prefer screen + terse VO over music.

### Beat sheet

| TC | Visual | VO / on-screen text |
|---|---|---|
| **0:00–0:20** | `encrypted-ixs/src/lib.rs` outline or six-name list. | "Six Arcis circuits: `shuffle`, `deal_to_seat_v2`, `reveal_flop`, `reveal_turn`, `reveal_river`, `showdown_reveal`. Public Solana instruction for dealing is still `deal_to_seat`; the circuit name is `deal_to_seat_v2` because the old comp-def on cluster 456 could not be closed." |
| **0:20–0:45** | Diagram or comment zoom: seat `i` → `deck[2i], deck[2i+1]`; board **18–20** flop, **21** turn, **22** river. | "One sealed deck. Holes at even/odd pairs per seat. Community cards are fixed indices 18 through 22. Every later circuit re-feeds the same `Enc<Mxe, Deck>` — we do not reshuffle between streets." |
| **0:45–1:05** | `deal_to_seat.rs` constraint / SECURITY.md **C-1**. | "C-1: `deal_to_seat` requires `player_seat.player == payer`. You cannot deal someone else's seat to your x25519 key. That was a critical finding; it is fixed and regression-covered." |
| **1:05–1:25** | `shuffle` callback / SECURITY.md **H-2**. | "H-2: shuffle callback is one-shot. If `deck_state.is_shuffled` is already true, a late second callback is a no-op — it cannot swap a committed deck under live hole cards." |
| **1:25–1:55** | Explorer: `DeckState` account for the live hand — highlight `deck` as 64 ciphertext bytes + nonce. Split with UI showing encrypted opponent cards. | "Explorer view of `DeckState`: opaque MXE ciphertext. Honest latency: about 15 to 20 seconds per MPC round on this cluster. Edits compress the wait; we caption the real duration." |
| **1:55–2:20** | Live two-Phantom hand fragment OR `app/scripts/devnet-full-hand.cjs` success tail. Show named showdown. | "Same deck feeds showdown reveal for non-folded seats. Play-money exhibit on `judge-demo` with a permissionless crank — not a hosted dealer console." |
| **2:20–2:30** | End card: program id, `SECURITY.md`, cluster 456. | "Audit notes and fixes live in `SECURITY.md`. Cluster offset 456. Watch the table the same day you watch this video." |

### Technical VO — continuous read

> Six Arcis circuits: shuffle, deal_to_seat_v2, reveal_flop, reveal_turn, reveal_river, showdown_reveal. The public instruction is still deal_to_seat; the circuit is named deal_to_seat_v2.
>
> One sealed deck. Seat i reads deck positions 2i and 2i+1. The board is fixed: flop 18 through 20, turn 21, river 22. Later circuits re-feed the same Enc M-X-E deck.
>
> C-1: deal_to_seat requires the payer to own the seat — you cannot seal a victim's holes to your key.
>
> H-2: the shuffle callback is one-shot. A late duplicate cannot replace a committed deck.
>
> On Explorer, DeckState is ciphertext, not cards. Each MPC round is about 15 to 20 seconds; we cut dead waits in the edit and caption the real wait.
>
> Showdown reveals non-folded holes from that same deck. Play-money on judge-demo, crank in the loop. Details in SECURITY.md. Cluster 456.

### One finding deep-dive (pick C-1 for the cut)

If time is tight, keep **C-1** on screen longer and reduce H-2 to a single sentence lower-third:

- **Problem:** caller-supplied x25519 pubkey + no seat ownership check → attacker deals victim seat to attacker key.
- **Fix:** `player_seat.player == payer` → `NotYourSeat`.
- **Proof cue:** cite `SECURITY.md` § C-1; optional flash of `app/scripts/devnet-exploit-checks.cjs` if it covers the case.

---

## Shoot day checklist (Step 1–2 from the task)

- [ ] Helius (or equivalent) RPC in env; crank running on **`judge-demo`**
- [ ] Two Phantoms seated; faucet chips topped up
- [ ] 10 raw takes; pick 1 with fold bubble + flop theater + named showdown
- [ ] Edit MPC waits to ~3s with burn-in **`real wait ~18s`**
- [ ] Scrub VO/transcript for banned phrases (`$60B`, any stakes, popup-free, a few seconds, Inco-as-current)
- [ ] Confirm no segment from `youtu.be/6WgATb6sfp4` is in the timeline
- [ ] Export pitch ≤2:45 and technical ≤2:30
- [ ] Upload new URLs; **pin URLs on landing after recording**
- [ ] Watch both finals once end-to-end; confirm live `judge-demo` still plays that day

---

## Freeze & submit (human; not automatable here)

| When | Action |
|---|---|
| **2026-10-08** | **Freeze.** No circuit edits, no program upgrade, no IDL copy except break-glass faucet / RPC / crank. |
| **2026-10-08** (buffer to Oct 12) | Submit on Colosseum, **Solana track**. Attach the **new** pitch + technical videos only. Do **not** attach `6WgATb6sfp4`. Do **not** paste gitignored Inco-era `PITCH.md`. |
| Oct 9–11 | Crank / faucet / RPC watch only. No feature creep. |

---

## Post-recording landing note

After URLs exist, update `app/app/page.tsx` Watch section with two links (or embeds) labeled roughly "Pitch (2:45)" and "Technical (2:30)". Until then, leave the page alone — no fake video iframes.

**Pin URLs on landing after recording.**
`)