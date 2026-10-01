// 1つの Market の結果確定処理（純粋関数）。配当計算は odds.ts、利子は debt.ts に委譲する
import { applyInterest } from "./debt";
import { settlePayouts } from "./odds";
import type { Bet, CasinoAccountRecord, Market } from "./types";

export type SettleError = "already_settled" | "invalid_order" | "unsafe_balance";

export type Result<T> = { ok: true; value: T } | { ok: false; error: SettleError };

export interface SettleMarketInput {
  market: Market;
  /** market.id に紐づくベットのみを渡す想定だが、念のため内部でも marketId で絞り込む */
  bets: Bet[];
  accounts: CasinoAccountRecord[];
  /** 確定着順（先頭が優勝） */
  order: string[];
  now: Date;
}

export interface SettleMarketOutput {
  market: Market;
  payouts: { id: string; payoutAmount: number }[];
  /** 変化した口座のみ（配当を受け取った、または利子が付いた口座）。docs 参照 */
  accounts: CasinoAccountRecord[];
}

/** race かつ選択肢が3つ以上のときだけ三連単があり得るため、着順は最低3件必要 */
function requiredOrderLength(market: Market): number {
  const isRace = market.type === "event" && market.category === "race" && market.options.length >= 3;
  return isRace ? 3 : 1;
}

function isValidOrder(market: Market, order: readonly string[]): boolean {
  if (order.length === 0) return false;
  if (order.length < requiredOrderLength(market)) return false;
  const optionIds = new Set(market.options.map((o) => o.id));
  if (!order.every((id) => optionIds.has(id))) return false;
  return new Set(order).size === order.length;
}

/**
 * Market を確定する。
 * - 対象 Market のベットのみで配当を計算し、口座の pointsBalance に加算する
 * - 借金が残っている口座は（この Market にベットしていなくても）全員利子を付与する
 * - 返す accounts は「配当を受け取った」または「利子が付いた」口座だけ（変化の無い口座は含めない）
 */
export function settleMarket(input: SettleMarketInput): Result<SettleMarketOutput> {
  const { market, bets, accounts, order } = input;
  if (market.status === "settled") return { ok: false, error: "already_settled" };
  if (!isValidOrder(market, order)) return { ok: false, error: "invalid_order" };

  const marketBets = bets.filter((b) => b.marketId === market.id);
  const payoutMap = settlePayouts(marketBets, order);

  const payoutByStudent = new Map<string, number>();
  for (const b of marketBets) {
    const amount = payoutMap.get(b.id) ?? 0;
    payoutByStudent.set(b.studentId, (payoutByStudent.get(b.studentId) ?? 0) + amount);
  }

  const changedAccounts: CasinoAccountRecord[] = [];
  for (const account of accounts) {
    const received = payoutByStudent.get(account.studentId) ?? 0;
    const hasDebt = account.debtAmount > 0;
    if (received === 0 && !hasDebt) continue;
    changedAccounts.push({
      ...account,
      pointsBalance: account.pointsBalance + received,
      debtAmount: hasDebt ? applyInterest(account).debtAmount : account.debtAmount,
    });
  }

  const payouts = marketBets.map((b) => ({ id: b.id, payoutAmount: payoutMap.get(b.id) ?? 0 }));
  if (payouts.some((p) => !Number.isSafeInteger(p.payoutAmount)) || changedAccounts.some((a) => !Number.isSafeInteger(a.pointsBalance) || !Number.isSafeInteger(a.debtAmount))) return { ok: false, error: "unsafe_balance" };

  return {
    ok: true,
    value: {
      market: { ...market, status: "settled", resultOrder: [...order] },
      payouts,
      accounts: changedAccounts,
    },
  };
}
