import type { Repository } from "../db/repository.js";
import type { ShopService } from "../game/collection/shop.js";
import { getHeroById } from "../heroes/match.js";
import { formatGold } from "../game/economy/gold-rewards.js";
import {
  getCombatHero,
  getMvpHeroEntry,
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const MENU_TEXT =
  `📋 <b>Меню игры</b>\n\n` +
  `<b>Викторина</b>\n` +
  `/riddle — загадка · /emo_riddle — эмо-загадка\n` +
  `/hint — подсказка · /cancel — сдаться\n\n` +
  `<b>Экономика и коллекция</b>\n` +
  `/gold — баланс · /shop — магазин\n` +
  `/heroes — герои и статы\n` +
  `/collection — то же, что /heroes\n\n` +
  `<b>Бои</b>\n` +
  `/fight — вызов · /endfight — завершить бой\n` +
  `/top — рейтинг чата (загадки + бои)\n\n` +
  `<b>Профиль</b>\n` +
  `/nick — дотаник · /me — профиль\n` +
  `/top — топ чата · /achievements\n\n` +
  `/help — полные правила`;

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
): string {
  const heroes = shop.listShopHeroes(chatId, userId);
  const items = shop.listShopItems(chatId, userId);
  const slots = shop.getPlayerItemSlots(chatId, userId);

  const heroLines = heroes.map(({ entry, hero, guessCount, unlocked, owned }) => {
    const name = hero?.name_ru ?? `#${entry.hero_id}`;
    const badge = formatHeroEmojiHtml(entry.hero_id);
    if (owned) {
      return `✅ ${badge} ${escapeHtml(name)} — куплен`;
    }
    if (!unlocked) {
      return `🔒 ${badge} ${escapeHtml(name)} — ${guessCount}/${entry.required_guesses} угадываний`;
    }
    const price = entry.price === 0 ? "бесплатно" : `${entry.price}💰`;
    return `🛒 ${badge} ${escapeHtml(name)} — ${price}`;
  });

  const slotLines = slots.map((s) => {
    const num = s.slot + 1;
    if (!s.itemId) return `[${num}] ➕ пусто`;
    const emoji = formatItemEmojiHtml(s.itemId);
    return `[${num}] ${emoji} ${escapeHtml(s.name ?? "")} · ${s.usesRemaining}/${s.maxUses}`;
  });

  const itemLines = items.map(({ item, guessCount, unlocked, owned, canBuy }) => {
    const emoji = formatItemEmojiHtml(item.id);
    if (owned) {
      return `✅ ${emoji} ${escapeHtml(item.name_ru)} — куплен`;
    }
    if (!unlocked) {
      return `🔒 ${emoji} ${escapeHtml(item.name_ru)} — ${guessCount}/${item.required_guesses}`;
    }
    if (!canBuy) {
      return `⛔ ${emoji} ${escapeHtml(item.name_ru)} — слоты заняты (${PLAYER_ITEM_SLOTS}/${PLAYER_ITEM_SLOTS})`;
    }
    return `🛒 ${emoji} ${escapeHtml(item.name_ru)} — ${item.price}💰 (T${item.tier}, ${item.max_uses} исп.)`;
  });

  return (
    `🏪 <b>Магазин чата</b> · у вас <b>${gold}</b> ${formatGold(1).split(" ")[1]}\n\n` +
    `<b>Ваши слоты предметов</b> (макс. ${PLAYER_ITEM_SLOTS}):\n${slotLines.join("\n")}\n\n` +
    `<b>Герои:</b>\n${heroLines.join("\n")}\n\n` +
    `<b>Предметы:</b>\n${itemLines.join("\n")}\n\n` +
    `<i>Каждый предмет покупается один раз. Использования тратятся в бою.</i>`
  );
}

export function formatCollectionList(
  repo: Repository,
  chatId: string,
  userId: string,
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
    `📦 <b>Ваши герои</b> · выберите для статов\n\n` +
    `${lines.join("\n")}\n\n` +
    `<i>Предметы — в /shop (3 слота на игрока). Продажа героя — 50% цены.</i>`
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
