# HiddenHand - Privacy Poker on Solana

## ⚡ CURRENT STATE (2026) — Arcium MPC (READ THIS FIRST)

**The card-privacy backend is now Arcium MPC, NOT Inco TEE + MagicBlock VRF.** The
hackathon-era sections further down describe the retired Inco/VRF design and are kept
only as historical context. Where they conflict with this banner, this banner wins.

**Why the switch:** the old design had a SEV-HIGH flaw — the deck was reconstructable
from the public VRF callback randomness, so "encryption" was theater against a chain
observer. Arcium shuffles inside MPC; randomness never touches the chain; the deck lives
on-chain only as an opaque MXE ciphertext.

**Architecture (the card lifecycle = 6 Arcium MPC circuits in `encrypted-ixs/src/lib.rs`):**
- `shuffle` → shuffles the 52-card deck in-MPC, seals it to the MXE, stored on-chain in
  `DeckState.deck` (`[[u8;32];2]`) + `deck_nonce`. Re-fed unchanged into every later circuit.
- `deal_to_seat` (once per seated player) → seals that seat's 2 hole cards to the player's
  own x25519 key. Emitted via the `HoleDealt` event; only that player can decrypt (client-side
  RescueCipher). Deck positions `2i, 2i+1` for seat `i`; board at 18–22.
- `reveal_flop` / `reveal_turn` / `reveal_river` → re-feed the deck, `.reveal()` the board
  publicly; callback writes `HandState.community_cards` and advances the phase.
- `showdown_reveal` → batched; reveals non-folded hole cards (mask from on-chain fold state)
  into each seat's `revealed_card_1/2`; the existing `showdown` eval then runs on public cards.

Retired: `request_shuffle`/`callback_shuffle` (VRF), `encrypt_hole_cards`, `grant_card_allowance`,
`grant_own_allowance`, `grant_community_allowances`, `reveal_cards`/`reveal_community` (Inco/Ed25519),
`inco_cpi.rs`, `ephemeral-vrf-sdk`. Betting / pot / side-pots / rake / hand-eval are unchanged
public Solana logic (50 passing unit tests).

**Security hardening (Aug 2026, see `SECURITY.md` for full audit):** C-1 (deal_to_seat
seat-ownership), H-1 (showdown remaining-accounts completeness: all active seats present +
summed stakes == pot), H-2 (idempotent shuffle callback), H-3 (lone winner settles without
showdown; `active_count > 1` guard in showdown_reveal), M-1 (timeout_deal refund dedup +
completeness), M-2 (no timeout_player during community-reveal wait), L-1 (no leaving mid-hand,
even at 0 chips), L-2 (collect_rake works on Closed tables). New instruction
**`timeout_showdown`** (anyone, after 180s): aborts a hand stuck at showdown/community reveal
because the MPC never completed — refunds every stake, guarded so a decided showdown can't be
dodged (`HandNotStuck`). Both abort paths emit **`HandAborted`** (reason 0=deal stall,
1=reveal stall; parsed in `useHandHistory.ts`). Error enum: never remove/reorder variants
(Anchor error codes are index-based); retired Inco-era variants stay with a comment.
CI: `.github/workflows/program.yml` enforces `cargo fmt --check` + `clippy -D warnings` +
tests; `app.yml` enforces the Next build (lint non-blocking, pre-existing debt).

**Version stack:** `arcis`/`arcium-anchor`/`-client`/`-macros` `=0.11.1`, `anchor-lang 1.0.x` /
Solana 3.x, `arcium` CLI 0.11.2, `@arcium-hq/client 0.11.2` (frontend), devnet cluster offset **456**.

**Deployment status (Phase 3 complete, re-homed 2026-08-18):** program
`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz` on **devnet**. The previous
program `9chPz3vJDeU7gr4zBtDreJUpVLKbqwrKoQBQQjT1SF5X` is frozen — its upgrade
authority key was lost. Upgrade / MXE authority is
`~/.config/solana/hiddenhand/upgrade-authority.json` (pubkey
`CbRBAijxZrSre8TZWX1VWeEJSsD4Z2foEpsn1rbAJCdZ`). Program keypair:
`~/.config/solana/hiddenhand/program.json`. **Never** `solana-keygen new --force`
onto `id.json` or those files. A full hand has run end-to-end
through the live MPC network (shuffle → deal → bet → reveals → showdown), with dealt cards
matching the showdown-revealed cards and the pot conserved. Circuits are hosted (OffChain source)
at `github.com/criptocbas/hiddenhand-arcium-circuit` — **if you edit a circuit you MUST
`arcium build` → re-push the exact `.arcis` to that repo → redeploy, or computations abort.**

**Frontend:** `app/lib/arcium.ts` (replaces `lib/inco.ts`) — x25519 key derivation, MXE pubkey,
RescueCipher decrypt, Arcium queue-account set, event scanning. `usePokerGame.ts` drives the 6
MPC steps (public API preserved). Builds under Turbopack via `next.config.ts` aliases
(anchor-core-shim + crypto/fs/child_process polyfills — see the file). Reproducible integration
test: `app/scripts/devnet-full-hand.cjs`. RPC must be reliable (Helius) via `NEXT_PUBLIC_SOLANA_RPC`;
public devnet drops Arcium txs.

---

## Historical note

The sections that used to follow this banner described the retired
MagicBlock VRF + Inco TEE design (Solana Privacy Hack, 2025). That
design had a SEV-HIGH flaw: the deck was reconstructable from public
VRF callback randomness. The rewrite is documented in
`thinking/privacy-backend-decision-2026.md`. Do not treat any
Inco / VRF / `inco_cpi.rs` / `lib/inco.ts` text as current.

## Game phases

```
Dealing → PreFlop → Flop → Turn → River → Showdown → Settled
```

`GamePhase as u8` encoding (Dealing=0 … Settled=6) is part of the event ABI.
**Do not reorder `GamePhase` variants** in `hand.rs`.

## PDAs

- **Table**: `["table", table_id]`
- **Player Seat**: `["seat", table_pubkey, seat_index]`
- **Hand State**: `["hand", table_pubkey, hand_number]`
- **Deck State**: `["deck", table_pubkey, hand_number]`
- **Vault**: `["vault", table_pubkey]` — SPL TokenAccount, authority = table PDA

## Token architecture (SPL)

Each table is denominated in a single SPL token (stored as `token_mint: Pubkey` on Table).
Devnet default is HiddenHand Chips (HHC, play-money faucet); tables may also use USDC.

**Vault pattern**: The vault is an SPL `TokenAccount` PDA at `["vault", table_key]` with
`token::authority = table PDA`. The **table PDA signs transfers** using `TABLE_SEED`
signer seeds — not the vault's own seeds.

**Internal chip ledger**: `PlayerSeat.chips`, `HandState.pot`, and `Table.accumulated_rake`
are abstract u64 values manipulated in-memory. **Real token transfers only happen at 4
entry/exit points**: `join_table` (deposit), `leave_table` (withdraw), `collect_rake`
(authority), `close_inactive_table` (emergency refund). Gameplay instructions (betting,
dealing, showdown, etc.) never touch tokens.

**Anchor types**: Uses `InterfaceAccount<'info, TokenAccount>` and
`Interface<'info, TokenInterface>` for Token and Token-2022.

**Native SOL is not supported** — was removed when switching from SystemAccount vaults
to TokenAccount vaults.

## On-chain events & hand replay

Events in `events.rs` create a complete audit trail for every hand:

| Event | Emitted in | When |
|-------|-----------|------|
| `HandStarted` | `deal_to_seat` (last seat) | All seats dealt, blinds posted |
| `ActionTaken` | `player_action.rs`, `timeout_player.rs` | Every player action or timeout |
| `CommunityCardsRevealed` | `reveal_flop` / `reveal_turn` / `reveal_river` callbacks | Board cards published |
| `ShowdownReveal` | `showdown_reveal` callback | Non-folded hole cards published |
| `HandCompleted` | `showdown.rs` | Hand finishes, pot distributed |
| `HandAborted` | `timeout_deal`, `timeout_showdown` | Stuck hand refunded |

**ActionTaken.action_type encoding**: 0=Fold, 1=Check, 2=Call, 3=Raise, 4=AllIn, 5=TimeoutFold, 6=TimeoutCheck.

**Frontend sync gotcha (IMPORTANT)**: `useHandHistory.ts` has hardcoded SHA-256 discriminators (`EVENT_DISCRIMINATORS`) and hand-written binary parsers for each event. If you rename an event struct, add/remove/reorder its fields, or change field types, you **must**:
1. Regenerate the discriminator: `echo -n "event:<EventName>" | sha256sum` (first 8 bytes)
2. Update the corresponding `parse*FromBuffer` function to match the new layout
3. Run `anchor build` and copy the updated IDL to `app/lib/idl/`

**Historical reconstruction**: `useHandHistory` calls `getSignaturesForAddress(tablePDA)` on mount to fetch past transactions, parses all `"Program data:"` log lines by discriminator, and rebuilds both `history` (HandCompleted) and `handTimelines` (all other events). This works because the table PDA appears in every instruction's account list.

## Game liveness (AFK recovery)

Timeout checks use Solana cluster time (not local time). Frontend uses `getBlockTime()` for validation.

1. **Player Action Timeout** (`timeout_player`): Force fold/check inactive players after 60s (`ACTION_TIMEOUT_SECONDS`)
2. **Deal Timeout** (`timeout_deal`): Abort + refund if shuffle never commits or a seated player never deals in (30s)
3. **Community Reveal Timeout** (`reveal_flop` / `reveal_turn` / `reveal_river`): Any player can queue the street after 60s if authority is AFK
4. **Stuck MPC Reveal** (`timeout_showdown`): After 180s, abort and refund everyone

## Spectator mode

The spectator system lets anyone watch live tables without connecting a wallet.

**Privacy invariant (CRITICAL):** Live hole cards are not on-chain. They arrive only as
`HoleDealt` ciphertext sealed to the owner's x25519 key. The `useTableState` hook always
returns `holeCards: [null, null]`. Spectators may only see `revealedCards` after
`showdown_reveal` writes plaintext 0–51. This is not just a UI concern; it's the core
privacy guarantee.

**Read-only Anchor provider pattern:** Both `useTableState` and `useLobby` create their own Anchor `Program` instance using a dummy wallet when no real wallet is connected. This allows on-chain reads without wallet connection:
```ts
const dummyWallet = {
  publicKey: PublicKey.default,
  signTransaction: async (tx) => tx,
  signAllTransactions: async (txs) => txs,
};
const provider = new AnchorProvider(connection, wallet ?? dummyWallet, opts);
```

**dataSize filter (GOTCHA):** `useLobby` filters `table.all()` with `dataSize: 177` to skip old devnet table accounts that predate the USDC migration (they're 33 bytes shorter and cause deserialization errors). **If the Table struct changes, this constant MUST be updated to match `Table::SIZE` in `table.rs`.**

## Rake system

Rake is a percentage of each pot, capped per hand, tiered by blind level. Set at table creation via `getRakeForBlinds()` in `app/lib/rake.ts`. Collected on-chain during `showdown` into `table.accumulated_rake`. Authority withdraws via `collect_rake` instruction.

| Tier | Max BB | Rake | Cap |
|------|--------|------|-----|
| Micro | $0.10 | 5% | $1 |
| Low | $1 | 4.5% | $2 |
| Medium | $5 | 4% | $5 |
| High | $25 | 3% | $15 |
| Nosebleed | $25+ | 2.5% | $25 |

## Mobile-responsive architecture

The frontend supports mobile phones in both portrait and landscape orientations. The table page is optimized for landscape (like PokerStars/GGPoker mobile apps).

**Key mobile hooks** (`useIsMobile.ts`):
- `useIsMobileLandscape()` — true when `innerHeight <= 500 && landscape`. Triggers compact table mode.
- `useIsMobilePortrait()` — true when `portrait && width <= 768`. Triggers rotation overlay.
- `useIsTouch()` — true when `(hover: none) and (pointer: coarse)`. Hides keyboard shortcut hints.

**Table page mobile behavior:**
- `RotateDeviceOverlay` appears on portrait mobile, suggesting landscape. Dismissible.
- `PokerTable` uses tighter `SEAT_POSITIONS_MOBILE` (seats at 6%/94% instead of 12%/88%) and seat width shrinks from `w-36` to `w-[5.5rem]`.
- `PlayerSeat` accepts `compact` prop: xs cards, smaller padding/text/badges.
- `Card.tsx` has `xs` size (36x50px) in addition to sm/md/lg.
- `ActionPanel` in `mobile` mode renders as a fixed bottom bar with 4 inline buttons and an expandable raise drawer (slides up). Hidden keyboard hints via `.kbd-hint` CSS class.

**CSS utilities** (`globals.css`):
- `.safe-bottom/.safe-left/.safe-right/.safe-top` — `env(safe-area-inset-*)` for notched devices
- `.touch-target` — min 48px on touch devices
- `.kbd-hint` — hidden on `(hover: none) and (pointer: coarse)`
- `.no-overscroll` — prevents pull-to-refresh on table page
- `.scrollbar-hide` — hides scrollbar on horizontal filter pill rows

**Viewport meta** (`layout.tsx`): `viewport-fit=cover, maximum-scale=1, user-scalable=no` prevents accidental zoom during gameplay.

**Modals on mobile**: `CreateTableModal` and `QuickPlayModal` use `items-end sm:items-center` and `rounded-t-*` to slide up from bottom as sheets on mobile, centered on desktop.

## Development commands

```bash
arcium build                     # Arcis circuits + Anchor program
cargo test -p hiddenhand         # on-chain unit tests (50)
cd app && npm run dev            # frontend; needs NEXT_PUBLIC_SOLANA_RPC
```

The Mocha suite under `tests/` is a retired native-SOL / VRF/Inco landmine and is
skipped (`Anchor.toml` `[scripts] test`). Do not run it against
`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`. Devnet E2E:
`app/scripts/devnet-full-hand.cjs`.

## Design notes

- Dark theme with poker aesthetic (green felt, gold accents)
- Card reveal animations with 3D flip effect
- Sound effects for chips/cards/actions
- Mobile-first responsive: landscape table, bottom action bar, compact seats
- Safe area support for notched phones (iPhone X+, Dynamic Island)
- Touch-optimized: 48px minimum targets, no hover-only interactions
- Reduced motion support via `prefers-reduced-motion`
