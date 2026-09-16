import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStoredHoleDealt, serializeStoredHoleDealt } from "./holeCardsStorage";

function bytes(fill: number, len = 32): number[] {
  return Array.from({ length: len }, () => fill);
}

describe("serializeStoredHoleDealt", () => {
  it("stores the public log shape and never plaintext ranks", () => {
    const blob = {
      card0: bytes(10),
      card1: bytes(11),
      nonce: bytes(1, 16),
      encPubkey: bytes(7),
    };
    const json = serializeStoredHoleDealt(blob);
    assert.equal(json.includes("decrypted"), false);
    assert.equal(json.trimStart().startsWith("["), false);
    assert.deepEqual(JSON.parse(json), blob);
    assert.deepEqual(parseStoredHoleDealt(json), blob);
  });
});

describe("parseStoredHoleDealt", () => {
  it("rejects leftover plaintext ranks", () => {
    assert.equal(parseStoredHoleDealt("[12,25]"), null);
    assert.equal(parseStoredHoleDealt(JSON.stringify({ decrypted: [12, 25] })), null);
    assert.equal(parseStoredHoleDealt(JSON.stringify([12, 25])), null);
  });
});
