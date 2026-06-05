import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateRoundPoints,
  calculateHintPenalty,
  calculateSpeedBonus,
  calculateStreakBonus,
} from "./scoring.js";

const cfg = {
  pointsPerWin: 10,
  minPointsPerWin: 1,
  hintPenalty: 2,
  maxHintPenalty: 6,
  speedBonusFast: 5,
  speedBonusMed: 2,
  streakBonus3: 2,
  streakBonus5: 5,
  streakBonus10: 10,
};

describe("calculateRoundPoints", () => {
  it("fast answer without hints beats base", () => {
    const r = calculateRoundPoints(
      { hintsUsed: 0, elapsedMs: 20_000, difficultyMultiplier: 1, streakBefore: 0 },
      cfg,
    );
    assert.ok(r.total > 10);
    assert.equal(r.speedBonus, 5);
  });

  it("3 hints reduces below base", () => {
    const r = calculateRoundPoints(
      { hintsUsed: 3, elapsedMs: 200_000, difficultyMultiplier: 1, streakBefore: 0 },
      cfg,
    );
    assert.ok(r.total < 10);
    assert.equal(r.hintPenalty, 6);
  });

  it("expert multiplier increases points", () => {
    const normal = calculateRoundPoints(
      { hintsUsed: 0, elapsedMs: 20_000, difficultyMultiplier: 1, streakBefore: 0 },
      cfg,
    );
    const expert = calculateRoundPoints(
      { hintsUsed: 0, elapsedMs: 20_000, difficultyMultiplier: 1.5, streakBefore: 0 },
      cfg,
    );
    assert.equal(expert.total, Math.round(normal.total * 1.5));
  });

  it("respects minimum points", () => {
    const r = calculateRoundPoints(
      { hintsUsed: 10, elapsedMs: 999_999, difficultyMultiplier: 0.8, streakBefore: 0 },
      cfg,
    );
    assert.ok(r.total >= cfg.minPointsPerWin);
  });
});

describe("calculateStreakBonus", () => {
  it("gives bonus at streak 3, 5, 10", () => {
    assert.equal(calculateStreakBonus(2, cfg), 2);
    assert.equal(calculateStreakBonus(4, cfg), 5);
    assert.equal(calculateStreakBonus(9, cfg), 10);
    assert.equal(calculateStreakBonus(0, cfg), 0);
  });
});

describe("calculateSpeedBonus", () => {
  it("tiered speed bonuses", () => {
    assert.equal(calculateSpeedBonus(15_000, cfg), 5);
    assert.equal(calculateSpeedBonus(60_000, cfg), 2);
    assert.equal(calculateSpeedBonus(180_000, cfg), 0);
  });
});

describe("calculateHintPenalty", () => {
  it("caps at max", () => {
    assert.equal(calculateHintPenalty(0, cfg), 0);
    assert.equal(calculateHintPenalty(1, cfg), 2);
    assert.equal(calculateHintPenalty(3, cfg), 6);
    assert.equal(calculateHintPenalty(10, cfg), 6);
  });
});
