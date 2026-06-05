import { config, type TitleId } from "../config.js";

export type Title = {
  id: TitleId;
  name: string;
  minPoints: number;
  emoji: string;
};

export const TITLES: Title[] = [
  { id: "creep", name: "Крип", minPoints: 0, emoji: "🐾" },
  { id: "support", name: "Саппорт", minPoints: 50, emoji: "🛡" },
  { id: "carry", name: "Керри", minPoints: 150, emoji: "⚔️" },
  { id: "core", name: "Кор", minPoints: 300, emoji: "🔥" },
  { id: "divine", name: "Божество", minPoints: 500, emoji: "👑" },
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

export function formatTitleBadge(title: Title): string {
  const customId = config.titleEmoji[title.id];
  if (customId) {
    return `<tg-emoji emoji-id="${customId}">${title.emoji}</tg-emoji>`;
  }
  return title.emoji;
}

export function formatTitleLine(title: Title): string {
  return `${formatTitleBadge(title)} ${title.name}`;
}
