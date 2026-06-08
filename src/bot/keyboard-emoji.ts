import type { InlineKeyboard } from "grammy";
import {
  formatHeroButtonText,
  getHeroCustomEmojiId,
} from "../game/catalog/hero-emoji.js";
import {
  formatItemButtonText,
  getItemCustomEmojiId,
} from "../game/catalog/item-emoji.js";

/** Inline-кнопка героя с icon_custom_emoji_id, если замаплено. */
export function addHeroButton(
  kb: InlineKeyboard,
  heroId: number,
  callbackData: string,
  name?: string,
): InlineKeyboard {
  kb.text(formatHeroButtonText(heroId, name), callbackData);
  const iconId = getHeroCustomEmojiId(heroId);
  if (iconId) kb.icon(iconId);
  return kb;
}

/** Inline-кнопка предмета с icon_custom_emoji_id, если замаплено. */
export function addItemButton(
  kb: InlineKeyboard,
  itemId: number,
  callbackData: string,
  name?: string,
): InlineKeyboard {
  kb.text(formatItemButtonText(itemId, name), callbackData);
  const iconId = getItemCustomEmojiId(itemId);
  if (iconId) kb.icon(iconId);
  return kb;
}
