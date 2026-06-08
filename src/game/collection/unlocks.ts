import type { Repository } from "../../db/repository.js";
import {
  getItemById,
  getMvpHeroEntry,
  type MvpHeroCatalogEntry,
} from "../catalog/catalog.js";

export function recordChatUnlockOnWin(
  repo: Repository,
  chatId: string,
  targetType: "hero" | "item",
  targetId: number,
): { newlyUnlocked: boolean; guessCount: number; required: number } {
  const required =
    targetType === "hero"
      ? (getMvpHeroEntry(targetId)?.required_guesses ?? 999)
      : (getItemById(targetId)?.required_guesses ?? 999);

  const before = repo.getChatUnlock(chatId, targetType, targetId);
  const wasUnlocked =
    before?.unlocked_at != null || (before?.guess_count ?? 0) >= required;

  const after = repo.incrementChatUnlock(
    chatId,
    targetType,
    targetId,
    required,
  );

  const isUnlocked =
    after.unlocked_at != null || after.guess_count >= required;

  return {
    newlyUnlocked: !wasUnlocked && isUnlocked,
    guessCount: after.guess_count,
    required,
  };
}

export function isEntityInMvpCatalog(
  targetType: "hero" | "item",
  targetId: number,
): boolean {
  if (targetType === "hero") return !!getMvpHeroEntry(targetId);
  return !!getItemById(targetId);
}

export function getRequiredGuesses(
  targetType: "hero" | "item",
  targetId: number,
): number {
  if (targetType === "hero") {
    return getMvpHeroEntry(targetId)?.required_guesses ?? 999;
  }
  return getItemById(targetId)?.required_guesses ?? 999;
}

export function getCatalogHeroEntry(
  heroId: number,
): MvpHeroCatalogEntry | undefined {
  return getMvpHeroEntry(heroId);
}
