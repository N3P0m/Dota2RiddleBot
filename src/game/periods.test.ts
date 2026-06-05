import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { weekKey, monthKey, getPreviousWeekKey } from "./periods.js";

const TZ = "Europe/Moscow";

describe("periods", () => {
  it("weekKey format", () => {
    const key = weekKey(new Date("2026-06-05T12:00:00Z"), TZ);
    assert.match(key, /^\d{4}-W\d{2}$/);
  });

  it("monthKey format", () => {
    const key = monthKey(new Date("2026-06-05T12:00:00Z"), TZ);
    assert.equal(key, "2026-06");
  });

  it("getPreviousWeekKey differs from current", () => {
    const now = new Date("2026-06-05T12:00:00Z");
    const current = weekKey(now, TZ);
    const prev = getPreviousWeekKey(now, TZ);
    assert.notEqual(current, prev);
  });

  it("weekKey is deterministic for same instant", () => {
    const d = new Date("2026-01-15T10:00:00Z");
    assert.equal(weekKey(d, TZ), weekKey(d, TZ));
  });
});
