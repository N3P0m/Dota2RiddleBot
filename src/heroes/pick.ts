import { heroes, type Hero } from "./match.js";

/** Вес для героя, который уже был в сессии чата (не в пуле). */
const USED_WEIGHT = 0.08;

/**
 * Случайный герой: не из списка — нормальный шанс, из списка — ~8%.
 * Когда в истории уже все герои — равный выбор (историю сбрасывает вызывающий код).
 */
export function pickHeroForSession(recentHeroIds: number[]): Hero {
  const recentSet = new Set(recentHeroIds);

  const weights = heroes.map((h) => (recentSet.has(h.id) ? USED_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (let i = 0; i < heroes.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return heroes[i]!;
  }

  return heroes[heroes.length - 1]!;
}
