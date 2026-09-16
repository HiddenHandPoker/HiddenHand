import type { HoleDealtFields } from "./holeDealtMatch";
import { PublicKey } from "@solana/web3.js";

/** sessionStorage key: wallet + table + hand + seat. Never store plaintext ranks. */
export function holeCardsStorageKey(
  wallet: PublicKey,
  tablePda: PublicKey,
  handNumber: number,
  seat: number
): string {
  return `hh_holecards:${wallet.toBase58()}:${tablePda.toBase58()}:${handNumber}:${seat}`;
}

function isByte(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255;
}

function isByteArray(v: unknown, len: number): v is number[] {
  return Array.isArray(v) && v.length === len && v.every(isByte);
}

/** Public HoleDealt log shape. Rejects leftover plaintext `[rank, rank]`. */
export function parseStoredHoleDealt(raw: string): HoleDealtFields | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if ("decrypted" in o) return null;
    if (
      isByteArray(o.card0, 32) &&
      isByteArray(o.card1, 32) &&
      isByteArray(o.nonce, 16) &&
      isByteArray(o.encPubkey, 32)
    ) {
      return {
        card0: o.card0,
        card1: o.card1,
        nonce: o.nonce,
        encPubkey: o.encPubkey,
      };
    }
  } catch {
    // ignore malformed cache
  }
  return null;
}

export function serializeStoredHoleDealt(blob: HoleDealtFields): string {
  return JSON.stringify({
    card0: Array.from(blob.card0),
    card1: Array.from(blob.card1),
    nonce: Array.from(blob.nonce),
    encPubkey: Array.from(blob.encPubkey),
  });
}
