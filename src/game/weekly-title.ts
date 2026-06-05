import type { Repository } from "../db/repository.js";
import { getPreviousWeekKey } from "./periods.js";

export const WEEKLY_TITLE_NAME = "Король недели";
export const WEEKLY_TITLE_PREFIX = `👑 [${WEEKLY_TITLE_NAME}]`;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getActiveWeeklyTitle(
  repo: Repository,
  chatId: string,
  userId: string,
): string | undefined {
  const row = repo.getWeeklyTitle(chatId, userId);
  if (!row) return undefined;
  if (row.expires_at <= Date.now()) return undefined;
  return WEEKLY_TITLE_PREFIX;
}

export function awardWeeklyTitles(
  repo: Repository,
  timeZone: string,
  enabled = true,
): number {
  if (!enabled) return 0;

  repo.deleteExpiredWeeklyTitles();
  const prevWeek = getPreviousWeekKey(new Date(), timeZone);
  const chatIds = repo.getAllChatIds();
  let awarded = 0;

  for (const chatId of chatIds) {
    const leader = repo.getPeriodLeader(chatId, "week", prevWeek);
    if (!leader) continue;

    const existing = repo.getWeeklyTitle(chatId, leader.user_id);
    if (existing?.week_key === prevWeek) continue;

    const expiresAt = Date.now() + WEEK_MS;
    repo.setWeeklyTitle(
      chatId,
      leader.user_id,
      WEEKLY_TITLE_NAME,
      prevWeek,
      expiresAt,
    );
    repo.grantBonusReroll(leader.user_id, timeZone);
    awarded++;
    console.log(
      `[WeeklyTitle] ${leader.user_id} in ${chatId} for week ${prevWeek}`,
    );
  }

  return awarded;
}

export function shouldRunWeeklyAward(
  timeZone: string,
  lastRunWeekKey: string | null,
): boolean {
  const currentWeek = getPreviousWeekKey(new Date(), timeZone);
  if (lastRunWeekKey === currentWeek) return false;

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  const isMonday = weekday.startsWith("Mon") || weekday.startsWith("пн");
  if (!isMonday) return false;
  return hour >= 0 && (hour > 0 || minute >= 5);
}
