import type { Repository } from "../db/repository.js";
import type { Hero } from "../heroes/match.js";
import type { RoundPointsResult } from "./scoring.js";
import { isHardOrExpert } from "./hero-difficulty.js";
import { getTitleByPoints } from "./titles.js";
import { getPreviousMonthKey, getPreviousWeekKey } from "./periods.js";

export type AchievementId =
  | "first_blood"
  | "speed_demon"
  | "no_hints_10"
  | "streak_5"
  | "streak_10"
  | "hard_hero_5"
  | "weekly_king"
  | "monthly_legend"
  | "centurion"
  | "riddle_starter"
  | "all_roles"
  | "divine_rank"
  | "immortal_rank"
  | "battle_first"
  | "collector_5";

export type Achievement = {
  id: AchievementId;
  name: string;
  description: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_blood", name: "Первая кровь", description: "Первая победа в чате" },
  { id: "speed_demon", name: "Демон скорости", description: "Победа < 15 сек без подсказок" },
  { id: "no_hints_10", name: "Снайпер", description: "10 побед без подсказок" },
  { id: "streak_5", name: "В ударе", description: "Серия 5 побед подряд" },
  { id: "streak_10", name: "Неостановимый", description: "Серия 10 побед подряд" },
  { id: "hard_hero_5", name: "Знаток ниши", description: "5 побед на сложных героях" },
  { id: "weekly_king", name: "Король недели", description: "#1 в топе недели" },
  { id: "monthly_legend", name: "Легенда месяца", description: "#1 в топе месяца" },
  { id: "centurion", name: "Сотня", description: "100 побед в чате" },
  { id: "riddle_starter", name: "Загадыватель", description: "50 запущенных /riddle" },
  { id: "all_roles", name: "Универсал", description: "Победы на 5+ разных атрибутах" },
  { id: "divine_rank", name: "Божество", description: "Достичь ранга Божество" },
  { id: "immortal_rank", name: "Титан", description: "Достичь ранга Титан" },
  { id: "battle_first", name: "Дуэлянт", description: "Первая победа в PvP-бою" },
  { id: "collector_5", name: "Коллекционер", description: "5 героев в коллекции чата" },
];

const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: AchievementId): Achievement {
  return ACHIEVEMENT_MAP.get(id)!;
}

export type WinAchievementContext = {
  chatId: string;
  userId: string;
  hero: Hero;
  hintsUsed: number;
  elapsedMs: number;
  streakAfter: number;
  pointsAfter: number;
  breakdown: RoundPointsResult;
};

export function checkWinAchievements(
  repo: Repository,
  ctx: WinAchievementContext,
): AchievementId[] {
  const unlocked = new Set(
    repo.getUserAchievements(ctx.chatId, ctx.userId).map((a) => a.achievement_id),
  );
  const newly: AchievementId[] = [];

  const tryUnlock = (id: AchievementId) => {
    if (!unlocked.has(id) && !newly.includes(id)) {
      newly.push(id);
      unlocked.add(id);
    }
  };

  if (repo.isFirstWinInChat(ctx.chatId, ctx.userId)) {
    tryUnlock("first_blood");
  }

  if (ctx.hintsUsed === 0 && ctx.elapsedMs < 15_000) {
    tryUnlock("speed_demon");
  }

  if (repo.countWinsNoHints(ctx.chatId, ctx.userId) >= 10) {
    tryUnlock("no_hints_10");
  }

  if (ctx.streakAfter >= 5) tryUnlock("streak_5");
  if (ctx.streakAfter >= 10) tryUnlock("streak_10");

  if (repo.countWinsOnHardHeroes(ctx.chatId, ctx.userId) >= 5) {
    tryUnlock("hard_hero_5");
  }

  if (repo.countChatWins(ctx.chatId, ctx.userId) >= 100) {
    tryUnlock("centurion");
  }

  if (repo.getRiddlesStarted(ctx.chatId, ctx.userId) >= 50) {
    tryUnlock("riddle_starter");
  }

  if (repo.countDistinctPrimaryAttrs(ctx.chatId, ctx.userId) >= 5) {
    tryUnlock("all_roles");
  }

  const rankId = getTitleByPoints(ctx.pointsAfter).id;
  if (rankId === "divine" || rankId === "immortal") {
    tryUnlock("divine_rank");
  }
  if (rankId === "immortal") {
    tryUnlock("immortal_rank");
  }

  if (newly.length > 0) {
    console.log(`[Achievement] ${ctx.userId} unlocked: ${newly.join(", ")}`);
  }

  return newly;
}

export function checkPeriodAchievements(
  repo: Repository,
  chatId: string,
  userId: string,
  timeZone: string,
): AchievementId[] {
  const unlocked = new Set(
    repo.getUserAchievements(chatId, userId).map((a) => a.achievement_id),
  );
  const newly: AchievementId[] = [];

  const tryUnlock = (id: AchievementId) => {
    if (!unlocked.has(id)) newly.push(id);
  };

  const prevWeek = getPreviousWeekKey(new Date(), timeZone);
  const weekLeader = repo.getPeriodLeader(chatId, "week", prevWeek);
  if (weekLeader?.user_id === userId) tryUnlock("weekly_king");

  const prevMonth = getPreviousMonthKey(new Date(), timeZone);
  const monthLeader = repo.getPeriodLeader(chatId, "month", prevMonth);
  if (monthLeader?.user_id === userId) tryUnlock("monthly_legend");

  return newly;
}

export function persistAchievements(
  repo: Repository,
  chatId: string,
  userId: string,
  ids: AchievementId[],
): void {
  const now = Date.now();
  for (const id of ids) {
    repo.unlockAchievement(chatId, userId, id, now);
  }
}

export function formatAchievementAnnounce(
  displayName: string,
  achievement: Achievement,
): string {
  return `🏅 <b>${escapeHtml(displayName)}</b> получил(а) достижение «${escapeHtml(achievement.name)}»!`;
}

export function formatAchievementsList(
  unlockedIds: AchievementId[],
): string {
  const unlockedSet = new Set(unlockedIds);
  const lines = ACHIEVEMENTS.map((a) => {
    const mark = unlockedSet.has(a.id) ? "✅" : "⬜";
    return `${mark} <b>${escapeHtml(a.name)}</b> — ${escapeHtml(a.description)}`;
  });
  return `🏅 <b>Достижения</b>\n\n${lines.join("\n")}`;
}

export function formatRecentAchievements(
  unlockedIds: AchievementId[],
  limit = 3,
): string | undefined {
  if (unlockedIds.length === 0) return undefined;
  const recent = unlockedIds
    .map((id) => getAchievement(id))
    .slice(-limit)
    .map((a) => a.name)
    .join(", ");
  return `🏅 ${escapeHtml(recent)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Used in round result recording to tag hard hero wins. */
export { isHardOrExpert };
