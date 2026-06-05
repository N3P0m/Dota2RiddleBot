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

export type RankProgress = {
  isMax: boolean;
  current: string;
  next: string;
  percent: number;
  remaining: number;
};

function getStarSegment(
  points: number,
  title: Title,
): { stars: number; start: number; end: number } {
  const upper = getTitleUpperBound(title);
  const range = upper - title.minPoints;
  const starSize = range / 5;
  const stars = getStarsInTitle(points);
  const start = title.minPoints + (stars - 1) * starSize;
  const end = stars < 5 ? title.minPoints + stars * starSize : upper;
  return { stars, start, end };
}

/** Прогресс до следующей звезды или медали. */
export function getRankProgress(points: number): RankProgress {
  const title = getTitleByPoints(points);
  const current = formatRankName(title, points);

  if (title.id === "immortal" && points >= MAX_RANK_POINTS) {
    return {
      isMax: true,
      current,
      next: current,
      percent: 100,
      remaining: 0,
    };
  }

  const { stars, start, end } = getStarSegment(points, title);
  let next: string;

  if (stars < 5) {
    next = `${title.name} ${stars + 1}`;
  } else if (title.id === "immortal") {
    next = "Титан 5";
  } else {
    const nextTitle = TITLES[TITLES.indexOf(title) + 1]!;
    next = `${nextTitle.name} 1`;
  }

  const span = Math.max(1, end - start);
  const percent = Math.min(100, Math.max(0, Math.round(((points - start) / span) * 100)));
  const remaining = Math.max(0, Math.ceil(end - points));

  return { isMax: false, current, next, percent, remaining };
}

const PROGRESS_BAR_WIDTH = 10;

export function formatProgressBar(percent: number, width = PROGRESS_BAR_WIDTH): string {
  const filled = Math.min(width, Math.max(0, Math.round((percent / 100) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function formatRemainingPoints(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} очков`;
  if (mod10 === 1) return `${n} очко`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} очка`;
  return `${n} очков`;
}

/** Строка прогресс-бара для сообщения победы. */
export function formatRankProgress(points: number): string {
  const progress = getRankProgress(points);
  const title = getTitleByPoints(points);
  const badge = formatTitleBadge(title);

  if (progress.isMax) {
    return `📊 ${badge} ${progress.current} — максимальный ранг!`;
  }

  const bar = formatProgressBar(progress.percent);
  return (
    `📊 ${progress.current} <code>${bar}</code> ${progress.next}\n` +
    `<i>ещё ${formatRemainingPoints(progress.remaining)}</i>`
  );
}
