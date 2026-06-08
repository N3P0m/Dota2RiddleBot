import type { GeminiClient } from "../ai/gemini.js";
import type { Repository } from "../db/repository.js";
import { todayKey } from "./nick-date.js";

export type TauntContext = {
  wrongGuesses: number;
  hintsUsed: number;
  tauntsSent: number;
};

/** Шанс обзывательства растёт с подсказками и промахами. */
export function calcTauntChance(ctx: TauntContext): number {
  const { wrongGuesses, hintsUsed } = ctx;
  if (hintsUsed < 1 && wrongGuesses < 1) return 0;

  let chance = 0;

  // Подсказки: с первой уже давит, каждая следующая сильнее
  if (hintsUsed >= 1) {
    chance += 0.08 + (hintsUsed - 1) * 0.14;
  }

  // Промахи: первый слабый, дальше нарастает
  if (wrongGuesses >= 2) {
    chance += 0.1 + (wrongGuesses - 2) * 0.12;
  } else if (wrongGuesses === 1) {
    chance += 0.15;
  }

  return Math.min(0.85, chance);
}

export class InsultService {
  constructor(
    private repo: Repository,
    private gemini: GeminiClient,
    private timeZone: string,
    private maxPool: number,
    private dailyBatch: number,
    private enabled: boolean,
  ) {}

  /** При старте раунда: раз в день +20 в пул (макс. 300). */
  async ensureDailyRefill(): Promise<void> {
    if (!this.enabled) return;

    const date = todayKey(this.timeZone);
    if (this.repo.hasInsultRefillToday(date)) return;

    const current = this.repo.countInsults();
    if (current >= this.maxPool) {
      this.repo.markInsultRefillToday(date, 0);
      console.log(`[Insult] Pool full (${current}), skip refill`);
      return;
    }

    const toAdd = Math.min(this.dailyBatch, this.maxPool - current);
    const exclude = this.repo.getAllInsultTexts();
    const batch = await this.gemini.generateInsultBatch(
      date,
      `insult-${date}-${Date.now()}`,
      toAdd,
      exclude,
    );

    const added = this.repo.addInsults(batch);
    this.repo.markInsultRefillToday(date, added);
    console.log(`[Insult] Daily refill: +${added} (pool ${current + added}/${this.maxPool})`);
  }

  /** Бросок: вернуть обзывательство или null. */
  rollTaunt(chatId: string, ctx: TauntContext): string | null {
    if (!this.enabled) return null;
    if (ctx.tauntsSent >= 3) return null;

    const chance = calcTauntChance(ctx);
    if (chance <= 0 || Math.random() > chance) return null;

    const insult = this.repo.pickRandomInsult(chatId);
    if (!insult) return null;

    this.repo.incrementRoundTaunts(chatId);
    return insult;
  }

  recordWrongGuess(chatId: string): TauntContext {
    this.repo.incrementWrongGuesses(chatId);
    return this.repo.getTauntContext(chatId);
  }

  getTauntContext(chatId: string): TauntContext {
    return this.repo.getTauntContext(chatId);
  }
}
