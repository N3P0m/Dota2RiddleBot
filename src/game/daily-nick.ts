import type { GeminiClient } from "../ai/gemini.js";
import type { Repository } from "../db/repository.js";
import { todayKey } from "./nick-date.js";

export type DailyNickResult =
  | {
      ok: true;
      nickname: string;
      cached: boolean;
      date: string;
      previousNicks: string[];
    }
  | { ok: false; reason: "generate_failed" };

export class DailyNickService {
  constructor(
    private repo: Repository,
    private gemini: GeminiClient,
    private timeZone: string,
  ) {}

  getTodayNick(userId: string): string | undefined {
    return this.repo.getDailyNick(userId, todayKey(this.timeZone));
  }

  getPreviousNicks(userId: string): string[] {
    return this.repo.getPreviousNicks(userId);
  }

  async getOrCreate(
    userId: string,
    displayName: string,
    username: string | null,
    forceNew = false,
  ): Promise<DailyNickResult> {
    const date = todayKey(this.timeZone);

    if (!forceNew) {
      const existing = this.repo.getDailyNick(userId, date);
      if (existing) {
        return {
          ok: true,
          nickname: existing,
          cached: true,
          date,
          previousNicks: this.repo.getPreviousNicks(userId),
        };
      }
    }

    const seed = `${userId}-${date}-${Date.now()}`;
    const nickname = await this.gemini.generateDailyNick(date, seed);
    if (!nickname) {
      return { ok: false, reason: "generate_failed" };
    }

    this.repo.saveDailyNick(userId, date, nickname, displayName, username);
    return {
      ok: true,
      nickname,
      cached: false,
      date,
      previousNicks: this.repo.getPreviousNicks(userId),
    };
  }
}
