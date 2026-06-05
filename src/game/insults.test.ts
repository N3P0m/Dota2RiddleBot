import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcTauntChance } from "./insults.js";

describe("calcTauntChance", () => {
  it("zero with no hints and no wrong guesses", () => {
    assert.equal(calcTauntChance({ wrongGuesses: 0, hintsUsed: 0, tauntsSent: 0 }), 0);
  });

  it("first hint already adds chance", () => {
    const oneHint = calcTauntChance({ wrongGuesses: 0, hintsUsed: 1, tauntsSent: 0 });
    assert.equal(oneHint, 0.08);
  });

  it("each hint increases chance", () => {
    const h1 = calcTauntChance({ wrongGuesses: 0, hintsUsed: 1, tauntsSent: 0 });
    const h2 = calcTauntChance({ wrongGuesses: 0, hintsUsed: 2, tauntsSent: 0 });
    const h3 = calcTauntChance({ wrongGuesses: 0, hintsUsed: 3, tauntsSent: 0 });
    assert.ok(h2 > h1);
    assert.ok(h3 > h2);
    assert.ok(Math.abs(h2 - 0.22) < 0.001);
    assert.ok(Math.abs(h3 - 0.36) < 0.001);
  });

  it("hints stack with wrong guesses", () => {
    const hintsOnly = calcTauntChance({ wrongGuesses: 0, hintsUsed: 2, tauntsSent: 0 });
    const both = calcTauntChance({ wrongGuesses: 3, hintsUsed: 2, tauntsSent: 0 });
    assert.ok(both > hintsOnly);
    assert.ok(both <= 0.85);
  });
});
