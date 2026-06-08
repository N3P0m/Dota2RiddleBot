import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createFighter,
  initBattle,
  prepareAutoTurn,
  resolveTurn,
  setPendingAction,
  setPendingItem,
} from "./engine.js";

describe("battle engine", () => {
  it("resolves turn when both picked", () => {
    const ch = createFighter("u1", 14, 1, [])!;
    const def = createFighter("u2", 5, 1, [])!;
    let state = initBattle(ch, def);
    setPendingAction(state, "u1", "Q");
    setPendingAction(state, "u2", "attack");
    const result = resolveTurn(state);
    assert.equal(result.finished, false);
    assert.ok(result.state.challenger.hp < ch.maxHp || result.state.defender.hp < def.maxHp);
  });

  it("can finish battle", () => {
    const ch = createFighter("u1", 26, 10, [])!;
    const def = createFighter("u2", 5, 1, [])!;
    ch.damage = 200;
    let state = initBattle(ch, def);
    for (let i = 0; i < 5 && state.defender.hp > 0; i++) {
      setPendingAction(state, "u1", "R");
      setPendingAction(state, "u2", "attack");
      const r = resolveTurn(state);
      state = r.state;
      if (r.finished) break;
    }
    assert.ok(state.defender.hp <= 0 || state.challenger.hp <= 0);
  });

  it("level-1 starter duel ends within 4 turns", () => {
    const ch = createFighter("u1", 14, 1, [])!;
    const def = createFighter("u2", 5, 1, [])!;
    let state = initBattle(ch, def);
    let turns = 0;
    let finished = false;

    while (turns < 4 && !finished) {
      setPendingAction(state, "u1", turns % 2 === 0 ? "Q" : "attack");
      setPendingAction(state, "u2", "attack");
      const r = resolveTurn(state);
      state = r.state;
      turns++;
      finished = r.finished;
    }

    assert.ok(finished, `expected finish within 4 turns, hp ch=${state.challenger.hp} def=${state.defender.hp}`);
  });

  it("applies item before skill and consumes use", () => {
    const ch = createFighter("u1", 14, 1, [{ itemId: 1, usesRemaining: 2 }])!;
    const def = createFighter("u2", 5, 1, [])!;
    ch.hp = Math.round(ch.maxHp * 0.5);
    let state = initBattle(ch, def);

    setPendingItem(state, "u1", 1);
    setPendingAction(state, "u1", "attack");
    setPendingAction(state, "u2", "attack");

    const result = resolveTurn(state);
    assert.equal(result.finished, false);
    assert.equal(result.state.challenger.battleItems[0]?.usesRemaining, 1);
    assert.ok(
      result.state.log.some((l) => l.includes("Танго")),
      "item effect should appear in log",
    );
  });

  it("prepareAutoTurn fills both fighters", () => {
    const ch = createFighter("u1", 14, 1, [{ itemId: 1, usesRemaining: 2 }])!;
    const def = createFighter("u2", 5, 1, [])!;
    const state = initBattle(ch, def);
    prepareAutoTurn(state);
    assert.ok(state.challenger.pendingAction);
    assert.ok(state.defender.pendingAction);
  });

  it("removes item from battle when uses depleted", () => {
    const ch = createFighter("u1", 14, 1, [{ itemId: 1, usesRemaining: 1 }])!;
    const def = createFighter("u2", 5, 1, [])!;
    let state = initBattle(ch, def);

    setPendingItem(state, "u1", 1);
    setPendingAction(state, "u1", "attack");
    setPendingAction(state, "u2", "attack");

    const result = resolveTurn(state);
    assert.equal(result.state.challenger.battleItems.length, 0);
  });
});
