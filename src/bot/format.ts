import type { ScoreRow } from "../db/repository.js";
import { formatPoints } from "../game/scoring.js";
import { formatReadableText } from "./text-layout.js";

export const HELP_TEXT = `🎮 <b>Угадай героя Dota 2</b>

<b>Команды:</b>
/riddle — новая загадка
/hint — подсказка (короче и явнее)
/nick — дотаник на сегодня (нейросеть)
/nick new — перекатить ник на сегодня
/top — топ-10 игроков чата
/me — ваши очки
/cancel — отменить раунд
/help — справка

<b>Как играть:</b>
1. /riddle или кнопка «Новая загадка»
2. Ответ: <b>!имя</b> (<code>!пудж</code>, <code>!largo</code>)
3. Под загадкой: <b>Подсказка</b> и <b>Закончить</b>
4. После угадывания: <b>Топ</b> и <b>Новая загадка</b>

Команды тоже работают: /hint, /cancel, /top, /nick`;

export function formatRiddle(riddle: string, showAnswer?: string): string {
  const formatted = escapeHtml(formatReadableText(riddle));
  let body = `🧩 <b>Загадка:</b>\n\n${formatted}\n\n<i>Ответ: <code>!имя</code> (RU/EN). /hint — подсказка</i>`;
  if (showAnswer) {
    body += `\n\n🔧 <b>Ответ (тест):</b> ${escapeHtml(showAnswer)}`;
  }
  return body;
}

export function formatHint(hint: string): string {
  return `💡 <b>Подсказка:</b>\n\n${escapeHtml(formatReadableText(hint))}`;
}

export function formatWin(
  displayName: string,
  heroNameRu: string,
  heroNameEn: string,
  points: number,
): string {
  return `✅ <b>${escapeHtml(displayName)}</b> угадал(а): <b>${escapeHtml(heroNameRu)}</b> (${escapeHtml(heroNameEn)})!\n+${formatPoints(points)}`;
}

export function formatLeaderboard(rows: ScoreRow[]): string {
  if (rows.length === 0) {
    return "📊 Пока никто не набрал очков. Запустите /riddle!";
  }
  const lines = rows.map((r, i) => {
    const name = escapeHtml(r.display_name);
    const pts = formatPoints(r.points);
    return `${i + 1}. ${name} — ${pts} (${r.wins} побед)`;
  });
  return `🏆 <b>Топ чата:</b>\n\n${lines.join("\n")}`;
}

export function formatMe(row: ScoreRow | undefined, displayName: string): string {
  if (!row) {
    return `👤 <b>${escapeHtml(displayName)}</b>\nПока 0 очков. Участвуйте в /riddle!`;
  }
  return `👤 <b>${escapeHtml(displayName)}</b>\n${formatPoints(row.points)} · ${row.wins} побед`;
}

export function formatDailyNick(
  nickname: string,
  dateLabel: string,
  cached: boolean,
  previousNicks: string[] = [],
): string {
  const status = cached
    ? "уже был сегодня"
    : "свежий, только что выкатили";

  let body =
    `📛 <b>Твой дотаник на ${escapeHtml(dateLabel)}</b>\n\n` +
    `<b>${escapeHtml(nickname)}</b>\n\n` +
    `<i>${status}. Завтра — новый. /nick new — перекатить.</i>`;

  const past = previousNicks.filter((n) => n !== nickname).slice(0, 15);
  if (past.length > 0) {
    const lines = past.map((n) => `• ${escapeHtml(n)}`).join("\n");
    body += `\n\n<b>Бывшие ники:</b>\n${lines}`;
  }

  return body;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
