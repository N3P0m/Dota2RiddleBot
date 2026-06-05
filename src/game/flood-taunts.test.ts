import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calcFloodTauntChance } from "./flood-taunts.js";
import {
  getFloodTauntSlot,
  getWorkTimeSlot,
  isWorkHours as checkWorkHours,
} from "./work-hours.js";

describe("calcFloodTauntChance", () => {
  it("zero with one round", () => {
    assert.equal(calcFloodTauntChance(1), 0);
  });

  it("grows with recent rounds", () => {
    const r2 = calcFloodTauntChance(2);
    const r4 = calcFloodTauntChance(4);
    const r6 = calcFloodTauntChance(6);
    assert.ok(r2 > 0);
    assert.ok(r4 > r2);
    assert.ok(r6 > r4);
    assert.ok(r6 <= 0.55);
  });
});

describe("flood taunt slots", () => {
  it("work hours use work slot", () => {
    const morning = new Date("2026-06-05T06:00:00Z"); // 9:00 MSK
    const { slot, isWorkHours } = getFloodTauntSlot(morning, "Europe/Moscow", 8, 16);
    assert.equal(isWorkHours, true);
    assert.equal(slot, "morning");
    assert.equal(getWorkTimeSlot(morning, "Europe/Moscow", 8, 16), "morning");
  });

  it("evening uses leisure slots not work", () => {
    const evening = new Date("2026-06-05T14:00:00Z"); // 17:00 MSK
    const { slot, isWorkHours } = getFloodTauntSlot(evening, "Europe/Moscow", 8, 16);
    assert.equal(isWorkHours, false);
    assert.equal(checkWorkHours(evening, "Europe/Moscow", 8, 16), false);
    assert.equal(slot, "evening");
  });

  it("night slot after 22", () => {
    const night = new Date("2026-06-05T20:00:00Z"); // 23:00 MSK
    const { slot, isWorkHours } = getFloodTauntSlot(night, "Europe/Moscow", 8, 16);
    assert.equal(isWorkHours, false);
    assert.equal(slot, "night");
  });
});
