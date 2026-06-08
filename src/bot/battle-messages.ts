import type { Repository } from "../db/repository.js";
import type { BattleState } from "../game/battle/engine.js";
import {
  formatBattleFightHeader,
  formatBattleMessage,
  formatBattleResult,
} from "../game/battle/format.js";

function playerName(repo: Repository, cid: string, uid: string): string {
  return repo.getPlayerDisplayName(cid, uid);
}

export function buildBattleMessageText(
  repo: Repository,
  battleRow: NonNullable<ReturnType<Repository["getBattle"]>>,
  state: BattleState,
  finished: boolean,
  result?: {
    winnerId?: string;
    winnerMmrDelta?: number;
    loserMmrDelta?: number;
    winnerXpGain?: number;
    loserXpGain?: number;
    winnerGoldGain?: number;
    loserGoldGain?: number;
  },
): string {
  const cid = battleRow.chat_id;
  const chName = playerName(repo, cid, battleRow.challenger_id);
  const defName = playerName(repo, cid, battleRow.defender_id);

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

    return formatBattleResult(
      playerName(repo, cid, result.winnerId),
      playerName(repo, cid, loserId),
      {
        heroId: winnerHeroId,
        level: winnerHero?.level ?? winnerFighter.level,
        xp: winnerHero?.xp ?? 0,
        xpGain: result.winnerXpGain ?? 0,
        points: winnerScore?.points ?? 0,
        pointsDelta: result.winnerMmrDelta ?? 0,
        goldGain: result.winnerGoldGain ?? 0,
      },
      {
        heroId: loserHeroId,
        level: loserHero?.level ?? loserFighter.level,
        xp: loserHero?.xp ?? 0,
        xpGain: result.loserXpGain ?? 0,
        points: loserScore?.points ?? 0,
        pointsDelta: result.loserMmrDelta ?? 0,
        goldGain: result.loserGoldGain ?? 0,
      },
    );
  }

  return (
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
    )
  );
}
