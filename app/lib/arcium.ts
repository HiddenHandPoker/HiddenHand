/**
 * Arcium MPC client integration (Phase 3c).
 *
 * Replaces the retired Inco TEE layer (`lib/inco.ts`). The card lifecycle
 * (shuffle, deal, community reveals, showdown reveal) runs as Arcium MPC
 * circuits. This module is the browser-side counterpart:
 *
 *  - Derives a per-wallet x25519 keypair (from a wallet signature) used to seal
 *    a player's hole cards to *them* inside the `deal_to_seat` circuit.
 *  - Fetches the MXE public key and builds the RescueCipher shared secret.
 *  - Decrypts the sealed hole cards emitted by the `HoleDealt` callback event.
 *  - Assembles the Arcium account set every `queue_computation` instruction needs
 *    (mempool / exec pool / computation / comp-def / cluster / fee-pool / clock …).
 *  - Generates computation offsets + nonces, and parses callback events.
 *
 * SSR-safety: `@arcium-hq/client` pulls node/crypto bits, so — mirroring the old
 * `inco.ts` — every function that touches the SDK dynamic-imports it. The pure
 * card-decode helpers stay synchronous so UI components can import them freely.
 */

import { PublicKey, type Connection } from "@solana/web3.js";
import { BN, type AnchorProvider, type Program, type Idl } from "@anchor-lang/core";

/**
 * Arcium cluster offset. Devnet = 456 (from Arcium.toml `[clusters.devnet]`).
 * Mainnet would be a different offset; keep in sync with deployment.
 */
export const CLUSTER_OFFSET = 456;

// ============================================================
// Card decoding (pure — no SDK, safe to import anywhere)
// ============================================================

const SUITS = ["Hearts", "Diamonds", "Clubs", "Spades"];
const SUIT_SYMBOLS = ["♥", "♦", "♣", "♠"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];

/** Sentinel the showdown circuit returns for a hidden (folded) hole card. */
export const HIDDEN_CARD = 53;

export interface DecodedCard {
  value: number;
  suit: string;
  suitSymbol: string;
  rank: string;
  display: string; // e.g., "A♠"
}

/** Decode a plaintext card value (0-51) to suit and rank. */
export function decodeCard(cardValue: number): DecodedCard {
  if (cardValue < 0 || cardValue > 51) {
    throw new Error(`Invalid card value: ${cardValue}`);
  }
  const suitIndex = Math.floor(cardValue / 13);
  const rankIndex = cardValue % 13;
  return {
    value: cardValue,
    suit: SUITS[suitIndex],
    suitSymbol: SUIT_SYMBOLS[suitIndex],
    rank: RANKS[rankIndex],
    display: `${RANKS[rankIndex]}${SUIT_SYMBOLS[suitIndex]}`,
  };
}

/** True if a revealed card value is a real card (0-51), not the hidden sentinel. */
export function isRealCard(value: number): boolean {
  return value >= 0 && value <= 51;
}

// ============================================================
// Per-wallet encryption keys (x25519), derived from a signature
// ============================================================

export interface EncryptionKeys {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface WalletSigner {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}

const KEY_CACHE = new Map<string, EncryptionKeys>();

/** Bump this when rotating the derivation message so leftover v1 keys are unused. */
const ENC_KEY_VERSION = 2;

function keyCacheId(walletPubkey: PublicKey, programId: PublicKey): string {
  return `arcium-enc-key:v${ENC_KEY_VERSION}:${programId.toBase58()}:${walletPubkey.toBase58()}`;
}

function wipePersistedKeyMaterial(walletPubkey: PublicKey, programId: PublicKey): void {
  if (typeof window === "undefined") return;
  // Never persist the SK. Drop any leftover plaintext keys from earlier builds.
  const prefixes = [
    `arcium-enc-key:${programId.toBase58()}:${walletPubkey.toBase58()}`,
    keyCacheId(walletPubkey, programId),
  ];
  for (const id of prefixes) {
    window.localStorage.removeItem(id);
  }
}

/**
 * Derive a deterministic x25519 keypair for this wallet + program.
 *
 * The private key is `sha256(wallet_signature)`, so it is fully recoverable from
 * the wallet at any time — losing the in-memory cache just costs one more
 * signature popup. Kept in RAM only: `HoleDealt` ciphertexts are public logs,
 * so a persisted SK would decrypt historical and future hole cards after XSS.
 */
export async function deriveEncryptionKeys(
  wallet: WalletSigner,
  programId: PublicKey
): Promise<EncryptionKeys> {
  const cacheId = keyCacheId(wallet.publicKey, programId);
  wipePersistedKeyMaterial(wallet.publicKey, programId);

  const mem = KEY_CACHE.get(cacheId);
  if (mem) return mem;

  const { x25519 } = await import("@arcium-hq/client");
  const { sha256 } = await import("@noble/hashes/sha2");

  const message = `HiddenHand encryption key v${ENC_KEY_VERSION} for ${programId.toBase58()}`;
  const signature = await wallet.signMessage(new TextEncoder().encode(message));
  const privateKey = sha256(signature).slice(0, 32);
  const publicKey = x25519.getPublicKey(privateKey);
  const keys = { privateKey, publicKey };

  KEY_CACHE.set(cacheId, keys);
  return keys;
}

/** Forget cached encryption keys (e.g. on wallet disconnect). */
export function clearEncryptionKeys(walletPubkey: PublicKey, programId: PublicKey): void {
  KEY_CACHE.delete(keyCacheId(walletPubkey, programId));
  wipePersistedKeyMaterial(walletPubkey, programId);
}

// ============================================================
// MXE public key + RescueCipher
// ============================================================

/**
 * Fetch the MXE x25519 public key, retrying while the ARX nodes warm up.
 * Returns null if it never becomes available.
 */
export async function fetchMXEPublicKey(
  provider: AnchorProvider,
  programId: PublicKey,
  attempts = 20,
  delayMs = 500
): Promise<Uint8Array | null> {
  const { getMXEPublicKey } = await import("@arcium-hq/client");
  for (let i = 0; i < attempts; i++) {
    try {
      const key = await getMXEPublicKey(provider, programId);
      if (key) return key;
    } catch {
      // MXE account may not be visible yet on a cold RPC.
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/** RescueCipher instance for the shared secret between our key and the MXE. */
export async function makeCipher(privateKey: Uint8Array, mxePublicKey: Uint8Array) {
  const { x25519, RescueCipher } = await import("@arcium-hq/client");
  const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
  return new RescueCipher(sharedSecret);
}

/**
 * Decrypt the sealed hole cards from a `HoleDealt` callback event.
 * `card0`/`card1` are the sealed ciphertexts ([u8;32] → number[]) and `nonce`
 * is the sealing nonce ([u8;16]) — both come straight off the event.
 */
export async function decryptHoleCards(
  privateKey: Uint8Array,
  mxePublicKey: Uint8Array,
  card0: number[] | Uint8Array,
  card1: number[] | Uint8Array,
  nonce: number[] | Uint8Array
): Promise<[number, number]> {
  const cipher = await makeCipher(privateKey, mxePublicKey);
  const c0 = Array.from(card0);
  const c1 = Array.from(card1);
  const nonceBytes = nonce instanceof Uint8Array ? nonce : Uint8Array.from(nonce);
  const [v0, v1] = cipher.decrypt([c0, c1], nonceBytes);
  return [Number(v0), Number(v1)];
}

// ============================================================
// Computation offsets + nonces
// ============================================================

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Web Crypto is required for Arcium nonces and computation offsets");
  }
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Fresh 8-byte random computation offset (u64) for a queue_computation call. */
export function newComputationOffset(): BN {
  return new BN(randomBytes(8), "le");
}

/** Fresh 16-byte random nonce, returned both as raw bytes and as a u128 BN. */
export function newNonce(): { bytes: Uint8Array; bn: BN } {
  const bytes = randomBytes(16);
  return { bytes, bn: new BN(bytes, "le") };
}

// ============================================================
// Arcium account set for queue_computation instructions
// ============================================================

/** The Arcium accounts every queue_computation instruction shares. */
export interface ArciumQueueAccounts {
  signPdaAccount: PublicKey;
  mxeAccount: PublicKey;
  mempoolAccount: PublicKey;
  executingPool: PublicKey;
  computationAccount: PublicKey;
  compDefAccount: PublicKey;
  clusterAccount: PublicKey;
  poolAccount: PublicKey;
  clockAccount: PublicKey;
  arciumProgram: PublicKey;
}

function u32le(bytes: Uint8Array): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
}

/**
 * Resolve every Arcium account a `queue_computation` instruction needs but that
 * Anchor cannot derive from the IDL (they depend on the cluster offset and the
 * per-call computation offset). Feed the result into `.accountsPartial({...})`
 * alongside the instruction's own accounts (payer, table, hand_state, …).
 *
 * `circuitName` must match the `#[instruction]` fn name exactly
 * (shuffle | deal_to_seat | reveal_flop | reveal_turn | reveal_river | showdown_reveal).
 */
export async function queueAccounts(
  programId: PublicKey,
  circuitName: string,
  computationOffset: BN
): Promise<ArciumQueueAccounts> {
  const {
    getArciumSignerAccAddress,
    getMXEAccAddress,
    getMempoolAccAddress,
    getExecutingPoolAccAddress,
    getComputationAccAddress,
    getCompDefAccAddress,
    getCompDefAccOffset,
    getClusterAccAddress,
    getFeePoolAccAddress,
    getClockAccAddress,
    getArciumProgramId,
  } = await import("@arcium-hq/client");

  const compDefOffset = u32le(getCompDefAccOffset(circuitName));

  return {
    signPdaAccount: getArciumSignerAccAddress(programId),
    mxeAccount: getMXEAccAddress(programId),
    mempoolAccount: getMempoolAccAddress(CLUSTER_OFFSET),
    executingPool: getExecutingPoolAccAddress(CLUSTER_OFFSET),
    computationAccount: getComputationAccAddress(CLUSTER_OFFSET, computationOffset),
    compDefAccount: getCompDefAccAddress(programId, compDefOffset),
    clusterAccount: getClusterAccAddress(CLUSTER_OFFSET),
    poolAccount: getFeePoolAccAddress(),
    clockAccount: getClockAccAddress(),
    arciumProgram: getArciumProgramId(),
  };
}

/**
 * Wait for an MPC computation to finalize (the ARX callback landing on-chain).
 * Returns the finalization tx signature, whose logs carry the callback's events.
 */
export async function awaitFinalization(
  provider: AnchorProvider,
  computationOffset: BN,
  programId: PublicKey,
  timeoutMs = 120_000
): Promise<string> {
  const { awaitComputationFinalization } = await import("@arcium-hq/client");
  return awaitComputationFinalization(
    provider,
    computationOffset,
    programId,
    "confirmed",
    timeoutMs
  );
}

// ============================================================
// Callback event parsing
// ============================================================

export interface DecodedEvent {
  name: string;
  data: Record<string, unknown>;
}

/**
 * Decode Anchor program events from a callback transaction's logs. Hole cards
 * live only in the `HoleDealt` event (never on-chain), so we must read them here.
 */
export async function fetchCallbackEvents(
  connection: Connection,
  program: Program<Idl>,
  signature: string
): Promise<DecodedEvent[]> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const logs = tx?.meta?.logMessages ?? [];
  const events: DecodedEvent[] = [];
  const PREFIX = "Program data: ";
  for (const log of logs) {
    if (!log.startsWith(PREFIX)) continue;
    const b64 = log.slice(PREFIX.length);
    try {
      const decoded = program.coder.events.decode(b64);
      if (decoded) events.push({ name: decoded.name, data: decoded.data as Record<string, unknown> });
    } catch {
      // not one of our events; skip
    }
  }
  return events;
}

/**
 * Scan the most recent program transactions for decoded events.
 *
 * Arcium submits the callback that carries `HoleDealt` as its own transaction —
 * and frequently a duplicate that fails with `AlreadyCallbackedComputation`. So
 * the signature returned by `awaitComputationFinalization` is NOT reliably the
 * tx that emitted the event. Scanning the last few program txs finds it robustly.
 * (Verified on devnet — parsing only the finalize sig silently missed the event.)
 */
export async function scanRecentEvents(
  connection: Connection,
  program: Program<Idl>,
  programId: PublicKey,
  limit = 40
): Promise<DecodedEvent[]> {
  const sigs = await connection.getSignaturesForAddress(programId, { limit });
  const out: DecodedEvent[] = [];
  for (const s of sigs) {
    out.push(...(await fetchCallbackEvents(connection, program, s.signature)));
  }
  return out;
}

export interface HoleDealtFields {
  encPubkey: number[];
  nonce: number[];
  card0: number[];
  card1: number[];
}

/** Pull a HoleDealt payload addressed to `encPubkey` out of decoded events. */
export function findHoleDealtForKey(
  events: DecodedEvent[],
  encPubkey: Uint8Array
): HoleDealtFields | null {
  const myPubHex = Buffer.from(encPubkey).toString("hex");
  for (const ev of events) {
    if (ev.name !== "holeDealt" && ev.name !== "HoleDealt") continue;
    const d = ev.data as {
      encPubkey?: number[];
      enc_pubkey?: number[];
      nonce: number[];
      card0: number[];
      card1: number[];
    };
    const pub = d.encPubkey ?? d.enc_pubkey ?? [];
    if (Buffer.from(pub).toString("hex") !== myPubHex) continue;
    return { encPubkey: pub, nonce: d.nonce, card0: d.card0, card1: d.card1 };
  }
  return null;
}
