import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateGoldWinReward } from "./gold-rewards.js";

const cfg = {
  goldPerWin: 8,
  goldHintWinnerTax: 2,
  speedBonusFast: 5,
  speedBonusMed: 2,
};

describe("calculateGoldWinReward", () => {
  it("adds speed bonus without hints", () => {
    const r = calculateGoldWinReward(
      { hintsUsed: 0, elapsedMs: 20_000, difficultyMultiplier: 1 },
      cfg,
    );
    assert.equal(r.total, 13);
    assert.equal(r.speedBonus, 5);
  });

  it("subtracts hint tax from winner", () => {
    const r = calculateGoldWinReward(
      { hintsUsed: 2, elapsedMs: 200_000, difficultyMultiplier: 1 },
      cfg,
    );
    assert.equal(r.hintTax, 4);
    assert.equal(r.total, 4);
  });

  it("applies difficulty multiplier", () => {
    const r = calculateGoldWinReward(
      { hintsUsed: 0, elapsedMs: 200_000, difficultyMultiplier: 1.5 },
      cfg,
    );
    assert.equal(r.total, 12);
  });
});
