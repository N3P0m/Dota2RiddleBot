import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HeroEmojiMapStore,
  bindHeroEmojiMapStore,
  getMappedCustomEmojiId,
} from "./hero-emoji-map.js";

describe("HeroEmojiMapStore", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hero-emoji-map-"));
    filePath = path.join(tmpDir, "map.json");
  });

  afterEach(() => {
    bindHeroEmojiMapStore(null);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("persists mapping to disk", () => {
    const store = new HeroEmojiMapStore(filePath);
    store.set(14, "5368324170671202288", "🎣");

    const reloaded = new HeroEmojiMapStore(filePath);
    assert.equal(reloaded.get(14)?.custom_emoji_id, "5368324170671202288");
  });

  it("bound store is used by getters", () => {
    const store = new HeroEmojiMapStore(filePath);
    bindHeroEmojiMapStore(store);
    store.set(5, "5368324170671202288", "❄️");
    assert.equal(getMappedCustomEmojiId(5), "5368324170671202288");
  });
});
