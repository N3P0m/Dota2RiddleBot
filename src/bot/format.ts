import type { ScoreRow } from "../db/repository.js";
import { formatPoints } from "../game/scoring.js";
import { formatReadableText } from "./text-layout.js";

export const HELP_TEXT = `🎮 <b>Угадай героя Dota 2</b>

<b>Команды:</b>
/riddle — новая загадка
/emo-riddle — эмо-загадка (1 эмодзи = 1 скилл)
/hint — подсказка (короче и явнее)
/nick — дотаник на сегодня (нейросеть)
/nick new — перекатить (или кнопка под ником)
/top — топ-10 игроков чата
/me — ваши очки
/cancel — сдаться (показать героя)
/help — справка

<b>Как играть:</b>
1. /riddle или кнопка «Новая загадка»
2. /emo-riddle — герой зашифрован эмодзи-скиллами
3. Ответ: <b>!имя</b> (<code>!пудж</code>, <code>!largo</code>)
4. Под загадкой: <b>Подсказка</b> (каждая явнее) и <b>Сдаться</b>
5. В эмо-режиме подсказка раскрывает скилл за эмодзи
6. После угадывания: <b>Топ</b> и новая загадка

Команды тоже работают: /hint, /cancel, /top, /nick`;

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
    hintNumber <= 1
      ? "Подсказка"
      : `Подсказка #${hintNumber} (сильнее предыдущих)`;
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
  stackRemaining = 0,
): string {
  const status = cached
    ? "уже был сегодня"
    : "свежий, только что выкатили";

  let body =
    `📛 <b>Твой дотаник на ${escapeHtml(dateLabel)}</b>\n\n` +
    `<b>${escapeHtml(nickname)}</b>\n\n` +
    `<i>${status}. Завтра — новый. Кнопка ниже — перекатить.</i>`;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
