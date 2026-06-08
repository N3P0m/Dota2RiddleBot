import type { Repository } from "../../db/repository.js";
import type { WalletService } from "../economy/wallet.js";
import { config } from "../../config.js";
import {
  MVP_HEROES,
  MVP_ITEMS,
  PLAYER_ITEM_SLOTS,
  getMvpHeroEntry,
  getItemById,
} from "../catalog/catalog.js";
import { getHeroById } from "../../heroes/match.js";

const STARTER_HERO_ID = 14;

export type PlayerItemSlotView = {
  slot: number;
  itemId?: number;
  name?: string;
  usesRemaining?: number;
  maxUses?: number;
};

export type SellHeroResult =
  | { ok: true; refund: number; name: string }
  | {
      ok: false;
      reason:
        | "not_owned"
        | "starter"
        | "last_hero"
        | "in_battle"
        | "not_in_catalog";
    };

export type ShopBuyResult =
  | { ok: true; kind: "hero" | "item"; name: string }
  | {
      ok: false;
      reason:
        | "not_unlocked"
        | "already_owned"
        | "slots_full"
        | "insufficient_gold"
        | "not_in_catalog"
        | "no_hero";
    };

export class ShopService {
  constructor(
    private repo: Repository,
    private wallet: WalletService,
  ) {}

  ensureStarterHero(chatId: string, userId: string): void {
    const existing = this.repo.getPlayerHero(chatId, userId, STARTER_HERO_ID);
    if (!existing) {
      this.repo.addPlayerHero(chatId, userId, STARTER_HERO_ID);
    }
  }

  buyHero(
    chatId: string,
    userId: string,
    heroId: number,
  ): ShopBuyResult {
    const entry = getMvpHeroEntry(heroId);
    if (!entry) return { ok: false, reason: "not_in_catalog" };

    if (
      !this.repo.isChatUnlocked(
        chatId,
        "hero",
        heroId,
        entry.required_guesses,
      )
    ) {
      return { ok: false, reason: "not_unlocked" };
    }

    if (this.repo.getPlayerHero(chatId, userId, heroId)) {
      return { ok: false, reason: "already_owned" };
    }

    if (entry.price > 0) {
      const debit = this.wallet.debit(
        userId,
        entry.price,
        "shop_hero",
        chatId,
        String(heroId),
      );
      if (!debit.ok) return { ok: false, reason: "insufficient_gold" };
    }

    this.repo.addPlayerHero(chatId, userId, heroId);
    const hero = getHeroById(heroId);
    return { ok: true, kind: "hero", name: hero?.name_ru ?? String(heroId) };
  }

  buyItem(
    chatId: string,
    userId: string,
    itemId: number,
  ): ShopBuyResult {
    const item = getItemById(itemId);
    if (!item) return { ok: false, reason: "not_in_catalog" };

    if (
      !this.repo.isChatUnlocked(
        chatId,
        "item",
        itemId,
        item.required_guesses,
      )
    ) {
      return { ok: false, reason: "not_unlocked" };
    }

    if (this.repo.ownsItem(chatId, userId, itemId)) {
      return { ok: false, reason: "already_owned" };
    }

    const emptySlot = this.repo.findFirstEmptyItemSlot(chatId, userId);
    if (emptySlot == null) {
      return { ok: false, reason: "slots_full" };
    }

    const debit = this.wallet.debit(
      userId,
      item.price,
      "shop_item",
      chatId,
      String(itemId),
    );
    if (!debit.ok) return { ok: false, reason: "insufficient_gold" };

    this.repo.setPlayerItemSlot(
      chatId,
      userId,
      emptySlot,
      itemId,
      item.max_uses,
    );
    return { ok: true, kind: "item", name: item.name_ru };
  }

  getPlayerItemSlots(chatId: string, userId: string): PlayerItemSlotView[] {
    const rows = this.repo.getPlayerItemSlots(chatId, userId);
    const bySlot = new Map(rows.map((r) => [r.slot, r]));
    const slots: PlayerItemSlotView[] = [];

    for (let slot = 0; slot < PLAYER_ITEM_SLOTS; slot++) {
      const row = bySlot.get(slot);
      if (!row) {
        slots.push({ slot });
        continue;
      }
      const item = getItemById(row.item_id);
      slots.push({
        slot,
        itemId: row.item_id,
        name: item?.name_ru ?? `#${row.item_id}`,
        usesRemaining: row.uses_remaining,
        maxUses: item?.max_uses,
      });
    }
    return slots;
  }

  getSellRefund(heroId: number): number {
    const entry = getMvpHeroEntry(heroId);
    if (!entry || entry.price <= 0) return 0;
    return Math.floor(entry.price * config.heroSellRefundRate);
  }

  sellHero(
    chatId: string,
    userId: string,
    heroId: number,
    hasActiveBattle: boolean,
  ): SellHeroResult {
    if (hasActiveBattle) return { ok: false, reason: "in_battle" };

    const entry = getMvpHeroEntry(heroId);
    if (!entry) return { ok: false, reason: "not_in_catalog" };

    if (heroId === STARTER_HERO_ID || entry.price <= 0) {
      return { ok: false, reason: "starter" };
    }

    const owned = this.repo.getPlayerHeroes(chatId, userId);
    if (!owned.some((h) => h.hero_id === heroId)) {
      return { ok: false, reason: "not_owned" };
    }
    if (owned.length <= 1) {
      return { ok: false, reason: "last_hero" };
    }

    const refund = this.getSellRefund(heroId);
    this.repo.deletePlayerHero(chatId, userId, heroId);

    if (refund > 0) {
      this.wallet.credit(userId, refund, "sell_hero", chatId, String(heroId));
    }

    const hero = getHeroById(heroId);
    return { ok: true, refund, name: hero?.name_ru ?? String(heroId) };
  }

  listShopHeroes(chatId: string, userId: string) {
    return MVP_HEROES.map((entry) => {
      const hero = getHeroById(entry.hero_id);
      const unlock = this.repo.getChatUnlock(chatId, "hero", entry.hero_id);
      const owned = !!this.repo.getPlayerHero(chatId, userId, entry.hero_id);
      return {
        entry,
        hero,
        guessCount: unlock?.guess_count ?? 0,
        unlocked: this.repo.isChatUnlocked(
          chatId,
          "hero",
          entry.hero_id,
          entry.required_guesses,
        ),
        owned,
      };
    });
  }

  listShopItems(chatId: string, userId: string) {
    const slotsFull =
      this.repo.countFilledItemSlots(chatId, userId) >= PLAYER_ITEM_SLOTS;
    return MVP_ITEMS.map((item) => {
      const unlock = this.repo.getChatUnlock(chatId, "item", item.id);
      const owned = this.repo.ownsItem(chatId, userId, item.id);
      const unlocked = this.repo.isChatUnlocked(
        chatId,
        "item",
        item.id,
        item.required_guesses,
      );
      return {
        item,
        guessCount: unlock?.guess_count ?? 0,
        unlocked,
        owned,
        canBuy: unlocked && !owned && !slotsFull,
      };
    });
  }
}
