import type { Api } from "grammy";
import type { Repository } from "../db/repository.js";
import type { BattleService } from "../game/battle/service.js";
import type { BattleState } from "../game/battle/engine.js";
import type { AchievementId } from "../game/achievements.js";
import { config } from "../config.js";
import { buildBattleMessageText } from "./battle-messages.js";
import { keyboardAfterBattle } from "./keyboards.js";
import { formatAchievementMessages } from "./format.js";

export const BATTLE_TICK_MS = 2000;

export class BattleAutoRunner {
  private timers = new Map<number, NodeJS.Timeout>();

  constructor(
    private api: Api,
    private repo: Repository,
    private battle: BattleService,
  ) {}

  start(battleId: number): void {
    this.stop(battleId);
    const timer = setInterval(() => {
      void this.tick(battleId);
    }, BATTLE_TICK_MS);
    this.timers.set(battleId, timer);
  }

  stop(battleId: number): void {
    const timer = this.timers.get(battleId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(battleId);
    }
  }

  stopByChat(chatId: string): void {
    const row = this.repo.getBattleByChat(chatId);
    if (row) this.stop(row.id);
  }

  stopAll(): void {
    for (const id of this.timers.keys()) {
      this.stop(id);
    }
  }

  resumeActive(): void {
    for (const row of this.repo.listActiveBattles()) {
      this.start(row.id);
    }
  }

  private async tick(battleId: number): Promise<void> {
    const battleRow = this.repo.getBattle(battleId);
    if (!battleRow || battleRow.state !== "active") {
      this.stop(battleId);
      return;
    }

    const result = this.battle.advanceAutoTurn(battleRow.chat_id);
    if (!result.ok) {
      this.stop(battleId);
      return;
    }

    await this.pushBattleUpdate(
      battleRow,
      result.state,
      result.finished,
      result.finished
        ? {
            winnerId: result.winnerId,
            winnerMmrDelta: result.winnerMmrDelta,
            loserMmrDelta: result.loserMmrDelta,
            winnerXpGain: result.winnerXpGain,
            loserXpGain: result.loserXpGain,
            winnerGoldGain: result.winnerGoldGain,
            loserGoldGain: result.loserGoldGain,
            unlockedAchievements: result.unlockedAchievements,
          }
        : undefined,
    );

    if (result.finished) {
      this.stop(battleId);
    }
  }

  async pushBattleUpdate(
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
      unlockedAchievements?: AchievementId[];
    },
  ): Promise<void> {
    const text = buildBattleMessageText(
      this.repo,
      battleRow,
      state,
      finished,
      result,
    );

    const msgChat = battleRow.message_chat_id;
    const msgId = battleRow.message_id;
    if (!msgChat || !msgId) return;

    try {
      await this.api.editMessageText(Number(msgChat), msgId, text, {
        parse_mode: "HTML",
        reply_markup: finished ? keyboardAfterBattle() : undefined,
      });
    } catch {
      /* message unchanged or too old */
    }

    if (
      finished &&
      config.achievementsAnnounce &&
      result?.unlockedAchievements &&
      result.unlockedAchievements.length > 0 &&
      result.winnerId
    ) {
      const winnerName = this.repo.getPlayerDisplayName(
        battleRow.chat_id,
        result.winnerId,
      );
      const messages = formatAchievementMessages(
        winnerName,
        result.unlockedAchievements,
      );
      for (const msg of messages) {
        await this.api.sendMessage(Number(battleRow.chat_id), msg, {
          parse_mode: "HTML",
        });
      }
    }
  }
}
