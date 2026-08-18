<div align="center">

# 🃏 HiddenHand

### The only poker game where the house *can't* see your cards — not even us.

Fully on-chain Texas Hold'em on Solana, where the deck is shuffled and dealt **inside a multi-party computation (MPC) network** ([Arcium](https://arcium.com)). No server, no dealer, no chain observer — **nobody** — ever sees the deck or your hole cards. The privacy isn't a promise. It's a cryptographic guarantee.

[![Live on Devnet](https://img.shields.io/badge/▶_Live_Demo-devnet-14F195?style=for-the-badge)](https://hiddenhand.netlify.app)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?style=flat-square&logo=solana)](https://explorer.solana.com/address/GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz?cluster=devnet)
[![Arcium MPC](https://img.shields.io/badge/Arcium-MPC-22d3ee?style=flat-square)](https://arcium.com)
[![Anchor](https://img.shields.io/badge/Anchor-1.0-blue?style=flat-square)](https://www.anchor-lang.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](./LICENSE)

*"Don't trust the dealer. Trust the math."*

</div>

---

## Why this exists

Every hand of online poker you've ever played, you were trusting that the platform wouldn't cheat — that no employee would peek, no server would get breached, no superuser account would quietly read every hole card.

That trust has been broken before. In the **UltimateBet / Absolute Poker** scandal, insiders with "god-mode" accounts could see everyone's cards and stole an estimated **$20M+** before players noticed the impossibly perfect play.

The dirty secret of online poker is that **the game is only as honest as the people running the servers.**

HiddenHand removes those people from the equation. The cards stay encrypted the entire time — shuffled inside MPC, dealt to you sealed to *your* key, and only revealed at showdown, straight from the same sealed deck everyone was dealt from. There is no server that could cheat, because there is no server that can see.

| Traditional online poker | HiddenHand |
|---|---|
| The server sees every card | The deck is **never** in plaintext, anywhere |
| A DB breach leaks all hands | Cards live only as MPC ciphertext / client-side |
| "Superuser" exploits are possible | No party holds the deck — it's split across MPC nodes |
| "Trust us" | Verify the transactions on-chain |

---

## What makes this technically interesting

This project started for the Solana Privacy Hack with a **different** privacy stack — MagicBlock VRF for shuffling + Inco's TEE for card encryption — and then got **re-architected from the ground up** to fix a real, subtle flaw:

> **The vulnerability:** with a public verifiable-random-function (VRF) shuffle, the randomness that ordered the deck is emitted in the VRF callback **on-chain, in the clear**. Anyone watching the chain could re-derive the entire deck ordering. The "encrypted" hole cards were theater against a chain observer.

The fix isn't a patch — it's a different trust model. **Arcium MPC** shuffles the deck *inside* the computation: the randomness never touches the chain, and the deck exists on-chain only as an opaque ciphertext that no single party can decrypt. Privacy by construction, not by obscurity.

That migration — **VRF + TEE → MPC** — is the heart of this repo, and it's a case study in *understanding the tradeoffs* of each privacy primitive on Solana (VRF, TEE, FHE, MPC) rather than cargo-culting one.

---

## How a hand actually works

The betting, pot/side-pot math, hand evaluation, rake, and seating all run as **normal public Solana program logic** (they don't need to be secret). Only the card lifecycle is confidential, and it runs as **six Arcium MPC circuits** ([`encrypted-ixs/src/lib.rs`](./encrypted-ixs/src/lib.rs)). The deck is the single source of truth: shuffled once, sealed to the MXE, stored on-chain as ciphertext, and **re-fed unchanged** into every later circuit.

```
                     ┌──────────────────── on-chain, opaque ciphertext ─────────────────────┐
 start_hand ─▶ shuffle() ─▶ DeckState.deck  (Enc<Mxe, Pack<[u8;52]>>)                        │
 (public)      (MPC)            │                                                            │
                               │  re-fed (unchanged) into every circuit below               │
                               ▼                                                            │
  each player ─▶ deal_to_seat(deck, my_x25519_key, seat_i) ─▶ HoleDealt event (sealed to me) │
  (MPC, ×N)         hole cards = deck[2i], deck[2i+1]        └▶ only I decrypt (RescueCipher) │
                               ▼                                                            │
  betting ─▶ reveal_flop / reveal_turn / reveal_river(deck) ─▶ public board written on-chain │
  (public)      (MPC, .reveal() of deck[18..23])                                            │
                               ▼                                                            │
  showdown ─▶ showdown_reveal(deck, fold_mask) ─▶ non-folded hole cards revealed on-chain    │
  (public)      (MPC, batched)  └▶ hand evaluated on public cards, pot paid                  │
                     └────────────────────────────────────────────────────────────────────┘
```

**Fixed deck layout** (so community-card indices don't depend on player count):
`hole cards` → seat `i` gets `deck[2i], deck[2i+1]` · `flop` → `deck[18,19,20]` · `turn` → `deck[21]` · `river` → `deck[22]`.

**The privacy guarantees, precisely:**
- **Shuffle** happens in MPC; the randomness never appears on-chain. The deck is stored as `Enc<Mxe, …>` ciphertext — decryptable only by the MPC network acting together, for later computation.
- **Your hole cards** are sealed inside MPC to *your* x25519 key and emitted in a `HoleDealt` event. Only you can decrypt them (client-side, via `RescueCipher`). They **never touch the chain in plaintext** — not even as an encrypted handle on your seat account.
- **The board** is revealed publicly from the sealed deck — the same deck you were dealt from, provably.
- **At showdown**, only non-folded hands are revealed, straight from that same deck. Nobody can swap or fabricate a hand.

Because each player's cards seal to a key only they hold, **each player deals themselves in** (the authority can't deal for you). The hand advances to pre-flop once every seated player has run `deal_to_seat`. An [AFK-recovery instruction](#program-instructions) (`timeout_deal`) cleanly aborts and refunds a hand if someone never deals in.

---

## Feature highlights

- ♠️ **Full Texas Hold'em** — blinds, betting (fold/check/call/raise/all-in), side pots, showdown hand evaluation (best 5 of 7), rake.
- 🔒 **Arcium MPC card privacy** — shuffle, per-seat deal, community reveals, and showdown reveal as six MPC circuits.
- 🪙 **One-tap onboarding** — a built-in devnet faucet mints free **HiddenHand Chips (HHC)** so a new player is playing in one click, no token hunting.
- 👀 **Spectator mode** — watch any table live without a wallet; hole cards are provably never exposed to spectators.
- 📜 **On-chain hand history & replay** — every hand reconstructs from program events (`HandStarted`, `ActionTaken`, `CommunityCardsRevealed`, `ShowdownReveal`, `HandCompleted`, `HandAborted`).
- ⏱️ **Liveness / AFK recovery** — timeouts for stuck actions, community reveals, the deal phase, and abandoned tables.
- 📱 **Mobile-responsive** — landscape table, bottom action bar, safe-area handling, touch targets.
- 🛟 **Responsible-gaming tooling** — session timers, deposit limits, self-exclusion, break reminders.

---

## Tech stack

| Layer | Choice |
|---|---|
| MPC circuits | **Arcis** `0.11.1` (Rust DSL) — [`encrypted-ixs/`](./encrypted-ixs/) |
| On-chain program | **Anchor** `1.0.x` / **Solana** `3.x`, `#[arcium_program]` — [`programs/hiddenhand/`](./programs/hiddenhand/) |
| MPC coordination | Arcium CLI `0.11.2`, cluster offset **456** (devnet), Cerberus backend |
| Frontend | **Next.js 16** (App Router, TypeScript), Tailwind — [`app/`](./app/) |
| Client SDK | `@arcium-hq/client` `0.11.2` (x25519 / RescueCipher), `@anchor-lang/core`, Solana Wallet Adapter |
| Token | SPL (Token / Token-2022 via `InterfaceAccount`); devnet default = HHC play-money |

---

## Deployment

- **Program (devnet):** [`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`](https://explorer.solana.com/address/GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz?cluster=devnet) — MXE + all 6 comp-defs initialized.
- **Circuits (OffChain source):** hosted at [`criptocbas/hiddenhand-arcium-circuit`](https://github.com/criptocbas/hiddenhand-arcium-circuit). The program pins each circuit by `circuit_hash!()`; the MXE fetches and hash-verifies the `.arcis` at compute time. (Multi-MB circuits can't go on-chain economically — offchain hosting + hash pinning is the pattern.)
- **Live app:** deployed on Netlify → [hiddenhand.netlify.app](https://hiddenhand.netlify.app).

A full hand has been played end-to-end through the live UI against the deployed program: shuffle → deal → bet → flop/turn/river → showdown, with the correct winner paid and the cards each player decrypted at deal time matching what the showdown revealed.

---

## Program instructions

**Core game (public):** `create_table` · `join_table` · `leave_table` · `start_hand` · `player_action` · `showdown` · `collect_rake` · `close_inactive_table`

**Card lifecycle (Arcium MPC — queue + callback each):** `shuffle` · `deal_to_seat` · `reveal_flop` · `reveal_turn` · `reveal_river` · `showdown_reveal`

**Liveness / timeouts:** `timeout_player` (force-fold an AFK actor) · `timeout_deal` (abort + refund a hand stuck because a player never dealt in) · `timeout_showdown` (abort + refund a hand whose MPC reveal never completed)

---

## Security

The program went through an internal audit (August 2026) covering the MPC trust
boundaries, pot accounting, and every permissionless recovery path. All findings
are fixed and documented — severity, exploit scenario, and fix — in
[`SECURITY.md`](./SECURITY.md), and the critical ones are regression-tested by
devnet scripts that run the actual attacks against the deployed program
(`app/scripts/devnet-exploit-checks.cjs`, `app/scripts/devnet-timeout-showdown.cjs`).

---

## Repository layout

```
hiddenhand/
├── encrypted-ixs/src/lib.rs          # 6 Arcis MPC circuits (shuffle, deal, reveals, showdown)
├── programs/hiddenhand/src/
│   ├── lib.rs                        # #[arcium_program] entrypoints (queue + callback per circuit)
│   ├── instructions/                 # one file per instruction (incl. timeout_deal)
│   └── state/                        # Table, HandState, PlayerSeat, DeckState, hand_eval
├── app/                             # Next.js frontend
│   ├── lib/arcium.ts                 # x25519 keys, RescueCipher decrypt, queue-account set, event scan
│   ├── hooks/usePokerGame.ts         # drives the 6 MPC steps + game state
│   ├── app/api/faucet/route.ts       # devnet HHC faucet (mint-on-demand)
│   └── scripts/                      # devnet integration tests (full hand, timeout_deal)
├── Arcium.toml · Anchor.toml
```

---

## Running it

**Prerequisites:** Rust 1.85+, Solana CLI 3.x, Arcium CLI `0.11.2` (`curl -sSfL https://install.arcium.com/ | bash`), Node ≥ 20, Docker (for localnet).

**Program + circuits**
```bash
arcium build                     # compiles the Arcis circuits + the Anchor program
arcium test                      # runs against a local MPC cluster
# devnet: arcium deploy --cluster-offset 456 --recovery-set-size 4 -k <wallet> -u <reliable-rpc>
```

**Frontend**
```bash
cd app && npm install && npm run dev
```
Set `NEXT_PUBLIC_SOLANA_RPC` to a reliable devnet RPC (Helius/QuickNode/Triton) — the public devnet RPC drops Arcium transactions. To enable the chip faucet, set `FAUCET_SECRET` (base58 mint-authority key) server-side.

**Integration tests (devnet)**
```bash
cd app && RPC_URL=<helius> node scripts/devnet-full-hand.cjs        # full hand through real MPC
cd app && RPC_URL=<helius> node scripts/test-timeout-deal.cjs       # AFK deal-recovery
cd app && RPC_URL=<helius> node scripts/devnet-exploit-checks.cjs   # security regressions (C-1/L-1/H-1)
cd app && RPC_URL=<helius> node scripts/devnet-timeout-showdown.cjs # stuck-showdown abort + refund
```

> ⚠️ **Note on the faucet:** `/api/faucet` mints free **devnet** HiddenHand Chips to any wallet on request — this is intentional (frictionless onboarding for a play-money demo), not a bug. The mint-authority key lives only in the deployment's server-side env, never in this repo.

---

## Status & honest tradeoffs

**Working end-to-end** on devnet and playable on the live site: onboarding → shuffle → deal → betting → reveals → showdown → payout, plus spectating, hand replay, and AFK recovery.

Conscious tradeoffs for a devnet showcase (not oversights):
- **Latency:** ~15–20s per MPC round-trip on devnet, and a hand has several (shuffle, per-seat deal, three street reveals, showdown). This is the honest cost of provable privacy; the UI surfaces each step. Pre-computing the next hand during betting would hide most of it.
- **Wallet popups:** each MPC action uses the real wallet. MagicBlock session-key infrastructure is present but not yet wired into the MPC path.
- **Play-money only:** this is a technology showcase, not a real-money product (real-money poker carries liquidity + legal burdens a solo build shouldn't take on).

---

## Credits

Built by [**criptocbas**](https://github.com/criptocbas). Card privacy powered by [**Arcium**](https://arcium.com) MPC. Originally created for the **Solana Privacy Hack**, then re-architected from a VRF+TEE design to MPC.

## License

[MIT](./LICENSE) — do what you like, no warranty.
