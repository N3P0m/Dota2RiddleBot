import type { Context } from "grammy";
import type { GameService } from "../game/round.js";
import type { InsultService } from "../game/insults.js";
import type { FloodTauntService } from "../game/flood-taunts.js";
import type { Repository } from "../db/repository.js";
import { config } from "../config.js";
import {
  checkPeriodAchievements,
  persistAchievements,
} from "../game/achievements.js";
import { monthKey, weekKey, formatWeekRange, formatMonthLabel } from "../game/periods.js";
import { getTitleByPoints, formatTitleLine } from "../game/titles.js";
import {
  formatEmoHint,
  formatEmoRiddle,
  formatHint,
  formatLeaderboard,
  formatRiddle,
  formatSurrender,
  formatWin,
  formatTaunt,
  formatWorkTaunt,
  formatAchievementMessages,
  type LeaderboardPeriod,
} from "./format.js";
import { keyboardAfterWin, keyboardDuringRound, keyboardLeaderboard } from "./keyboards.js";
import {
  EMO_LOADING_STATUSES,
  HINT_LOADING_STATUSES,
  RIDDLE_LOADING_STATUSES,
  pickRandomStatus,
  replaceMessage,
  startLoadingTicker,
} from "./loading-message.js";

export function chatId(ctx: Context): string {
  return String(ctx.chat?.id ?? 0);
}

export function userId(ctx: Context): string {
  return String(ctx.from?.id ?? 0);
}

export function displayName(ctx: Context): string {
  const from = ctx.from;
  if (!from) return "Игрок";
  return from.first_name + (from.last_name ? ` ${from.last_name}` : "");
}

export function username(ctx: Context): string | null {
  return ctx.from?.username ?? null;
}

async function isGroupAdmin(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type === "private") return true;
  const member = await ctx.getChatMember(Number(userId(ctx)));
  return member.status === "creator" || member.status === "administrator";
}

export async function maybeReplyTaunt(
  ctx: Context,
  insults: InsultService,
  chatIdStr: string,
  context = insults.getTauntContext(chatIdStr),
): Promise<void> {
  const taunt = insults.rollTaunt(chatIdStr, context);
  if (!taunt) return;
  await ctx.reply(formatTaunt(taunt), { parse_mode: "HTML" });
}

export async function maybeReplyFloodTaunt(
  ctx: Context,
  floodTaunts: FloodTauntService,
  chatIdStr: string,
): Promise<void> {
  const ctxFlood = floodTaunts.onRoundStarted(chatIdStr);
  const line = floodTaunts.rollFloodTaunt(chatIdStr, ctxFlood);
  if (!line) return;
  await ctx.reply(formatWorkTaunt(line), { parse_mode: "HTML" });
}

async function executeRoundStart(
  ctx: Context,
  game: GameService,
  insults: InsultService,
  floodTaunts: FloodTauntService,
  mode: "text" | "emoji",
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  void insults.ensureDailyRefill();

  if (game.hasActiveRound(cid)) {
    await ctx.reply("⏳ Уже идёт раунд! Угадайте героя или нажмите «Сдаться».");
    return;
  }

  await ctx.replyWithChatAction("typing");

  const loadingFrames =
    mode === "emoji" ? EMO_LOADING_STATUSES : RIDDLE_LOADING_STATUSES;
  const firstStatus = pickRandomStatus(loadingFrames);
  const statusMsg = await ctx.reply(firstStatus);
  const msgChatId = statusMsg.chat.id;
  const msgId = statusMsg.message_id;
  const ticker = startLoadingTicker(
    ctx.api,
    msgChatId,
    msgId,
    loadingFrames,
    firstStatus,
  );

  try {
    const result = await game.startRound(
      cid,
      uid,
      username(ctx),
      displayName(ctx),
      mode,
    );
    ticker.stop();

    if (!result.ok) {
      await replaceMessage(
        ctx.api,
        msgChatId,
        msgId,
        "⏳ Уже идёт раунд! Угадайте героя или нажмите «Сдаться».",
      );
      return;
    }

    const text =
      result.mode === "emoji"
        ? formatEmoRiddle(result.riddle, result.showAnswer)
        : formatRiddle(result.riddle, result.showAnswer);

    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      text,
      true,
      keyboardDuringRound(),
    );
    await maybeReplyFloodTaunt(ctx, floodTaunts, cid);
  } catch (err) {
    ticker.stop();
    console.error("riddle error:", err);
    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      "❌ Не удалось придумать загадку. Попробуйте ещё раз.",
    ).catch(() => {});
  }
}

export async function executeRiddle(
  ctx: Context,
  game: GameService,
  insults: InsultService,
  floodTaunts: FloodTauntService,
): Promise<void> {
  await executeRoundStart(ctx, game, insults, floodTaunts, "text");
}

export async function executeEmoRiddle(
  ctx: Context,
  game: GameService,
  insults: InsultService,
  floodTaunts: FloodTauntService,
): Promise<void> {
  await executeRoundStart(ctx, game, insults, floodTaunts, "emoji");
}

export async function executeHint(
  ctx: Context,
  game: GameService,
  insults: InsultService,
): Promise<void> {
  const cid = chatId(ctx);

  if (!game.hasActiveRound(cid)) {
    const msg = game.hasAnyRound(cid)
      ? "🏁 Герой уже угадан! Запустите новую загадку."
      : "Нет активной загадки.";
    await ctx.reply(msg);
    return;
  }

  const emojiMode = game.getRoundMode(cid) === "emoji";

  if (emojiMode) {
    try {
      const result = await game.requestHint(cid);
      if (!result.ok) {
        const msg =
          result.reason === "no_round"
            ? "Нет активной загадки."
            : "🏁 Герой уже угадан!";
        await ctx.reply(msg);
        return;
      }
      await ctx.reply(
        formatEmoHint(result.hint, result.hintNumber),
        { parse_mode: "HTML", reply_markup: keyboardDuringRound() },
      );
      await maybeReplyTaunt(ctx, insults, cid);
    } catch (err) {
      console.error("hint error:", err);
      await ctx.reply("❌ Подсказка не вышла.");
    }
    return;
  }

  await ctx.replyWithChatAction("typing");

  const firstHintStatus = pickRandomStatus(HINT_LOADING_STATUSES);
  const statusMsg = await ctx.reply(firstHintStatus);
  const msgChatId = statusMsg.chat.id;
  const msgId = statusMsg.message_id;
  const ticker = startLoadingTicker(
    ctx.api,
    msgChatId,
    msgId,
    HINT_LOADING_STATUSES,
    firstHintStatus,
  );

  try {
    const result = await game.requestHint(cid);
    ticker.stop();

    if (!result.ok) {
      const msg =
        result.reason === "no_round"
          ? "Нет активной загадки."
          : "🏁 Герой уже угадан!";
      await replaceMessage(ctx.api, msgChatId, msgId, msg);
      return;
    }

    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      formatHint(result.hint, result.hintNumber),
      true,
      keyboardDuringRound(),
    );
    await maybeReplyTaunt(ctx, insults, cid);
  } catch (err) {
    ticker.stop();
    console.error("hint error:", err);
    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      "❌ Подсказка не вышла.",
    ).catch(() => {});
  }
}

export async function executeCancel(
  ctx: Context,
  game: GameService,
): Promise<boolean> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const starter = game.getRoundStarter(cid);

  if (!game.hasActiveRound(cid)) {
    const msg = game.hasAnyRound(cid)
      ? "🏁 Герой уже угадан! Запустите новую загадку."
      : "Нет активного раунда.";
    await ctx.reply(msg, {
      reply_markup: game.hasAnyRound(cid) ? keyboardAfterWin() : undefined,
    });
    return false;
  }

  const canSurrender = uid === starter || (await isGroupAdmin(ctx));
  if (!canSurrender) {
    await ctx.reply(
      "Сдаться может только тот, кто запустил загадку, или админ чата.",
    );
    return false;
  }

  const result = game.surrenderRound(cid);
  if (!result.ok) {
    const msg =
      result.reason === "already_won"
        ? "🏁 Герой уже угадан! Запустите новую загадку."
        : "Нет активного раунда.";
    await ctx.reply(msg, {
      reply_markup:
        result.reason === "already_won" ? keyboardAfterWin() : undefined,
    });
    return false;
  }

  await ctx.reply(
    formatSurrender(result.hero.name_ru, result.hero.name_en),
    { parse_mode: "HTML", reply_markup: keyboardAfterWin() },
  );
  return true;
}

function resolvePeriod(period: LeaderboardPeriod): {
  key?: string;
  rangeLabel?: string;
} {
  const tz = config.nickTimeZone;
  const now = new Date();
  if (period === "week") {
    const key = weekKey(now, tz);
    return { key, rangeLabel: formatWeekRange(key, tz) };
  }
  if (period === "month") {
    const key = monthKey(now, tz);
    return { key, rangeLabel: formatMonthLabel(key, tz) };
  }
  return {};
}

export async function executeTop(
  ctx: Context,
  repo: Repository,
  period: LeaderboardPeriod = "all",
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const { key, rangeLabel } = resolvePeriod(period);

  if (period !== "all" && key) {
    const periodAchievements = checkPeriodAchievements(
      repo,
      cid,
      uid,
      config.nickTimeZone,
    );
    persistAchievements(repo, cid, uid, periodAchievements);
  }

  if (period === "all") {
    const rows = repo.getLeaderboard(cid);
    await ctx.reply(formatLeaderboard(rows, "all"), {
      parse_mode: "HTML",
      reply_markup: keyboardLeaderboard(),
    });
    return;
  }

  const rows = repo.getLeaderboardForPeriod(cid, period, key!);
  const pointsMap = new Map<string, number>();
  for (const row of rows) {
    const allTime = repo.getUserScore(cid, row.user_id);
    if (allTime) pointsMap.set(row.user_id, allTime.points);
  }

  await ctx.reply(
    formatLeaderboard(rows, period, rangeLabel, pointsMap),
    { parse_mode: "HTML", reply_markup: keyboardLeaderboard() },
  );
}

export async function replyWin(
  ctx: Context,
  result: Extract<
    Awaited<ReturnType<GameService["checkAnswer"]>>,
    { ok: true }
  >,
  replyToMessageId?: number,
): Promise<void> {
  await ctx.reply(
    formatWin(
      displayName(ctx),
      result.hero,
      result.breakdown,
      result.streakAfter,
      result.newTitle,
      result.previousTitle,
    ),
    {
      parse_mode: "HTML",
      reply_markup: keyboardAfterWin(),
      ...(replyToMessageId
        ? { reply_parameters: { message_id: replyToMessageId } }
        : {}),
    },
  );

  if (config.achievementsAnnounce && result.unlockedAchievements.length > 0) {
    const messages = formatAchievementMessages(
      displayName(ctx),
      result.unlockedAchievements,
    );
    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: "HTML" });
    }
  }
}

export function buildNickScoreLine(
  repo: Repository,
  chatId: string,
  userId: string,
): string | undefined {
  const score = repo.getUserScore(chatId, userId);
  if (!score || score.points === 0) return undefined;
  const title = getTitleByPoints(score.points);
  let line = `${formatPoints(score.points)} · ${formatTitleLine(title)}`;
  if (score.current_streak >= 3) {
    line += ` · серия ${score.current_streak}`;
  }
  return line;
}

function formatPoints(points: number): string {
  const n = Math.abs(points);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${points} очков`;
  if (mod10 === 1) return `${points} очко`;
  if (mod10 >= 2 && mod10 <= 4) return `${points} очка`;
  return `${points} очков`;
}
