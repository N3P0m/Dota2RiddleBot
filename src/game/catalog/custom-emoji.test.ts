import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCustomEmojiHtml,
  isValidCustomEmojiId,
  stripCustomEmojiHtml,
} from "./custom-emoji.js";

describe("custom emoji", () => {
  it("rejects short ids (user ids)", () => {
    assert.equal(isValidCustomEmojiId("351533093"), false);
    assert.equal(formatCustomEmojiHtml("351533093", "🦸"), "🦸");
  });

  it("accepts long snowflake ids", () => {
    const id = "5368324170671202288";
    assert.equal(isValidCustomEmojiId(id), true);
    assert.match(
      formatCustomEmojiHtml(id, "🎣"),
      /tg-emoji emoji-id="5368324170671202288"/,
    );
  });

  it("strips tg-emoji tags", () => {
    const html = '<tg-emoji emoji-id="123">🦸</tg-emoji> Пудж';
    assert.equal(stripCustomEmojiHtml(html), "🦸 Пудж");
  });
});
