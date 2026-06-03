import type { Context } from "grammy";
import type { GameService } from "../game/round.js";
import type { Repository } from "../db/repository.js";
import {
  formatHint,
  formatLeaderboard,
  formatRiddle,
  formatSurrender,
  formatWin,
} from "./format.js";
import { keyboardAfterWin, keyboardDuringRound } from "./keyboards.js";
import {
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

export async function executeRiddle(
  ctx: Context,
  game: GameService,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  if (game.hasActiveRound(cid)) {
    await ctx.reply("⏳ Уже идёт раунд! Угадайте героя или нажмите «Сдаться».");
    return;
  }

  await ctx.replyWithChatAction("typing");

  const firstStatus = pickRandomStatus(RIDDLE_LOADING_STATUSES);
  const statusMsg = await ctx.reply(firstStatus);
  const msgChatId = statusMsg.chat.id;
  const msgId = statusMsg.message_id;
  const ticker = startLoadingTicker(
    ctx.api,
    msgChatId,
    msgId,
    RIDDLE_LOADING_STATUSES,
    firstStatus,
  );

  try {
    const result = await game.startRound(cid, uid);
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

    await replaceMessage(
      ctx.api,
      msgChatId,
      msgId,
      formatRiddle(result.riddle, result.showAnswer),
      true,
      keyboardDuringRound(),
    );
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

export async function executeHint(ctx: Context, game: GameService): Promise<void> {
  const cid = chatId(ctx);

  if (!game.hasActiveRound(cid)) {
    const msg = game.hasAnyRound(cid)
      ? "🏁 Герой уже угадан! Запустите новую загадку."
      : "Нет активной загадки.";
    await ctx.reply(msg);
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

export async function executeTop(ctx: Context, repo: Repository): Promise<void> {
  const rows = repo.getLeaderboard(chatId(ctx));
  await ctx.reply(formatLeaderboard(rows), { parse_mode: "HTML" });
}

export async function replyWin(
  ctx: Context,
  heroNameRu: string,
  heroNameEn: string,
  points: number,
  replyToMessageId?: number,
): Promise<void> {
  await ctx.reply(formatWin(displayName(ctx), heroNameRu, heroNameEn, points), {
    parse_mode: "HTML",
    reply_markup: keyboardAfterWin(),
    ...(replyToMessageId
      ? { reply_parameters: { message_id: replyToMessageId } }
      : {}),
  });
}
