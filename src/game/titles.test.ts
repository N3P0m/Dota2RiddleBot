import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTitleByPoints, getNextTitle, TITLES } from "./titles.js";

describe("getTitleByPoints", () => {
  it("returns creep at 0", () => {
    assert.equal(getTitleByPoints(0).id, "creep");
  });

  it("returns support at 50", () => {
    assert.equal(getTitleByPoints(50).id, "support");
    assert.equal(getTitleByPoints(49).id, "creep");
  });

  it("returns carry at 150", () => {
    assert.equal(getTitleByPoints(150).id, "carry");
  });

  it("returns divine at 500+", () => {
    assert.equal(getTitleByPoints(500).id, "divine");
    assert.equal(getTitleByPoints(9999).id, "divine");
  });
});

describe("getNextTitle", () => {
  it("returns next threshold", () => {
    assert.equal(getNextTitle(0)?.id, "support");
    assert.equal(getNextTitle(500), undefined);
  });
});

describe("TITLES", () => {
  it("has 5 ranks in ascending order", () => {
    for (let i = 1; i < TITLES.length; i++) {
      assert.ok(TITLES[i]!.minPoints > TITLES[i - 1]!.minPoints);
    }
  });
});
