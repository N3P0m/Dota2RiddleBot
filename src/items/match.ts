import { MVP_ITEMS, type ItemCatalogEntry } from "../game/catalog/catalog.js";
import {
  isFuzzyMatch,
  normalizeAnswer,
} from "../heroes/fuzzy-match.js";

export type Item = ItemCatalogEntry;

export const items = MVP_ITEMS;

const itemsById = new Map(items.map((i) => [i.id, i]));

export function getItemById(id: number): Item | undefined {
  return itemsById.get(id);
}

function buildCandidates(item: Item, extraVariants: string[] = []): string[] {
  const raw = [
    item.name_en,
    item.name_ru,
    ...item.aliases,
    item.name_en.replace(/[\s'-]/g, ""),
    item.name_ru.replace(/[\s'-]/g, ""),
    ...extraVariants,
  ];
  return [...new Set(raw.map(normalizeAnswer).filter((s) => s.length >= 2))];
}

export function isAnswerForItem(
  text: string,
  item: Item,
  extraVariants: string[] = [],
): boolean {
  const norm = normalizeAnswer(text);
  if (norm.length < 2) return false;
  for (const candidate of buildCandidates(item, extraVariants)) {
    if (isFuzzyMatch(norm, candidate)) return true;
  }
  return false;
}

export function collectItemAnswerVariants(
  item: Item,
  aiVariants: string[] = [],
): string[] {
  return [
    item.name_en,
    item.name_ru,
    ...item.aliases,
    ...aiVariants,
  ].filter((s, i, arr) => s.trim().length > 0 && arr.indexOf(s) === i);
}

export function getRandomItem(): Item {
  return items[Math.floor(Math.random() * items.length)]!;
}
