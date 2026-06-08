import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../db/repository.js";
import {
  getRequiredGuesses,
  isEntityInMvpCatalog,
  recordChatUnlockOnWin,
} from "./unlocks.js";

describe("unlocks", () => {
  it("pudge is in catalog with 0 guesses", () => {
    assert.equal(isEntityInMvpCatalog("hero", 14), true);
    assert.equal(getRequiredGuesses("hero", 14), 0);
  });

  it("unknown hero not in catalog", () => {
    assert.equal(isEntityInMvpCatalog("hero", 999), false);
  });

  describe("recordChatUnlockOnWin", () => {
    let tmpDir: string;
    let repo: Repository;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dota2heroes-unlock-"));
      repo = new Repository(path.join(tmpDir, "test.db"));
    });

    afterEach(() => {
      repo.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("increments guess_count for catalog hero on win", () => {
      const chatId = "-100";
      const progress = recordChatUnlockOnWin(repo, chatId, "hero", 1);
      assert.equal(progress.guessCount, 1);
      assert.equal(progress.required, 3);
      assert.equal(progress.newlyUnlocked, false);

      const row = repo.getChatUnlock(chatId, "hero", 1);
      assert.equal(row?.guess_count, 1);
    });

    it("increments guess_count for catalog item on win", () => {
      const chatId = "-100";
      const progress = recordChatUnlockOnWin(repo, chatId, "item", 3);
      assert.equal(progress.guessCount, 1);
      assert.equal(progress.required, 2);

      const row = repo.getChatUnlock(chatId, "item", 3);
      assert.equal(row?.guess_count, 1);
    });
  });
});
