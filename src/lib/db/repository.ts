// 永続化の抽象。実装は memory.ts（開発用・インメモリ＋JSON ファイル）と supabase.ts（本番）
// ポイントの増減ロジックはここに書かない（src/lib/casino/*.ts の純粋関数で計算し、結果だけを保存する）
import type { Bet, CasinoAccountRecord, Market } from "@/lib/casino/types";
import type { Event, EventResult, InviteEntry, Settings, Student, Team } from "@/lib/festival/types";

/** 残高・借金の組（CAS 更新の期待値・更新値に使う） */
export interface Balances {
  pointsBalance: number;
  debtAmount: number;
}

export interface BetFilter {
  marketId?: string;
  studentId?: string;
}

export interface Repository {
  // ---- 生徒名簿 ----
  listStudents(): Promise<Student[]>;
  getStudent(studentId: string): Promise<Student | null>;
  /** 名簿を丸ごと差し替える（CSV アップロード） */
  replaceStudents(students: readonly Student[]): Promise<void>;

  // ---- チーム・種目・結果 ----
  listTeams(): Promise<Team[]>;
  upsertTeam(team: Team): Promise<void>;
  deleteTeam(teamId: string): Promise<void>;

  listEvents(): Promise<Event[]>;
  getEvent(eventId: string): Promise<Event | null>;
  upsertEvent(event: Event): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;

  listEventResults(): Promise<EventResult[]>;
  /** 結果は (eventId, heatId) で一意 */
  getEventResult(eventId: string, heatId: string): Promise<EventResult | null>;
  upsertEventResult(result: EventResult): Promise<void>;
  deleteEventResult(eventId: string, heatId: string): Promise<void>;

  // ---- 招集案内 ----
  listInvites(studentId?: string): Promise<InviteEntry[]>;
  /** 招集案内を丸ごと差し替える（CSV アップロード） */
  replaceInvites(entries: readonly InviteEntry[]): Promise<void>;

  // ---- カジノ: Market・ベット ----
  listMarkets(): Promise<Market[]>;
  getMarket(marketId: string): Promise<Market | null>;
  upsertMarket(market: Market): Promise<void>;
  deleteMarket(marketId: string): Promise<void>;

  listBets(filter?: BetFilter): Promise<Bet[]>;
  getBet(betId: string): Promise<Bet | null>;
  insertBet(bet: Bet): Promise<void>;
  /** 実際に削除できた場合だけ true。取消の二重返金を防ぐ */
  deleteBet(betId: string): Promise<boolean>;
  /** 結果確定時に配当をまとめて記録する */
  updateBetPayouts(payouts: readonly { id: string; payoutAmount: number }[]): Promise<void>;

  // ---- カジノ: 口座 ----
  listAccounts(): Promise<CasinoAccountRecord[]>;
  getAccount(studentId: string): Promise<CasinoAccountRecord | null>;
  /** 既に同じ学籍番号の口座があれば false を返して何もしない */
  insertAccount(account: CasinoAccountRecord): Promise<boolean>;
  /**
   * 残高・借金を compare-and-set で更新する。
   * 現在値が expected と一致しないときは false を返して何も変えない（同時更新の検出）
   */
  updateBalances(studentId: string, expected: Balances, next: Balances): Promise<boolean>;
  /** 結果確定・利子・最終精算など、複数口座をまとめて上書きする（管理操作専用） */
  updateAccounts(accounts: readonly CasinoAccountRecord[]): Promise<void>;

  // ---- 設定 ----
  getSettings(): Promise<Settings>;
  updateSettings(settings: Settings): Promise<void>;

  /** 一意な ID を発行する（メモリ実装は連番、Supabase は UUID） */
  newId(prefix: string): string;
}
