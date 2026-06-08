import type { config as ConfigType } from "../../config.js";
import { calculateSpeedBonus } from "../scoring.js";

export type GoldConfig = Pick<
  typeof ConfigType,
  | "goldPerWin"
  | "goldHintWinnerTax"
  | "speedBonusFast"
  | "speedBonusMed"
>;

export type GoldWinInput = {
  hintsUsed: number;
  elapsedMs: number;
  difficultyMultiplier: number;
};

export type GoldWinResult = {
  total: number;
  base: number;
  speedBonus: number;
  hintTax: number;
  difficultyMultiplier: number;
  subtotal: number;
};

export function calculateGoldWinReward(
  input: GoldWinInput,
  cfg: GoldConfig,
): GoldWinResult {
  const base = cfg.goldPerWin;
  const speedBonus = calculateSpeedBonus(input.elapsedMs, {
    speedBonusFast: cfg.speedBonusFast,
    speedBonusMed: cfg.speedBonusMed,
  });
  const hintTax = input.hintsUsed * cfg.goldHintWinnerTax;
  const subtotal = base + speedBonus - hintTax;
  const raw = Math.round(subtotal * input.difficultyMultiplier);
  const total = Math.max(0, raw);

  return {
    total,
    base,
    speedBonus,
    hintTax,
    difficultyMultiplier: input.difficultyMultiplier,
    subtotal,
  };
}

export function formatGold(amount: number): string {
  const n = Math.abs(amount);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${amount} золота`;
  if (mod10 === 1) return `${amount} золото`;
  if (mod10 >= 2 && mod10 <= 4) return `${amount} золота`;
  return `${amount} золота`;
}

export function formatGoldWinBreakdown(result: GoldWinResult): string {
  const parts: string[] = [`${result.base} база`];
  if (result.speedBonus > 0) parts.push(`+${result.speedBonus} скорость`);
  if (result.hintTax > 0) parts.push(`−${result.hintTax} подсказки`);
  let line = parts.join(" · ");
  if (result.difficultyMultiplier !== 1) {
    const after = Math.round(result.subtotal * result.difficultyMultiplier);
    line += ` = ${after}`;
  }
  return `<b>+${formatGold(result.total)}</b>\n<i>${line}</i>`;
}
