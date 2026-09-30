// サーバー → クライアントに渡す表示用データ（Route Handler のレスポンス型）
import type { BetKind, MarketOption, MarketStatus, MarketType } from "./types";

/** 入場（/casino/enter）のモード */
export type EnterMode = "login" | "register";

export interface AccountView {
  pointsBalance: number;
  debtAmount: number;
}

export interface MyBetView {
  id: string;
  kind: BetKind;
  selection: string[];
  amount: number;
  payoutAmount: number | null;
}

export interface MarketView {
  market: {
    id: string;
    type: MarketType;
    no: string;
    title: string;
    en: string;
    options: MarketOption[];
    deadline: string;
    /** deadline を考慮した状態 */
    status: MarketStatus;
    kinds: BetKind[];
    resultOrder: string[] | null;
    trifectaOddsDefault: number;
    trifectaOddsOverrides: Record<string, number>;
  };
  /** 賭式ごとのプール（selection キー → 合計）。三連単のキーは "a>b>c" */
  pools: Record<BetKind, Record<string, number>>;
  players: number;
  account: AccountView;
  myBets: MyBetView[];
  serverNow: string;
}

export interface MarketSummary {
  id: string;
  no: string;
  title: string;
  en: string;
  status: MarketStatus;
  deadline: string;
  poolTotal: number;
  players: number;
  winnerName: string | null;
}

export interface MarketListView {
  markets: MarketSummary[];
  account: AccountView;
  serverNow: string;
}

// ---- F2 CREDIT（借入れ・返済） ----

export interface CreditView {
  account: AccountView;
  /** 1回の借入れ上限（debt.ts の BORROW_MAX） */
  borrowMax: number;
  /** 結果確定ごとに借金へ加算される利率（%表示用。10 なら +10%） */
  interestPercent: number;
  /** 返済できる上限（残高と借金の小さい方） */
  repayMax: number;
  /** 最終精算済みなら true（借入れ・返済とも不可） */
  finalized: boolean;
  serverNow: string;
}

// ---- F3 HISTORY（自分のベット履歴） ----

export interface HistoryBetRow {
  id: string;
  kind: BetKind;
  /** selection を表示名にしたもの（三連単は1着→2着→3着の順） */
  selectionNames: string[];
  amount: number;
  payoutAmount: number | null;
}

export interface HistoryMarketGroup {
  marketId: string;
  no: string;
  title: string;
  en: string;
  status: MarketStatus;
  bets: HistoryBetRow[];
  /** この Market の賭け金合計 */
  stakeTotal: number;
  /** この Market の払戻合計（未確定は 0 として扱う） */
  payoutTotal: number;
}

export interface HistoryView {
  groups: HistoryMarketGroup[];
  stakeTotal: number;
  payoutTotal: number;
  /** 収支（払戻合計 − 賭け金合計。未確定分は払戻 0 として計算） */
  net: number;
  account: AccountView;
  serverNow: string;
}

// ---- F4 RANK（順位） ----

export interface RankRowView {
  rank: number;
  studentId: string;
  name: string;
  /** 表示用の名前（口座作成時のニックネームがあればそれ、無ければ name） */
  displayName: string;
  netWorth: number;
  /** 精算済みなら精算直前の所持ポイント、未精算なら現在の残高 */
  pointsBalance: number;
  /** 精算済みなら精算直前の借金額、未精算なら現在の借金額 */
  debtAmount: number;
  /** 自分の行 */
  me: boolean;
}

export interface RankView {
  /** 最終精算済みなら true。false のときは全体順位表を公開しない */
  finalized: boolean;
  /** 未精算でも自分の順位だけは出す */
  myRank: number;
  myNetWorth: number;
  /** 口座の総数（順位の母数） */
  total: number;
  /** finalized のときのみ全件。未精算は空配列 */
  rows: RankRowView[];
  account: AccountView;
  serverNow: string;
}

/** API のエラーコード → 画面のエラー種別 */
export type ApiErrorCode =
  | "market_closed"
  | "invalid_kind"
  | "invalid_selection"
  | "invalid_stake"
  | "insufficient_balance"
  | "bet_not_found"
  | "market_not_found"
  | "account_not_found"
  | "bad_request"
  // ---- 入場・セッション ----
  | "unauthorized"
  | "not_in_roster"
  | "already_registered"
  | "wrong_password"
  | "invalid_password"
  | "invalid_nickname"
  // ---- 借入れ・返済 ----
  | "invalid_amount"
  | "over_borrow_limit"
  | "over_debt"
  | "finalized"
  // ---- 同時更新 ----
  | "conflict";

export type ApiResponse = { ok: true; view: MarketView } | { ok: false; error: ApiErrorCode };

/** F2 CREDIT の API レスポンス */
export type CreditApiResponse = { ok: true; view: CreditView } | { ok: false; error: ApiErrorCode };

/** 入場・退場の API レスポンス */
export type EnterApiResponse = { ok: true } | { ok: false; error: ApiErrorCode };
