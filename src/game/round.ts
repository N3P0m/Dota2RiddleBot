import type { GeminiClient } from "../ai/gemini.js";
import type { Repository } from "../db/repository.js";
import { getPresetRiddle } from "./preset-riddles.js";
import {
  collectAnswerVariants,
  getHeroById,
  isAnswerForHero,
  type Hero,
} from "../heroes/match.js";
import { heroes } from "../heroes/match.js";
import { pickHeroForSession } from "../heroes/pick.js";
import type { RiddleSource } from "../config.js";

export type StartRoundResult =
  | { ok: true; riddle: string; hero: Hero; showAnswer?: string }
  | { ok: false; reason: "active_round" };

export type AnswerResult =
  | { ok: true; hero: Hero; points: number; isWinner: boolean }
  | { ok: false; reason: "no_round" | "already_won" | "wrong" };

export type HintResult =
  | { ok: true; hint: string; hintNumber: number }
  | { ok: false; reason: "no_round" | "already_won" };

export type SurrenderResult =
  | { ok: true; hero: Hero }
  | { ok: false; reason: "no_round" | "already_won" };

export class GameService {
  constructor(
    private repo: Repository,
    private gemini: GeminiClient,
    private pointsPerWin: number,
    private riddleSource: RiddleSource,
    private showAnswer: boolean,
  ) {}

  async startRound(
    chatId: string,
    userId: string,
  ): Promise<StartRoundResult> {
    const existing = this.repo.getRound(chatId);
    if (existing && !existing.winner_user_id) {
      return { ok: false, reason: "active_round" };
    }
    if (existing) {
      this.repo.deleteRound(chatId);
    }

    let history = this.repo.getRiddleHeroHistory(chatId);
    const uniqueUsed = new Set(history).size;
    if (uniqueUsed >= heroes.length) {
      this.repo.clearRiddleHeroHistory(chatId);
      history = [];
    }

    const hero = pickHeroForSession(history);
    this.repo.addRiddleHeroToHistory(chatId, hero.id);
    let riddle: string;
    let aiVariants: string[] = [];

    if (this.riddleSource === "ai") {
      const pack = await this.gemini.generateRiddlePack(hero);
      riddle = pack.riddle;
      aiVariants = pack.possibleAnswers;
    } else {
      console.log(`[Game] preset riddle → ${hero.name_en} (${hero.name_ru})`);
      riddle = getPresetRiddle(hero);
    }

    const answerVariants = collectAnswerVariants(hero, aiVariants);
    this.repo.createRound(chatId, hero.id, userId, riddle, answerVariants);

    const answerLabel = `${hero.name_ru} / ${hero.name_en}`;
    return {
      ok: true,
      riddle,
      hero,
      showAnswer: this.showAnswer ? answerLabel : undefined,
    };
  }

  checkAnswer(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    text: string,
  ): AnswerResult {
    const round = this.repo.getRound(chatId);
    if (!round) {
      return { ok: false, reason: "no_round" };
    }

    if (round.winner_user_id) {
      return { ok: false, reason: "already_won" };
    }

    const hero = getHeroById(round.hero_id);
    if (!hero) {
      this.repo.deleteRound(chatId);
      return { ok: false, reason: "no_round" };
    }

    const extra = this.repo.getAnswerVariants(chatId);
    if (!isAnswerForHero(text, hero, extra)) {
      return { ok: false, reason: "wrong" };
    }

    this.repo.addWin(
      chatId,
      userId,
      username,
      displayName,
      this.pointsPerWin,
    );
    this.repo.finishRound(chatId, userId);

    return {
      ok: true,
      hero,
      points: this.pointsPerWin,
      isWinner: true,
    };
  }

  async requestHint(chatId: string): Promise<HintResult> {
    const round = this.repo.getActiveRound(chatId);
    if (!round) {
      const any = this.repo.getRound(chatId);
      if (any?.winner_user_id) {
        return { ok: false, reason: "already_won" };
      }
      return { ok: false, reason: "no_round" };
    }

    const hero = getHeroById(round.hero_id);
    if (!hero || !round.riddle) {
      return { ok: false, reason: "no_round" };
    }

    const hintNumber = round.hints_used + 1;
    const hint = await this.gemini.generateHint(hero, round.riddle, hintNumber);
    this.repo.incrementHints(chatId);
    return { ok: true, hint, hintNumber };
  }

  /** Сдача: показать героя, оставить в истории чата (не выпадет снова). */
  surrenderRound(chatId: string): SurrenderResult {
    const round = this.repo.getActiveRound(chatId);
    if (!round) {
      const any = this.repo.getRound(chatId);
      if (any?.winner_user_id) {
        return { ok: false, reason: "already_won" };
      }
      return { ok: false, reason: "no_round" };
    }

    const hero = getHeroById(round.hero_id);
    if (!hero) {
      this.repo.deleteRound(chatId);
      return { ok: false, reason: "no_round" };
    }

    this.repo.deleteRound(chatId);
    return { ok: true, hero };
  }

  hasActiveRound(chatId: string): boolean {
    return !!this.repo.getActiveRound(chatId);
  }

  hasAnyRound(chatId: string): boolean {
    return !!this.repo.getRound(chatId);
  }

  getRoundStarter(chatId: string): string | null {
    return this.repo.getRound(chatId)?.started_by ?? null;
  }
}
