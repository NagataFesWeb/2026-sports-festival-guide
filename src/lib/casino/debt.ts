// 借金（クレジット）・利子・最終精算ロジック（サーバー側でのみ実行する純粋関数）
// 計算式は docs/data-model.md「借金（クレジット）・利子ロジック」を参照
import type { CasinoAccount, CasinoAccountRecord } from "./types";

/** 1回の借入れで指定できる上限額 */
export const BORROW_MAX = 500;
/** 結果確定ごとにかかる複利の利率 */
export const INTEREST_RATE = 1.1;

export type DebtError =
  | "invalid_amount"
  | "over_borrow_limit"
  | "over_debt"
  | "insufficient_balance"
  | "finalized";

export type Result<T> = { ok: true; value: T } | { ok: false; error: DebtError };

/** 1以上の安全な整数のみを受け付ける（0・マイナス・小数・文字列などは拒否） */
function isPositiveSafeInteger(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 1;
}

/**
 * 借入れ。1回につき BORROW_MAX まで。points_balance・debt_amount の両方に加算する。
 * 合計の借入上限は設けない（debt_amount は際限なく増加しうる）
 */
export function borrow(account: CasinoAccount, amount: unknown, finalized: boolean): Result<CasinoAccount> {
  if (finalized) return { ok: false, error: "finalized" };
  if (!isPositiveSafeInteger(amount)) return { ok: false, error: "invalid_amount" };
  if (amount > BORROW_MAX) return { ok: false, error: "over_borrow_limit" };
  if (!Number.isSafeInteger(account.pointsBalance + amount) || !Number.isSafeInteger(account.debtAmount + amount)) return { ok: false, error: "invalid_amount" };
  return {
    ok: true,
    value: {
      ...account,
      pointsBalance: account.pointsBalance + amount,
      debtAmount: account.debtAmount + amount,
    },
  };
}

/**
 * 返済。points_balance 以下かつ debt_amount 以下の額を指定でき、両方から減算する。
 */
export function repay(account: CasinoAccount, amount: unknown, finalized: boolean): Result<CasinoAccount> {
  if (finalized) return { ok: false, error: "finalized" };
  if (!isPositiveSafeInteger(amount)) return { ok: false, error: "invalid_amount" };
  if (amount > account.pointsBalance) return { ok: false, error: "insufficient_balance" };
  if (amount > account.debtAmount) return { ok: false, error: "over_debt" };
  return {
    ok: true,
    value: {
      ...account,
      pointsBalance: account.pointsBalance - amount,
      debtAmount: account.debtAmount - amount,
    },
  };
}

/**
 * 利子の付与。debt_amount > 0 の口座のみ複利で増加させる（points_balance には影響しない）。
 * Market が settled になるたびに全生徒分を呼び出す想定。
 */
export function applyInterest(account: CasinoAccount): CasinoAccount {
  if (account.debtAmount <= 0) return account;
  return { ...account, debtAmount: Number(BigInt(account.debtAmount) * BigInt(110) / BigInt(100)) };
}

/**
 * 最終精算。精算直前の points_balance・debt_amount をスナップショットしたうえで
 * points_balance -= debt_amount（マイナスもそのまま許容）、debt_amount = 0 に確定する。
 * 冪等: すでに精算済み（finalBalanceBefore !== null）なら何もせずそのまま返す。
 */
export function finalizeAccount(record: CasinoAccountRecord): CasinoAccountRecord {
  if (record.finalBalanceBefore !== null) return record;
  return {
    ...record,
    finalBalanceBefore: record.pointsBalance,
    finalDebt: record.debtAmount,
    pointsBalance: record.pointsBalance - record.debtAmount,
    debtAmount: 0,
  };
}
