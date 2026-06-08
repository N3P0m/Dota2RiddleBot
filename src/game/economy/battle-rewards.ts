import type { config as ConfigType } from "../../config.js";
import { formatGold } from "./gold-rewards.js";

export type BattleGoldConfig = Pick<
  typeof ConfigType,
  "goldPerBattleWin" | "goldPerBattleLoss"
>;

export function calculateBattleGoldReward(
  won: boolean,
  cfg: BattleGoldConfig,
): number {
  return won ? cfg.goldPerBattleWin : cfg.goldPerBattleLoss;
}

export function formatBattleGoldReward(amount: number): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${formatGold(amount)}`;
}
