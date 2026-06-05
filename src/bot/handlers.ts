import { Bot, Context } from "grammy";
import type { GameService } from "../game/round.js";
import type { DailyNickService } from "../game/daily-nick.js";
import type { InsultService } from "../game/insults.js";
import type { FloodTauntService } from "../game/flood-taunts.js";
import type { Repository } from "../db/repository.js";
import { formatTodayRu } from "../game/nick-date.js";
import type { AchievementId } from "../game/achievements.js";
import { getActiveWeeklyTitle } from "../game/weekly-title.js";
import {
  chatId,
  displayName,
  executeCancel,
  executeEmoRiddle,
  executeHint,
  executeRiddle,
  executeTop,
  replyWin,
  userId,
  username,
  buildNickScoreLine,
  maybeReplyTaunt,
} from "./actions.js";
import {
  HELP_TEXT,
  formatDailyNick,
  formatMe,
  formatAchievementsList,
  type LeaderboardPeriod,
} from "./format.js";
import { CB, keyboardAfterNick, keyboardAfterWin } from "./keyboards.js";
import {
  NICK_LOADING_STATUSES,
  pickRandomStatus,
  replaceMessage,
  startLoadingTicker,
} from "./loading-message.js";

/** Ответ только так: «!пудж», «! ларго» */
function parseAnswerAttempt(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("!")) return null;
  const answer = trimmed.slice(1).trim();
  return answer.length >= 2 ? answer : null;
}

function parseTopPeriod(text: string): LeaderboardPeriod {
  const arg = text.trim().split(/\s+/)[1]?.toLowerCase();
  if (arg === "week" || arg === "неделя") return "week";
  if (arg === "month" || arg === "месяц") return "month";
  return "all";
}

async function runNickCommand(
  ctx: Context,
  dailyNick: DailyNickService,
  repo: Repository,
  forceNew: boolean,
): Promise<void> {
  const uid = userId(ctx);
  const cid = chatId(ctx);
  const weeklyPrefix = getActiveWeeklyTitle(repo, cid, uid);
  const scoreLine = buildNickScoreLine(repo, cid, uid);

  if (!forceNew) {
    const cached = dailyNick.getTodayNick(uid);
    if (cached) {
      await ctx.reply(
        formatDailyNick(
          cached,
          formatTodayRu(),
          true,
          dailyNick.getPreviousNicks(uid),
          dailyNick.getStackRemaining(uid),
          weeklyPrefix,
          scoreLine,
        ),
        { parse_mode: "HTML", reply_markup: keyboardAfterNick() },
      );
      return;
    }
  }

  await ctx.replyWithChatAction("typing");

  const firstStatus = pickRandomStatus(NICK_LOADING_STATUSES);
  const callbackMsg = ctx.callbackQuery?.message;
  let msgChatId: number;
  let msgId: number;

  if (callbackMsg && "message_id" in callbackMsg) {
    msgChatId = callbackMsg.chat.id;
    msgId = callbackMsg.message_id;
    await ctx.api.editMessageText(msgChatId, msgId, firstStatus);
  } else {
    const statusMsg = await ctx.reply(firstStatus);
    msgChatId = statusMsg.chat.id;
    msgId = statusMsg.message_id;
  }

  const ticker = startLoadingTicker(
    ctx.api,
    msgChatId,
    msgId,
    NICK_LOADING_STATUSES,
    firstStatus,
  );

  try {
    const result = await dailyNick.getOrCreate(
      uid,
      displayName(ctx),
      username(ctx),
      forceNew,
    );
    ticker.stop();

    if (!result.ok) {
      await replaceMessage(
        ctx.api,
        msgChatId,
        msgId,
        "❌ Не вышло придумать ник. Попробуйте /nick позже.",
      );
      return;
    }

    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      formatDailyNick(
        result.nickname,
        formatTodayRu(),
        result.cached,
        result.previousNicks,
        result.stackRemaining,
        weeklyPrefix,
        scoreLine,
      ),
      true,
      keyboardAfterNick(),
    );
  } catch (err) {
    ticker.stop();
    console.error("nick command error:", err);
    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      "❌ Ошибка генерации ника.",
    ).catch(() => {});
  }
}

export function registerHandlers(
  bot: Bot,
  game: GameService,
  repo: Repository,
  dailyNick: DailyNickService,
  insults: InsultService,
  floodTaunts: FloodTauntService,
): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
  });

  bot.command("riddle", async (ctx) => executeRiddle(ctx, game, insults, floodTaunts));
  bot.command("emo_riddle", async (ctx) => executeEmoRiddle(ctx, game, insults, floodTaunts));
  bot.command("hint", async (ctx) => executeHint(ctx, game, insults));

  bot.command("top", async (ctx) => {
    const period = parseTopPeriod(ctx.message?.text ?? "");
    await executeTop(ctx, repo, period);
  });

  bot.command(["achievements", "ach"], async (ctx) => {
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const unlocked = repo
      .getUserAchievements(cid, uid)
      .map((a) => a.achievement_id);
    await ctx.reply(formatAchievementsList(unlocked as AchievementId[]), {
      parse_mode: "HTML",
    });
  });

  bot.command("cancel", async (ctx) => executeCancel(ctx, game));

  bot.command("nick", async (ctx) => {
    const text = ctx.message?.text?.trim() ?? "";
    const forceNew = /\bnew\b/i.test(text);
    await runNickCommand(ctx, dailyNick, repo, forceNew);
  });

  bot.command("me", async (ctx) => {
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const row = repo.getUserScore(cid, uid);
    const achievements = repo
      .getUserAchievements(cid, uid)
      .map((a) => a.achievement_id);
    const weeklyPrefix = getActiveWeeklyTitle(repo, cid, uid);
    await ctx.reply(
      formatMe(row, displayName(ctx), achievements as AchievementId[], weeklyPrefix),
      { parse_mode: "HTML" },
    );
  });

  bot.callbackQuery(CB.HINT, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeHint(ctx, game, insults);
  });

  bot.callbackQuery(CB.CANCEL, async (ctx) => {
    const ok = await executeCancel(ctx, game);
    await ctx.answerCallbackQuery(ok ? "Ответ показан" : undefined);
  });

  bot.callbackQuery(CB.TOP, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeTop(ctx, repo, "all");
  });

  bot.callbackQuery(CB.TOP_WEEK, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeTop(ctx, repo, "week");
  });

  bot.callbackQuery(CB.TOP_MONTH, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeTop(ctx, repo, "month");
  });

  bot.callbackQuery(CB.TOP_ALL, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeTop(ctx, repo, "all");
  });

  bot.callbackQuery(CB.RIDDLE, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeRiddle(ctx, game, insults, floodTaunts);
  });

  bot.callbackQuery(CB.EMO_RIDDLE, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeEmoRiddle(ctx, game, insults, floodTaunts);
  });

  bot.callbackQuery(CB.NICK_NEW, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Перекатываю…" });
    await runNickCommand(ctx, dailyNick, repo, true);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    const answer = parseAnswerAttempt(text);
    if (!answer) return;

    const cid = chatId(ctx);
    if (!game.hasAnyRound(cid)) return;

    const result = game.checkAnswer(
      cid,
      userId(ctx),
      username(ctx),
      displayName(ctx),
      answer,
    );

    if (result.ok) {
      await replyWin(ctx, result, ctx.message.message_id);
      return;
    }

    if (result.reason === "wrong") {
      const ctxAfterWrong = insults.recordWrongGuess(cid);
      await maybeReplyTaunt(ctx, insults, cid, ctxAfterWrong);
      return;
    }

    if (result.reason === "already_won") {
      await ctx.reply("🏁 Герой уже угадан! Нажмите «Новая загадка».", {
        reply_parameters: { message_id: ctx.message.message_id },
        reply_markup: keyboardAfterWin(),
      });
    }
  });
}
