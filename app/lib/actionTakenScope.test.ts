import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PublicKey } from "@solana/web3.js";
import { generateTableId, getTablePDA } from "./program";
import {
  ACTION_TAKEN_BODY_SIZE,
  actionTakenMatchesTable,
  parseActionTakenFromBuffer,
  selectLiveActions,
  tableIdToHex,
} from "./actionTakenScope";

function writeU64LE(buf: Uint8Array, offset: number, value: number): void {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  view.setUint32(0, value >>> 0, true);
  view.setUint32(4, Math.floor(value / 0x100000000), true);
}

function writeI64LE(buf: Uint8Array, offset: number, value: number): void {
  writeU64LE(buf, offset, value);
}

function encodeActionTaken(fields: {
  tableId: Uint8Array;
  handNumber: number;
  seatIndex: number;
  actionType: number;
  amount: number;
  potAfter: number;
  phase: number;
  timestamp: number;
  nextActionOn: number;
}): Uint8Array {
  const data = new Uint8Array(ACTION_TAKEN_BODY_SIZE);
  data.set(fields.tableId.subarray(0, 32), 0);
  writeU64LE(data, 32, fields.handNumber);
  data[40] = fields.seatIndex;
  data[41] = fields.actionType;
  writeU64LE(data, 42, fields.amount);
  writeU64LE(data, 50, fields.potAfter);
  data[58] = fields.phase;
  writeI64LE(data, 59, fields.timestamp);
  data[67] = fields.nextActionOn;
  return data;
}

function action(
  tableId: string,
  handNumber: number,
  seat: number,
  at: number,
): { type: "action_taken"; tableId: string; timestamp: Date; seatIndex: number } {
  return {
    type: "action_taken",
    tableId,
    timestamp: new Date(at),
    seatIndex: seat,
  };
}

describe("tableIdToHex", () => {
  it("reads Uint8Array, number[], and PublicKey", () => {
    const bytes = generateTableId("felt-a");
    const hex = tableIdToHex(bytes);
    assert.equal(hex?.length, 64);
    assert.equal(tableIdToHex(Array.from(bytes)), hex);
    assert.equal(tableIdToHex(new PublicKey(bytes)), hex);
    assert.equal(tableIdToHex("0x" + hex), hex);
  });

  it("rejects short or missing values", () => {
    assert.equal(tableIdToHex(undefined), null);
    assert.equal(tableIdToHex(new Uint8Array(16)), null);
    assert.equal(tableIdToHex("zzzz"), null);
  });
});

describe("parseActionTakenFromBuffer", () => {
  it("keeps table_id from the first 32 bytes", () => {
    const tableId = generateTableId("felt-a");
    const data = encodeActionTaken({
      tableId,
      handNumber: 7,
      seatIndex: 3,
      actionType: 3,
      amount: 200,
      potAfter: 500,
      phase: 1,
      timestamp: 1_700_000_000,
      nextActionOn: 4,
    });
    const parsed = parseActionTakenFromBuffer(data);
    assert.ok(parsed);
    assert.equal(parsed!.tableId, tableIdToHex(tableId));
    assert.equal(parsed!.handNumber, 7);
    assert.equal(parsed!.seatIndex, 3);
    assert.equal(parsed!.actionType, 3);
    assert.equal(parsed!.amount, 200);
    assert.equal(parsed!.potAfter, 500);
    assert.equal(parsed!.phase, 1);
    assert.equal(parsed!.timestamp, 1_700_000_000);
    assert.equal(parsed!.nextActionOn, 4);
  });
});

describe("selectLiveActions table scope", () => {
  it("keeps the current table+hand and drops the same handNumber on another table", () => {
    const tableA = generateTableId("table-a");
    const tableB = generateTableId("table-b");
    const [pdaA] = getTablePDA(tableA);
    const hexA = tableIdToHex(tableA)!;
    const hexB = tableIdToHex(tableB)!;

    assert.equal(actionTakenMatchesTable(hexA, pdaA), true);
    assert.equal(actionTakenMatchesTable(hexB, pdaA), false);

    const timelines = new Map<number, ReturnType<typeof action>[]>([
      [
        4,
        [
          action(hexB, 4, 0, 1_000),
          action(hexA, 4, 1, 2_000),
          action(hexA, 4, 2, 1_500),
        ],
      ],
      [5, [action(hexA, 5, 0, 3_000)]],
    ]);

    const live = selectLiveActions(timelines, 4, pdaA);
    assert.equal(live.length, 2);
    assert.deepEqual(
      live.map((e) => e.seatIndex),
      [2, 1],
    );
    assert.ok(live.every((e) => e.tableId === hexA));
  });

  it("returns empty without tablePDA or a live handNumber", () => {
    const tableA = generateTableId("table-a");
    const hexA = tableIdToHex(tableA)!;
    const [pdaA] = getTablePDA(tableA);
    const timelines = new Map([[1, [action(hexA, 1, 0, 1)]]]);
    assert.deepEqual(selectLiveActions(timelines, 1, null), []);
    assert.deepEqual(selectLiveActions(timelines, 0, pdaA), []);
    assert.deepEqual(selectLiveActions(timelines, null, pdaA), []);
  });
});
