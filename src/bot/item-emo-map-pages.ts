import type { ItemEmojiMapStore } from "../game/catalog/item-emoji-map.js";
import { items, type Item } from "../items/match.js";

export const ITEM_EMO_MAP_PAGE_SIZE = 20;

export const itemsByName = [...items].sort((a, b) =>
  a.name_ru.localeCompare(b.name_ru, "ru"),
);

export function getItemEmoMapPageCount(): number {
  return Math.max(1, Math.ceil(itemsByName.length / ITEM_EMO_MAP_PAGE_SIZE));
}

export function clampItemEmoMapPage(page: number): number {
  return Math.max(0, Math.min(page, getItemEmoMapPageCount() - 1));
}

export function getItemEmoMapPage(page: number): Item[] {
  const p = clampItemEmoMapPage(page);
  const start = p * ITEM_EMO_MAP_PAGE_SIZE;
  return itemsByName.slice(start, start + ITEM_EMO_MAP_PAGE_SIZE);
}

export function getItemEmoMapPageForItem(itemId: number): number {
  const idx = itemsByName.findIndex((i) => i.id === itemId);
  if (idx < 0) return 0;
  return Math.floor(idx / ITEM_EMO_MAP_PAGE_SIZE);
}

export function isItemEmojiMapped(
  store: ItemEmojiMapStore,
  itemId: number,
): boolean {
  return !!store.get(itemId);
}

export function countMappedItems(store: ItemEmojiMapStore): number {
  return itemsByName.filter((i) => isItemEmojiMapped(store, i.id)).length;
}

export function resolveItemEmojiMapId(
  store: ItemEmojiMapStore,
  itemId: number,
): string {
  return store.get(itemId)?.custom_emoji_id?.trim() || "—";
}

export function itemEmojiMapMark(
  store: ItemEmojiMapStore,
  itemId: number,
): string {
  return store.get(itemId) ? "✅" : "○";
}
