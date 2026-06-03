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
      /** Сколько перекатов осталось без запроса к нейросети */
      stackRemaining: number;
      /** true — взяли из очереди; false — новый запрос к Gemini */
      fromStack: boolean;
    }
  | { ok: false; reason: "generate_failed" };

export class DailyNickService {
  constructor(
    private repo: Repository,
    private gemini: GeminiClient,
    private timeZone: string,
    private stackSize: number,
  ) {}

  getTodayNick(userId: string): string | undefined {
    return this.repo.getDailyNick(userId, todayKey(this.timeZone));
  }

  getPreviousNicks(userId: string): string[] {
    return this.repo.getPreviousNicks(userId);
  }

  getStackRemaining(userId: string): number {
    return this.repo.getNickQueue(userId, todayKey(this.timeZone)).length;
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
          stackRemaining: this.repo.getNickQueue(userId, date).length,
          fromStack: false,
        };
      }
    }

    const taken = await this.takeNextNick(userId, date);
    if (!taken) {
      return { ok: false, reason: "generate_failed" };
    }

    this.repo.saveDailyNick(userId, date, taken.nickname, displayName, username);
    return {
      ok: true,
      nickname: taken.nickname,
      cached: false,
      date,
      previousNicks: this.repo.getPreviousNicks(userId),
      stackRemaining: taken.stackRemaining,
      fromStack: taken.fromStack,
    };
  }

  private async takeNextNick(
    userId: string,
    nickDate: string,
  ): Promise<{
    nickname: string;
    stackRemaining: number;
    fromStack: boolean;
  } | null> {
    let queue = this.repo.getNickQueue(userId, nickDate);
    let fromStack = queue.length > 0;

    if (queue.length === 0) {
      const exclude = new Set([
        ...this.repo.getPreviousNicks(userId).map((n) => n.toLowerCase()),
        ...(this.repo.getDailyNick(userId, nickDate)?.toLowerCase()
          ? [this.repo.getDailyNick(userId, nickDate)!.toLowerCase()]
          : []),
      ]);
      const batch = await this.gemini.generateDailyNickBatch(
        nickDate,
        `${userId}-${nickDate}-${Date.now()}`,
        this.stackSize,
        [...exclude],
      );
      if (batch.length === 0) return null;
      queue = batch;
      fromStack = false;
    }

    const [nickname, ...rest] = queue;
    if (!nickname) return null;

    this.repo.setNickQueue(userId, nickDate, rest);
    return { nickname, stackRemaining: rest.length, fromStack };
  }
}
