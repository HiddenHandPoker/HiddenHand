import assert from "node:assert/strict";
import test from "node:test";
import { nextCommunityRevealAllowed } from "./communityReveal";

test("all-in runout: after turn callback, river is allowed", () => {
  assert.equal(
    nextCommunityRevealAllowed({
      awaiting: true,
      inFlight: false,
      revealingUi: false,
      phase: "Turn",
    }),
    true
  );
});

test("all-in runout: while turn MPC is in flight, river is not queued", () => {
  assert.equal(
    nextCommunityRevealAllowed({
      awaiting: true,
      inFlight: true,
      revealingUi: true,
      phase: "Turn",
    }),
    false
  );
});

test("stuck lock: inFlight left true after success blocks the river", () => {
  assert.equal(
    nextCommunityRevealAllowed({
      awaiting: true,
      inFlight: true,
      revealingUi: false,
      phase: "Turn",
    }),
    false
  );
});
