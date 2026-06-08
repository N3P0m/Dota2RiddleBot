import { formatProgressBar } from "../titles.js";

export const MAX_HERO_LEVEL = 15;
export const XP_PER_LEVEL = 50;

export type HeroLevelProgress = {
  isMax: boolean;
  percent: number;
  remaining: number;
  currentLabel: string;
  nextLabel: string;
};

export function xpForLevel(level: number): number {
  return (level - 1) * XP_PER_LEVEL;
}

/** Прогресс XP внутри текущего уровня (ур. 15 — максимум). */
export function getHeroLevelProgress(
  level: number,
  xp: number,
): HeroLevelProgress {
  const cappedLevel = Math.min(Math.max(1, level), MAX_HERO_LEVEL);

  if (cappedLevel >= MAX_HERO_LEVEL) {
    return {
      isMax: true,
      percent: 100,
      remaining: 0,
      currentLabel: `ур. ${MAX_HERO_LEVEL}`,
      nextLabel: `ур. ${MAX_HERO_LEVEL}`,
    };
  }

  const start = xpForLevel(cappedLevel);
  const end = xpForLevel(cappedLevel + 1);
  const span = Math.max(1, end - start);
  const percent = Math.min(
    100,
    Math.max(0, Math.round(((xp - start) / span) * 100)),
  );
  const remaining = Math.max(0, end - xp);

  return {
    isMax: false,
    percent,
    remaining,
    currentLabel: `ур. ${cappedLevel}`,
    nextLabel: `ур. ${cappedLevel + 1}`,
  };
}

/** Строка прогресс-бара уровня героя для HTML-сообщений. */
export function formatHeroLevelProgress(
  level: number,
  xp: number,
  xpGain?: number,
): string {
  const progress = getHeroLevelProgress(level, xp);
  const gainPart =
    xpGain != null && xpGain !== 0 ? ` (+${xpGain} XP)` : "";

  if (progress.isMax) {
    return `📊 ${progress.currentLabel}${gainPart} — максимум!`;
  }

  const bar = formatProgressBar(progress.percent);
  return (
    `📊 ${progress.currentLabel}${gainPart} <code>${bar}</code> ${progress.nextLabel}\n` +
    `<i>ещё ${progress.remaining} XP</i>`
  );
}
