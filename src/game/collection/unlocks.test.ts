import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getRequiredGuesses, isEntityInMvpCatalog } from "./unlocks.js";

describe("unlocks", () => {
  it("pudge is in catalog with 0 guesses", () => {
    assert.equal(isEntityInMvpCatalog("hero", 14), true);
    assert.equal(getRequiredGuesses("hero", 14), 0);
  });

  it("unknown hero not in catalog", () => {
    assert.equal(isEntityInMvpCatalog("hero", 999), false);
  });
});
