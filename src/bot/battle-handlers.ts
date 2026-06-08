import type { Context, InlineKeyboard } from "grammy";
import type { BattleService } from "../game/battle/service.js";
import type { ShopService } from "../game/collection/shop.js";
import type { Repository } from "../db/repository.js";
import {
  formatBattleMessage,
  formatBattlePickHero,
  formatBattleResult,
  formatFightPickHero,
} from "../game/battle/format.js";
import {
  keyboardBattleActions,
  keyboardFightOpponents,
  keyboardPickHero,
  keyboardPickHeroForFight,
} from "./keyboards.js";
import { chatId, userId } from "./actions.js";
import { getCombatHero, getItemById } from "../game/catalog/catalog.js";
import { formatActionLabel } from "../game/battle/engine.js";

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

async function editOrReply(
  ctx: Context,
  text: string,
  replyMarkup?: InlineKeyboard,
): Promise<void> {
  if (ctx.callbackQuery?.message) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      return;
    } catch {
      /* fallback */
    }
  }
  await ctx.reply(text, { parse_mode: "HTML", reply_markup: replyMarkup });
}

export async function executeFightMenu(
  ctx: Context,
  battle: BattleService,
  shop: ShopService,
  repo: Repository,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  shop.ensureStarterHero(cid, uid);

  if (battle.hasActiveBattle(cid)) {
    await editOrReply(
      ctx,
      "⏳ В чате уже идёт бой. Дождитесь окончания или /endfight.",
    );
    return;
  }

  if (!hasCombatHeroes(repo, cid, uid)) {
    await editOrReply(ctx, "Нет героев для боя. Откройте /shop и возьмите Пуджа.");
    return;
  }

  const opponents = listFightOpponents(repo, cid, uid);
  if (opponents.length === 0) {
    await editOrReply(
      ctx,
      "В чате пока нет других игроков с героями.\nПусть кто-нибудь откроет /shop — тогда появятся кнопки соперников.",
    );
    return;
  }

  await editOrReply(
    ctx,
    "⚔️ <b>Кого вызываем на бой?</b>\n\n<i>Выберите соперника, затем своего героя.</i>",
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

  await editOrReply(
    ctx,
    formatFightPickHero(targetName, challengerName),
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
    await editOrReply(ctx, "У соперника нет героев для боя.");
    battle.clearBattle(cid);
    return;
  }

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery();
  }

  await editOrReply(
    ctx,
    formatBattlePickHero(challengerName, defenderName, challengerHeroId),
    keyboardPickHero(result.battleId, owned.map((h) => h.hero_id)),
  );
}

async function refreshBattleMessage(
  ctx: Context,
  repo: Repository,
  battleId: number,
  battleRow: NonNullable<ReturnType<Repository["getBattle"]>>,
  state: import("../game/battle/engine.js").BattleState,
  finished: boolean,
  result?: {
    winnerId?: string;
    winnerMmrDelta?: number;
    loserMmrDelta?: number;
    winnerXpGain?: number;
    loserXpGain?: number;
  },
): Promise<void> {
  const cid = chatId(ctx);
  const chName = playerName(repo, cid, battleRow.challenger_id);
  const defName = playerName(repo, cid, battleRow.defender_id);

  let text: string;
  if (finished && result?.winnerId) {
    const loserId =
      result.winnerId === battleRow.challenger_id
        ? battleRow.defender_id
        : battleRow.challenger_id;
    const winnerHeroId =
      result.winnerId === battleRow.challenger_id
        ? state.challenger.heroId
        : state.defender.heroId;
    const loserHeroId =
      loserId === battleRow.challenger_id
        ? state.challenger.heroId
        : state.defender.heroId;

    const winnerFighter =
      result.winnerId === battleRow.challenger_id
        ? state.challenger
        : state.defender;
    const loserFighter =
      result.winnerId === battleRow.challenger_id
        ? state.defender
        : state.challenger;
    const winnerHero = repo.getPlayerHero(cid, result.winnerId, winnerHeroId);
    const loserHero = repo.getPlayerHero(cid, loserId, loserHeroId);
    const winnerScore = repo.getUserScore(cid, result.winnerId);
    const loserScore = repo.getUserScore(cid, loserId);

    text = formatBattleResult(
      playerName(repo, cid, result.winnerId),
      playerName(repo, cid, loserId),
      {
        heroId: winnerHeroId,
        level: winnerHero?.level ?? winnerFighter.level,
        xp: winnerHero?.xp ?? 0,
        xpGain: result.winnerXpGain ?? 0,
        points: winnerScore?.points ?? 0,
        pointsDelta: result.winnerMmrDelta ?? 0,
      },
      {
        heroId: loserHeroId,
        level: loserHero?.level ?? loserFighter.level,
        xp: loserHero?.xp ?? 0,
        xpGain: result.loserXpGain ?? 0,
        points: loserScore?.points ?? 0,
        pointsDelta: result.loserMmrDelta ?? 0,
      },
    );
  } else {
    text = formatBattleMessage(
      state,
      battleRow.challenger_id,
      battleRow.defender_id,
      chName,
      defName,
    );
  }

  const markup = finished
    ? undefined
    : keyboardBattleActions(
        battleId,
        state.challenger.heroId,
        state.defender.heroId,
        state.challenger.battleItems,
        state.defender.battleItems,
        state.challenger.pendingItemId,
        state.defender.pendingItemId,
      );

  const msgChat = battleRow.message_chat_id ?? cid;
  const msgId = battleRow.message_id;

  if (msgId) {
    try {
      await ctx.api.editMessageText(Number(msgChat), msgId, text, {
        parse_mode: "HTML",
        reply_markup: markup,
      });
      return;
    } catch {
      /* new message */
    }
  }

  const newMsg = await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: markup,
  });
  repo.updateBattle(battleId, {
    message_id: newMsg.message_id,
    message_chat_id: String(newMsg.chat.id),
  });
}

export async function handleBattlePick(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
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

  await ctx.answerCallbackQuery();

  const state = result.state;
  const chName = playerName(repo, cid, battleRow.challenger_id);
  const defName = playerName(repo, cid, battleRow.defender_id);

  const msg = await ctx.editMessageText(
    formatBattleMessage(
      state,
      battleRow.challenger_id,
      battleRow.defender_id,
      chName,
      defName,
    ),
    {
      parse_mode: "HTML",
      reply_markup: keyboardBattleActions(
        battleId,
        state.challenger.heroId,
        state.defender.heroId,
        state.challenger.battleItems,
        state.defender.battleItems,
        state.challenger.pendingItemId,
        state.defender.pendingItemId,
      ),
    },
  );

  const message = msg === true ? ctx.callbackQuery?.message : msg;
  if (message && "message_id" in message) {
    repo.updateBattle(battleId, {
      message_id: message.message_id,
      message_chat_id: String(message.chat.id),
    });
  }
}

export async function handleBattleItemUse(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  battleId: number,
  itemId: number,
  side: "ch" | "def",
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  const battleRow = repo.getBattle(battleId);
  if (!battleRow) {
    await ctx.answerCallbackQuery({ text: "Бой не найден" });
    return;
  }

  const ownerId =
    side === "ch" ? battleRow.challenger_id : battleRow.defender_id;
  if (uid !== ownerId) {
    await ctx.answerCallbackQuery({
      text: "Это не ваши кнопки!",
      show_alert: true,
    });
    return;
  }

  const result = battle.submitItemUse(cid, uid, itemId);
  if (!result.ok) {
    const msgs: Record<string, string> = {
      turn_locked: "Ход уже зафиксирован скиллом",
      invalid_item: "Предмет недоступен",
      no_battle: "Бой не найден",
      not_participant: "Вы не в бою",
    };
    await ctx.answerCallbackQuery({
      text: msgs[result.reason] ?? result.reason,
    });
    return;
  }

  const item = getItemById(itemId);
  await ctx.answerCallbackQuery({
    text: `Выбран: ${item?.name_ru ?? "предмет"} · выберите скилл`,
  });

  await refreshBattleMessage(
    ctx,
    repo,
    battleId,
    battleRow,
    result.state,
    false,
  );
}

export async function handleBattleAction(
  ctx: Context,
  battle: BattleService,
  repo: Repository,
  battleId: number,
  action: string,
  side: "ch" | "def",
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);

  const battleRow = repo.getBattle(battleId);
  if (!battleRow) {
    await ctx.answerCallbackQuery({ text: "Бой не найден" });
    return;
  }

  const ownerId =
    side === "ch" ? battleRow.challenger_id : battleRow.defender_id;
  if (uid !== ownerId) {
    await ctx.answerCallbackQuery({
      text: "Это не ваши кнопки!",
      show_alert: true,
    });
    return;
  }

  const battleAction = action as "attack" | "Q" | "W" | "E" | "R";
  const result = battle.submitAction(cid, uid, battleAction);
  if (!result.ok) {
    const msgs: Record<string, string> = {
      already_picked: "Вы уже выбрали скилл",
      no_battle: "Бой не найден",
      not_participant: "Вы не в бою",
    };
    await ctx.answerCallbackQuery({
      text: msgs[result.reason] ?? result.reason,
    });
    return;
  }

  const state = result.state;
  const fighter =
    uid === battleRow.challenger_id ? state.challenger : state.defender;
  const actionLabel = formatActionLabel(fighter.heroId, battleAction);

  const bothPicked =
    state.challenger.pendingAction != null &&
    state.defender.pendingAction != null;

  if (result.finished) {
    await ctx.answerCallbackQuery({ text: "Бой!" });
  } else if (bothPicked) {
    await ctx.answerCallbackQuery({ text: "Оба готовы!" });
  } else {
    let toast = `Ваш выбор: ${actionLabel}`;
    if (fighter.pendingItemId != null) {
      const item = getItemById(fighter.pendingItemId);
      toast = `${item?.name_ru ?? "Предмет"} → ${actionLabel}`;
    }
    await ctx.answerCallbackQuery({
      text: `${toast} · ждём соперника`,
    });
  }

  await refreshBattleMessage(ctx, repo, battleId, battleRow, state, result.finished, {
    winnerId: result.winnerId,
    winnerMmrDelta: result.winnerMmrDelta,
    loserMmrDelta: result.loserMmrDelta,
    winnerXpGain: result.winnerXpGain,
    loserXpGain: result.loserXpGain,
  });
}

function formatBattleEndedMessage(testMode: boolean): string {
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
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const result = tryEndBattle(repo, battle, cid, uid);

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
  battleId: number,
): Promise<void> {
  const cid = chatId(ctx);
  const uid = userId(ctx);
  const result = tryEndBattle(repo, battle, cid, uid, battleId);

  if (!result.ok) {
    const alertText =
      result.reason === "no_battle"
        ? "Бой не найден"
        : result.reason === "not_participant"
          ? "Отменить могут только участники боя"
          : "Бой уже завершён";
    await ctx.answerCallbackQuery({
      text: alertText,
      show_alert: result.reason === "not_participant",
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Бой отменён" });
  await announceBattleEnded(
    ctx,
    result.battleRow,
    formatBattleEndedMessage(true),
  );
}

export async function executeFightCommand(
  ctx: Context,
  battle: BattleService,
  shop: ShopService,
  repo: Repository,
): Promise<void> {
  const mention = ctx.message?.entities?.find((e) => e.type === "text_mention");
  let targetId = mention?.user?.id
    ? String(mention.user.id)
    : undefined;

  if (!targetId && ctx.message?.reply_to_message?.from) {
    targetId = String(ctx.message.reply_to_message.from.id);
  }

  if (!targetId) {
    await executeFightMenu(ctx, battle, shop, repo);
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

  await ctx.reply(formatFightPickHero(targetName, challengerName), {
    parse_mode: "HTML",
    reply_markup: keyboardPickHeroForFight(
      heroes.map((h) => h.hero_id),
      targetId,
    ),
  });
}
