import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatItemEmojiHtml,
  getItemEmojiFallback,
} from "./item-emoji.js";

describe("item emoji", () => {
  it("uses default fallback when not mapped", () => {
    assert.equal(getItemEmojiFallback(8), "🎒");
    assert.equal(formatItemEmojiHtml(8), "🎒");
  });
});
