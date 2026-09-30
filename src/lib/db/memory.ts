// 開発用の永続化実装。状態は globalThis に持ち（HMR で消えない）、任意で .data/db.json に書き出す
// ポイントの増減計算はここに書かない（渡された値をそのまま保存するだけ）
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createFixtureState,
  createSeedAccounts,
  SEED_EVENTS,
  SEED_EVENT_RESULTS,
  SEED_INVITES,
  SEED_STUDENTS,
  SEED_TEAMS,
} from "../casino/fixtures";
import type { Bet, CasinoAccountRecord, Market } from "../casino/types";
import type { Event, EventResult, InviteEntry, Settings, Student, Team } from "../festival/types";
import type { Balances, BetFilter, Repository } from "./repository";

interface MemoryState {
  students: Student[];
  teams: Team[];
  events: Event[];
  eventResults: EventResult[];
  invites: InviteEntry[];
  markets: Market[];
  bets: Bet[];
  accounts: CasinoAccountRecord[];
  settings: Settings;
  /** newId の連番 */
  seq: number;
}

// ---- JSON ファイル永続化（任意。失敗しても無視する） ----

function dbFilePath(): string {
  return join(process.cwd(), ".data", "db.json");
}

/**
 * 永続化するかどうか。環境変数はモジュール読み込み時ではなく毎回読む
 * （ESM の import は巻き上げられるため、テストの process.env 設定より先に評価されてしまう）
 */
function persistEnabled(): boolean {
  if (process.env.DB_PERSIST === "0") return false;
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false;
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 設定（キーが両方そろっていること。値は null もあり得るので in で見る） */
function isSettingsShape(value: unknown): boolean {
  return isRecord(value) && "finalSettledAt" in value && "scoresPublishedAt" in value;
}

/** 種目（ヒート対応後の形。heats / kind / delayMin が無い古い行は捨てる） */
function isEventShape(value: unknown): boolean {
  return isRecord(value) && Array.isArray(value.heats) && typeof value.kind === "string" && typeof value.delayMin === "number";
}

/** 種目の結果（(eventId, heatId) キー。heatId が無い古い行は捨てる） */
function isEventResultShape(value: unknown): boolean {
  return isRecord(value) && typeof value.eventId === "string" && typeof value.heatId === "string";
}

/** Market（heatId 列の追加後の形） */
function isMarketShape(value: unknown): boolean {
  return isRecord(value) && "heatId" in value;
}

/** 招集案内（tag 列の追加後の形） */
function isInviteShape(value: unknown): boolean {
  return isRecord(value) && typeof value.tag === "string";
}

/**
 * JSON から読んだ値が期待する形かを確かめる（古い・壊れたファイルはシードに戻す）。
 * 列が増えたら必ずここも足すこと。足し忘れると古いファイルをそのまま読んで実行時に壊れる
 */
export function isMemoryState(value: unknown): value is MemoryState {
  if (!isRecord(value)) return false;
  const arrayKeys = ["students", "teams", "events", "eventResults", "invites", "markets", "bets", "accounts"];
  if (!arrayKeys.every((k) => Array.isArray(value[k]))) return false;
  if (typeof value.seq !== "number") return false;
  if (!isSettingsShape(value.settings)) return false;
  if (!(value.events as unknown[]).every(isEventShape)) return false;
  if (!(value.eventResults as unknown[]).every(isEventResultShape)) return false;
  if (!(value.markets as unknown[]).every(isMarketShape)) return false;
  if (!(value.invites as unknown[]).every(isInviteShape)) return false;
  return true;
}

/** nickname 列の追加前に書かれた口座を補う（無ければ空文字。シードに戻さず読む） */
function withNickname(accounts: CasinoAccountRecord[]): CasinoAccountRecord[] {
  return accounts.map((a) => (typeof a.nickname === "string" ? a : { ...a, nickname: "" }));
}

function loadState(): MemoryState | null {
  if (!persistEnabled()) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(dbFilePath(), "utf8"));
    if (!isMemoryState(parsed)) return null;
    return { ...parsed, accounts: withNickname(parsed.accounts) };
  } catch {
    // ファイルが無い・壊れている場合はシードから作り直す
    return null;
  }
}

function saveState(state: MemoryState): void {
  if (!persistEnabled()) return;
  try {
    const file = dbFilePath();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Vercel のファイルシステムは読み取り専用。書けなくても動作は継続する
  }
}

// ---- 状態の初期化 ----

/** 返り値は必ずコピー（呼び出し側の変更が保管データに漏れないようにする） */
function copy<T>(value: T): T {
  return structuredClone(value);
}

function createSeedState(): MemoryState {
  const now = new Date();
  const casino = createFixtureState(now);
  return {
    students: copy(SEED_STUDENTS),
    teams: copy(SEED_TEAMS),
    events: copy(SEED_EVENTS),
    eventResults: copy(SEED_EVENT_RESULTS),
    invites: copy(SEED_INVITES),
    markets: casino.markets,
    bets: casino.bets,
    accounts: createSeedAccounts(now),
    settings: { finalSettledAt: null, scoresPublishedAt: null },
    seq: casino.seq,
  };
}

// 開発サーバーのホットリロードで状態が消えないよう globalThis に保持する
const holder = globalThis as typeof globalThis & { __dbMemoryState?: MemoryState };

function state(): MemoryState {
  holder.__dbMemoryState ??= loadState() ?? createSeedState();
  return holder.__dbMemoryState;
}

/** テスト用。保持している状態を捨てて次回アクセス時にシードから作り直す */
export function resetMemoryState(): void {
  holder.__dbMemoryState = undefined;
}

/** 種目の結果の同一判定キー。結果は (eventId, heatId) で一意 */
function resultKey(eventId: string, heatId: string): string {
  return `${eventId}/${heatId}`;
}

/** 配列内の同一キーの要素を差し替える（無ければ追加する） */
function upsertBy<T>(list: T[], item: T, isSame: (existing: T) => boolean): void {
  const i = list.findIndex(isSame);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

export class MemoryRepository implements Repository {
  // ---- 生徒名簿 ----

  async listStudents(): Promise<Student[]> {
    return copy(state().students);
  }

  async getStudent(studentId: string): Promise<Student | null> {
    const found = state().students.find((s) => s.studentId === studentId);
    return found ? copy(found) : null;
  }

  async replaceStudents(students: readonly Student[]): Promise<void> {
    const s = state();
    s.students = students.map((x) => copy(x));
    saveState(s);
  }

  // ---- チーム・種目・結果 ----

  async listTeams(): Promise<Team[]> {
    return copy(state().teams);
  }

  async upsertTeam(team: Team): Promise<void> {
    const s = state();
    upsertBy(s.teams, copy(team), (t) => t.id === team.id);
    saveState(s);
  }

  async deleteTeam(teamId: string): Promise<void> {
    const s = state();
    s.teams = s.teams.filter((t) => t.id !== teamId);
    saveState(s);
  }

  async listEvents(): Promise<Event[]> {
    return copy(state().events);
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const found = state().events.find((e) => e.id === eventId);
    return found ? copy(found) : null;
  }

  async upsertEvent(event: Event): Promise<void> {
    const s = state();
    upsertBy(s.events, copy(event), (e) => e.id === event.id);
    saveState(s);
  }

  async deleteEvent(eventId: string): Promise<void> {
    const s = state();
    s.events = s.events.filter((e) => e.id !== eventId);
    saveState(s);
  }

  async listEventResults(): Promise<EventResult[]> {
    return copy(state().eventResults);
  }

  async getEventResult(eventId: string, heatId: string): Promise<EventResult | null> {
    const key = resultKey(eventId, heatId);
    const found = state().eventResults.find((r) => resultKey(r.eventId, r.heatId) === key);
    return found ? copy(found) : null;
  }

  async upsertEventResult(result: EventResult): Promise<void> {
    const s = state();
    const key = resultKey(result.eventId, result.heatId);
    upsertBy(s.eventResults, copy(result), (r) => resultKey(r.eventId, r.heatId) === key);
    saveState(s);
  }

  async deleteEventResult(eventId: string, heatId: string): Promise<void> {
    const s = state();
    const key = resultKey(eventId, heatId);
    s.eventResults = s.eventResults.filter((r) => resultKey(r.eventId, r.heatId) !== key);
    saveState(s);
  }

  // ---- 招集案内 ----

  async listInvites(studentId?: string): Promise<InviteEntry[]> {
    const list = state().invites.filter((i) => studentId === undefined || i.studentId === studentId);
    return copy(list);
  }

  async replaceInvites(entries: readonly InviteEntry[]): Promise<void> {
    const s = state();
    s.invites = entries.map((x) => copy(x));
    saveState(s);
  }

  // ---- カジノ: Market・ベット ----

  async listMarkets(): Promise<Market[]> {
    return copy(state().markets);
  }

  async getMarket(marketId: string): Promise<Market | null> {
    const found = state().markets.find((m) => m.id === marketId);
    return found ? copy(found) : null;
  }

  async upsertMarket(market: Market): Promise<void> {
    const s = state();
    upsertBy(s.markets, copy(market), (m) => m.id === market.id);
    saveState(s);
  }

  async deleteMarket(marketId: string): Promise<void> {
    const s = state();
    s.markets = s.markets.filter((m) => m.id !== marketId);
    saveState(s);
  }

  async listBets(filter?: BetFilter): Promise<Bet[]> {
    const list = state().bets.filter(
      (b) =>
        (filter?.marketId === undefined || b.marketId === filter.marketId) &&
        (filter?.studentId === undefined || b.studentId === filter.studentId),
    );
    return copy(list);
  }

  async getBet(betId: string): Promise<Bet | null> {
    const found = state().bets.find((b) => b.id === betId);
    return found ? copy(found) : null;
  }

  async insertBet(bet: Bet): Promise<void> {
    const s = state();
    s.bets.push(copy(bet));
    saveState(s);
  }

  async deleteBet(betId: string): Promise<boolean> {
    const s = state();
    const before = s.bets.length;
    s.bets = s.bets.filter((b) => b.id !== betId);
    if (s.bets.length === before) return false;
    saveState(s);
    return true;
  }

  async updateBetPayouts(payouts: readonly { id: string; payoutAmount: number }[]): Promise<void> {
    const s = state();
    const map = new Map(payouts.map((p) => [p.id, p.payoutAmount]));
    for (const bet of s.bets) {
      const amount = map.get(bet.id);
      if (amount !== undefined) bet.payoutAmount = amount;
    }
    saveState(s);
  }

  // ---- カジノ: 口座 ----

  async listAccounts(): Promise<CasinoAccountRecord[]> {
    return copy(state().accounts);
  }

  async getAccount(studentId: string): Promise<CasinoAccountRecord | null> {
    const found = state().accounts.find((a) => a.studentId === studentId);
    return found ? copy(found) : null;
  }

  async insertAccount(account: CasinoAccountRecord): Promise<boolean> {
    const s = state();
    if (s.accounts.some((a) => a.studentId === account.studentId)) return false;
    s.accounts.push(copy(account));
    saveState(s);
    return true;
  }

  async updateBalances(studentId: string, expected: Balances, next: Balances): Promise<boolean> {
    const s = state();
    const account = s.accounts.find((a) => a.studentId === studentId);
    if (!account) return false;
    // compare-and-set: 現在値が期待値と違えば同時更新なので何も変えない
    if (account.pointsBalance !== expected.pointsBalance || account.debtAmount !== expected.debtAmount) return false;
    account.pointsBalance = next.pointsBalance;
    account.debtAmount = next.debtAmount;
    saveState(s);
    return true;
  }

  async updateAccounts(accounts: readonly CasinoAccountRecord[]): Promise<void> {
    const s = state();
    for (const account of accounts) {
      upsertBy(s.accounts, copy(account), (a) => a.studentId === account.studentId);
    }
    saveState(s);
  }

  // ---- 設定 ----

  async getSettings(): Promise<Settings> {
    return copy(state().settings);
  }

  async updateSettings(settings: Settings): Promise<void> {
    const s = state();
    s.settings = copy(settings);
    saveState(s);
  }

  // seq の書き出しは次の更新に任せる（ID 発行の直後に必ず挿入が走るため）
  newId(prefix: string): string {
    const s = state();
    s.seq += 1;
    return `${prefix}-${s.seq}`;
  }
}
