import { formatCustomEmojiHtml, isValidCustomEmojiId } from "./custom-emoji.js";
import {
  getMappedItemCustomEmojiId,
  getMappedItemEmojiFallback,
} from "./item-emoji-map.js";
import { getItemById } from "../../items/match.js";

const DEFAULT_FALLBACK = "🎒";

function resolveCustomEmojiId(itemId: number): string | undefined {
  return getMappedItemCustomEmojiId(itemId);
}

/** Unicode-эмодзи для кнопок и fallback внутри &lt;tg-emoji&gt;. */
export function getItemEmojiFallback(itemId: number): string {
  return getMappedItemEmojiFallback(itemId) || DEFAULT_FALLBACK;
}

/** HTML: кастомный эмодзи Telegram или fallback. */
export function formatItemEmojiHtml(itemId: number): string {
  const fallback = getItemEmojiFallback(itemId);
  return formatCustomEmojiHtml(resolveCustomEmojiId(itemId), fallback);
}

/** HTML: эмодзи + имя (имя не экранируется — экранируйте снаружи). */
export function formatItemNameWithEmojiHtml(
  itemId: number,
  name?: string,
): string {
  const label = name ?? getItemById(itemId)?.name_ru ?? `Предмет ${itemId}`;
  return `${formatItemEmojiHtml(itemId)} ${label}`;
}

/** ID кастомного эмодзи для icon_custom_emoji_id на inline-кнопках. */
export function getItemCustomEmojiId(itemId: number): string | undefined {
  const id = resolveCustomEmojiId(itemId);
  return id && isValidCustomEmojiId(id) ? id : undefined;
}

function shortenButtonName(name: string, maxName = 18): string {
  return name.length > maxName ? `${name.slice(0, maxName - 1)}…` : name;
}

/** Текст кнопки без эмодзи (иконка — через icon_custom_emoji_id). */
export function formatItemButtonText(itemId: number, name?: string): string {
  const label = name ?? getItemById(itemId)?.name_ru ?? String(itemId);
  return shortenButtonName(label);
}

/** Текст для inline-кнопок: unicode fallback, если нет custom emoji id. */
export function formatItemButtonLabel(itemId: number, name?: string): string {
  const text = formatItemButtonText(itemId, name);
  if (getItemCustomEmojiId(itemId)) return text;
  return `${getItemEmojiFallback(itemId)} ${text}`;
}
