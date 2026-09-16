# Competitive position

Honest census for judges and for ourselves. Every claim here must survive a
look at the deployed program and a grep of this repo.

## Claim we can defend

- Live Texas Hold'em on Solana **devnet** whose card lifecycle is six Arcium
  MPC circuits (`encrypted-ixs/src/lib.rs`).
- Program id [`GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz`](https://explorer.solana.com/address/GAc5rZPEFfaevbTL6F5jqWAuYQUNVHPfaQ2dRc5tFgSz?cluster=devnet).
- The deck is stored on-chain only as `Enc<Mxe>` ciphertext (`DeckState.deck`).
  Shuffle randomness never hits the chain.
- Hole cards are sealed inside MPC to the player's own x25519 key and emitted
  as `HoleDealt`; only that player decrypts (client-side RescueCipher).
- Board and showdown holes come from `.reveal()` of **the same** sealed deck
  (seat `i` → `deck[2i], deck[2i+1]`; flop 18–20; turn 21; river 22).
- We found and retired our own SEV-HIGH bug: a public MagicBlock VRF callback
  made the deck reconstructable from on-chain randomness. That rewrite is
  `thinking/privacy-backend-decision-2026.md`.
- Internal audit (C-1 through L-2) in `SECURITY.md`, with regression scripts
  and an E2E hand through the live MXE (`app/scripts/devnet-full-hand.cjs`).

Latency is **15–20 seconds per MPC round** on this cluster. That wait is the
dealer.

## Claim we will not make

- **First private poker.** We are not, and we do not say so.
- **Trustless.** Cerberus is 1-of-N honest on a permissioned cluster.
- **No house.** The program collects rake (`collect_rake`).
- **Any stakes.** This is play-money (HHC faucet) on devnet.
- **Popup-free.** Session keys may sign `player_action` only; MPC queues use
  the real wallet as fee payer.
- **Mainnet.** Not deployed; not a real-money product.

## Census (named occupants)

**CoinPoker / ACR.** Custodial crypto poker rooms. Cards are server-side; the
operator can see or reconstruct holes. Different category: we do not hold the
deck.

**FastPoker.** MagicBlock Ephemeral Rollup plus a TEE dealer-service. Different
trust: ER/TEE operator and a dealer service sit in the card path. We do not
put the deck in a TEE or a dealer service.

**CerberusPoker / [`ANAVHEOBA/arcium_poker`](https://github.com/ANAVHEOBA/arcium_poker).**
Same Arcium thesis (MPC Hold'em). We differentiate on a **live** program id
`GAc5rZPE…`, six circuits actually hosted OffChain and hash-pinned, an
internal audit with regression scripts, and a documented end-to-end hand
through the live MXE.

**Arcium blackjack example.** SDK template / tutorial, not a product. Proof
that the toolchain can shuffle cards; not a six-max Hold'em room.

## Trust model one-liner

Cerberus 1-of-N honest, permissioned cluster offset **456**. `Enc<Shared>` is a
viewing key (the player decrypts their own holes). The MXE deck (`Enc<Mxe>`) is
the commitment; no single party can open it.
