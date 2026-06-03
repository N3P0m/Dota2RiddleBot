import { Bot, Context } from "grammy";
import type { GameService } from "../game/round.js";
import type { DailyNickService } from "../game/daily-nick.js";
import type { Repository } from "../db/repository.js";
import { formatTodayRu } from "../game/nick-date.js";
import {
  chatId,
  displayName,
  executeCancel,
  executeHint,
  executeRiddle,
  executeTop,
  replyWin,
  userId,
  username,
} from "./actions.js";
import {
  HELP_TEXT,
  formatDailyNick,
  formatMe,
} from "./format.js";
import { CB, keyboardAfterWin } from "./keyboards.js";
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

async function runNickCommand(
  ctx: Context,
  dailyNick: DailyNickService,
  forceNew: boolean,
): Promise<void> {
  if (!forceNew) {
    const cached = dailyNick.getTodayNick(userId(ctx));
    if (cached) {
      await ctx.reply(
        formatDailyNick(
          cached,
          formatTodayRu(),
          true,
          dailyNick.getPreviousNicks(userId(ctx)),
        ),
        { parse_mode: "HTML" },
      );
      return;
    }
  }

  await ctx.replyWithChatAction("typing");

  const firstStatus = pickRandomStatus(NICK_LOADING_STATUSES);
  const statusMsg = await ctx.reply(firstStatus);
  const msgChatId = statusMsg.chat.id;
  const msgId = statusMsg.message_id;
  const ticker = startLoadingTicker(
    ctx.api,
    msgChatId,
    msgId,
    NICK_LOADING_STATUSES,
    firstStatus,
  );

  try {
    const result = await dailyNick.getOrCreate(
      userId(ctx),
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
      ),
      true,
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
): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: "HTML" });
  });

  bot.command("riddle", async (ctx) => executeRiddle(ctx, game));
  bot.command("hint", async (ctx) => executeHint(ctx, game));
  bot.command("top", async (ctx) => executeTop(ctx, repo));
  bot.command("cancel", async (ctx) => executeCancel(ctx, game));

  bot.command("nick", async (ctx) => {
    const text = ctx.message?.text?.trim() ?? "";
    const forceNew = /\bnew\b/i.test(text);
    await runNickCommand(ctx, dailyNick, forceNew);
  });

  bot.command("me", async (ctx) => {
    const row = repo.getUserScore(chatId(ctx), userId(ctx));
    await ctx.reply(formatMe(row, displayName(ctx)), { parse_mode: "HTML" });
  });

  bot.callbackQuery(CB.HINT, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeHint(ctx, game);
  });

  bot.callbackQuery(CB.CANCEL, async (ctx) => {
    const ok = await executeCancel(ctx, game);
    await ctx.answerCallbackQuery(ok ? "Раунд отменён" : undefined);
  });

  bot.callbackQuery(CB.TOP, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeTop(ctx, repo);
  });

  bot.callbackQuery(CB.RIDDLE, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeRiddle(ctx, game);
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
      await replyWin(
        ctx,
        result.hero.name_ru,
        result.hero.name_en,
        result.points,
        ctx.message.message_id,
      );
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
