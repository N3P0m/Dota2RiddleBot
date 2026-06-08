import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateMmrDelta } from "./mmr.js";

describe("calculateMmrDelta", () => {
  it("equal mmr gives ~12-13 points", () => {
    const { winnerDelta, loserDelta } = calculateMmrDelta(1000, 1000, 25);
    assert.equal(winnerDelta, 13);
    assert.equal(loserDelta, -12);
  });

  it("upset gives more to winner", () => {
    const { winnerDelta } = calculateMmrDelta(1000, 1200, 25);
    assert.ok(winnerDelta > 15);
  });
});
