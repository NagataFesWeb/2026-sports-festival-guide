// 単勝・複勝はプール方式、三連単は管理者が設定する固定倍率。計算式は docs/data-model.md を参照
import type { Bet, BetKind, Market } from "./types";

export const DEFAULT_TRIFECTA_ODDS = 336;

export function trifectaOdds(market: Pick<Market, "trifectaOddsDefault" | "trifectaOddsOverrides">, key: string): number {
  return market.trifectaOddsOverrides?.[key] ?? market.trifectaOddsDefault ?? DEFAULT_TRIFECTA_ODDS;
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

/**
 * 見込み倍率。対象への賭けが 0 のときは null（表示は「―」）。
 * - 単勝: 全賭け金 ÷ 対象への賭け金
 * - 複勝: (全賭け金 ÷ 3) ÷ 対象への賭け金（3着以内の3対象でプールを等分する前提の見込み）
 */
export function estimateOdds(pool: Pool, kind: BetKind, key: string): number | null {
  const stake = pool[key] ?? 0;
  if (stake <= 0) return null;
  const total = poolTotal(pool);
  return kind === "place" ? total / PLACE_SLOTS / stake : total / stake;
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
 * 賭式ごとに独立したプールで精算する（ただし三連単は固定倍率）。
 * - 単勝: プール全額を的中ベットで按分
 * - 複勝: プールを「賭けがある的中対象の数」で等分し、各対象の的中ベットで按分
 * - 三連単: 締切時に保存されていた個別倍率、未設定なら既定倍率で払戻
 * 的中ベットが 1 件も無い賭式のプールは没収（配当 0）
 */
export function settlePayouts(
  bets: readonly Bet[],
  order: readonly string[],
  trifecta?: Pick<Market, "trifectaOddsDefault" | "trifectaOddsOverrides">,
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
        hit ? Math.floor((kind === "trifecta" && trifecta ? trifectaOdds(trifecta, key) : share / pool[key]) * b.amount) : 0,
      );
    }
  }
  return payouts;
}
