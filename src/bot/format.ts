import type { PeriodLeaderboardRow, ScoreRow } from "../db/repository.js";
import type { AchievementId } from "../game/achievements.js";
import {
  formatAchievementAnnounce,
  formatAchievementsList,
  formatRecentAchievements,
  getAchievement,
} from "../game/achievements.js";
import type { RoundPointsResult } from "../game/scoring.js";
import { formatPoints, formatPointsBreakdown } from "../game/scoring.js";
import {
  formatTitleBadge,
  formatTitleLine,
  getTitleByPoints,
  type Title,
} from "../game/titles.js";
import { formatReadableText } from "./text-layout.js";

export type LeaderboardPeriod = "all" | "week" | "month";

export const HELP_TEXT = `🎮 <b>Угадай героя Dota 2</b>

<b>Команды:</b>
/riddle — новая загадка
/emo-riddle — эмо-загадка (1 эмодзи = 1 скилл)
/hint — подсказка
/nick — дотаник на сегодня (нейросеть)
/nick new — перекатить (или кнопка под ником)
/top — топ-10 за всё время
/top week — топ недели
/top month — топ месяца
/achievements — все достижения
/me — профиль: титул, очки, серия
/cancel — сдаться (показать героя)
/help — справка

<b>Очки:</b> зависят от скорости, подсказок, серии и сложности героя.
<b>Титулы:</b> Крип → Саппорт → Керри → Кор → Божество.
<b>Достижения:</b> разблокируются за особые заслуги.

<b>Как играть:</b>
1. /riddle или кнопка «Новая загадка»
2. /emo-riddle — герой зашифрован эмодзи-скиллами
3. Ответ: <b>!имя</b> (<code>!пудж</code>, <code>!largo</code>)
4. Под загадкой: <b>Подсказка</b> и <b>Сдаться</b>
5. После угадывания: <b>Топ</b> и новая загадка`;

export function formatRiddle(riddle: string, showAnswer?: string): string {
  const formatted = escapeHtml(formatReadableText(riddle));
  let body = `🧩 <b>Загадка:</b>\n\n${formatted}\n\n<i>Ответ: <code>!имя</code> (RU/EN). /hint — подсказка</i>`;
  if (showAnswer) {
    body += `\n\n🔧 <b>Ответ (тест):</b> ${escapeHtml(showAnswer)}`;
  }
  return body;
}

export function formatHint(hint: string, hintNumber: number): string {
  const label =
    hintNumber <= 1 ? "Подсказка" : `Подсказка #${hintNumber}`;
  return `💡 <b>${label}:</b>\n\n${escapeHtml(formatReadableText(hint))}`;
}

export function formatEmoRiddle(emojis: string, showAnswer?: string): string {
  let body =
    `🎭 <b>Эмо-загадка:</b>\n\n` +
    `${emojis}\n\n` +
    `<i>Каждый эмодзи — один скилл героя. Ответ: <code>!имя</code>. /hint — расшифровка скиллов</i>`;
  if (showAnswer) {
    body += `\n\n🔧 <b>Ответ (тест):</b> ${escapeHtml(showAnswer)}`;
  }
  return body;
}

export function formatEmoHint(hint: string, hintNumber: number): string {
  const lines = hint
    .split("\n")
    .map((line) => {
      const sep = line.indexOf(" — ");
      if (sep === -1) return escapeHtml(line);
      const emoji = line.slice(0, sep);
      const skill = escapeHtml(line.slice(sep + 3));
      return `${emoji} — ${skill}`;
    })
    .join("\n");

  const label =
    hintNumber <= 1 ? "Подсказка" : `Подсказка #${hintNumber}`;
  return `💡 <b>${label}:</b>\n\n${lines}`;
}

export function formatSurrender(
  heroNameRu: string,
  heroNameEn: string,
): string {
  return (
    `🏳 <b>Сдались!</b> Это был <b>${escapeHtml(heroNameRu)}</b> (${escapeHtml(heroNameEn)}).\n\n` +
    `<i>Герой в пройденных — в новых загадках почти не повторится.</i>`
  );
}

export function formatWin(
  displayName: string,
  heroNameRu: string,
  heroNameEn: string,
  breakdown: RoundPointsResult,
  streakAfter: number,
  newTitle?: Title,
  previousTitle?: Title,
): string {
  let body =
    `✅ <b>${escapeHtml(displayName)}</b> угадал(а): <b>${escapeHtml(heroNameRu)}</b> (${escapeHtml(heroNameEn)})!\n` +
    formatPointsBreakdown(breakdown);

  if (streakAfter >= 3) {
    body += `\n🔥 Серия: ${streakAfter} подряд!`;
  }

  if (newTitle && previousTitle) {
    body += `\n${formatTitleBadge(previousTitle)} → ${formatTitleBadge(newTitle)} Новый титул: <b>${escapeHtml(newTitle.name)}</b>!`;
  }

  return body;
}

export function formatLeaderboard(
  rows: ScoreRow[] | PeriodLeaderboardRow[],
  period: LeaderboardPeriod = "all",
  rangeLabel?: string,
  pointsMap?: Map<string, number>,
): string {
  if (rows.length === 0) {
    const hint =
      period === "week"
        ? "За эту неделю пока нет побед."
        : period === "month"
          ? "За этот месяц пока нет побед."
          : "Пока никто не набрал очков. Запустите /riddle!";
    return `📊 ${hint}`;
  }

  const title =
    period === "week"
      ? `🏆 <b>Топ недели${rangeLabel ? ` (${rangeLabel})` : ""}</b>`
      : period === "month"
        ? `🏆 <b>Топ месяца${rangeLabel ? ` (${rangeLabel})` : ""}</b>`
        : "🏆 <b>Топ чата (всё время)</b>";

  const lines = rows.map((r, i) => {
    const name = escapeHtml(r.display_name);
    const pts = formatPoints(r.points);
    const titleBadge =
      pointsMap && "user_id" in r
        ? formatTitleBadge(getTitleByPoints(pointsMap.get(r.user_id) ?? r.points))
        : "points" in r && "current_streak" in r
          ? formatTitleBadge(getTitleByPoints((r as ScoreRow).points))
          : "";
    const prefix = titleBadge ? `${titleBadge} ` : "";
    return `${i + 1}. ${prefix}${name} — ${pts} (${r.wins} побед)`;
  });

  return `${title}\n\n${lines.join("\n")}`;
}

export function formatMe(
  row: ScoreRow | undefined,
  displayName: string,
  achievementIds: AchievementId[] = [],
  weeklyTitlePrefix?: string,
): string {
  const titlePrefix = weeklyTitlePrefix ? `${weeklyTitlePrefix} ` : "";
  if (!row) {
    return `👤 <b>${titlePrefix}${escapeHtml(displayName)}</b>\nПока 0 очков. Участвуйте в /riddle!`;
  }

  const title = getTitleByPoints(row.points);
  let body =
    `👤 <b>${titlePrefix}${escapeHtml(displayName)}</b>\n` +
    `${formatTitleLine(title)}\n` +
    `${formatPoints(row.points)} · ${row.wins} побед`;

  if (row.current_streak >= 3) {
    body += ` · 🔥 серия ${row.current_streak}`;
  }
  if (row.best_streak > row.current_streak) {
    body += ` (лучшая: ${row.best_streak})`;
  }

  const recent = formatRecentAchievements(achievementIds);
  if (recent) {
    body += `\n${recent}`;
  }

  return body;
}

export function formatDailyNick(
  nickname: string,
  dateLabel: string,
  cached: boolean,
  previousNicks: string[] = [],
  stackRemaining = 0,
  weeklyTitlePrefix?: string,
  scoreLine?: string,
): string {
  const status = cached
    ? "уже был сегодня"
    : "свежий, только что выкатили";

  const nickDisplay = weeklyTitlePrefix
    ? `${weeklyTitlePrefix} ${escapeHtml(nickname)}`
    : escapeHtml(nickname);

  let body =
    `📛 <b>Твой дотаник на ${escapeHtml(dateLabel)}</b>\n\n` +
    `<b>${nickDisplay}</b>`;

  if (scoreLine) {
    body += `\n\n${scoreLine}`;
  }

  body += `\n\n<i>${status}. Завтра — новый. Кнопка ниже — перекатить.</i>`;

  if (stackRemaining > 0) {
    const n = stackRemaining;
    const word =
      n % 10 === 1 && n % 100 !== 11
        ? "перекат"
        : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)
          ? "переката"
          : "перекатов";
    body += `\n\n<i>⚡ В запасе ${n} ${word} без нейросети.</i>`;
  }

  const past = previousNicks.filter((n) => n !== nickname).slice(0, 15);
  if (past.length > 0) {
    const lines = past.map((n) => `• ${escapeHtml(n)}`).join("\n");
    body += `\n\n<b>Бывшие ники:</b>\n${lines}`;
  }

  return body;
}

export function formatAchievementMessages(
  displayName: string,
  ids: AchievementId[],
): string[] {
  return ids.map((id) =>
    formatAchievementAnnounce(displayName, getAchievement(id)),
  );
}

export { formatAchievementsList };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
