import type { Repository } from "../db/repository.js";
import type { ShopService } from "../game/collection/shop.js";
import { getHeroById } from "../heroes/match.js";
import { formatGold } from "../game/economy/gold-rewards.js";
import {
  getCombatHero,
  getMvpHeroEntry,
  maxItemTierForLevel,
  PLAYER_ITEM_SLOTS,
} from "../game/catalog/catalog.js";
import { formatItemEmojiHtml } from "../game/catalog/item-emoji.js";
import {
  formatHeroEmojiHtml,
  formatHeroNameWithEmojiHtml,
} from "../game/catalog/hero-emoji.js";
import {
  computeHeroStats,
  formatSkillSummary,
} from "../game/collection/hero-stats.js";
import { formatHeroLevelProgress } from "../game/collection/hero-progress.js";
import { formatTitleLine, getTitleByPoints } from "../game/titles.js";
import { formatPoints } from "../game/scoring.js";
import { HELP_TEXT } from "./format.js";
import { escapeHtml } from "./telegram-html.js";
import type { ShopViewMode } from "./keyboards.js";

export const MENU_TEXT =
  `📋 <b>Меню игры</b>\n\n` +
  `<i>Выберите действие кнопками ниже.</i>\n` +
  `<i>Полный список команд — /help</i>`;

export function formatGoldProfile(
  wallet: { gold: number },
  chatPoints = 0,
): string {
  const title = getTitleByPoints(chatPoints);
  return (
    `💰 <b>Кошелёк</b>\n\n` +
    `Золото: <b>${wallet.gold}</b>\n` +
    `Рейтинг чата: ${formatTitleLine(title, chatPoints)} · ${formatPoints(chatPoints)}`
  );
}

export function formatShop(
  shop: ShopService,
  chatId: string,
  userId: string,
  gold: number,
  viewMode: ShopViewMode = "compact",
): string {
  const heroes = shop.listShopHeroes(chatId, userId);
  const items = shop.listShopItems(chatId, userId);
  const slots = shop.getPlayerItemSlots(chatId, userId);
  const maxSlots = shop.getMaxItemSlots(chatId, userId);
  const maxLevel = shop.getMaxHeroLevel(chatId, userId);

  const heroLines = heroes
    .filter(({ unlocked, owned }) => viewMode === "full" || unlocked || owned)
    .map(({ entry, hero, guessCount, unlocked, owned }) => {
      const name = hero?.name_ru ?? `#${entry.hero_id}`;
      const badge = formatHeroEmojiHtml(entry.hero_id);
      if (owned) {
        return viewMode === "compact" ? null : `✅ ${badge} ${escapeHtml(name)} — куплен`;
      }
      if (!unlocked) {
        return `🔒 ${badge} ${escapeHtml(name)} — ${guessCount}/${entry.required_guesses} угадываний`;
      }
      const price = entry.price === 0 ? "бесплатно" : `${entry.price}💰`;
      return `🛒 ${badge} ${escapeHtml(name)} — ${price}`;
    })
    .filter((line): line is string => line != null);

  const slotLines = slots.map((s) => {
    const num = s.slot + 1;
    if (s.slot >= maxSlots) {
      return `[${num}] 🔒 нужен ур. ${s.slot < 2 ? 3 : 8} героя`;
    }
    if (!s.itemId) return `[${num}] ➕ пусто`;
    const emoji = formatItemEmojiHtml(s.itemId);
    const rechargeCost = shop.getRechargeCost(s.itemId);
    const needsRecharge =
      s.usesRemaining != null && s.maxUses != null && s.usesRemaining < s.maxUses;
    const rechargeHint = needsRecharge ? ` · 🔋 ${rechargeCost}g` : "";
    return `[${num}] ${emoji} ${escapeHtml(s.name ?? "")} · ${s.usesRemaining}/${s.maxUses}${rechargeHint}`;
  });

  const blockLabels: Record<string, string> = {
    slots_full: `слоты заняты (${maxSlots}/${PLAYER_ITEM_SLOTS})`,
    level_too_low: `нужен ур. героя выше (сейчас ${maxLevel})`,
    mmr_too_low: "нужен рейтинг чата выше",
    tier_locked: `T${maxItemTierForLevel(maxLevel)}+ недоступен`,
  };

  const itemLines = items
    .filter(({ unlocked, owned, canBuy }) => viewMode === "full" || unlocked || owned || canBuy)
    .map(({ item, guessCount, unlocked, owned, canBuy, blockReason }) => {
      const emoji = formatItemEmojiHtml(item.id);
      if (owned) {
        return viewMode === "compact" ? null : `✅ ${emoji} ${escapeHtml(item.name_ru)} — куплен`;
      }
      if (!unlocked) {
        return `🔒 ${emoji} ${escapeHtml(item.name_ru)} — ${guessCount}/${item.required_guesses}`;
      }
      if (!canBuy && blockReason) {
        return `⛔ ${emoji} ${escapeHtml(item.name_ru)} — ${blockLabels[blockReason] ?? blockReason}`;
      }
      return `🛒 ${emoji} ${escapeHtml(item.name_ru)} — ${item.price}💰 (T${item.tier}, ${item.max_uses} исп.)`;
    })
    .filter((line): line is string => line != null);

  const viewLabel =
    viewMode === "compact" ? "доступное" : "весь каталог";

  const lockedHeroCount = heroes.filter((h) => !h.unlocked && !h.owned).length;
  const lockedItemCount = items.filter((i) => !i.unlocked && !i.owned).length;
  const lockedNote =
    viewMode === "compact" && (lockedHeroCount > 0 || lockedItemCount > 0)
      ? `\n<i>🔒 Ещё ${lockedHeroCount} героев и ${lockedItemCount} предметов — кнопка «Весь каталог».</i>`
      : "";

  return (
    `🏪 <b>Магазин чата</b> · <b>${gold}</b>💰 · <i>${viewLabel}</i>\n\n` +
    `<b>Слоты предметов</b> (${maxSlots}/${PLAYER_ITEM_SLOTS}, ур. героя ${maxLevel}):\n${slotLines.join("\n")}\n\n` +
    `<b>Герои:</b>\n${heroLines.length > 0 ? heroLines.join("\n") : "<i>Нет доступных</i>"}\n\n` +
    `<b>Предметы:</b>\n${itemLines.length > 0 ? itemLines.join("\n") : "<i>Нет доступных</i>"}` +
    `${lockedNote}\n\n` +
    `<i>Каждый предмет покупается один раз. Использования тратятся в бою; перезарядка — кнопкой 🔋.</i>`
  );
}

export function formatCollectionList(
  repo: Repository,
  chatId: string,
  userId: string,
  gold = 0,
): string {
  const rows = repo.getPlayerHeroes(chatId, userId);
  if (rows.length === 0) {
    return "📦 <b>Коллекция пуста.</b>\nОткройте /shop и возьмите бесплатного Пуджа.";
  }

  const lines = rows.map((r) => {
    const hero = getHeroById(r.hero_id);
    const name = hero?.name_ru ?? `#${r.hero_id}`;
    return (
      `• ${formatHeroNameWithEmojiHtml(r.hero_id, escapeHtml(name))} ур. ${r.level}`
    );
  });

  return (
    `📦 <b>Коллекция</b> · ${rows.length} героев · <b>${gold}</b>💰\n\n` +
    `${lines.join("\n")}\n\n` +
    `<i>Выберите героя для статов. Предметы — в /shop. Продажа — 50% цены.</i>`
  );
}

/** @deprecated use formatCollectionList */
export function formatCollection(
  repo: Repository,
  chatId: string,
  userId: string,
): string {
  return formatCollectionList(repo, chatId, userId);
}

export function formatHeroDetail(
  repo: Repository,
  shop: ShopService,
  chatId: string,
  userId: string,
  heroId: number,
): string {
  const row = repo.getPlayerHero(chatId, userId, heroId);
  if (!row) return "Герой не найден в коллекции.";

  const hero = getHeroById(heroId);
  const name = hero?.name_ru ?? `#${heroId}`;
  const combat = getCombatHero(heroId);
  const stats = computeHeroStats(heroId, row.level);
  const refund = shop.getSellRefund(heroId);
  const ownedCount = repo.getPlayerHeroes(chatId, userId).length;

  const lines: string[] = [
    `${formatHeroNameWithEmojiHtml(heroId, `<b>${escapeHtml(name)}</b>`)} · ур. <b>${row.level}</b>`,
    formatHeroLevelProgress(row.level, row.xp),
  ];

  if (stats) {
    lines.push(
      "",
      `<b>Статы в бою:</b>`,
      `❤️ HP <b>${stats.hp}</b> · 💧 MP <b>${stats.mana}</b>`,
      `⚔️ Урон <b>${stats.damage}</b> · 🛡 Броня <b>${stats.armor}</b>`,
    );
  }

  if (combat) {
    lines.push("", `<b>Скиллы:</b> ${escapeHtml(formatSkillSummary(combat))}`);
  }

  const buyPrice = getMvpHeroEntry(heroId)?.price ?? 0;
  if (refund > 0 && ownedCount > 1) {
    const pct = buyPrice > 0 ? Math.round((refund / buyPrice) * 100) : 0;
    lines.push("", `<i>Продажа вернёт <b>${refund}💰</b> (${pct}% цены)</i>`);
  } else if (heroId === 14) {
    lines.push("", `<i>Стартового героя продать нельзя.</i>`);
  }

  return lines.join("\n");
}

export { HELP_TEXT };
