import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  potFractionChips,
  raisePresetDisabled,
  raisePresetValue,
} from "./raisePad";

describe("potFractionChips", () => {
  it("is fraction * pot when toCall is 0", () => {
    assert.equal(potFractionChips(0.5, 100, 0), 50);
    assert.equal(potFractionChips(2 / 3, 90, 0), 60);
    assert.equal(potFractionChips(1, 100, 0), 100);
  });

  it("uses toCall + fraction * (pot + toCall) when facing a bet", () => {
    // pot 100, toCall 20 → pot-sized = 20 + 1*(100+20) = 140
    assert.equal(potFractionChips(1, 100, 20), 140);
    assert.equal(potFractionChips(0.5, 100, 20), 80);
  });
});

describe("raisePresetDisabled", () => {
  it("disables pot fractions below on-chain minRaise", () => {
    // toCall 20, minRaise 20 → min chips in = 40
    assert.equal(raisePresetDisabled("half", 30, 20, 20, 500), true);
    assert.equal(raisePresetDisabled("pot", 40, 20, 20, 500), false);
  });

  it("never disables all-in for minRaise", () => {
    assert.equal(raisePresetDisabled("allin", 25, 20, 20, 25), false);
  });
});

describe("raisePresetValue", () => {
  it("clamps fractions to the stack and all-in is the stack", () => {
    assert.equal(raisePresetValue("pot", 1000, 0, 50), 50);
    assert.equal(raisePresetValue("allin", 100, 20, 75), 75);
  });
});
