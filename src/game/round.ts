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
import { getPresetItemRiddle } from "./preset-item-riddles.js";
import { isEmojiRound, type RoundMode } from "./round-mode.js";
import {
  collectAnswerVariants,
  getHeroById,
  isAnswerForHero,
  type Hero,
} from "../heroes/match.js";
import { heroes } from "../heroes/match.js";
import {
  collectItemAnswerVariants,
  getItemById,
  getRandomItem,
  isAnswerForItem,
  type Item,
} from "../items/match.js";
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
import type { WalletService } from "./economy/wallet.js";
import {
  calculateGoldWinReward,
  type GoldWinResult,
  type GoldConfig,
} from "./economy/gold-rewards.js";
import { recordChatUnlockOnWin } from "./collection/unlocks.js";
import { getMvpHeroIds } from "./catalog/catalog.js";

const MVP_HERO_ID_SET = new Set(getMvpHeroIds());
const SHOP_HERO_POOL = heroes.filter((h) => MVP_HERO_ID_SET.has(h.id));

export type StartRoundResult =
  | {
      ok: true;
      riddle: string;
      hero?: Hero;
      item?: Item;
      targetType: "hero" | "item";
      showAnswer?: string;
      mode: RoundMode;
    }
  | { ok: false; reason: "active_round" };

export type AnswerResult =
  | {
      ok: true;
      hero?: Hero;
      item?: Item;
      targetType: "hero" | "item";
      points: number;
      goldEarned: number;
      goldBreakdown: GoldWinResult;
      goldAfter: number;
      isWinner: boolean;
      breakdown: RoundPointsResult;
      streakAfter: number;
      pointsAfter: number;
      newTitle?: Title;
      previousTitle: Title;
      unlockedAchievements: AchievementId[];
      unlockProgress?: { guessCount: number; required: number; newlyUnlocked: boolean };
    }
  | { ok: false; reason: "no_round" | "already_won" | "wrong" };

export type HintResult =
  | { ok: true; hint: string; hintNumber: number }
  | {
      ok: false;
      reason: "no_round" | "already_won" | "insufficient_gold";
      requiredGold?: number;
    };

export type SurrenderResult =
  | { ok: true; hero?: Hero; item?: Item; targetType: "hero" | "item" }
  | { ok: false; reason: "no_round" | "already_won" };

export class GameService {
  constructor(
    private repo: Repository,
    private gemini: GeminiClient,
    private scoringConfig: ScoringConfig,
    private goldConfig: GoldConfig,
    private wallet: WalletService,
    private riddleSource: RiddleSource,
    private showAnswer: boolean,
    private timeZone: string,
    private riddleItemChance: number,
    private goldHintBuyCost: number,
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

    const isItemRound =
      mode === "text" && Math.random() < this.riddleItemChance;

    if (isItemRound) {
      return this.startItemRound(chatId, userId, username, displayName);
    }

    let history = this.repo.getRiddleHeroHistory(chatId);
    const uniqueUsed = new Set(history).size;
    if (uniqueUsed >= SHOP_HERO_POOL.length) {
      this.repo.clearRiddleHeroHistory(chatId);
      history = [];
    }

    const hero = pickHeroForSession(history, SHOP_HERO_POOL);
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
      "hero",
    );
    this.repo.incrementRiddlesStarted(chatId, userId, username, displayName);

    const answerLabel = `${hero.name_ru} / ${hero.name_en}`;
    return {
      ok: true,
      riddle,
      hero,
      targetType: "hero",
      showAnswer: this.showAnswer ? answerLabel : undefined,
      mode,
    };
  }

  private async startItemRound(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
  ): Promise<StartRoundResult> {
    const item = getRandomItem();
    const riddle = getPresetItemRiddle(item);
    const answerVariants = collectItemAnswerVariants(item);
    this.repo.createRound(
      chatId,
      item.id,
      userId,
      riddle,
      answerVariants,
      "text",
      null,
      "item",
    );
    this.repo.incrementRiddlesStarted(chatId, userId, username, displayName);
    console.log(`[Game] item riddle → ${item.name_en} (${item.name_ru})`);

    const answerLabel = `${item.name_ru} / ${item.name_en}`;
    return {
      ok: true,
      riddle,
      item,
      targetType: "item",
      showAnswer: this.showAnswer ? answerLabel : undefined,
      mode: "text",
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

    const targetType = (round.target_type ?? "hero") as "hero" | "item";
    const extra = this.repo.getAnswerVariants(chatId);

    if (targetType === "item") {
      return this.checkItemAnswer(
        chatId,
        userId,
        username,
        displayName,
        text,
        round,
        extra,
      );
    }

    const hero = getHeroById(round.hero_id);
    if (!hero) {
      this.repo.deleteRound(chatId);
      return { ok: false, reason: "no_round" };
    }

    if (!isAnswerForHero(text, hero, extra)) {
      return { ok: false, reason: "wrong" };
    }

    return this.processWin(chatId, userId, username, displayName, round, hero, "hero");
  }

  private checkItemAnswer(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    text: string,
    round: { hero_id: number; hints_used: number; started_at: number },
    extra: string[],
  ): AnswerResult {
    const item = getItemById(round.hero_id);
    if (!item) {
      this.repo.deleteRound(chatId);
      return { ok: false, reason: "no_round" };
    }

    if (!isAnswerForItem(text, item, extra)) {
      return { ok: false, reason: "wrong" };
    }

    return this.processWin(chatId, userId, username, displayName, round, item, "item");
  }

  private processWin(
    chatId: string,
    userId: string,
    username: string | null,
    displayName: string,
    round: { hero_id: number; hints_used: number; started_at: number },
    entity: Hero | Item,
    targetType: "hero" | "item",
  ): AnswerResult {
    const elapsedMs = Date.now() - round.started_at;
    const streakBefore = this.repo.getCurrentStreak(chatId, userId);
    const pointsBefore =
      this.repo.getUserScore(chatId, userId)?.points ?? 0;
    const titleBefore = getTitleByPoints(pointsBefore);

    const difficultyMultiplier =
      targetType === "hero"
        ? getHeroDifficultyMultiplier(entity as Hero)
        : 1;

    const breakdown = calculateRoundPoints(
      {
        hintsUsed: round.hints_used,
        elapsedMs,
        difficultyMultiplier,
        streakBefore,
      },
      this.scoringConfig,
    );

    const goldBreakdown = calculateGoldWinReward(
      {
        hintsUsed: round.hints_used,
        elapsedMs,
        difficultyMultiplier,
      },
      this.goldConfig,
    );

    this.wallet.credit(
      userId,
      goldBreakdown.total,
      "win",
      chatId,
      String(round.hero_id),
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

    if (targetType === "hero") {
      this.repo.recordRoundResult({
        chatId,
        userId,
        heroId: round.hero_id,
        pointsEarned: breakdown.total,
        hintsUsed: round.hints_used,
        elapsedMs,
        difficultyMultiplier: breakdown.difficultyMultiplier,
        streakAfter,
        periodWeek: weekKey(now, this.timeZone),
        periodMonth: monthKey(now, this.timeZone),
      });
    }

    const pointsAfter = pointsBefore + breakdown.total;
    const goldAfter = this.wallet.getWallet(userId).gold;

    let unlockProgress:
      | { guessCount: number; required: number; newlyUnlocked: boolean }
      | undefined;

    unlockProgress = recordChatUnlockOnWin(
      this.repo,
      chatId,
      targetType,
      round.hero_id,
    );

    const unlockedAchievements =
      targetType === "hero"
        ? checkWinAchievements(this.repo, {
            chatId,
            userId,
            hero: entity as Hero,
            hintsUsed: round.hints_used,
            elapsedMs,
            streakAfter,
            pointsAfter,
            breakdown,
          })
        : [];
    persistAchievements(this.repo, chatId, userId, unlockedAchievements);

    const titleAfter = getTitleByPoints(pointsAfter);
    const newTitle =
      titleAfter.id !== titleBefore.id ? titleAfter : undefined;

    return {
      ok: true,
      hero: targetType === "hero" ? (entity as Hero) : undefined,
      item: targetType === "item" ? (entity as Item) : undefined,
      targetType,
      points: breakdown.total,
      goldEarned: goldBreakdown.total,
      goldBreakdown,
      goldAfter,
      isWinner: true,
      breakdown,
      streakAfter,
      pointsAfter,
      newTitle,
      previousTitle: titleBefore,
      unlockedAchievements,
      unlockProgress,
    };
  }

  async requestHint(
    chatId: string,
    userId: string,
  ): Promise<HintResult> {
    const round = this.repo.getActiveRound(chatId);
    if (!round) {
      const any = this.repo.getRound(chatId);
      if (any?.winner_user_id) {
        return { ok: false, reason: "already_won" };
      }
      return { ok: false, reason: "no_round" };
    }

    const debit = this.wallet.debit(
      userId,
      this.goldHintBuyCost,
      "hint_buy",
      chatId,
    );
    if (!debit.ok) {
      return {
        ok: false,
        reason: "insufficient_gold",
        requiredGold: this.goldHintBuyCost,
      };
    }

    const targetType = (round.target_type ?? "hero") as "hero" | "item";
    const hintNumber = round.hints_used + 1;

    if (isEmojiRound(round.round_mode)) {
      const skills = parseEmoSkills(round.emo_skills);
      if (skills.length === 0) {
        this.wallet.credit(userId, this.goldHintBuyCost, "hint_refund", chatId);
        return { ok: false, reason: "no_round" };
      }
      let hint: string;
      if (hintNumber > skills.length) {
        hint = formatEmoHintFromSkills(skills, skills.length);
        return { ok: true, hint, hintNumber: skills.length };
      }
      hint = formatEmoHintFromSkills(skills, hintNumber);
      this.repo.incrementHints(chatId);
      this.repo.appendHintPayer(chatId, userId, hintNumber);
      return { ok: true, hint, hintNumber };
    }

    if (targetType === "item") {
      const item = getItemById(round.hero_id);
      if (!item) {
        this.wallet.credit(userId, this.goldHintBuyCost, "hint_refund", chatId);
        return { ok: false, reason: "no_round" };
      }
      const hint = this.fallbackItemHint(item, hintNumber);
      this.repo.incrementHints(chatId);
      this.repo.appendHintPayer(chatId, userId, hintNumber);
      return { ok: true, hint, hintNumber };
    }

    const hero = getHeroById(round.hero_id);
    if (!hero || !round.riddle) {
      this.wallet.credit(userId, this.goldHintBuyCost, "hint_refund", chatId);
      return { ok: false, reason: "no_round" };
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
    this.repo.appendHintPayer(chatId, userId, hintNumber);
    return { ok: true, hint: pack.hint, hintNumber };
  }

  private fallbackItemHint(item: Item, hintNumber: number): string {
    const hints = [
      `Предмет из лавки, tier ${item.tier}.`,
      `Стоит около ${item.price} золота в магазине.`,
      `Русское название начинается на «${item.name_ru.slice(0, 2)}…»`,
    ];
    return hints[Math.min(hintNumber - 1, hints.length - 1)]!;
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

    const targetType = (round.target_type ?? "hero") as "hero" | "item";

    if (targetType === "item") {
      const item = getItemById(round.hero_id);
      if (!item) {
        this.repo.deleteRound(chatId);
        return { ok: false, reason: "no_round" };
      }
      this.repo.deleteRound(chatId);
      return { ok: true, item, targetType: "item" };
    }

    const hero = getHeroById(round.hero_id);
    if (!hero) {
      this.repo.deleteRound(chatId);
      return { ok: false, reason: "no_round" };
    }

    this.repo.deleteRound(chatId);
    return { ok: true, hero, targetType: "hero" };
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

  getHintBuyCost(): number {
    return this.goldHintBuyCost;
  }
}
