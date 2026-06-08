import { getMvpHeroEntry } from "../game/catalog/catalog.js";
import type { HeroEmojiMapStore } from "../game/catalog/hero-emoji-map.js";
import { heroes, type Hero } from "../heroes/match.js";

export const EMO_MAP_PAGE_SIZE = 20;

export const heroesByName = [...heroes].sort((a, b) =>
  a.name_ru.localeCompare(b.name_ru, "ru"),
);

export function getEmoMapPageCount(): number {
  return Math.max(1, Math.ceil(heroesByName.length / EMO_MAP_PAGE_SIZE));
}

export function clampEmoMapPage(page: number): number {
  return Math.max(0, Math.min(page, getEmoMapPageCount() - 1));
}

export function getEmoMapHeroesPage(page: number): Hero[] {
  const p = clampEmoMapPage(page);
  const start = p * EMO_MAP_PAGE_SIZE;
  return heroesByName.slice(start, start + EMO_MAP_PAGE_SIZE);
}

export function getEmoMapPageForHero(heroId: number): number {
  const idx = heroesByName.findIndex((h) => h.id === heroId);
  if (idx < 0) return 0;
  return Math.floor(idx / EMO_MAP_PAGE_SIZE);
}

export function isHeroEmojiMapped(
  store: HeroEmojiMapStore,
  heroId: number,
): boolean {
  if (store.get(heroId)) return true;
  const catalog = getMvpHeroEntry(heroId)?.custom_emoji_id?.trim();
  return !!catalog;
}

export function countMappedHeroes(store: HeroEmojiMapStore): number {
  return heroesByName.filter((h) => isHeroEmojiMapped(store, h.id)).length;
}

export function resolveHeroEmojiMapId(
  store: HeroEmojiMapStore,
  heroId: number,
): string {
  const mapped = store.get(heroId)?.custom_emoji_id?.trim();
  if (mapped) return mapped;
  return getMvpHeroEntry(heroId)?.custom_emoji_id?.trim() || "—";
}

export function heroEmojiMapMark(
  store: HeroEmojiMapStore,
  heroId: number,
): string {
  if (store.get(heroId)) return "✅";
  const catalog = getMvpHeroEntry(heroId)?.custom_emoji_id?.trim();
  if (catalog) return "📦";
  return "○";
}
