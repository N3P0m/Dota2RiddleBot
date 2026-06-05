import type { PeriodLeaderboardRow, ScoreRow } from "../db/repository.js";
import type { AchievementId } from "../game/achievements.js";
import {
  formatAchievementAnnounce,
  formatAchievementsList,
  formatRecentAchievements,
  getAchievement,
} from "../game/achievements.js";
import type { Hero } from "../heroes/match.js";
import type { RoundPointsResult } from "../game/scoring.js";
import { formatPoints, formatPointsBreakdown } from "../game/scoring.js";
import { getHeroDifficulty } from "../game/hero-difficulty.js";
import {
  formatRankName,
  formatTitleBadge,
  formatTitleLine,
  getTitleByPoints,
  type Title,
} from "../game/titles.js";
import { formatReadableText } from "./text-layout.js";

const ATTR_LABELS: Record<string, string> = {
  str: "💪 Сила",
  agi: "🏹 Ловкость",
  int: "🧠 Интеллект",
  all: "⚖️ Универсал",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "🟢 лёгкий",
  normal: "",
  hard: "🟠 сложный",
  expert: "🔴 эксперт",
};

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
<b>Ранги:</b> как в Dota 2 по MMR-очкам (0 → 15 000): Рекрут 1 … Титан 5.
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

export function formatTaunt(text: string): string {
  return `🗣 <b>Бот:</b> <i>${escapeHtml(text)}</i>`;
}

export function formatWorkTaunt(text: string): string {
  return `💼 <b>Бот:</b> <i>${escapeHtml(text)}</i>`;
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

function formatElapsedTime(ms: number): string {
  const sec = Math.max(1, Math.floor(ms / 1000));
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} мин ${rem} сек` : `${min} мин`;
}

function formatHintsLine(hintsUsed: number): string {
  if (hintsUsed === 0) return "💡 без подсказок";
  const n = hintsUsed;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "подсказок";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "подсказка";
    else if (mod10 >= 2 && mod10 <= 4) word = "подсказки";
  }
  return `💡 ${n} ${word}`;
}

function formatHeroWinBlock(hero: Hero, breakdown: RoundPointsResult): string {
  const attr = ATTR_LABELS[hero.primary_attr] ?? hero.primary_attr;
  const diff = DIFFICULTY_LABELS[getHeroDifficulty(hero)];
  const meta: string[] = [attr];
  if (diff) meta.push(diff);
  meta.push(`⏱ ${formatElapsedTime(breakdown.elapsedMs)}`);
  meta.push(formatHintsLine(breakdown.hintsUsed));

  return (
    `🦸 <b>${escapeHtml(hero.name_ru)}</b> <i>(${escapeHtml(hero.name_en)})</i>\n` +
    `<i>${meta.join(" · ")}</i>`
  );
}

export function formatWin(
  displayName: string,
  hero: Hero,
  breakdown: RoundPointsResult,
  streakAfter: number,
  newTitle?: Title,
  previousTitle?: Title,
  pointsAfter?: number,
): string {
  const lines = [
    `✅ <b>Верно!</b> ${escapeHtml(displayName)}`,
    "",
    formatHeroWinBlock(hero, breakdown),
    "",
    `💰 ${formatPointsBreakdown(breakdown)}`,
  ];

  if (streakAfter >= 3) {
    lines.push("", `🔥 Серия: <b>${streakAfter}</b> подряд!`);
  }

  if (newTitle && previousTitle) {
    lines.push(
      "",
      `${formatTitleBadge(previousTitle)} → ${formatTitleBadge(newTitle)} Новый ранг: <b>${escapeHtml(pointsAfter !== undefined ? formatRankName(newTitle, pointsAfter) : newTitle.name)}</b>!`,
    );
  }

  return lines.join("\n");
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
    `${formatTitleLine(title, row.points)}\n` +
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
