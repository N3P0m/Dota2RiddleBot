import type { Repository } from "../../db/repository.js";
import { getCombatHero } from "../catalog/catalog.js";
import {
  persistAchievements,
  type AchievementId,
} from "../achievements.js";
import {
  createFighter,
  initBattle,
  resolveTurn,
  setPendingAction,
  setPendingItem,
  bothReady,
  type BattleAction,
  type BattleItemState,
  type BattleState,
  type FighterState,
} from "./engine.js";
import { calculateMmrDelta } from "./mmr.js";

export const XP_WIN = 40;
export const XP_LOSS = 15;

export type BattleStartResult =
  | { ok: true; battleId: number; needsDefenderPick: true }
  | { ok: true; battleId: number; state: BattleState }
  | { ok: false; reason: "active" | "no_hero" | "self" | "not_in_combat" };

export class BattleService {
  constructor(
    private repo: Repository,
    private kFactor: number,
  ) {}

  hasActiveBattle(chatId: string): boolean {
    const b = this.repo.getBattleByChat(chatId);
    return !!b && b.state !== "finished";
  }

  private loadBattleItems(
    chatId: string,
    userId: string,
  ): BattleItemState[] {
    return this.repo
      .getPlayerItemSlots(chatId, userId)
      .filter((s) => s.uses_remaining > 0)
      .map((s) => ({
        itemId: s.item_id,
        usesRemaining: s.uses_remaining,
      }));
  }

  private syncItemUsesFromBattle(
    chatId: string,
    userId: string,
    fighter: FighterState,
  ): void {
    const dbSlots = this.repo.getPlayerItemSlots(chatId, userId);
    const battleById = new Map(
      fighter.battleItems.map((i) => [i.itemId, i.usesRemaining]),
    );

    for (const slot of dbSlots) {
      const remaining = battleById.get(slot.item_id);
      if (remaining == null || remaining <= 0) {
        this.repo.removePlayerItemSlot(chatId, userId, slot.item_id);
      } else {
        this.repo.updateItemUses(chatId, userId, slot.item_id, remaining);
      }
    }
  }

  startChallenge(
    chatId: string,
    challengerId: string,
    defenderId: string,
    challengerHeroId: number,
  ): BattleStartResult {
    if (challengerId === defenderId) {
      return { ok: false, reason: "self" };
    }

    if (this.hasActiveBattle(chatId)) {
      return { ok: false, reason: "active" };
    }

    this.repo.deleteBattle(chatId);

    const owned = this.repo.getPlayerHero(chatId, challengerId, challengerHeroId);
    if (!owned) return { ok: false, reason: "no_hero" };

    if (!getCombatHero(challengerHeroId)) {
      return { ok: false, reason: "not_in_combat" };
    }

    const challengerFighter = createFighter(
      challengerId,
      challengerHeroId,
      owned.level,
      this.loadBattleItems(chatId, challengerId),
    );
    if (!challengerFighter) return { ok: false, reason: "not_in_combat" };

    const pending = {
      challengerHeroId,
      challengerFighter,
    };

    const battle = this.repo.createBattle(
      chatId,
      challengerId,
      defenderId,
      "pick_defender",
      JSON.stringify(pending),
    );

    return { ok: true, battleId: battle.id, needsDefenderPick: true };
  }

  defenderPick(
    chatId: string,
    defenderId: string,
    heroId: number,
  ):
    | { ok: true; state: BattleState; battleId: number }
    | { ok: false; reason: string } {
    const battle = this.repo.getBattleByChat(chatId);
    if (!battle || battle.state !== "pick_defender") {
      return { ok: false, reason: "no_battle" };
    }
    if (battle.defender_id !== defenderId) {
      return { ok: false, reason: "not_defender" };
    }

    const owned = this.repo.getPlayerHero(chatId, defenderId, heroId);
    if (!owned) return { ok: false, reason: "no_hero" };
    if (!getCombatHero(heroId)) return { ok: false, reason: "not_in_combat" };

    const pending = JSON.parse(battle.state_json) as {
      challengerHeroId: number;
      challengerFighter: ReturnType<typeof createFighter>;
    };

    const defenderFighter = createFighter(
      defenderId,
      heroId,
      owned.level,
      this.loadBattleItems(chatId, defenderId),
    );
    if (!defenderFighter || !pending.challengerFighter) {
      return { ok: false, reason: "init_failed" };
    }

    const state = initBattle(pending.challengerFighter, defenderFighter);
    this.repo.updateBattle(battle.id, {
      state: "active",
      state_json: JSON.stringify(state),
      turn: 1,
    });

    return { ok: true, state, battleId: battle.id };
  }

  submitItemUse(
    chatId: string,
    userId: string,
    itemId: number,
  ): { ok: true; state: BattleState } | { ok: false; reason: string } {
    const battle = this.repo.getBattleByChat(chatId);
    if (!battle || battle.state !== "active") {
      return { ok: false, reason: "no_battle" };
    }

    if (
      userId !== battle.challenger_id &&
      userId !== battle.defender_id
    ) {
      return { ok: false, reason: "not_participant" };
    }

    const state = JSON.parse(battle.state_json) as BattleState;
    const fighter =
      state.challenger.userId === userId
        ? state.challenger
        : state.defender;

    if (fighter.pendingAction != null) {
      return { ok: false, reason: "turn_locked" };
    }

    if (!setPendingItem(state, userId, itemId)) {
      return { ok: false, reason: "invalid_item" };
    }

    this.repo.updateBattle(battle.id, {
      state_json: JSON.stringify(state),
    });

    return { ok: true, state };
  }

  submitAction(
    chatId: string,
    userId: string,
    action: BattleAction,
  ):
    | {
        ok: true;
        state: BattleState;
        finished: boolean;
        winnerId?: string;
        winnerMmrDelta?: number;
        loserMmrDelta?: number;
        winnerXpGain?: number;
        loserXpGain?: number;
      }
    | { ok: false; reason: string } {
    const battle = this.repo.getBattleByChat(chatId);
    if (!battle || battle.state !== "active") {
      return { ok: false, reason: "no_battle" };
    }

    if (
      userId !== battle.challenger_id &&
      userId !== battle.defender_id
    ) {
      return { ok: false, reason: "not_participant" };
    }

    const state = JSON.parse(battle.state_json) as BattleState;
    if (!setPendingAction(state, userId, action)) {
      return { ok: false, reason: "already_picked" };
    }

    if (!bothReady(state)) {
      this.repo.updateBattle(battle.id, {
        state_json: JSON.stringify(state),
      });
      return { ok: true, state, finished: false };
    }

    const result = resolveTurn(state);
    this.syncItemUsesFromBattle(
      chatId,
      battle.challenger_id,
      result.state.challenger,
    );
    this.syncItemUsesFromBattle(
      chatId,
      battle.defender_id,
      result.state.defender,
    );

    this.repo.updateBattle(battle.id, {
      state_json: JSON.stringify(result.state),
      turn: result.state.turn,
    });

    let winnerMmrDelta: number | undefined;
    let loserMmrDelta: number | undefined;
    let winnerXpGain: number | undefined;
    let loserXpGain: number | undefined;
    if (result.finished && result.winnerId) {
      const finish = this.finishBattle(chatId, battle.id, result.winnerId);
      winnerMmrDelta = finish.winnerDelta;
      loserMmrDelta = finish.loserDelta;
      winnerXpGain = finish.winnerXpGain;
      loserXpGain = finish.loserXpGain;
    }

    return {
      ok: true,
      state: result.state,
      finished: result.finished,
      winnerId: result.winnerId,
      winnerMmrDelta,
      loserMmrDelta,
      winnerXpGain,
      loserXpGain,
    };
  }

  private finishBattle(
    chatId: string,
    battleId: number,
    winnerId: string,
  ): {
    winnerDelta: number;
    loserDelta: number;
    winnerXpGain: number;
    loserXpGain: number;
  } {
    const battle = this.repo.getBattle(battleId)!;
    const loserId =
      winnerId === battle.challenger_id
        ? battle.defender_id
        : battle.challenger_id;

    const winnerPoints = this.repo.getUserScore(chatId, winnerId)?.points ?? 0;
    const loserPoints = this.repo.getUserScore(chatId, loserId)?.points ?? 0;
    const { winnerDelta, loserDelta } = calculateMmrDelta(
      winnerPoints,
      loserPoints,
      this.kFactor,
    );

    const winnerName = this.repo.getPlayerDisplayName(chatId, winnerId);
    const loserName = this.repo.getPlayerDisplayName(chatId, loserId);
    this.repo.adjustPoints(chatId, winnerId, null, winnerName, winnerDelta);
    this.repo.adjustPoints(chatId, loserId, null, loserName, loserDelta);

    const state = JSON.parse(battle.state_json) as BattleState;
    const winnerHeroId =
      winnerId === battle.challenger_id
        ? state.challenger.heroId
        : state.defender.heroId;

    this.repo.addHeroXp(chatId, winnerId, winnerHeroId, XP_WIN);
    const loserHeroId =
      loserId === battle.challenger_id
        ? state.challenger.heroId
        : state.defender.heroId;
    this.repo.addHeroXp(chatId, loserId, loserHeroId, XP_LOSS);

    const unlocked: AchievementId[] = [];
    const existing = new Set(
      this.repo
        .getUserAchievements(chatId, winnerId)
        .map((a) => a.achievement_id),
    );
    if (!existing.has("battle_first")) unlocked.push("battle_first");
    if (this.repo.getPlayerHeroes(chatId, winnerId).length >= 5) {
      if (!existing.has("collector_5")) unlocked.push("collector_5");
    }
    persistAchievements(this.repo, chatId, winnerId, unlocked);

    this.repo.deleteBattle(chatId);

    return {
      winnerDelta,
      loserDelta,
      winnerXpGain: XP_WIN,
      loserXpGain: XP_LOSS,
    };
  }

  getRatingDelta(
    chatId: string,
    winnerId: string,
    loserId: string,
  ): { winnerDelta: number; loserDelta: number } {
    const winnerPoints = this.repo.getUserScore(chatId, winnerId)?.points ?? 0;
    const loserPoints = this.repo.getUserScore(chatId, loserId)?.points ?? 0;
    return calculateMmrDelta(winnerPoints, loserPoints, this.kFactor);
  }

  clearBattle(chatId: string): void {
    this.repo.deleteBattle(chatId);
  }
}
