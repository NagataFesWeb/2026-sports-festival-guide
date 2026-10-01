// ベット・取消の検証と残高の増減（サーバー側でのみ実行する純粋関数）
import type { Bet, BetKind, CasinoAccount, Market, MarketStatus } from "./types";

export type BetError =
  | "market_closed"
  | "invalid_kind"
  | "invalid_selection"
  | "invalid_stake"
  | "insufficient_balance"
  | "bet_not_found";

export type Result<T> = { ok: true; value: T } | { ok: false; error: BetError };

/** 締切前かつ未確定なら受付中 */
export function isMarketOpen(market: Market, now: Date): boolean {
  return market.status === "open" && now.getTime() < Date.parse(market.deadline);
}

/** deadline を過ぎた open は closed として扱う */
export function effectiveStatus(market: Market, now: Date): MarketStatus {
  if (market.status === "open" && !isMarketOpen(market, now)) return "closed";
  return market.status;
}

/** リレーのみ単勝・複勝・三連単。他の競技・overall・custom は単勝のみ */
export function allowedKinds(market: Market): BetKind[] {
  if (market.type === "event" && market.category === "race" && market.options.length >= 3 && /リレー|relay/i.test(market.title)) {
    return ["win", "place", "trifecta"];
  }
  return ["win"];
}

/** 1以上の整数だけを受け付ける（0・マイナス・小数・空は null） */
export function parseStake(input: string): number | null {
  const v = input.trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

function isValidAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 1;
}

/** 選択肢の存在・個数・三連単の重複をチェック */
export function isValidSelection(market: Market, kind: BetKind, selection: readonly string[]): boolean {
  const need = kind === "trifecta" ? 3 : 1;
  const ids = new Set(market.options.map((o) => o.id));
  return (
    selection.length === need &&
    selection.every((id) => ids.has(id)) &&
    new Set(selection).size === need
  );
}

export interface PlaceBetInput {
  kind: BetKind;
  selection: string[];
  /** リクエスト由来のため unknown で受けて検証する */
  amount: unknown;
}

export function placeBet(
  account: CasinoAccount,
  market: Market,
  input: PlaceBetInput,
  now: Date,
  betId: string,
): Result<{ account: CasinoAccount; bet: Bet }> {
  if (!isMarketOpen(market, now)) return { ok: false, error: "market_closed" };
  if (!allowedKinds(market).includes(input.kind)) return { ok: false, error: "invalid_kind" };
  if (!isValidSelection(market, input.kind, input.selection)) {
    return { ok: false, error: "invalid_selection" };
  }
  if (!isValidAmount(input.amount)) return { ok: false, error: "invalid_stake" };
  if (input.amount > account.pointsBalance) return { ok: false, error: "insufficient_balance" };

  const bet: Bet = {
    id: betId,
    marketId: market.id,
    studentId: account.studentId,
    kind: input.kind,
    selection: [...input.selection],
    amount: input.amount,
    payoutAmount: null,
    createdAt: now.toISOString(),
  };
  return {
    ok: true,
    value: { account: { ...account, pointsBalance: account.pointsBalance - input.amount }, bet },
  };
}

/** 締切前の自分のベットを1件取り消し、賭け金を全額戻す */
export function cancelBet(
  account: CasinoAccount,
  market: Market,
  bet: Bet,
  now: Date,
): Result<{ account: CasinoAccount }> {
  if (bet.studentId !== account.studentId || bet.marketId !== market.id) {
    return { ok: false, error: "bet_not_found" };
  }
  // 配当が記録済みのベットは取り消せない（払戻を受けたうえで賭け金も戻す二重取りを防ぐ）
  if (bet.payoutAmount !== null) return { ok: false, error: "bet_not_found" };
  if (!isMarketOpen(market, now)) return { ok: false, error: "market_closed" };
  return { ok: true, value: { account: { ...account, pointsBalance: account.pointsBalance + bet.amount } } };
}
