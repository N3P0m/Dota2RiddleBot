import type { Context } from "grammy";
import type { Repository } from "../db/repository.js";
import type { ShopService } from "../game/collection/shop.js";
import type { WalletService } from "../game/economy/wallet.js";
import type { BattleService } from "../game/battle/service.js";
import { getMvpHeroEntry } from "../game/catalog/catalog.js";
import {
  formatCollectionList,
  formatHeroDetail,
  formatShop,
  MENU_TEXT,
} from "./collection-format.js";
import {
  CB,
  keyboardCollectionList,
  keyboardHeroDetail,
  keyboardMenu,
  keyboardShop,
  type ShopViewMode,
} from "./keyboards.js";
import { chatId, userId } from "./actions.js";
import { replyOrEditHtml } from "./telegram-html.js";

export async function executeMenu(ctx: Context): Promise<void> {
  await replyOrEditHtml(ctx, MENU_TEXT, keyboardMenu());
}

export async function showShop(
  ctx: Context,
  shop: ShopService,
  wallet: WalletService,
  repo: Repository,
  viewMode: ShopViewMode = "compact",
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  shop.ensureStarterHero(cid, uid);
  const w = wallet.ensureWallet(uid);
  const heroRows = shop.listShopHeroes(cid, uid).map((h) => ({
    heroId: h.entry.hero_id,
    price: h.entry.price,
    owned: h.owned,
    unlocked: h.unlocked,
  }));
  const itemRows = shop.listShopItems(cid, uid).map((i) => ({
    itemId: i.item.id,
    price: i.item.price,
    unlocked: i.unlocked,
    owned: i.owned,
    canBuy: i.canBuy,
  }));
  const rechargeSlots = shop
    .getPlayerItemSlots(cid, uid)
    .filter(
      (s) =>
        s.itemId != null &&
        s.usesRemaining != null &&
        s.maxUses != null &&
        s.usesRemaining < s.maxUses,
    )
    .map((s) => ({
      slot: s.slot,
      itemId: s.itemId!,
      cost: shop.getRechargeCost(s.itemId!),
    }));
  await replyOrEditHtml(
    ctx,
    formatShop(shop, cid, uid, w.gold, viewMode),
    keyboardShop(heroRows, itemRows, rechargeSlots, viewMode),
  );
}

export async function executeCollection(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  wallet?: WalletService,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  shop.ensureStarterHero(cid, uid);

  const gold = wallet?.ensureWallet(uid).gold ?? 0;
  const rows = repo.getPlayerHeroes(cid, uid);
  await replyOrEditHtml(
    ctx,
    formatCollectionList(repo, cid, uid, gold),
    keyboardCollectionList(rows.map((r) => r.hero_id)),
  );
}

async function showHeroDetail(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  heroId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const row = repo.getPlayerHero(cid, uid, heroId);
  if (!row) return;

  const refund = shop.getSellRefund(heroId);
  const ownedCount = repo.getPlayerHeroes(cid, uid).length;
  const entry = getMvpHeroEntry(heroId);
  const canSell =
    ownedCount > 1 &&
    entry != null &&
    entry.price > 0 &&
    heroId !== 14;

  await replyOrEditHtml(
    ctx,
    formatHeroDetail(repo, shop, cid, uid, heroId),
    keyboardHeroDetail(heroId, refund, canSell),
  );
}

export async function handleCollectionHero(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  heroId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  const row = repo.getPlayerHero(cid, uid, heroId);
  if (!row) {
    await ctx.answerCallbackQuery({ text: "Герой не в коллекции" });
    return;
  }

  await ctx.answerCallbackQuery();
  await showHeroDetail(ctx, shop, repo, heroId);
}

export async function handleHeroSell(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  battle: BattleService,
  heroId: number,
  wallet?: WalletService,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  const result = shop.sellHero(cid, uid, heroId, battle.hasActiveBattle(cid));
  if (!result.ok) {
    const msgs: Record<string, string> = {
      not_owned: "Герой не ваш",
      starter: "Стартового героя не продают",
      last_hero: "Нужен хотя бы один герой",
      in_battle: "Сначала завершите бой (/endfight)",
      not_in_catalog: "Не в каталоге",
    };
    await ctx.answerCallbackQuery({
      text: msgs[result.reason] ?? "Не удалось продать",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({
    text: `Продано: +${result.refund}g`,
  });

  await executeCollection(ctx, shop, repo, wallet);
}

export async function handleCollectionBack(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  wallet?: WalletService,
): Promise<void> {
  await ctx.answerCallbackQuery();
  await executeCollection(ctx, shop, repo, wallet);
}
