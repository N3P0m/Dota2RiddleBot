import { config, type TitleId } from "../config.js";

/** Верхняя граница лестницы — как топовый MMR в Dota 2 (~15k). */
export const MAX_RANK_POINTS = 15_000;

export type Title = {
  id: TitleId;
  name: string;
  minPoints: number;
  emoji: string;
};

/** Пороги медалей = MMR-границы Dota 2 (Рекрут → Титан). */
export const TITLES: Title[] = [
  { id: "herald", name: "Рекрут", minPoints: 0, emoji: "🐾" },
  { id: "guardian", name: "Страж", minPoints: 620, emoji: "🛡" },
  { id: "crusader", name: "Рыцарь", minPoints: 1380, emoji: "⚔️" },
  { id: "archon", name: "Герой", minPoints: 2140, emoji: "🎖️" },
  { id: "legend", name: "Легенда", minPoints: 2900, emoji: "🔥" },
  { id: "ancient", name: "Властелин", minPoints: 3660, emoji: "💎" },
  { id: "divine", name: "Божество", minPoints: 4420, emoji: "✨" },
  { id: "immortal", name: "Титан", minPoints: 5420, emoji: "👑" },
];

export function getTitleByPoints(points: number): Title {
  let current = TITLES[0]!;
  for (const title of TITLES) {
    if (points >= title.minPoints) current = title;
  }
  return current;
}

export function getNextTitle(points: number): Title | undefined {
  return TITLES.find((t) => t.minPoints > points);
}

function getTitleUpperBound(title: Title): number {
  if (title.id === "immortal") return MAX_RANK_POINTS;
  const idx = TITLES.indexOf(title);
  return TITLES[idx + 1]!.minPoints;
}

/** Звёзда медали 1–5 внутри текущего ранга (как «Легенда 5», «Титан 3»). */
export function getStarsInTitle(points: number): number {
  const title = getTitleByPoints(points);
  const upper = getTitleUpperBound(title);
  const range = upper - title.minPoints;
  if (range <= 0) return 5;

  const progress = Math.min(points - title.minPoints, range - 1);
  const starSize = range / 5;
  return Math.min(5, Math.max(1, Math.floor(progress / starSize) + 1));
}

export function formatRankName(title: Title, points: number): string {
  return `${title.name} ${getStarsInTitle(points)}`;
}

export function formatTitleBadge(title: Title): string {
  const customId = config.titleEmoji[title.id];
  if (customId) {
    return `<tg-emoji emoji-id="${customId}">${title.emoji}</tg-emoji>`;
  }
  return title.emoji;
}

export function formatTitleLine(title: Title, points?: number): string {
  const badge = formatTitleBadge(title);
  if (points === undefined) {
    return `${badge} ${title.name}`;
  }
  return `${badge} ${formatRankName(title, points)}`;
}
