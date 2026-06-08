import { Bot, Context } from "grammy";
import type { GameService } from "../game/round.js";
import type { DailyNickService } from "../game/daily-nick.js";
import type { InsultService } from "../game/insults.js";
import type { FloodTauntService } from "../game/flood-taunts.js";
import type { Repository } from "../db/repository.js";
import type { WalletService } from "../game/economy/wallet.js";
import type { ShopService } from "../game/collection/shop.js";
import type { BattleService } from "../game/battle/service.js";
import type { BattleAutoRunner } from "./battle-auto.js";
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
  WELCOME_TEXT,
  formatDailyNick,
  formatMe,
  formatAchievementsList,
  type LeaderboardPeriod,
} from "./format.js";
import {
  CB,
  keyboardAfterNick,
  keyboardAfterWin,
  keyboardHub,
  keyboardMenu,
} from "./keyboards.js";
import {
  formatGoldProfile,
  MENU_TEXT,
} from "./collection-format.js";
import {
  executeCollection,
  executeMenu,
  showShop,
  handleCollectionBack,
  handleCollectionHero,
  handleHeroSell,
} from "./collection-handlers.js";
import { replyOrEditHtml } from "./telegram-html.js";
import type { HeroEmojiMapStore } from "../game/catalog/hero-emoji-map.js";
import type { ItemEmojiMapStore } from "../game/catalog/item-emoji-map.js";
import {
  executeEmoMap,
  executeEmoMapPage,
  handleEmoMapPick,
  tryCaptureEmoMapMessage,
} from "./emo-map-handlers.js";
import {
  executeItemEmoMap,
  executeItemEmoMapPage,
  handleItemEmoMapPick,
  tryCaptureItemEmoMapMessage,
} from "./item-emo-map-handlers.js";
import {
  executeFightCommand,
  executeEndFight,
  executeFightMenu,
  executeFightPickOpponent,
  handleBattleCancel,
  handleBattleDecline,
  handleBattlePick,
  startFightWithHero,
} from "./battle-handlers.js";
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
  wallet: WalletService,
  shop: ShopService,
  battle: BattleService,
  battleRunner: BattleAutoRunner,
  heroEmojiMap: HeroEmojiMapStore | null,
  itemEmojiMap: ItemEmojiMapStore | null,
): void {
  bot.command("help", async (ctx) => {
    await replyOrEditHtml(ctx, HELP_TEXT, keyboardMenu());
  });

  bot.command("start", async (ctx) => {
    await replyOrEditHtml(ctx, WELCOME_TEXT, keyboardMenu());
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
    await replyOrEditHtml(
      ctx,
      formatAchievementsList(unlocked as AchievementId[]),
      keyboardHub(),
    );
  });

  bot.command("cancel", async (ctx) => executeCancel(ctx, game));

  bot.command("gold", async (ctx) => {
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const w = wallet.ensureWallet(uid);
    const points = repo.getUserScore(cid, uid)?.points ?? 0;
    await replyOrEditHtml(
      ctx,
      formatGoldProfile(w, points),
      keyboardHub(),
    );
  });

  bot.command("shop", async (ctx) => {
    await showShop(ctx, shop, wallet, repo);
  });

  bot.command("menu", async (ctx) => {
    await replyOrEditHtml(ctx, MENU_TEXT, keyboardMenu());
  });

  // Telegram не считает /emo-map bot_command (дефис в имени) — ловим через hears.
  bot.hears(/^\/emo-map(?:@\w+)?\s*$/i, async (ctx) => {
    if (!heroEmojiMap) {
      await ctx.reply("Маппер эмодзи отключён (HERO_EMOJI_MAP_DEV).");
      return;
    }
    itemEmojiMap?.clearPending(userId(ctx));
    await executeEmoMap(ctx, heroEmojiMap);
  });

  bot.hears(/^\/item-emo-map(?:@\w+)?\s*$/i, async (ctx) => {
    if (!itemEmojiMap) {
      await ctx.reply("Маппер эмодзи отключён (HERO_EMOJI_MAP_DEV).");
      return;
    }
    heroEmojiMap?.clearPending(userId(ctx));
    await executeItemEmoMap(ctx, itemEmojiMap);
  });

  bot.command("collection", async (ctx) => {
    await executeCollection(ctx, shop, repo, wallet);
  });

  bot.command("heroes", async (ctx) => {
    await executeCollection(ctx, shop, repo, wallet);
  });

  bot.command("fight", async (ctx) => {
    await executeFightCommand(ctx, battle, shop, repo, wallet);
  });

  bot.command("endfight", async (ctx) => {
    await executeEndFight(ctx, battle, repo, battleRunner);
  });

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
    await replyOrEditHtml(
      ctx,
      formatMe(row, displayName(ctx), achievements as AchievementId[], weeklyPrefix),
      keyboardHub(),
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

  bot.callbackQuery(CB.SHOP, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showShop(ctx, shop, wallet, repo);
  });

  bot.callbackQuery(CB.SHOP_FULL, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showShop(ctx, shop, wallet, repo, "full");
  });

  bot.callbackQuery(CB.SHOP_AVAIL, async (ctx) => {
    await ctx.answerCallbackQuery();
    await showShop(ctx, shop, wallet, repo, "compact");
  });

  bot.callbackQuery(CB.COLLECTION, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeCollection(ctx, shop, repo, wallet);
  });

  bot.callbackQuery(CB.MENU, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeMenu(ctx);
  });

  bot.callbackQuery(CB.COL_BACK, async (ctx) => {
    await handleCollectionBack(ctx, shop, repo, wallet);
  });

  bot.callbackQuery(/^col_h:(\d+)$/, async (ctx) => {
    await handleCollectionHero(ctx, shop, repo, Number(ctx.match![1]));
  });

  bot.callbackQuery(/^col_sell:(\d+)$/, async (ctx) => {
    await handleHeroSell(ctx, shop, repo, battle, Number(ctx.match![1]), wallet);
  });

  bot.callbackQuery(/^emo_map:(\d+)$/, async (ctx) => {
    if (!heroEmojiMap) {
      await ctx.answerCallbackQuery({ text: "Отключено" });
      return;
    }
    itemEmojiMap?.clearPending(userId(ctx));
    await handleEmoMapPick(ctx, heroEmojiMap, Number(ctx.match![1]));
  });

  bot.callbackQuery(/^emo_map_p:(\d+)$/, async (ctx) => {
    if (!heroEmojiMap) {
      await ctx.answerCallbackQuery({ text: "Отключено" });
      return;
    }
    await executeEmoMapPage(ctx, heroEmojiMap, Number(ctx.match![1]));
  });

  bot.callbackQuery("emo_map_nop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(/^item_emo_map:(\d+)$/, async (ctx) => {
    if (!itemEmojiMap) {
      await ctx.answerCallbackQuery({ text: "Отключено" });
      return;
    }
    heroEmojiMap?.clearPending(userId(ctx));
    await handleItemEmoMapPick(ctx, itemEmojiMap, Number(ctx.match![1]));
  });

  bot.callbackQuery(/^item_emo_map_p:(\d+)$/, async (ctx) => {
    if (!itemEmojiMap) {
      await ctx.answerCallbackQuery({ text: "Отключено" });
      return;
    }
    await executeItemEmoMapPage(ctx, itemEmojiMap, Number(ctx.match![1]));
  });

  bot.callbackQuery("item_emo_map_nop", async (ctx) => {
    await ctx.answerCallbackQuery();
  });

  bot.callbackQuery(CB.FIGHT, async (ctx) => {
    await ctx.answerCallbackQuery();
    await executeFightMenu(ctx, battle, shop, repo, wallet);
  });

  bot.callbackQuery(/^fight_vs:(.+)$/, async (ctx) => {
    await executeFightPickOpponent(
      ctx,
      shop,
      repo,
      ctx.match![1]!,
    );
  });

  bot.callbackQuery(/^shop_h:(\d+)$/, async (ctx) => {
    const heroId = Number(ctx.match![1]);
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const result = shop.buyHero(cid, uid, heroId);
    if (!result.ok) {
      const msgs: Record<string, string> = {
        not_unlocked: "Ещё не разблокирован в этом чате.",
        already_owned: "Уже куплен.",
        insufficient_gold: "Не хватает золота.",
        not_in_catalog: "Нет в каталоге.",
      };
      await ctx.answerCallbackQuery({
        text: msgs[result.reason] ?? "Ошибка",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({ text: `Куплен: ${result.name}` });
    await showShop(ctx, shop, wallet, repo);
  });

  bot.callbackQuery(/^shop_i:(\d+)$/, async (ctx) => {
    const itemId = Number(ctx.match![1]);
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const result = shop.buyItem(cid, uid, itemId);
    if (!result.ok) {
      const msgs: Record<string, string> = {
        not_unlocked: "Предмет не разблокирован чатом.",
        already_owned: "Предмет уже куплен.",
        slots_full: "Все слоты заняты.",
        insufficient_gold: "Не хватает золота.",
        not_in_catalog: "Нет в каталоге.",
        level_too_low: "Нужен более высокий уровень героя.",
        mmr_too_low: "Нужен более высокий рейтинг чата.",
        tier_locked: "Тир предмета пока недоступен.",
      };
      await ctx.answerCallbackQuery({
        text: msgs[result.reason] ?? "Ошибка",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({ text: `Куплен: ${result.name}` });
    await showShop(ctx, shop, wallet, repo);
  });

  bot.callbackQuery(/^shop_r:(\d+)$/, async (ctx) => {
    const slot = Number(ctx.match![1]);
    const cid = chatId(ctx);
    const uid = userId(ctx);
    const result = shop.rechargeItem(cid, uid, slot);
    if (!result.ok) {
      const msgs: Record<string, string> = {
        empty_slot: "Слот пуст.",
        full_uses: "Использования уже полные.",
        insufficient_gold: "Не хватает золота.",
        not_in_catalog: "Нет в каталоге.",
      };
      await ctx.answerCallbackQuery({
        text: msgs[result.reason] ?? "Ошибка",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({
      text: `Перезарядка: ${result.name} (−${result.cost}g)`,
    });
    await showShop(ctx, shop, wallet, repo);
  });

  bot.callbackQuery(/^fight_ch:([^:]+):(\d+)$/, async (ctx) => {
    const targetUserId = ctx.match![1]!;
    const heroId = Number(ctx.match![2]);
    await startFightWithHero(ctx, battle, shop, repo, targetUserId, heroId);
  });

  bot.callbackQuery(/^btl_pick:(\d+):(\d+)$/, async (ctx) => {
    const battleId = Number(ctx.match![1]);
    const heroId = Number(ctx.match![2]);
    await handleBattlePick(ctx, battle, repo, battleRunner, battleId, heroId);
  });

  bot.callbackQuery(/^btl_cancel:(\d+)$/, async (ctx) => {
    await handleBattleCancel(
      ctx,
      battle,
      repo,
      battleRunner,
      Number(ctx.match![1]),
    );
  });

  bot.callbackQuery(/^btl_decline:(\d+)$/, async (ctx) => {
    await handleBattleDecline(
      ctx,
      battle,
      repo,
      battleRunner,
      Number(ctx.match![1]),
    );
  });

  if (heroEmojiMap || itemEmojiMap) {
    bot
      .on("message")
      .filter((ctx) => {
        const uid = userId(ctx);
        return (
          heroEmojiMap?.getPending(uid) != null ||
          itemEmojiMap?.getPending(uid) != null
        );
      })
      .use(async (ctx) => {
        const uid = userId(ctx);
        if (itemEmojiMap?.getPending(uid) != null) {
          await tryCaptureItemEmoMapMessage(ctx, itemEmojiMap);
          return;
        }
        if (heroEmojiMap?.getPending(uid) != null) {
          await tryCaptureEmoMapMessage(ctx, heroEmojiMap);
        }
      });
  }

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
