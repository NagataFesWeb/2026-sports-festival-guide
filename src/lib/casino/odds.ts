// 全賭式をプールで計算する。全賭式の最低倍率は均等な的中確率の逆数。
import type { Bet, BetKind } from "./types";

/** 旧DBの既定値にも使う8組の基準。実際の最低倍率はMarketの選択肢数から計算する */
export const DEFAULT_TRIFECTA_ODDS = 8 * 7 * 6;

/** 全対象が同じ強さの場合の的中確率を全賭式の最低保証に使う */
export function minimumOdds(kind: BetKind, optionCount: number = 8): number {
  if (!Number.isInteger(optionCount) || optionCount < 1) throw new RangeError("選択肢数は1以上の整数が必要です");
  if (kind === "trifecta") {
    if (optionCount < 3) throw new RangeError("三連単には3つ以上の選択肢が必要です");
    return optionCount * (optionCount - 1) * (optionCount - 2);
  }
  return kind === "place" ? optionCount / Math.min(PLACE_SLOTS, optionCount) : optionCount;
}

/** 賭式ごとのプール（selection キー → 賭け金合計） */
export type Pool = Record<string, number>;

/** selection を 1 つのキーにする（三連単は着順つき "a>b>c"） */
export function selectionKey(selection: readonly string[]): string {
  return selection.join(">");
}

/** 指定した賭式のプールを集計する */
export function buildPool(bets: readonly Bet[], kind: BetKind): Pool {
  const pool: Pool = {};
  for (const b of bets) {
    if (b.kind !== kind) continue;
    const key = selectionKey(b.selection);
    pool[key] = (pool[key] ?? 0) + b.amount;
  }
  return pool;
}

export function poolTotal(pool: Pool): number {
  let total = 0;
  for (const v of Object.values(pool)) total += v;
  return total;
}

/** 複勝で払戻対象になる着順の数 */
export const PLACE_SLOTS = 3;

/** 見込み倍率。全ユーザーの同じ賭式のプールを使い、最低保証を適用する */
export function estimateOdds(pool: Pool, kind: BetKind, key: string, optionCount: number = 8): number {
  const minimum = minimumOdds(kind, optionCount);
  const stake = pool[key] ?? 0;
  if (stake <= 0) return minimum;
  const total = poolTotal(pool);
  const slots = kind === "place" ? Math.min(PLACE_SLOTS, optionCount) : 1;
  return Math.max(minimum, total / slots / stake);
}

/** 見込み払戻額（端数切り捨て）。倍率が出ないときは null */
export function estimateReturn(odds: number | null, stake: number): number | null {
  if (odds === null || !Number.isInteger(stake) || stake < 1) return null;
  return Math.floor(stake * odds);
}

/** 倍率の表示（小数2桁に切り捨て、倍率なしは「―」） */
export function formatOdds(odds: number | null): string {
  if (odds === null) return "―";
  return (Math.floor(odds * 100) / 100).toFixed(2);
}

/** 指定した賭式・対象に自分が賭けている合計 */
export function sumStakes(
  bets: readonly { kind: BetKind; selection: readonly string[]; amount: number }[],
  kind: BetKind,
  key: string,
): number {
  let total = 0;
  for (const b of bets) if (b.kind === kind && selectionKey(b.selection) === key) total += b.amount;
  return total;
}

/** 確定済み配当の合計（未確定は 0 として扱う） */
export function sumPayouts(bets: readonly { payoutAmount: number | null }[]): number {
  let total = 0;
  for (const b of bets) total += b.payoutAmount ?? 0;
  return total;
}

export interface HitSummary {
  /** 的中したベットの件数 */
  count: number;
  /** 的中ベットの払戻合計 */
  payout: number;
  /** 的中ベットの賭け金合計 */
  stake: number;
  /** 実効倍率（払戻合計 ÷ 賭け金合計）。的中が無いときは null */
  rate: number | null;
}

/** 的中演出用の集計（払戻が 1 以上のベットだけを数える。未確定・外れは含めない） */
export function summarizeHits(bets: readonly { amount: number; payoutAmount: number | null }[]): HitSummary {
  let count = 0;
  let payout = 0;
  let stake = 0;
  for (const b of bets) {
    if (b.payoutAmount === null || b.payoutAmount <= 0) continue;
    count += 1;
    payout += b.payoutAmount;
    stake += b.amount;
  }
  return { count, payout, stake, rate: stake > 0 ? payout / stake : null };
}

/** 1 賭式ぶんの的中判定 */
function hitKeys(kind: BetKind, order: readonly string[]): string[] {
  if (kind === "win") return order.length > 0 ? [order[0]] : [];
  if (kind === "place") return order.slice(0, PLACE_SLOTS);
  return order.length >= 3 ? [selectionKey(order.slice(0, 3))] : [];
}

/**
 * 結果確定時の配当を bet.id ごとに返す（外れは 0、端数は各ベットで切り捨て）。
 * 賭式ごとに独立したプールで精算する。
 * - 単勝: プール全額を的中ベットで按分し、選択肢数と同じ倍率を最低保証
 * - 複勝: プールを「賭けがある的中対象の数」で等分し、各対象で按分。選択肢数÷的中枠数を最低保証
 * - 三連単: プール全額を的中ベットで按分し、選択肢数から求めた順列数の倍率を最低保証（旧DB設定は使わない）
 * 的中ベットが 1 件も無い賭式のプールは没収（配当 0）
 */
export function settlePayouts(
  bets: readonly Bet[],
  order: readonly string[],
  optionCount: number = 8,
): Map<string, number> {
  const payouts = new Map<string, number>();
  const kinds: BetKind[] = ["win", "place", "trifecta"];
  for (const kind of kinds) {
    const kindBets = bets.filter((b) => b.kind === kind);
    const pool = buildPool(kindBets, kind);
    const total = poolTotal(pool);
    const hits = hitKeys(kind, order).filter((k) => (pool[k] ?? 0) > 0);
    const share = hits.length > 0 ? total / hits.length : 0;
    for (const b of kindBets) {
      const key = selectionKey(b.selection);
      const hit = hits.includes(key);
      payouts.set(
        b.id,
        hit ? Math.floor(Math.max(minimumOdds(kind, optionCount), share / pool[key]) * b.amount) : 0,
      );
    }
  }
  return payouts;
}
