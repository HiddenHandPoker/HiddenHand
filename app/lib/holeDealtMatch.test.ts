import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findHoleDealtForKey,
  holeDealtMatches,
  parseEventU64,
} from "./holeDealtMatch";

function bytes(fill: number, len = 32): number[] {
  return Array.from({ length: len }, () => fill);
}

function event(
  overrides: Record<string, unknown> = {}
): { name: string; data: Record<string, unknown> } {
  return {
    name: "holeDealt",
    data: {
      enc_pubkey: bytes(7),
      nonce: bytes(1, 16),
      card0: bytes(10),
      card1: bytes(11),
      table_id: bytes(3),
      hand_number: 4,
      seat_index: 0,
      ...overrides,
    },
  };
}

describe("parseEventU64", () => {
  it("reads number, bigint, and BN-like toNumber", () => {
    assert.equal(parseEventU64(5), 5);
    assert.equal(parseEventU64(BigInt(5)), 5);
    assert.equal(parseEventU64({ toNumber: () => 9 }), 9);
    assert.equal(parseEventU64(undefined), null);
    assert.equal(parseEventU64("5"), null);
  });
});

describe("findHoleDealtForKey hand + table", () => {
  const key = Uint8Array.from(bytes(7));
  const tableA = Uint8Array.from(bytes(3));
  const tableB = Uint8Array.from(bytes(9));

  const events = [
    event({ hand_number: 4, card0: bytes(40), card1: bytes(41) }),
    event({ hand_number: 5, card0: bytes(50), card1: bytes(51), nonce: bytes(2, 16) }),
    event({
      table_id: Array.from(tableB),
      hand_number: 5,
      card0: bytes(99),
      card1: bytes(98),
    }),
  ];

  it("does not attach hand N-1 cards to hand N at the same table", () => {
    const found = findHoleDealtForKey(events, key, {
      tableId: tableA,
      handNumber: 5,
      seatIndex: 0,
    });
    assert.ok(found);
    assert.deepEqual(found.card0, bytes(50));
    assert.deepEqual(found.card1, bytes(51));

    const prev = findHoleDealtForKey(events, key, {
      tableId: tableA,
      handNumber: 4,
      seatIndex: 0,
    });
    assert.ok(prev);
    assert.deepEqual(prev.card0, bytes(40));

    assert.equal(
      findHoleDealtForKey(events, key, { tableId: tableA, handNumber: 6, seatIndex: 0 }),
      null
    );
  });

  it("requires handNumber on the event when the filter is provided", () => {
    const missing = [event({ hand_number: undefined, card0: bytes(1) })];
    delete missing[0].data.hand_number;
    assert.equal(
      findHoleDealtForKey(missing, key, { tableId: tableA, handNumber: 4 }),
      null
    );
    assert.ok(
      holeDealtMatches(event().data, key, { tableId: tableA, handNumber: 4 })
    );
    assert.equal(
      holeDealtMatches(event({ hand_number: { toNumber: () => 5 } }).data, key, {
        handNumber: 5,
      }),
      true
    );
  });

  it("rejects a matching handNumber from another table", () => {
    assert.equal(
      findHoleDealtForKey(events, key, { tableId: tableB, handNumber: 4, seatIndex: 0 }),
      null
    );
    const other = findHoleDealtForKey(events, key, {
      tableId: tableB,
      handNumber: 5,
      seatIndex: 0,
    });
    assert.ok(other);
    assert.deepEqual(other.card0, bytes(99));
  });

  it("matches Anchor camelCase fields and BN handNumber", () => {
    const found = findHoleDealtForKey(
      [
        {
          name: "HoleDealt",
          data: {
            encPubkey: bytes(7),
            nonce: bytes(1, 16),
            card0: bytes(60),
            card1: bytes(61),
            tableId: bytes(3),
            handNumber: { toNumber: () => 8 },
            seatIndex: 2,
          },
        },
      ],
      key,
      { tableId: tableA, handNumber: 8, seatIndex: 2 }
    );
    assert.ok(found);
    assert.deepEqual(found.card0, bytes(60));
  });
});
