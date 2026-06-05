import type { Repository } from "../db/repository.js";
import {
  getFloodTauntSlot,
  workHourKey,
  type FloodTauntSlot,
} from "./work-hours.js";

export type FloodContext = {
  recentRounds: number;
  tauntsSentThisHour: number;
  slot: FloodTauntSlot;
  isWorkHours: boolean;
};

/** Шанс флуд-реплики от числа раундов подряд в окне времени. */
export function calcFloodTauntChance(recentRounds: number): number {
  if (recentRounds < 2) return 0;

  let chance = 0.12 + (recentRounds - 2) * 0.14;
  if (recentRounds >= 4) chance += 0.08;
  if (recentRounds >= 6) chance += 0.1;
  return Math.min(0.55, chance);
}

export class FloodTauntService {
  constructor(
    private repo: Repository,
    private timeZone: string,
    private enabled: boolean,
    private workStart: number,
    private workEnd: number,
    private windowMs: number,
    private maxPerHour: number,
  ) {}

  /** Вызывать при успешном старте раунда. */
  onRoundStarted(chatId: string, now = new Date()): FloodContext {
    this.repo.recordChatRoundStart(chatId, now.getTime(), this.windowMs);
    const { slot, isWorkHours } = getFloodTauntSlot(
      now,
      this.timeZone,
      this.workStart,
      this.workEnd,
    );
    const hourKey = workHourKey(now, this.timeZone);
    const recentRounds = this.repo.countRecentRounds(
      chatId,
      this.windowMs,
      now.getTime(),
    );
    const tauntsSentThisHour = this.repo.getWorkTauntsSentInHour(chatId, hourKey);
    return { recentRounds, tauntsSentThisHour, slot, isWorkHours };
  }

  rollFloodTaunt(chatId: string, ctx: FloodContext): string | null {
    if (!this.enabled) return null;
    if (ctx.tauntsSentThisHour >= this.maxPerHour) return null;

    const chance = calcFloodTauntChance(ctx.recentRounds);
    if (chance <= 0 || Math.random() > chance) return null;

    const text = this.repo.pickRandomFloodTaunt(
      chatId,
      ctx.slot,
      ctx.isWorkHours,
    );
    if (!text) return null;

    const hourKey = workHourKey(new Date(), this.timeZone);
    this.repo.incrementWorkTauntsSent(chatId, hourKey);
    console.log(
      `[FloodTaunt] chat=${chatId} rounds=${ctx.recentRounds} slot=${ctx.slot} work=${ctx.isWorkHours} chance=${(chance * 100).toFixed(0)}%`,
    );
    return text;
  }
}
