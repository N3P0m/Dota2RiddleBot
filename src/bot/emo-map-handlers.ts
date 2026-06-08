import type { Context } from "grammy";
import { config } from "../config.js";
import type {
  HeroEmojiMapEntry,
  HeroEmojiMapStore,
} from "../game/catalog/hero-emoji-map.js";
import { formatHeroNameWithEmojiHtml } from "../game/catalog/hero-emoji.js";
import { getHeroById } from "../heroes/match.js";
import { extractCustomEmojiIds } from "./incoming-log.js";
import { userId } from "./actions.js";
import {
  clampEmoMapPage,
  countMappedHeroes,
  getEmoMapHeroesPage,
  getEmoMapPageCount,
  getEmoMapPageForHero,
  heroEmojiMapMark,
  heroesByName,
  resolveHeroEmojiMapId,
} from "./emo-map-pages.js";
import { keyboardEmoMapHeroes } from "./keyboards.js";
import { replyHtml, replyOrEditHtml } from "./telegram-html.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function heroName(heroId: number): string {
  return getHeroById(heroId)?.name_ru ?? `Герой ${heroId}`;
}

function formatEmoMapSavedNotice(
  heroId: number,
  saved: HeroEmojiMapEntry,
): string {
  const name = heroName(heroId);
  return (
    `✅ <b>Сохранено:</b> ${formatHeroNameWithEmojiHtml(heroId, `<b>${escapeHtml(name)}</b>`)}\n` +
    `id: <code>${escapeHtml(saved.custom_emoji_id)}</code> · fallback: ${escapeHtml(saved.emoji_fallback)}\n\n`
  );
}

function formatEmoMapMenu(store: HeroEmojiMapStore, page: number): string {
  const p = clampEmoMapPage(page);
  const pages = getEmoMapPageCount();
  const slice = getEmoMapHeroesPage(p);
  const mapped = countMappedHeroes(store);

  const lines = slice.map((hero) => {
    const mark = heroEmojiMapMark(store, hero.id);
    const id = resolveHeroEmojiMapId(store, hero.id);
    return `${mark} <b>${escapeHtml(hero.name_ru)}</b>: <code>${escapeHtml(id)}</code>`;
  });

  return (
    `🛠 <b>Маппер эмодзи героев</b> (dev)\n\n` +
    `Всего героев: <b>${heroesByName.length}</b> · сопоставлено: <b>${mapped}</b>\n` +
    `Стр. ${p + 1}/${pages}\n\n` +
    `1. Нажмите героя\n` +
    `2. Отправьте в чат <b>кастомный</b> эмодзи\n` +
    `3. Бот сохранит в <code>${escapeHtml(config.heroEmojiMapPath)}</code>\n\n` +
    lines.join("\n")
  );
}

export async function executeEmoMap(
  ctx: Context,
  store: HeroEmojiMapStore,
  page = 0,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.reply("Маппер эмодзи отключён (HERO_EMOJI_MAP_DEV).");
    return;
  }

  const uid = userId(ctx);
  store.clearPending(uid);
  const p = clampEmoMapPage(page);
  try {
    await replyOrEditHtml(
      ctx,
      formatEmoMapMenu(store, p),
      keyboardEmoMapHeroes(store, p),
    );
  } catch (err) {
    console.error("[HeroEmojiMap] executeEmoMap failed:", err);
    await ctx.reply("❌ Не удалось открыть маппер. Смотри логи бота.");
  }
}

export async function executeEmoMapPage(
  ctx: Context,
  store: HeroEmojiMapStore,
  page: number,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.answerCallbackQuery({ text: "Отключено" });
    return;
  }
  await ctx.answerCallbackQuery();
  const p = clampEmoMapPage(page);
  await replyOrEditHtml(
    ctx,
    formatEmoMapMenu(store, p),
    keyboardEmoMapHeroes(store, p),
  );
}

export async function handleEmoMapPick(
  ctx: Context,
  store: HeroEmojiMapStore,
  heroId: number,
): Promise<void> {
  if (!config.heroEmojiMapDev) {
    await ctx.answerCallbackQuery({ text: "Отключено" });
    return;
  }

  if (!getHeroById(heroId)) {
    await ctx.answerCallbackQuery({ text: "Нет такого героя" });
    return;
  }

  store.setPending(userId(ctx), heroId);
  await ctx.answerCallbackQuery();

  const name = heroName(heroId);
  await ctx.reply(
    `📎 Жду кастомный эмодзи для <b>${escapeHtml(name)}</b>\n\n` +
      `<i>Отправьте одно сообщение с premium/custom emoji. /emo-map — отмена выбора.</i>`,
    { parse_mode: "HTML" },
  );
}

/** true — сообщение обработано маппером. */
export async function tryCaptureEmoMapMessage(
  ctx: Context,
  store: HeroEmojiMapStore,
): Promise<boolean> {
  if (!config.heroEmojiMapDev) return false;

  const uid = userId(ctx);
  const pendingHeroId = store.getPending(uid);
  if (pendingHeroId == null || !ctx.message) return false;

  const hits = extractCustomEmojiIds(ctx.message);
  if (hits.length === 0) {
    await ctx.reply(
      "Нужен <b>кастомный</b> эмодзи Telegram (не обычный Unicode).\n" +
        "Отправьте emoji из premium-пака или /emo-map для сброса.",
      { parse_mode: "HTML" },
    );
    return true;
  }

  const hit = hits[0]!;
  const saved = store.set(pendingHeroId, hit.id, hit.glyph ?? "🦸");
  store.clearPending(uid);

  const page = getEmoMapPageForHero(pendingHeroId);
  await replyHtml(
    ctx,
    formatEmoMapSavedNotice(pendingHeroId, saved) +
      formatEmoMapMenu(store, page),
    { reply_markup: keyboardEmoMapHeroes(store, page) },
  );
  return true;
}
