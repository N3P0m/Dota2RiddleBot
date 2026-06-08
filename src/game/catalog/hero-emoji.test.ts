import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCustomEmojiHtml } from "./custom-emoji.js";
import {
  formatHeroEmojiHtml,
  getHeroEmojiFallback,
} from "./hero-emoji.js";

describe("hero emoji", () => {
  it("uses fallback when custom_emoji_id empty", () => {
    assert.equal(getHeroEmojiFallback(5), "🦸");
    assert.equal(formatHeroEmojiHtml(5), "🦸");
  });

  it("renders tg-emoji only for valid document ids", () => {
    assert.equal(formatCustomEmojiHtml("123456789", "🎣"), "🎣");
    assert.match(
      formatCustomEmojiHtml("5368324170671202288", "🎣"),
      /tg-emoji/,
    );
  });
});
