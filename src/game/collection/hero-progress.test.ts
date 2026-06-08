import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getHeroLevelProgress,
  formatHeroLevelProgress,
  xpForLevel,
  MAX_HERO_LEVEL,
} from "./hero-progress.js";

describe("hero level progress", () => {
  it("xp thresholds per level", () => {
    assert.equal(xpForLevel(1), 0);
    assert.equal(xpForLevel(2), 50);
    assert.equal(xpForLevel(15), 700);
  });

  it("tracks progress within level", () => {
    const p = getHeroLevelProgress(3, 110);
    assert.equal(p.isMax, false);
    assert.equal(p.percent, 20);
    assert.equal(p.remaining, 40);
    assert.equal(p.currentLabel, "ур. 3");
    assert.equal(p.nextLabel, "ур. 4");
  });

  it("marks max level", () => {
    const p = getHeroLevelProgress(MAX_HERO_LEVEL, 900);
    assert.equal(p.isMax, true);
    assert.equal(p.percent, 100);
  });

  it("includes xp gain in formatted line", () => {
    const line = formatHeroLevelProgress(5, 200, 40);
    assert.match(line, /\+40 XP/);
    assert.match(line, /<code>/);
  });
});
