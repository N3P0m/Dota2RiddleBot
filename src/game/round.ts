import type { GeminiClient } from "../ai/gemini.js";
import type { Repository } from "../db/repository.js";
import type { ScoringConfig } from "./scoring.js";
import type { AchievementId } from "./achievements.js";
import type { Title } from "./titles.js";
import {
  formatEmoHintFromSkills,
  parseEmoSkills,
  serializeEmoSkills,
} from "./emo-skills.js";
import { getPresetRiddle } from "./preset-riddles.js";
import { isEmojiRound, type RoundMode } from "./round-mode.js";
import {
  collectAnswerVariants,
  getHeroById,
  isAnswerForHero,
  type Hero,
} from "../heroes/match.js";
import { heroes } from "../heroes/match.js";
import { pickHeroForSession } from "../heroes/pick.js";
import type { RiddleSource } from "../config.js";
import { calculateRoundPoints, type RoundPointsResult } from "./scoring.js";
import { getHeroDifficultyMultiplier } from "./hero-difficulty.js";
import { getTitleByPoints } from "./titles.js";
import { monthKey, weekKey } from "./periods.js";
import {
  checkWinAchievements,
  persistAchievements,
} from "./achievements.js";

export type StartRoundResult =
  | {
      ok: true;
      riddle: string;
      hero: Hero;
      showAnswer?: string;
      mode: RoundMode;
    }
  | { ok: false; reason: "active_round" };

export type AnswerResult =
  | {
      ok: true;
      hero: Hero;
      points: number;
      isWinner: boolean;
      breakdown: RoundPointsResult;
      streakAfter: number;
      pointsAfter: number;
      newTitle?: Title;
      previousTitle: Title;
      unlockedAchievements: AchievementId[];
    }
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
    private scoringConfig: ScoringConfig,
    private riddleSource: RiddleSource,
    private showAnswer: boolean,
    private timeZone: string,
  ) {}

  async startRound(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    mode: RoundMode = "text",
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
    let emoSkillsJson: string | null = null;

    if (mode === "emoji") {
      const pack = await this.gemini.generateEmoRiddlePack(hero);
      riddle = pack.emojis;
      aiVariants = pack.possibleAnswers;
      emoSkillsJson = serializeEmoSkills(pack.skills);
      console.log(`[Game] emo riddle → ${hero.name_en} (${hero.name_ru})`);
    } else if (this.riddleSource === "ai") {
      const pack = await this.gemini.generateRiddlePack(hero);
      riddle = pack.riddle;
      aiVariants = pack.possibleAnswers;
    } else {
      console.log(`[Game] preset riddle → ${hero.name_en} (${hero.name_ru})`);
      riddle = getPresetRiddle(hero);
    }

    const answerVariants = collectAnswerVariants(hero, aiVariants);
    this.repo.createRound(
      chatId,
      hero.id,
      userId,
      riddle,
      answerVariants,
      mode,
      emoSkillsJson,
    );
    this.repo.incrementRiddlesStarted(chatId, userId, username, displayName);

    const answerLabel = `${hero.name_ru} / ${hero.name_en}`;
    return {
      ok: true,
      riddle,
      hero,
      showAnswer: this.showAnswer ? answerLabel : undefined,
      mode,
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

    const elapsedMs = Date.now() - round.started_at;
    const streakBefore = this.repo.getCurrentStreak(chatId, userId);
    const pointsBefore =
      this.repo.getUserScore(chatId, userId)?.points ?? 0;
    const titleBefore = getTitleByPoints(pointsBefore);

    const breakdown = calculateRoundPoints(
      {
        hintsUsed: round.hints_used,
        elapsedMs,
        difficultyMultiplier: getHeroDifficultyMultiplier(hero),
        streakBefore,
      },
      this.scoringConfig,
    );

    this.repo.addWin(
      chatId,
      userId,
      username,
      displayName,
      breakdown.total,
    );
    this.repo.finishRound(chatId, userId);

    const streakAfter = this.repo.updateStreaks(chatId, userId);
    const now = new Date();
    this.repo.recordRoundResult({
      chatId,
      userId,
      heroId: hero.id,
      pointsEarned: breakdown.total,
      hintsUsed: round.hints_used,
      elapsedMs,
      difficultyMultiplier: breakdown.difficultyMultiplier,
      streakAfter,
      periodWeek: weekKey(now, this.timeZone),
      periodMonth: monthKey(now, this.timeZone),
    });

    const pointsAfter = pointsBefore + breakdown.total;
    const unlockedAchievements = checkWinAchievements(this.repo, {
      chatId,
      userId,
      hero,
      hintsUsed: round.hints_used,
      elapsedMs,
      streakAfter,
      pointsAfter,
      breakdown,
    });
    persistAchievements(this.repo, chatId, userId, unlockedAchievements);

    const titleAfter = getTitleByPoints(pointsAfter);
    const newTitle =
      titleAfter.id !== titleBefore.id ? titleAfter : undefined;

    return {
      ok: true,
      hero,
      points: breakdown.total,
      isWinner: true,
      breakdown,
      streakAfter,
      pointsAfter,
      newTitle,
      previousTitle: titleBefore,
      unlockedAchievements,
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

    if (isEmojiRound(round.round_mode)) {
      const skills = parseEmoSkills(round.emo_skills);
      if (skills.length === 0) {
        return { ok: false, reason: "no_round" };
      }
      if (hintNumber > skills.length) {
        const hint = formatEmoHintFromSkills(skills, skills.length);
        return { ok: true, hint, hintNumber: skills.length };
      }
      const hint = formatEmoHintFromSkills(skills, hintNumber);
      this.repo.incrementHints(chatId);
      return { ok: true, hint, hintNumber };
    }

    const previouslyHinted = this.repo.getHintedSkills(chatId);
    const pack = await this.gemini.generateHint(
      hero,
      round.riddle,
      hintNumber,
      previouslyHinted,
    );
    this.repo.incrementHints(chatId);
    this.repo.appendHintedSkill(chatId, pack.skillKey);
    return { ok: true, hint: pack.hint, hintNumber };
  }

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

  getRoundMode(chatId: string): RoundMode {
    const round = this.repo.getRound(chatId);
    return isEmojiRound(round?.round_mode) ? "emoji" : "text";
  }
}
