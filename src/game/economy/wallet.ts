import type { Repository } from "../../db/repository.js";

export type WalletRow = {
  user_id: string;
  gold: number;
  battle_mmr: number;
};

export type DebitResult =
  | { ok: true; newBalance: number; debited: number }
  | { ok: false; reason: "insufficient"; balance: number };

export class WalletService {
  constructor(private repo: Repository) {}

  ensureWallet(userId: string): WalletRow {
    return this.repo.ensureWallet(userId);
  }

  getWallet(userId: string): WalletRow {
    return this.repo.ensureWallet(userId);
  }

  credit(
    userId: string,
    amount: number,
    reason: string,
    chatId?: string,
    refId?: string,
  ): number {
    if (amount <= 0) return this.ensureWallet(userId).gold;
    return this.repo.adjustGold(userId, amount, reason, chatId, refId);
  }

  debit(
    userId: string,
    amount: number,
    reason: string,
    chatId?: string,
    refId?: string,
  ): DebitResult {
    if (amount <= 0) {
      const w = this.ensureWallet(userId);
      return { ok: true, newBalance: w.gold, debited: 0 };
    }
    const wallet = this.ensureWallet(userId);
    if (wallet.gold < amount) {
      return { ok: false, reason: "insufficient", balance: wallet.gold };
    }
    const newBalance = this.repo.adjustGold(
      userId,
      -amount,
      reason,
      chatId,
      refId,
    );
    return { ok: true, newBalance, debited: amount };
  }

  /** Списать до нуля, если не хватает (для налога победителя). */
  debitUpTo(
    userId: string,
    amount: number,
    reason: string,
    chatId?: string,
    refId?: string,
  ): { debited: number; newBalance: number } {
    const wallet = this.ensureWallet(userId);
    const debited = Math.min(wallet.gold, amount);
    if (debited <= 0) {
      return { debited: 0, newBalance: wallet.gold };
    }
    const partialReason =
      debited < amount ? `${reason}_partial` : reason;
    const newBalance = this.repo.adjustGold(
      userId,
      -debited,
      partialReason,
      chatId,
      refId,
    );
    return { debited, newBalance };
  }

  adjustBattleMmr(userId: string, delta: number): number {
    return this.repo.adjustBattleMmr(userId, delta);
  }
}
