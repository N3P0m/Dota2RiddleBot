import { formatCustomEmojiHtml, isValidCustomEmojiId } from "./custom-emoji.js";
import { getMvpHeroEntry } from "./catalog.js";
import {
  getMappedCustomEmojiId,
  getMappedEmojiFallback,
} from "./hero-emoji-map.js";
import { getHeroById } from "../../heroes/match.js";

const DEFAULT_FALLBACK = "🦸";

function resolveCustomEmojiId(heroId: number): string | undefined {
  const mapped = getMappedCustomEmojiId(heroId);
  if (mapped) return mapped;
  const fromCatalog = getMvpHeroEntry(heroId)?.custom_emoji_id?.trim();
  return fromCatalog && fromCatalog.length > 0 ? fromCatalog : undefined;
}

/** Unicode-эмодзи для кнопок и fallback внутри &lt;tg-emoji&gt;. */
export function getHeroEmojiFallback(heroId: number): string {
  const mapped = getMappedEmojiFallback(heroId);
  if (mapped) return mapped;
  const entry = getMvpHeroEntry(heroId);
  return entry?.emoji_fallback?.trim() || DEFAULT_FALLBACK;
}

/** HTML: кастомный эмодзи Telegram или fallback. */
export function formatHeroEmojiHtml(heroId: number): string {
  const fallback = getHeroEmojiFallback(heroId);
  return formatCustomEmojiHtml(resolveCustomEmojiId(heroId), fallback);
}

/** HTML: эмодзи + имя (имя не экранируется — экранируйте снаружи). */
export function formatHeroNameWithEmojiHtml(
  heroId: number,
  name?: string,
): string {
  const label = name ?? getHeroById(heroId)?.name_ru ?? `Герой ${heroId}`;
  return `${formatHeroEmojiHtml(heroId)} ${label}`;
}

/** ID кастомного эмодзи для icon_custom_emoji_id на inline-кнопках. */
export function getHeroCustomEmojiId(heroId: number): string | undefined {
  const id = resolveCustomEmojiId(heroId);
  return id && isValidCustomEmojiId(id) ? id : undefined;
}

function shortenButtonName(name: string, maxName = 18): string {
  return name.length > maxName ? `${name.slice(0, maxName - 1)}…` : name;
}

/** Текст кнопки без эмодзи (иконка — через icon_custom_emoji_id). */
export function formatHeroButtonText(heroId: number, name?: string): string {
  const label = name ?? getHeroById(heroId)?.name_ru ?? String(heroId);
  return shortenButtonName(label);
}

/** Текст для inline-кнопок: unicode fallback, если нет custom emoji id. */
export function formatHeroButtonLabel(heroId: number, name?: string): string {
  const text = formatHeroButtonText(heroId, name);
  if (getHeroCustomEmojiId(heroId)) return text;
  return `${getHeroEmojiFallback(heroId)} ${text}`;
}
