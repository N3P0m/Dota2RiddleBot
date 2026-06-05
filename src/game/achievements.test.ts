import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACHIEVEMENTS, formatAchievementAnnounce } from "./achievements.js";

describe("achievements catalog", () => {
  it("has 12 achievements", () => {
    assert.equal(ACHIEVEMENTS.length, 12);
  });

  it("all ids are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe("formatAchievementAnnounce", () => {
  it("includes player name and achievement", () => {
    const msg = formatAchievementAnnounce("Иван", ACHIEVEMENTS[0]!);
    assert.match(msg, /Иван/);
    assert.match(msg, /Первая кровь/);
  });
});
