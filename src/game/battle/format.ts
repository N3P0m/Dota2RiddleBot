import { getHeroById } from "../../heroes/match.js";
import { getCombatHero } from "../catalog/catalog.js";
import { formatHeroNameWithEmojiHtml } from "../catalog/hero-emoji.js";
import { formatHeroLevelProgress } from "../collection/hero-progress.js";
import { formatPoints } from "../scoring.js";
import { formatBattleGoldReward } from "../economy/battle-rewards.js";
import { formatRankProgress } from "../titles.js";
import { escapeHtml } from "../../bot/telegram-html.js";
import type { BattleState, FighterState } from "./engine.js";

/** Кликабельный тег игрока в HTML (уведомление в группе). */
export function formatUserMentionHtml(
  userId: string,
  displayName: string,
): string {
  return `<a href="tg://user?id=${userId}">${escapeHtml(displayName)}</a>`;
}

const BATTLE_LOG_LINES = 5;
const LOG_EMPTY = "·";

function resourceBar(current: number, max: number, width = 8): string {
  if (max <= 0) return "░".repeat(width);
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * width);
  const pctLabel = Math.round(pct * 100);
  return `${"▓".repeat(filled)}${"░".repeat(width - filled)} ${pctLabel}%`;
}

function formatFighterStatusLine(f: FighterState): string {
  const status: string[] = [];
  if (f.statuses.stunned > 0) status.push(`⚡ стан ${f.statuses.stunned}`);
  if (f.statuses.silenced > 0) status.push(`🔇 сайленс ${f.statuses.silenced}`);
  if (f.statuses.dot > 0) status.push(`🔥 DoT ${f.statuses.dot}`);
  if (f.statuses.buffArmor > 0) status.push(`🛡 броня +`);
  if (f.statuses.buffDamage > 0) status.push(`⚔️ урон +`);
  return status.length > 0 ? status.join(" · ") : LOG_EMPTY;
}

function formatFighterItemsLine(f: FighterState): string {
  const count = f.battleItems.filter((i) => i.usesRemaining > 0).length;
  return count > 0 ? `🎒 предметы: ${count}` : LOG_EMPTY;
}

/** Фиксированные 5 строк — без скачков высоты при тиках. */
function fighterBlock(f: FighterState, playerName: string): string {
  const hero = getHeroById(f.heroId);
  const heroName = hero?.name_ru ?? `Герой ${f.heroId}`;

  return [
    `<b>${escapeHtml(playerName)}</b> · ${formatHeroNameWithEmojiHtml(f.heroId, escapeHtml(heroName))} <i>ур.${f.level}</i>`,
    `❤️ ${Math.max(0, f.hp)}/${f.maxHp}  ${resourceBar(f.hp, f.maxHp)}`,
    `💧 ${f.mana}/${f.maxMana}  ${resourceBar(f.mana, f.maxMana)}`,
    formatFighterStatusLine(f),
    formatFighterItemsLine(f),
  ].join("\n");
}

function autoBattleStatusLine(): string {
  return "<i>⚙️ Автобой · ходы и предметы случайно · обновление каждые 2 с</i>";
}

function formatLogLine(
  line: string,
  challengerId: string,
  defenderId: string,
  challengerName: string,
  defenderName: string,
): string {
  const text = line
    .replaceAll(challengerId, challengerName)
    .replaceAll(defenderId, defenderName);
  const max = 52;
  const clipped =
    text.length > max ? `${text.slice(0, max - 1)}…` : text;
  return escapeHtml(clipped);
}

function formatBattleLogSection(
  state: BattleState,
  challengerId: string,
  defenderId: string,
  challengerName: string,
  defenderName: string,
): string {
  const slots = Array<string>(BATTLE_LOG_LINES).fill(LOG_EMPTY);
  const recent = state.log
    .slice(-BATTLE_LOG_LINES)
    .map((l) =>
      formatLogLine(
        l,
        challengerId,
        defenderId,
        challengerName,
        defenderName,
      ),
    );
  const offset = BATTLE_LOG_LINES - recent.length;
  for (let i = 0; i < recent.length; i++) {
    slots[offset + i] = recent[i]!;
  }
  return `<b>Лог</b>\n${slots.join("\n")}`;
}

export function formatBattleMessage(
  state: BattleState,
  challengerId: string,
  defenderId: string,
  challengerName: string,
  defenderName: string,
): string {
  return [
    `⚔️ <b>Бой · раунд ${state.turn}</b>`,
    "",
    fighterBlock(state.challenger, challengerName),
    "",
    fighterBlock(state.defender, defenderName),
    "",
    autoBattleStatusLine(),
    "",
    formatBattleLogSection(
      state,
      challengerId,
      defenderId,
      challengerName,
      defenderName,
    ),
  ].join("\n");
}

/** Один экран: вызов + выбор героя инициатором (без тега). */
export function formatFightPickHero(
  challengerName: string,
  targetName: string,
): string {
  return (
    `⚔️ Вызов → <b>${escapeHtml(targetName)}</b>\n\n` +
    `<i>${escapeHtml(challengerName)}, выберите своего героя:</i>`
  );
}

/** Инициатор выбрал героя — то же сообщение, кнопки убраны. */
export function formatChallengeSent(
  challengerName: string,
  targetName: string,
  challengerHeroId: number,
): string {
  const hero = getHeroById(challengerHeroId);
  const heroName = hero?.name_ru ?? `Герой ${challengerHeroId}`;

  return (
    `⚔️ <b>${escapeHtml(challengerName)}</b> вызывает ` +
    `<b>${escapeHtml(targetName)}</b> на бой!\n\n` +
    `Ваш герой: ${formatHeroNameWithEmojiHtml(challengerHeroId, `<b>${escapeHtml(heroName)}</b>`)}\n\n` +
    `<i>Ждём ответа соперника 👇</i>`
  );
}

export function formatBattlePickHero(
  challengerName: string,
  defenderUserId: string,
  defenderName: string,
  challengerHeroId: number,
): string {
  const hero = getHeroById(challengerHeroId);
  const heroName = hero?.name_ru ?? `Герой ${challengerHeroId}`;
  const defender = formatUserMentionHtml(defenderUserId, defenderName);

  return (
    `⚔️ <b>${escapeHtml(challengerName)}</b> вызывает на бой!\n\n` +
    `Герой вызывающего: ${formatHeroNameWithEmojiHtml(challengerHeroId, `<b>${escapeHtml(heroName)}</b>`)}\n\n` +
    `${defender}, <b>выберите героя для ответа:</b>`
  );
}

export function formatBattleFightHeader(
  challengerUserId: string,
  challengerName: string,
  defenderUserId: string,
  defenderName: string,
): string {
  const ch = formatUserMentionHtml(challengerUserId, challengerName);
  const def = formatUserMentionHtml(defenderUserId, defenderName);
  return `⚔️ ${ch} vs ${def}\n\n`;
}

export type BattleResultSide = {
  heroId: number;
  level: number;
  xp: number;
  xpGain: number;
  points: number;
  pointsDelta: number;
  goldGain: number;
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
  isWinner: boolean,
): string {
  const hero = getHeroById(side.heroId);
  const heroName = hero?.name_ru ?? `Герой ${side.heroId}`;
  const nameLine = isWinner
    ? `<b>🏆 ${escapeHtml(playerName)}</b>`
    : `<i>💀 ${escapeHtml(playerName)}</i>`;

  return [
    nameLine,
    formatHeroNameWithEmojiHtml(side.heroId, escapeHtml(heroName)),
    formatHeroLevelProgress(side.level, side.xp, side.xpGain),
    `💰 ${formatBattleGoldReward(side.goldGain)}`,
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
    `🏆 <b>Победа: ${escapeHtml(winnerName)}</b>`,
    `<i>Поражение: ${escapeHtml(loserName)}</i>`,
    "",
    `▰▰▰ <b>${escapeHtml(winnerName)}</b> ▰▰▰`,
    formatBattleResultSide(winnerName, winner, true),
    "",
    `▱▱▱ <i>${escapeHtml(loserName)}</i> ▱▱▱`,
    formatBattleResultSide(loserName, loser, false),
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
