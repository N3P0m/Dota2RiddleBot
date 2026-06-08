import type { Context } from "grammy";
import { config } from "../config.js";
import type {
  ItemEmojiMapEntry,
  ItemEmojiMapStore,
} from "../game/catalog/item-emoji-map.js";
import { formatItemNameWithEmojiHtml } from "../game/catalog/item-emoji.js";
import { getItemById } from "../items/match.js";
import { extractCustomEmojiIds } from "./incoming-log.js";
import { userId } from "./actions.js";
import {
  clampItemEmoMapPage,
  countMappedItems,
  getItemEmoMapPage,
  getItemEmoMapPageCount,
  getItemEmoMapPageForItem,
  itemEmojiMapMark,
  itemsByName,
  resolveItemEmojiMapId,
} from "./item-emo-map-pages.js";
import { keyboardItemEmoMap } from "./keyboards.js";
import { replyHtml, replyOrEditHtml } from "./telegram-html.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function itemName(itemId: number): string {
  return getItemById(itemId)?.name_ru ?? `Предмет ${itemId}`;
}

function formatItemEmoMapSavedNotice(
  itemId: number,
  saved: ItemEmojiMapEntry,
): string {
  const name = itemName(itemId);
  return (
    `✅ <b>Сохранено:</b> ${formatItemNameWithEmojiHtml(itemId, `<b>${escapeHtml(name)}</b>`)}\n` +
    `id: <code>${escapeHtml(saved.custom_emoji_id)}</code> · fallback: ${escapeHtml(saved.emoji_fallback)}\n\n`
  );
}

function formatItemEmoMapMenu(store: ItemEmojiMapStore, page: number): string {
  const p = clampItemEmoMapPage(page);
  const pages = getItemEmoMapPageCount();
  const slice = getItemEmoMapPage(p);
  const mapped = countMappedItems(store);

  const lines = slice.map((item) => {
    const mark = itemEmojiMapMark(store, item.id);
    const id = resolveItemEmojiMapId(store, item.id);
    return `${mark} <b>${escapeHtml(item.name_ru)}</b>: <code>${escapeHtml(id)}</code>`;
  });

  return (
    `🛠 <b>Маппер эмодзи предметов</b> (dev)\n\n` +
    `Всего предметов: <b>${itemsByName.length}</b> · сопоставлено: <b>${mapped}</b>\n` +
    `Стр. ${p + 1}/${pages}\n\n` +
    `1. Нажмите предмет\n` +
    `2. Отправьте в чат <b>кастомный</b> эмодзи\n` +
    `3. Бот сохранит в <code>${escapeHtml(config.itemEmojiMapPath)}</code>\n\n` +
    lines.join("\n")
  );
}

export async function executeItemEmoMap(
  ctx: Context,
  store: ItemEmojiMapStore,
  page = 0,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.reply("Маппер эмодзи отключён (HERO_EMOJI_MAP_DEV).");
    return;
  }

  store.clearPending(userId(ctx));
  const p = clampItemEmoMapPage(page);
  try {
    await replyOrEditHtml(
      ctx,
      formatItemEmoMapMenu(store, p),
      keyboardItemEmoMap(store, p),
    );
  } catch (err) {
    console.error("[ItemEmojiMap] executeItemEmoMap failed:", err);
    await ctx.reply("❌ Не удалось открыть маппер. Смотри логи бота.");
  }
}

export async function executeItemEmoMapPage(
  ctx: Context,
  store: ItemEmojiMapStore,
  page: number,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.answerCallbackQuery({ text: "Отключено" });
    return;
  }
  await ctx.answerCallbackQuery();
  const p = clampItemEmoMapPage(page);
  await replyOrEditHtml(
    ctx,
    formatItemEmoMapMenu(store, p),
    keyboardItemEmoMap(store, p),
  );
}

export async function handleItemEmoMapPick(
  ctx: Context,
  store: ItemEmojiMapStore,
  itemId: number,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.answerCallbackQuery({ text: "Отключено" });
    return;
  }

  if (!getItemById(itemId)) {
    await ctx.answerCallbackQuery({ text: "Нет такого предмета" });
    return;
  }

  store.setPending(userId(ctx), itemId);
  await ctx.answerCallbackQuery();

  const name = itemName(itemId);
  await ctx.reply(
    `📎 Жду кастомный эмодзи для <b>${escapeHtml(name)}</b>\n\n` +
      `<i>Отправьте одно сообщение с premium/custom emoji. /item-emo-map — отмена выбора.</i>`,
    { parse_mode: "HTML" },
  );
}

/** true — сообщение обработано маппером. */
export async function tryCaptureItemEmoMapMessage(
  ctx: Context,
  store: ItemEmojiMapStore,
): Promise<boolean> {
  if (!config.heroEmojiMapDev) return false;

  const uid = userId(ctx);
  const pendingItemId = store.getPending(uid);
  if (pendingItemId == null || !ctx.message) return false;

  const hits = extractCustomEmojiIds(ctx.message);
  if (hits.length === 0) {
    await ctx.reply(
      "Нужен <b>кастомный</b> эмодзи Telegram (не обычный Unicode).\n" +
        "Отправьте emoji из premium-пака или /item-emo-map для сброса.",
      { parse_mode: "HTML" },
    );
    return true;
  }

  const hit = hits[0]!;
  const saved = store.set(pendingItemId, hit.id, hit.glyph ?? "🎒");
  store.clearPending(uid);

  const page = getItemEmoMapPageForItem(pendingItemId);
  await replyHtml(
    ctx,
    formatItemEmoMapSavedNotice(pendingItemId, saved) +
      formatItemEmoMapMenu(store, page),
    { reply_markup: keyboardItemEmoMap(store, page) },
  );
  return true;
}
