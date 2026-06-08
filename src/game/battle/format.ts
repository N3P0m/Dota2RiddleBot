import { getHeroById } from "../../heroes/match.js";
import { getCombatHero } from "../catalog/catalog.js";
import { formatHeroNameWithEmojiHtml } from "../catalog/hero-emoji.js";
import { formatHeroLevelProgress } from "../collection/hero-progress.js";
import { formatPoints } from "../scoring.js";
import { formatRankProgress } from "../titles.js";
import type { BattleState, FighterState } from "./engine.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function resourceBar(current: number, max: number, width = 8): string {
  if (max <= 0) return "░".repeat(width);
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * width);
  const pctLabel = Math.round(pct * 100);
  return `${"▓".repeat(filled)}${"░".repeat(width - filled)} ${pctLabel}%`;
}

function fighterBlock(f: FighterState, playerName: string): string {
  const hero = getHeroById(f.heroId);
  const heroName = hero?.name_ru ?? `Герой ${f.heroId}`;
  const lines = [
    `<b>${escapeHtml(playerName)}</b> · ${formatHeroNameWithEmojiHtml(f.heroId, escapeHtml(heroName))} <i>ур.${f.level}</i>`,
    `❤️ ${Math.max(0, f.hp)}/${f.maxHp}  ${resourceBar(f.hp, f.maxHp)}`,
    `💧 ${f.mana}/${f.maxMana}  ${resourceBar(f.mana, f.maxMana)}`,
  ];

  const status: string[] = [];
  if (f.statuses.stunned > 0) status.push(`⚡ стан ${f.statuses.stunned}`);
  if (f.statuses.silenced > 0) status.push(`🔇 сайленс ${f.statuses.silenced}`);
  if (f.statuses.dot > 0) status.push(`🔥 DoT ${f.statuses.dot}`);
  if (f.statuses.buffArmor > 0) status.push(`🛡 броня +`);
  if (f.statuses.buffDamage > 0) status.push(`⚔️ урон +`);
  if (status.length > 0) lines.push(status.join(" · "));

  if (f.pendingAction != null) {
    lines.push(`<i>✅ ход сделан</i>`);
  } else if (f.pendingItemId != null) {
    lines.push(`<i>🎒 предмет выбран · ждём скилл</i>`);
  }

  return lines.join("\n");
}

function waitingLine(
  state: BattleState,
  challengerName: string,
  defenderName: string,
): string {
  const chReady = state.challenger.pendingAction != null;
  const defReady = state.defender.pendingAction != null;

  if (chReady && defReady) {
    return "<i>Оба сделали ход — разрешаем раунд…</i>";
  }
  if (chReady) {
    return `<i>✅ ${escapeHtml(challengerName)} сделал ход · ждём ${escapeHtml(defenderName)}</i>`;
  }
  if (defReady) {
    return `<i>✅ ${escapeHtml(defenderName)} сделал ход · ждём ${escapeHtml(challengerName)}</i>`;
  }
  return (
    `<i>Раунд ${state.turn}: предмет (опц.) → скилл. ` +
    `${escapeHtml(challengerName)} — верхние ряды, ` +
    `${escapeHtml(defenderName)} — нижние.</i>`
  );
}

function formatLogLine(
  line: string,
  challengerId: string,
  defenderId: string,
  challengerName: string,
  defenderName: string,
): string {
  return escapeHtml(
    line
      .replaceAll(challengerId, challengerName)
      .replaceAll(defenderId, defenderName),
  );
}

export function formatBattleMessage(
  state: BattleState,
  challengerId: string,
  defenderId: string,
  challengerName: string,
  defenderName: string,
): string {
  const recentLog = state.log
    .slice(-5)
    .map((l) =>
      formatLogLine(
        l,
        challengerId,
        defenderId,
        challengerName,
        defenderName,
      ),
    )
    .join("\n");

  return [
    `⚔️ <b>Бой · раунд ${state.turn}</b>`,
    "",
    fighterBlock(state.challenger, challengerName),
    "",
    fighterBlock(state.defender, defenderName),
    "",
    waitingLine(state, challengerName, defenderName),
    recentLog ? `\n<b>Лог</b>\n${recentLog}` : "",
  ].join("\n");
}

export function formatFightPickHero(
  targetName: string,
  challengerName: string,
): string {
  return (
    `⚔️ <b>Кого вызываем?</b> → <b>${escapeHtml(targetName)}</b>\n\n` +
    `<i>${escapeHtml(challengerName)}, выберите своего героя:</i>`
  );
}

export function formatBattlePickHero(
  challengerName: string,
  defenderName: string,
  challengerHeroId: number,
): string {
  const hero = getHeroById(challengerHeroId);
  const heroName = hero?.name_ru ?? `Герой ${challengerHeroId}`;

  return (
    `⚔️ <b>${escapeHtml(challengerName)}</b> вызывает ` +
    `<b>${escapeHtml(defenderName)}</b> на бой!\n\n` +
    `Герой вызывающего: ${formatHeroNameWithEmojiHtml(challengerHeroId, `<b>${escapeHtml(heroName)}</b>`)}\n\n` +
    `<i>${escapeHtml(defenderName)}, выберите героя для ответа:</i>`
  );
}

export type BattleResultSide = {
  heroId: number;
  level: number;
  xp: number;
  xpGain: number;
  points: number;
  pointsDelta: number;
};

function formatRatingProgressBlock(points: number, delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return (
    `📈 ${formatPoints(points)} (<b>${sign}${delta}</b>)\n` +
    `${formatRankProgress(points)}`
  );
}

function formatBattleResultSide(
  playerName: string,
  side: BattleResultSide,
): string {
  const hero = getHeroById(side.heroId);
  const heroName = hero?.name_ru ?? `Герой ${side.heroId}`;

  return [
    `<b>${escapeHtml(playerName)}</b>`,
    formatHeroNameWithEmojiHtml(side.heroId, escapeHtml(heroName)),
    formatHeroLevelProgress(side.level, side.xp, side.xpGain),
    formatRatingProgressBlock(side.points, side.pointsDelta),
  ].join("\n");
}

export function formatBattleResult(
  winnerName: string,
  loserName: string,
  winner: BattleResultSide,
  loser: BattleResultSide,
): string {
  return [
    `🏆 <b>${escapeHtml(winnerName)}</b> победил <b>${escapeHtml(loserName)}</b>!`,
    "",
    formatBattleResultSide(winnerName, winner),
    "",
    formatBattleResultSide(loserName, loser),
  ].join("\n");
}

export function skillButtonLabel(
  heroId: number,
  key: "Q" | "W" | "E" | "R",
): string {
  const combat = getCombatHero(heroId);
  const skill = combat?.skills.find((s) => s.key === key);
  if (!skill) return key;
  const short = skill.name_ru.split(" ")[0] ?? skill.name_ru;
  return `${key}: ${short.slice(0, 8)}`;
}
