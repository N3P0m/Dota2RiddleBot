import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Message } from "grammy/types";
import { extractCustomEmojiIds } from "./incoming-log.js";

describe("extractCustomEmojiIds", () => {
  it("reads custom_emoji entities from text", () => {
    const message = {
      text: "🎣 привет",
      entities: [
        {
          type: "custom_emoji",
          offset: 0,
          length: 2,
          custom_emoji_id: "5368324170671202288",
        },
      ],
    } as Message;

    const hits = extractCustomEmojiIds(message);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.id, "5368324170671202288");
    assert.equal(hits[0]!.source, "entity");
  });

  it("reads custom_emoji_id from sticker", () => {
    const message = {
      sticker: {
        emoji: "🎣",
        custom_emoji_id: "5368324170671202288",
      },
    } as Message;

    const hits = extractCustomEmojiIds(message);
    assert.equal(hits[0]!.id, "5368324170671202288");
    assert.equal(hits[0]!.glyph, "🎣");
    assert.equal(hits[0]!.source, "sticker");
  });
});
