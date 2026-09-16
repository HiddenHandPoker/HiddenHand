/**
 * Pure HoleDealt matching. Kept SDK-free so hand/table filters can be unit-tested.
 * When `match.handNumber` is set, events without that hand are rejected — otherwise
 * a later hand at the same table can attach the previous HoleDealt ciphertext.
 */

export interface HoleDealtFields {
  encPubkey: number[];
  nonce: number[];
  card0: number[];
  card1: number[];
}

export interface HoleDealtMatch {
  tableId?: Uint8Array | number[];
  handNumber?: number;
  seatIndex?: number;
}

export interface HoleDealtEventData {
  encPubkey?: number[] | Uint8Array;
  enc_pubkey?: number[] | Uint8Array;
  nonce?: number[] | Uint8Array;
  card0?: number[] | Uint8Array;
  card1?: number[] | Uint8Array;
  tableId?: number[] | Uint8Array;
  table_id?: number[] | Uint8Array;
  handNumber?: unknown;
  hand_number?: unknown;
  seatIndex?: number;
  seat_index?: number;
}

export function isHoleDealtEventName(name: string): boolean {
  return name === "holeDealt" || name === "HoleDealt";
}

/** Anchor u64 may be a number, bigint, or BN (`toNumber`). */
export function parseEventU64(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "bigint") {
    const n = Number(raw);
    return Number.isSafeInteger(n) ? n : null;
  }
  if (raw && typeof raw === "object" && typeof (raw as { toNumber?: unknown }).toNumber === "function") {
    try {
      const n = (raw as { toNumber: () => unknown }).toNumber();
      return typeof n === "number" && Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function holeDealtFieldsFromData(data: HoleDealtEventData): HoleDealtFields | null {
  const pub = data.encPubkey ?? data.enc_pubkey;
  if (!pub || !data.nonce || !data.card0 || !data.card1) return null;
  return {
    encPubkey: Array.from(pub),
    nonce: Array.from(data.nonce),
    card0: Array.from(data.card0),
    card1: Array.from(data.card1),
  };
}

/**
 * True when the event is addressed to `encPubkey` and every provided match
 * field is present and equal. Missing fields fail closed for provided filters.
 */
export function holeDealtMatches(
  data: HoleDealtEventData,
  encPubkey: Uint8Array | number[],
  match?: HoleDealtMatch
): boolean {
  const pub = data.encPubkey ?? data.enc_pubkey;
  if (!pub || !bytesEqual(pub, encPubkey)) return false;

  if (match?.tableId) {
    const tid = data.tableId ?? data.table_id;
    if (!tid || !bytesEqual(tid, match.tableId)) return false;
  }

  if (match?.handNumber !== undefined) {
    const hn = parseEventU64(data.handNumber ?? data.hand_number);
    if (hn === null || hn !== match.handNumber) return false;
  }

  if (match?.seatIndex !== undefined) {
    const seat = data.seatIndex ?? data.seat_index;
    if (seat === undefined || seat !== match.seatIndex) return false;
  }

  return true;
}

export function findHoleDealtForKey(
  events: { name: string; data: Record<string, unknown> }[],
  encPubkey: Uint8Array,
  match?: HoleDealtMatch
): HoleDealtFields | null {
  for (const ev of events) {
    if (!isHoleDealtEventName(ev.name)) continue;
    const data = ev.data as HoleDealtEventData;
    if (!holeDealtMatches(data, encPubkey, match)) continue;
    return holeDealtFieldsFromData(data);
  }
  return null;
}
