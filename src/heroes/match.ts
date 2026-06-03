import heroesData from "./heroes.json" with { type: "json" };
import {
  isFuzzyMatch,
  normalizeAnswer,
} from "./fuzzy-match.js";

export type Hero = {
  id: number;
  name_en: string;
  name_ru: string;
  roles: string[];
  primary_attr: string;
  aliases: string[];
};

export { normalizeAnswer } from "./fuzzy-match.js";

export const heroes = heroesData as Hero[];

const heroesById = new Map(heroes.map((h) => [h.id, h]));

export function getHeroById(id: number): Hero | undefined {
  return heroesById.get(id);
}

export function getRandomHero(): Hero {
  return heroes[Math.floor(Math.random() * heroes.length)]!;
}

function buildCandidates(hero: Hero, extraVariants: string[] = []): string[] {
  const raw = [
    hero.name_en,
    hero.name_ru,
    ...hero.aliases,
    ...extraVariants,
    hero.name_en.replace(/[\s'-]/g, ""),
    hero.name_ru.replace(/[\s'-]/g, ""),
  ];
  return [...new Set(raw.map(normalizeAnswer).filter((s) => s.length >= 2))];
}

/** Проверяет, что ответ относится к конкретному герою (RU/EN, алиасы, варианты от нейросети). */
export function isAnswerForHero(
  text: string,
  hero: Hero,
  extraVariants: string[] = [],
): boolean {
  const norm = normalizeAnswer(text);
  if (norm.length < 2) return false;

  for (const candidate of buildCandidates(hero, extraVariants)) {
    if (isFuzzyMatch(norm, candidate)) return true;
  }
  return false;
}

/** Угадывание героя по тексту среди всех (для отладки). */
export function matchHeroAnswer(text: string): Hero | null {
  const norm = normalizeAnswer(text);
  if (norm.length < 2) return null;

  for (const hero of heroes) {
    if (isAnswerForHero(text, hero)) return hero;
  }
  return null;
}

export function collectAnswerVariants(hero: Hero, aiVariants: string[] = []): string[] {
  return [
    hero.name_en,
    hero.name_ru,
    ...hero.aliases,
    ...aiVariants,
  ].filter((s, i, arr) => s.trim().length > 0 && arr.indexOf(s) === i);
}
