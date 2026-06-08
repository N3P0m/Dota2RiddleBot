import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateBattleGoldReward } from "./battle-rewards.js";

const cfg = {
  goldPerBattleWin: 20,
  goldPerBattleLoss: 6,
};

describe("calculateBattleGoldReward", () => {
  it("rewards winner", () => {
    assert.equal(calculateBattleGoldReward(true, cfg), 20);
  });

  it("rewards loser with consolation", () => {
    assert.equal(calculateBattleGoldReward(false, cfg), 6);
  });
});
