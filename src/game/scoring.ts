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
  hintsUsed: number;
  elapsedMs: number;
  hintPenalty: number;
  speedBonus: number;
  streakBonus: number;
  difficultyMultiplier: number;
  /** base − штраф + бонусы, до множителя сложности */
  subtotal: number;
  /** true, если итог поднят до MIN_POINTS_PER_WIN */
  appliedMinCap: boolean;
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

/** Бонус за текущую победу: 3-я подряд → +2, 5-я → +5, 10-я → +10. */
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
  const subtotal = base - hintPenalty + speedBonus + streakBonus;
  const raw = subtotal * input.difficultyMultiplier;
  const rawRounded = Math.round(raw);
  const total = Math.max(cfg.minPointsPerWin, rawRounded);
  const appliedMinCap = rawRounded < cfg.minPointsPerWin;

  console.log(
    `[Scoring] (${base}-${hintPenalty}+${speedBonus}+${streakBonus})` +
      `×${input.difficultyMultiplier}=${rawRounded} → ${total}` +
      (appliedMinCap ? " (min cap)" : ""),
  );

  return {
    total,
    base,
    hintsUsed: input.hintsUsed,
    elapsedMs: input.elapsedMs,
    hintPenalty,
    speedBonus,
    streakBonus,
    difficultyMultiplier: input.difficultyMultiplier,
    subtotal,
    appliedMinCap,
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

function hintPenaltyLabel(penalty: number, hintsUsed: number): string {
  const n = hintsUsed;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "подсказок";
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = "подсказка";
    else if (mod10 >= 2 && mod10 <= 4) word = "подсказки";
  }
  return `−${penalty} ${word}`;
}

function difficultyLabel(multiplier: number): string {
  if (multiplier < 1) return `×${multiplier} лёгкий герой`;
  if (multiplier > 1) return `×${multiplier} сложный герой`;
  return "";
}

/** Разбивка для сообщения победы. */
export function formatPointsBreakdown(result: RoundPointsResult): string {
  const { total, subtotal, difficultyMultiplier } = result;
  const hasMods =
    result.hintPenalty > 0 ||
    result.speedBonus > 0 ||
    result.streakBonus > 0 ||
    difficultyMultiplier !== 1;

  const head = `<b>+${formatPoints(total)}</b>`;

  if (!hasMods) {
    return head;
  }

  const steps: string[] = [`${result.base} база`];

  if (result.hintPenalty > 0) {
    steps.push(hintPenaltyLabel(result.hintPenalty, result.hintsUsed));
  }
  if (result.speedBonus > 0) {
    steps.push(`+${result.speedBonus} за скорость`);
  }
  if (result.streakBonus > 0) {
    steps.push(`+${result.streakBonus} за серию`);
  }

  let formula: string;
  if (difficultyMultiplier !== 1) {
    const diff = difficultyLabel(difficultyMultiplier);
    const afterMult = Math.round(subtotal * difficultyMultiplier);
    formula =
      steps.length === 1
        ? `${result.base} → ${diff} = ${afterMult}`
        : `${steps.join(" · ")} = ${subtotal} → ${diff} = ${afterMult}`;
  } else {
    formula = steps.join(" · ");
    if (subtotal !== result.base) {
      formula += ` = ${subtotal}`;
    }
  }

  if (result.appliedMinCap) {
    formula += ` → мин. ${total}`;
  }

  return `${head}\n<i>${formula}</i>`;
}
