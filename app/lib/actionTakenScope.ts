import { PublicKey } from "@solana/web3.js";
import { getTablePDA } from "./program";

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function isByte(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255;
}

/** Hex of on-chain `table_id: [u8; 32]`. Null if the value is not 32 bytes. */
export function tableIdToHex(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
    if (/^[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
    return null;
  }

  let bytes: Uint8Array | null = null;
  if (raw instanceof Uint8Array) {
    bytes = raw;
  } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    bytes = new Uint8Array(raw);
  } else if (Array.isArray(raw) && raw.length >= 32 && raw.slice(0, 32).every(isByte)) {
    bytes = Uint8Array.from(raw.slice(0, 32));
  } else if (typeof raw === "object") {
    const maybe = raw as { toBytes?: () => Uint8Array; toBuffer?: () => Uint8Array | Buffer };
    try {
      if (typeof maybe.toBytes === "function") {
        bytes = maybe.toBytes();
      } else if (typeof maybe.toBuffer === "function") {
        const buf = maybe.toBuffer();
        bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      }
    } catch {
      return null;
    }
  }

  if (!bytes || bytes.length < 32) return null;
  return bytesToHex(bytes.subarray(0, 32));
}

export function hexToTableId(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** True when event `table_id` seeds the current table PDA. */
export function actionTakenMatchesTable(
  tableIdHex: string | undefined,
  tablePDA: PublicKey | null | undefined,
): boolean {
  if (!tableIdHex || !tablePDA) return false;
  const bytes = hexToTableId(tableIdHex);
  if (!bytes) return false;
  const [pda] = getTablePDA(bytes);
  return pda.equals(tablePDA);
}

function readU64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const lo = view.getUint32(0, true);
  const hi = view.getUint32(4, true);
  return lo + hi * 0x100000000;
}

function readI64LE(data: Uint8Array, offset: number): number {
  const view = new DataView(data.buffer, data.byteOffset + offset, 8);
  const lo = view.getUint32(0, true);
  const hi = view.getInt32(4, true);
  return lo + hi * 0x100000000;
}

/** ActionTaken body after the 8-byte event discriminator. */
export const ACTION_TAKEN_BODY_SIZE = 32 + 8 + 1 + 1 + 8 + 8 + 1 + 8 + 1;

export interface ParsedActionTakenPayload {
  tableId: string;
  handNumber: number;
  seatIndex: number;
  actionType: number;
  amount: number;
  potAfter: number;
  phase: number;
  timestamp: number;
  nextActionOn: number;
}

export function parseActionTakenFromBuffer(data: Uint8Array): ParsedActionTakenPayload | null {
  try {
    if (data.length < ACTION_TAKEN_BODY_SIZE) return null;
    const tableId = tableIdToHex(data.subarray(0, 32));
    if (!tableId) return null;
    let offset = 32;
    const handNumber = readU64LE(data, offset); offset += 8;
    const seatIndex = data[offset++];
    const actionType = data[offset++];
    const amount = readU64LE(data, offset); offset += 8;
    const potAfter = readU64LE(data, offset); offset += 8;
    const phase = data[offset++];
    const timestamp = readI64LE(data, offset); offset += 8;
    const nextActionOn = data[offset++];
    return {
      tableId,
      handNumber,
      seatIndex,
      actionType,
      amount,
      potAfter,
      phase,
      timestamp,
      nextActionOn,
    };
  } catch {
    return null;
  }
}

export function filterLiveActionsByTable<T extends { tableId?: string }>(
  actions: readonly T[],
  tablePDA: PublicKey | null | undefined,
): T[] {
  if (!tablePDA) return [];
  return actions.filter((a) => actionTakenMatchesTable(a.tableId, tablePDA));
}

/** Current-hand ActionTaken for this table only (program-wide listeners leak other tables). */
export function selectLiveActions<T extends { type: string; timestamp: Date; tableId?: string }>(
  timelines: Map<number, readonly T[]>,
  handNumber: number | null | undefined,
  tablePDA: PublicKey | null | undefined,
): T[] {
  if (handNumber == null || handNumber <= 0 || !tablePDA) return [];
  const events = timelines.get(handNumber) ?? [];
  return filterLiveActionsByTable(
    events.filter((e) => e.type === "action_taken"),
    tablePDA,
  )
    .slice()
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/** Program-wide HandCompleted listeners leak other tables at the same handNumber. */
export function filterHistoryByTable<T extends { tableId?: string }>(
  history: readonly T[],
  tablePDA: PublicKey | null | undefined,
): T[] {
  if (!tablePDA) return [];
  return history.filter((h) => actionTakenMatchesTable(h.tableId, tablePDA));
}

/** Current-hand HandCompleted for this table only. Missing table_id fails closed. */
export function selectLiveHandCompleted<T extends { tableId?: string; handNumber: number }>(
  history: readonly T[],
  handNumber: number | null | undefined,
  tablePDA: PublicKey | null | undefined,
): T | undefined {
  if (handNumber == null || handNumber <= 0 || !tablePDA) return undefined;
  return history.find(
    (h) => h.handNumber === handNumber && actionTakenMatchesTable(h.tableId, tablePDA),
  );
}
