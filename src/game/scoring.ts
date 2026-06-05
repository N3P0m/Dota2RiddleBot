import type { config as ConfigType } from "../config.js";

export type RoundScoringInput = {
  hintsUsed: number;
  elapsedMs: number;
  difficultyMultiplier: number;
  streakBefore: number;
};

export type RoundPointsResult = {
  total: number;
  base: number;
  hintPenalty: number;
  speedBonus: number;
  streakBonus: number;
  difficultyMultiplier: number;
};

export type ScoringConfig = Pick<
  typeof ConfigType,
  | "pointsPerWin"
  | "minPointsPerWin"
  | "hintPenalty"
  | "maxHintPenalty"
  | "speedBonusFast"
  | "speedBonusMed"
  | "streakBonus3"
  | "streakBonus5"
  | "streakBonus10"
>;

const FAST_MS = 30_000;
const MED_MS = 120_000;

export function calculateSpeedBonus(
  elapsedMs: number,
  cfg: Pick<ScoringConfig, "speedBonusFast" | "speedBonusMed">,
): number {
  if (elapsedMs <= FAST_MS) return cfg.speedBonusFast;
  if (elapsedMs <= MED_MS) return cfg.speedBonusMed;
  return 0;
}

export function calculateHintPenalty(
  hintsUsed: number,
  cfg: Pick<ScoringConfig, "hintPenalty" | "maxHintPenalty">,
): number {
  return Math.min(hintsUsed * cfg.hintPenalty, cfg.maxHintPenalty);
}

export function calculateStreakBonus(
  streakBefore: number,
  cfg: Pick<ScoringConfig, "streakBonus3" | "streakBonus5" | "streakBonus10">,
): number {
  if (streakBefore >= 9) return cfg.streakBonus10;
  if (streakBefore >= 4) return cfg.streakBonus5;
  if (streakBefore >= 2) return cfg.streakBonus3;
  return 0;
}

export function calculateRoundPoints(
  input: RoundScoringInput,
  cfg: ScoringConfig,
): RoundPointsResult {
  const base = cfg.pointsPerWin;
  const hintPenalty = calculateHintPenalty(input.hintsUsed, cfg);
  const speedBonus = calculateSpeedBonus(input.elapsedMs, cfg);
  const streakBonus = calculateStreakBonus(input.streakBefore, cfg);
  const raw =
    (base - hintPenalty + speedBonus + streakBonus) * input.difficultyMultiplier;
  const total = Math.max(cfg.minPointsPerWin, Math.round(raw));

  console.log(
    `[Scoring] base=${base} hints=${input.hintsUsed} penalty=${hintPenalty} ` +
      `speed=${speedBonus} streak=${streakBonus} diff=${input.difficultyMultiplier} → ${total}`,
  );

  return {
    total,
    base,
    hintPenalty,
    speedBonus,
    streakBonus,
    difficultyMultiplier: input.difficultyMultiplier,
  };
}

export function formatPoints(points: number): string {
  const n = Math.abs(points);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${points} очков`;
  if (mod10 === 1) return `${points} очко`;
  if (mod10 >= 2 && mod10 <= 4) return `${points} очка`;
  return `${points} очков`;
}

export function formatPointsBreakdown(result: RoundPointsResult): string {
  const parts: string[] = [`${result.base} база`];

  if (result.hintPenalty > 0) {
    parts.push(`−${result.hintPenalty} подсказка`);
  }
  if (result.speedBonus > 0) {
    parts.push(`+${result.speedBonus} скорость`);
  }
  if (result.streakBonus > 0) {
    parts.push(`🔥 серия +${result.streakBonus}`);
  }
  if (result.difficultyMultiplier !== 1) {
    parts.push(`×${result.difficultyMultiplier} сложность`);
  }

  return `+${result.total} (${parts.join(", ")})`;
}
