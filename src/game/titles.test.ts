import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getTitleByPoints,
  getNextTitle,
  getStarsInTitle,
  getRankProgress,
  formatRankName,
  formatRankProgress,
  formatProgressBar,
  MAX_RANK_POINTS,
  TITLES,
} from "./titles.js";

describe("getTitleByPoints", () => {
  it("returns herald at 0", () => {
    assert.equal(getTitleByPoints(0).id, "herald");
  });

  it("returns guardian at 620", () => {
    assert.equal(getTitleByPoints(620).id, "guardian");
    assert.equal(getTitleByPoints(619).id, "herald");
  });

  it("returns legend at 2900", () => {
    assert.equal(getTitleByPoints(2900).id, "legend");
  });

  it("returns divine at 4420+", () => {
    assert.equal(getTitleByPoints(4420).id, "divine");
    assert.equal(getTitleByPoints(5419).id, "divine");
  });

  it("returns immortal at 5420+", () => {
    assert.equal(getTitleByPoints(5420).id, "immortal");
    assert.equal(getTitleByPoints(20_000).id, "immortal");
  });
});

describe("getNextTitle", () => {
  it("returns next threshold", () => {
    assert.equal(getNextTitle(0)?.id, "guardian");
    assert.equal(getNextTitle(5420), undefined);
  });
});

describe("getStarsInTitle", () => {
  it("returns 1 star at rank start", () => {
    assert.equal(getStarsInTitle(0), 1);
    assert.equal(getStarsInTitle(620), 1);
    assert.equal(getStarsInTitle(2900), 1);
    assert.equal(getStarsInTitle(5420), 1);
  });

  it("returns 5 stars at rank ceiling", () => {
    assert.equal(getStarsInTitle(619), 5);
    assert.equal(getStarsInTitle(1379), 5);
    assert.equal(getStarsInTitle(3659), 5);
    assert.equal(getStarsInTitle(MAX_RANK_POINTS), 5);
  });

  it("shows legend 5 and titan 3 style", () => {
    assert.equal(formatRankName(getTitleByPoints(3659), 3659), "Легенда 5");
    assert.equal(formatRankName(getTitleByPoints(3660), 3660), "Властелин 1");
    const titan3Points = 5420 + Math.floor((MAX_RANK_POINTS - 5420) / 5) * 2;
    assert.equal(getStarsInTitle(titan3Points), 3);
    assert.equal(formatRankName(getTitleByPoints(titan3Points), titan3Points), "Титан 3");
  });
});

describe("getRankProgress", () => {
  it("tracks progress to next star", () => {
    const p = getRankProgress(3200);
    assert.equal(p.isMax, false);
    assert.equal(p.current, "Легенда 2");
    assert.equal(p.next, "Легенда 3");
    assert.ok(p.percent > 0);
    assert.ok(p.remaining > 0);
  });

  it("tracks progress from star 5 to next medal", () => {
    const p = getRankProgress(3659);
    assert.equal(p.current, "Легенда 5");
    assert.equal(p.next, "Властелин 1");
    assert.equal(p.remaining, 1);
  });

  it("marks max rank at 15000", () => {
    const p = getRankProgress(MAX_RANK_POINTS);
    assert.equal(p.isMax, true);
    assert.equal(p.current, "Титан 5");
  });
});

describe("formatRankProgress", () => {
  it("includes progress bar", () => {
    const line = formatRankProgress(3200);
    assert.match(line, /📊/);
    assert.match(line, /Легенда 2/);
    assert.match(line, /Легенда 3/);
    assert.match(line, /█/);
    assert.match(line, /ещё/);
  });

  it("shows max rank message", () => {
    const line = formatRankProgress(MAX_RANK_POINTS);
    assert.match(line, /максимальный ранг/);
  });
});

describe("formatProgressBar", () => {
  it("renders filled and empty segments", () => {
    assert.equal(formatProgressBar(0), "░░░░░░░░░░");
    assert.equal(formatProgressBar(100), "██████████");
    assert.equal(formatProgressBar(50).length, 10);
  });
});

describe("TITLES", () => {
  it("has 8 Dota ranks with MMR thresholds", () => {
    assert.equal(TITLES.length, 8);
    assert.equal(TITLES[0]!.minPoints, 0);
    assert.equal(TITLES[7]!.minPoints, 5420);
    for (let i = 1; i < TITLES.length; i++) {
      assert.ok(TITLES[i]!.minPoints > TITLES[i - 1]!.minPoints);
    }
  });
});
