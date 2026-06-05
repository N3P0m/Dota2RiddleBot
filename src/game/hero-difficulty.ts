import type { Hero } from "../heroes/match.js";

export type HeroDifficulty = "easy" | "normal" | "hard" | "expert";

export const DIFFICULTY_MULTIPLIERS: Record<HeroDifficulty, number> = {
  easy: 0.8,
  normal: 1.0,
  hard: 1.2,
  expert: 1.5,
};

export function getHeroDifficulty(hero: Hero): HeroDifficulty {
  return hero.difficulty ?? "normal";
}

export function getHeroDifficultyMultiplier(hero: Hero): number {
  return DIFFICULTY_MULTIPLIERS[getHeroDifficulty(hero)];
}

export function isHardOrExpert(hero: Hero): boolean {
  const d = getHeroDifficulty(hero);
  return d === "hard" || d === "expert";
}

export function formatDifficultyLabel(multiplier: number): string | undefined {
  if (multiplier === 1) return undefined;
  if (multiplier < 1) return `×${multiplier} лёгкий герой`;
  return `×${multiplier} сложный герой`;
}
