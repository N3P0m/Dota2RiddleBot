import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ItemEmojiMapStore,
  bindItemEmojiMapStore,
  getMappedItemCustomEmojiId,
} from "./item-emoji-map.js";

describe("ItemEmojiMapStore", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "item-emoji-map-"));
    filePath = path.join(tmpDir, "map.json");
  });

  afterEach(() => {
    bindItemEmojiMapStore(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persists mapping to disk", () => {
    const store = new ItemEmojiMapStore(filePath);
    store.set(8, "5368324170671202288", "🛡");

    const reloaded = new ItemEmojiMapStore(filePath);
    assert.equal(reloaded.get(8)?.custom_emoji_id, "5368324170671202288");
  });

  it("bound store is used by getters", () => {
    const store = new ItemEmojiMapStore(filePath);
    bindItemEmojiMapStore(store);
    store.set(5, "5368324170671202288", "⚡");
    assert.equal(getMappedItemCustomEmojiId(5), "5368324170671202288");
  });
});
