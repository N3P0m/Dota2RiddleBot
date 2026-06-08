import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Repository } from "../../db/repository.js";
import { WalletService } from "../economy/wallet.js";
import { getItemById } from "../catalog/catalog.js";
import { ShopService } from "./shop.js";

describe("shop sell hero", () => {
  let tmpDir: string;
  let repo: Repository;
  let shop: ShopService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dota2heroes-"));
    repo = new Repository(path.join(tmpDir, "test.db"));
    const wallet = new WalletService(repo);
    shop = new ShopService(repo, wallet);
  });

  afterEach(() => {
    repo.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("refunds half price and removes hero", () => {
    const chatId = "-100";
    const userId = "u1";
    repo.ensureWallet(userId);
    repo.addPlayerHero(chatId, userId, 14);
    repo.addPlayerHero(chatId, userId, 5);

    const result = shop.sellHero(chatId, userId, 5, false);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.refund, 10);
    assert.equal(repo.getPlayerHero(chatId, userId, 5), undefined);
    assert.equal(repo.ensureWallet(userId).gold, 110);
  });

  it("cannot sell starter or last hero", () => {
    const chatId = "-100";
    const userId = "u1";
    repo.addPlayerHero(chatId, userId, 14);

    const starter = shop.sellHero(chatId, userId, 14, false);
    assert.equal(starter.ok, false);
    if (!starter.ok) assert.equal(starter.reason, "starter");

    repo.addPlayerHero(chatId, userId, 5);
    repo.deletePlayerHero(chatId, userId, 14);
    const last = shop.sellHero(chatId, userId, 5, false);
    assert.equal(last.ok, false);
    if (!last.ok) assert.equal(last.reason, "last_hero");
  });
});

describe("shop item slots", () => {
  let tmpDir: string;
  let repo: Repository;
  let wallet: WalletService;
  let shop: ShopService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dota2heroes-items-"));
    repo = new Repository(path.join(tmpDir, "test.db"));
    wallet = new WalletService(repo);
    shop = new ShopService(repo, wallet);
  });

  afterEach(() => {
    repo.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function unlockItem(chatId: string, itemId: number): void {
    const required = getItemById(itemId)?.required_guesses ?? 1;
    for (let i = 0; i < required; i++) {
      repo.incrementChatUnlock(chatId, "item", itemId, required);
    }
  }

  function fund(userId: string, gold: number): void {
    wallet.credit(userId, gold, "test");
  }

  it("buys item into first free slot with full uses", () => {
    const chatId = "-100";
    const userId = "u1";
    fund(userId, 200);
    unlockItem(chatId, 1);

    const result = shop.buyItem(chatId, userId, 1);
    assert.equal(result.ok, true);

    const slots = shop.getPlayerItemSlots(chatId, userId);
    assert.equal(slots[0]?.itemId, 1);
    assert.equal(slots[0]?.usesRemaining, 3);
    assert.equal(slots[0]?.maxUses, 3);
  });

  it("cannot buy duplicate item", () => {
    const chatId = "-100";
    const userId = "u1";
    fund(userId, 500);
    unlockItem(chatId, 1);
    unlockItem(chatId, 2);

    assert.equal(shop.buyItem(chatId, userId, 1).ok, true);
    const dup = shop.buyItem(chatId, userId, 1);
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.reason, "already_owned");
  });

  it("cannot buy when all 3 slots are full", () => {
    const chatId = "-100";
    const userId = "u1";
    fund(userId, 500);
    for (const id of [1, 2, 3]) {
      unlockItem(chatId, id);
      assert.equal(shop.buyItem(chatId, userId, id).ok, true);
    }
    unlockItem(chatId, 4);
    const full = shop.buyItem(chatId, userId, 4);
    assert.equal(full.ok, false);
    if (!full.ok) assert.equal(full.reason, "slots_full");
  });
});
