import type { Context } from "grammy";
import type { BattleService } from "../game/battle/service.js";
import type { ShopService } from "../game/collection/shop.js";
import type { Repository } from "../db/repository.js";
import type { WalletService } from "../game/economy/wallet.js";
import type { BattleAutoRunner } from "./battle-auto.js";
import {
  formatBattleFightHeader,
  formatBattleMessage,
  formatBattlePickHero,
  formatChallengeSent,
  formatFightPickHero,
  formatUserMentionHtml,
} from "../game/battle/format.js";
import { formatPoints } from "../game/scoring.js";
import { formatTitleLine, getTitleByPoints } from "../game/titles.js";
import {
  keyboardChallengePending,
  keyboardFightOpponents,
  keyboardPickHero,
  keyboardPickHeroForFight,
} from "./keyboards.js";
import { chatId, userId } from "./actions.js";
import { getCombatHero } from "../game/catalog/catalog.js";
import { replyHtml, replyOrEditHtml } from "./telegram-html.js";

function hasCombatHeroes(repo: Repository, chatId: string, uid: string): boolean {
  return repo
    .getPlayerHeroes(chatId, uid)
    .some((h) => getCombatHero(h.hero_id));
}

function playerName(repo: Repository, cid: string, uid: string): string {
  return repo.getPlayerDisplayName(cid, uid);
}

function listFightOpponents(
  repo: Repository,
  chatId: string,
  uid: string,
): { userId: string; displayName: string }[] {
  return repo
    .getChatHeroOwners(chatId, uid)
    .filter((row) => hasCombatHeroes(repo, chatId, row.user_id))
    .map((row) => ({
      userId: row.user_id,
      displayName: repo.getPlayerDisplayName(chatId, row.user_id),
    }));
}

function formatFightMenuHeader(
  repo: Repository,
  cid: string,
  uid: string,
  gold: number,
): string {
  const points = repo.getUserScore(cid, uid)?.points ?? 0;
  const title = getTitleByPoints(points);
  return (
    `⚔️ <b>Кого вызываем на бой?</b>\n` +
    `<i>${formatTitleLine(title, points)} · ${formatPoints(points)} · ${gold}💰</i>\n\n` +
    `<i>Выберите соперника, затем своего героя.</i>`
  );
}

async function finalizePickMessage(ctx: Context, doneText: string): Promise<void> {
  if (!ctx.callbackQuery?.message) return;
  try {
    await ctx.editMessageText(doneText, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  } catch {
    /* already edited */
  }
}

export async function executeFightMenu(
  ctx: Context,
  battle: BattleService,
  shop: ShopService,
  repo: Repository,
  wallet?: WalletService,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  shop.ensureStarterHero(cid, uid);

  const pending = repo.getBattleByChat(cid);
  if (pending && pending.state === "pick_defender") {
    const chName = playerName(repo, cid, pending.challenger_id);
    const defName = playerName(repo, cid, pending.defender_id);
    const isChallenger = uid === pending.challenger_id;
    const isDefender = uid === pending.defender_id;
    let text =
      `⏳ <b>Ожидание ответа защитника</b>\n\n` +
      `${formatUserMentionHtml(pending.challenger_id, chName)} вызвал ` +
      `${formatUserMentionHtml(pending.defender_id, defName)}.\n\n`;
    if (isChallenger) {
      text += `<i>Можно отменить вызов кнопкой ниже или /endfight.</i>`;
      await replyOrEditHtml(
        ctx,
        text,
        keyboardChallengePending(pending.id),
      );
      return;
    }
    if (isDefender) {
      text += `<i>Выберите героя в сообщении вызова выше.</i>`;
    } else {
      text += `<i>Дождитесь выбора героя или /endfight.</i>`;
    }
    await replyOrEditHtml(ctx, text);
    return;
  }

  if (battle.hasActiveBattle(cid)) {
    await replyOrEditHtml(
      ctx,
      "⏳ В чате уже идёт бой. Дождитесь окончания или /endfight.",
    );
    return;
  }

  if (!hasCombatHeroes(repo, cid, uid)) {
    await replyOrEditHtml(
      ctx,
      "Нет героев для боя. Откройте /shop и возьмите Пуджа.",
    );
    return;
  }

  const opponents = listFightOpponents(repo, cid, uid);
  if (opponents.length === 0) {
    await replyOrEditHtml(
      ctx,
      "В чате пока нет других игроков с героями.\nПусть кто-нибудь откроет /shop — тогда появятся кнопки соперников.",
    );
    return;
  }

  const gold = wallet?.ensureWallet(uid).gold ?? 0;
  await replyOrEditHtml(
    ctx,
    formatFightMenuHeader(repo, cid, uid, gold),
    keyboardFightOpponents(opponents),
  );
}

export async function executeFightPickOpponent(
  ctx: Context,
  shop: ShopService,
  repo: Repository,
  targetUserId: string,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  if (targetUserId === uid) {
    await ctx.answerCallbackQuery({
      text: "Нельзя вызвать себя",
      show_alert: true,
    });
    return;
  }

  shop.ensureStarterHero(cid, uid);

  if (!hasCombatHeroes(repo, cid, uid)) {
    await ctx.answerCallbackQuery({ text: "Сначала возьмите героя в /shop" });
    return;
  }

  if (!hasCombatHeroes(repo, cid, targetUserId)) {
    await ctx.answerCallbackQuery({ text: "У соперника нет героев для боя" });
    return;
  }

  const targetName = playerName(repo, cid, targetUserId);
  const challengerName = playerName(repo, cid, uid);

  const heroes = repo
    .getPlayerHeroes(cid, uid)
    .filter((h) => getCombatHero(h.hero_id));

  await ctx.answerCallbackQuery();

  await replyOrEditHtml(
    ctx,
    formatFightPickHero(challengerName, targetName),
    keyboardPickHeroForFight(
      heroes.map((h) => h.hero_id),
      targetUserId,
    ),
  );
}

export async function startFightWithHero(
  ctx: Context,
  battle: BattleService,
  shop: ShopService,
  repo: Repository,
  targetUserId: string,
  challengerHeroId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  shop.ensureStarterHero(cid, uid);

  const result = battle.startChallenge(cid, uid, targetUserId, challengerHeroId);
  if (!result.ok) {
    const msgs: Record<string, string> = {
      active: "В чате уже идёт бой.",
      no_hero: "У вас нет этого героя. /shop",
      self: "Нельзя вызвать себя.",
      not_in_combat: "Этот герой пока недоступен в боях.",
    };
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({
        text: msgs[result.reason] ?? "Не удалось начать бой.",
        show_alert: true,
      });
    } else {
      await ctx.reply(msgs[result.reason] ?? "Не удалось начать бой.");
    }
    return;
  }

  const challengerName = playerName(repo, cid, uid);
  const defenderName = playerName(repo, cid, targetUserId);

  const owned = repo
    .getPlayerHeroes(cid, targetUserId)
    .filter((h) => getCombatHero(h.hero_id));

  if (owned.length === 0) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "У соперника нет героев" });
    }
    await replyOrEditHtml(ctx, "У соперника нет героев для боя.");
    battle.clearBattle(cid);
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  await finalizePickMessage(
    ctx,
    formatChallengeSent(challengerName, defenderName, challengerHeroId) +
      "\n\n<i>Ожидаем ответ защитника…</i>",
  );

  const challengeMsg = await ctx.reply(
    formatBattlePickHero(
      challengerName,
      targetUserId,
      defenderName,
      challengerHeroId,
    ),
    {
      parse_mode: "HTML",
      reply_markup: keyboardPickHero(result.battleId, owned.map((h) => h.hero_id)),
      link_preview_options: { is_disabled: true },
      ...(ctx.callbackQuery?.message && "message_id" in ctx.callbackQuery.message
        ? {
            reply_parameters: {
              message_id: ctx.callbackQuery.message.message_id,
            },
          }
        : {}),
    },
  );

  repo.updateBattle(result.battleId, {
    message_id: challengeMsg.message_id,
    message_chat_id: String(challengeMsg.chat.id),
  });

  if (ctx.callbackQuery?.message && "message_id" in ctx.callbackQuery.message) {
    try {
      await ctx.api.editMessageReplyMarkup(
        ctx.callbackQuery.message.chat.id,
        ctx.callbackQuery.message.message_id,
        { reply_markup: keyboardChallengePending(result.battleId) },
      );
    } catch {
      /* ignore */
    }
  }
}

export async function handleBattlePick(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  runner: BattleAutoRunner,
  battleId: number,
  heroId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  const battleRow = repo.getBattle(battleId);
  if (!battleRow || battleRow.defender_id !== uid) {
    await ctx.answerCallbackQuery({
      text: "Выбрать героя может только защитник!",
      show_alert: true,
    });
    return;
  }

  const result = battle.defenderPick(cid, uid, heroId);
  if (!result.ok) {
    await ctx.answerCallbackQuery({ text: "Не удалось выбрать героя" });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Бой начался!" });

  const chName = playerName(repo, cid, battleRow.challenger_id);
  const defName = playerName(repo, cid, battleRow.defender_id);

  await finalizePickMessage(
    ctx,
    `✅ ${formatUserMentionHtml(uid, defName)} принял вызов · бой ниже 👇`,
  );

  const state = result.state;
  const text =
    formatBattleFightHeader(
      battleRow.challenger_id,
      chName,
      battleRow.defender_id,
      defName,
    ) +
    formatBattleMessage(
      state,
      battleRow.challenger_id,
      battleRow.defender_id,
      chName,
      defName,
    );

  const fightMsg = await ctx.reply(text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(ctx.callbackQuery?.message && "message_id" in ctx.callbackQuery.message
      ? {
          reply_parameters: {
            message_id: ctx.callbackQuery.message.message_id,
          },
        }
      : {}),
  });

  repo.updateBattle(battleId, {
    message_id: fightMsg.message_id,
    message_chat_id: String(fightMsg.chat.id),
  });

  runner.start(battleId);
}

function formatBattleEndedMessage(
  testMode: boolean,
  reason?: "cancelled" | "declined" | "timeout",
): string {
  if (reason === "declined") {
    return (
      "🏳 <b>Вызов отклонён</b>\n\n" +
      "<i>Рейтинг, золото и XP не изменились.</i>"
    );
  }
  if (reason === "timeout") {
    return (
      "⏱ <b>Вызов истёк</b>\n\n" +
      "<i>Защитник не ответил вовремя. Рейтинг, золото и XP не изменились.</i>"
    );
  }
  if (testMode) {
    return (
      "🧪 <b>Бой отменён</b> (тест)\n\n" +
      "<i>Рейтинг, золото и XP не изменились.</i>"
    );
  }
  return (
    "🏳 <b>Бой завершён</b>\n\n" +
    "<i>Рейтинг, золото и XP не изменились.</i>"
  );
}

type EndBattleResult =
  | { ok: true; battleRow: NonNullable<ReturnType<Repository["getBattleByChat"]>> }
  | { ok: false; reason: "no_battle" | "not_participant" | "already_finished" };

function tryEndBattle(
  repo: Repository,
  battle: BattleService,
  runner: BattleAutoRunner,
  cid: string,
  uid: string,
  battleId?: number,
): EndBattleResult {
  const battleRow = battleId
    ? repo.getBattle(battleId)
    : repo.getBattleByChat(cid);

  if (!battleRow || battleRow.chat_id !== cid) {
    return { ok: false, reason: "no_battle" };
  }

  if (
    uid !== battleRow.challenger_id &&
    uid !== battleRow.defender_id
  ) {
    return { ok: false, reason: "not_participant" };
  }

  if (battleRow.state === "finished") {
    return { ok: false, reason: "already_finished" };
  }

  runner.stop(battleRow.id);
  battle.clearBattle(cid);
  return { ok: true, battleRow };
}

async function announceBattleEnded(
  ctx: Context,
  battleRow: NonNullable<ReturnType<Repository["getBattleByChat"]>>,
  text: string,
): Promise<void> {
  if (battleRow.message_id && battleRow.message_chat_id) {
    try {
      await ctx.api.editMessageText(
        Number(battleRow.message_chat_id),
        battleRow.message_id,
        text,
        { parse_mode: "HTML" },
      );
      return;
    } catch {
      /* fallback */
    }
  }

  if (ctx.callbackQuery?.message && "message_id" in ctx.callbackQuery.message) {
    try {
      await ctx.editMessageText(text, { parse_mode: "HTML" });
      return;
    } catch {
      /* fallback */
    }
  }

  await ctx.reply(text, { parse_mode: "HTML" });
}

export async function executeEndFight(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  runner: BattleAutoRunner,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const result = tryEndBattle(repo, battle, runner, cid, uid);

  if (!result.ok) {
    const msg =
      result.reason === "no_battle"
        ? "Нет активного боя в этом чате."
        : result.reason === "not_participant"
          ? "Завершить бой могут только его участники."
          : "Бой уже завершён.";
    await ctx.reply(msg);
    return;
  }

  await announceBattleEnded(
    ctx,
    result.battleRow,
    formatBattleEndedMessage(false),
  );
}

export async function handleBattleCancel(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  runner: BattleAutoRunner,
  battleId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const battleRow = repo.getBattle(battleId);

  if (!battleRow || battleRow.chat_id !== cid) {
    await ctx.answerCallbackQuery({ text: "Бой не найден" });
    return;
  }

  if (uid !== battleRow.challenger_id && uid !== battleRow.defender_id) {
    await ctx.answerCallbackQuery({
      text: "Отменить могут только участники боя",
      show_alert: true,
    });
    return;
  }

  if (
    battleRow.state === "pick_defender" &&
    uid !== battleRow.challenger_id
  ) {
    await ctx.answerCallbackQuery({
      text: "Отменить вызов может только инициатор",
      show_alert: true,
    });
    return;
  }

  const result = tryEndBattle(repo, battle, runner, cid, uid, battleId);

  if (!result.ok) {
    await ctx.answerCallbackQuery({ text: "Бой уже завершён" });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Вызов отменён" });
  await announceBattleEnded(
    ctx,
    result.battleRow,
    formatBattleEndedMessage(false, "cancelled"),
  );
}

export async function handleBattleDecline(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  runner: BattleAutoRunner,
  battleId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const battleRow = repo.getBattle(battleId);

  if (!battleRow || battleRow.chat_id !== cid) {
    await ctx.answerCallbackQuery({ text: "Вызов не найден" });
    return;
  }

  if (battleRow.state !== "pick_defender") {
    await ctx.answerCallbackQuery({ text: "Вызов уже неактивен" });
    return;
  }

  if (uid !== battleRow.defender_id) {
    await ctx.answerCallbackQuery({
      text: "Отклонить может только защитник",
      show_alert: true,
    });
    return;
  }

  const result = tryEndBattle(repo, battle, runner, cid, uid, battleId);

  if (!result.ok) {
    await ctx.answerCallbackQuery({ text: "Вызов уже завершён" });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Вызов отклонён" });
  await announceBattleEnded(
    ctx,
    result.battleRow,
    formatBattleEndedMessage(false, "declined"),
  );
}

export async function executeFightCommand(
  ctx: Context,
  battle: BattleService,
  shop: ShopService,
  repo: Repository,
  wallet?: WalletService,
): Promise<void> {
  const mention = ctx.message?.entities?.find((e) => e.type === "text_mention");
  let targetId = mention?.user?.id
    ? String(mention.user.id)
    : undefined;

  if (!targetId && ctx.message?.reply_to_message?.from) {
    targetId = String(ctx.message.reply_to_message.from.id);
  }

  if (!targetId) {
    await executeFightMenu(ctx, battle, shop, repo, wallet);
    return;
  }

  const cid = chatId(ctx);
  const uid = userId(ctx);
  shop.ensureStarterHero(cid, uid);

  if (!hasCombatHeroes(repo, cid, uid)) {
    await ctx.reply("Нет героев для боя. Откройте /shop.");
    return;
  }

  const heroes = repo
    .getPlayerHeroes(cid, uid)
    .filter((h) => getCombatHero(h.hero_id));

  const targetName = playerName(repo, cid, targetId);
  const challengerName = playerName(repo, cid, uid);

  await replyHtml(ctx, formatFightPickHero(challengerName, targetName), {
    reply_markup: keyboardPickHeroForFight(
      heroes.map((h) => h.hero_id),
      targetId,
    ),
  });
}

export async function expirePendingBattle(
  api: Context["api"],
  repo: Repository,
  battle: BattleService,
  runner: BattleAutoRunner,
  battleId: number,
): Promise<void> {
  const battleRow = repo.getBattle(battleId);
  if (!battleRow || battleRow.state !== "pick_defender") return;

  runner.stop(battleId);
  battle.clearBattle(battleRow.chat_id);

  const text = formatBattleEndedMessage(false, "timeout");
  if (battleRow.message_id && battleRow.message_chat_id) {
    try {
      await api.editMessageText(
        Number(battleRow.message_chat_id),
        battleRow.message_id,
        text,
        { parse_mode: "HTML" },
      );
      return;
    } catch {
      /* fallback */
    }
  }

  await api.sendMessage(Number(battleRow.chat_id), text, {
    parse_mode: "HTML",
  });
}
