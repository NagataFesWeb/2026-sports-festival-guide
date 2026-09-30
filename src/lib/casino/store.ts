// サーバー側のカジノ操作（Market・ベット・借入れ・返済・口座）。永続化は Repository に委譲する
// 残高の増減はこのファイルと betting.ts / debt.ts でのみ行い、クライアントの計算値は受け取らない
import { hashPassword, isValidPassword, verifyPassword } from "../auth/password";
import { getRepository } from "../db";
import type { Balances, Repository } from "../db/repository";
import { effectiveDeadline } from "../festival/schedule";
import type { Event } from "../festival/types";
import { allowedKinds, cancelBet, effectiveStatus, placeBet, type BetError, type PlaceBetInput } from "./betting";
import { borrow, BORROW_MAX, INTEREST_RATE, repay, type DebtError } from "./debt";
import { isValidNickname } from "./nickname";
import { buildPool, poolTotal, DEFAULT_TRIFECTA_ODDS } from "./odds";
import { rankAccounts } from "./settlement";
import type { Bet, BetKind, CasinoAccountRecord, Market } from "./types";
import type {
  CreditView,
  HistoryBetRow,
  HistoryMarketGroup,
  HistoryView,
  MarketListView,
  MarketSummary,
  MarketView,
  RankView,
} from "./view";

/** 新規口座に付与する初期ポイント（仕様書 機能5） */
export const INITIAL_POINTS = 1000;

/** compare-and-set が他の更新とぶつかったときに読み直す回数 */
const CAS_RETRY = 3;

export type StoreError = BetError | "market_not_found" | "account_not_found" | "conflict";
export type StoreResult = { ok: true; view: MarketView } | { ok: false; error: StoreError };

export type CreditError = DebtError | "account_not_found" | "conflict";
export type CreditResult = { ok: true; view: CreditView } | { ok: false; error: CreditError };

export type RegisterError = "not_in_roster" | "already_registered" | "invalid_password" | "invalid_nickname";
export type RegisterResult = { ok: true } | { ok: false; error: RegisterError };

export type AuthResult = { ok: true } | { ok: false; error: "wrong_password" };

// ---- compare-and-set による残高更新 ----

interface CasOutcome<T> {
  /** 書き込む残高 */
  next: Balances;
  /** 呼び出し側が受け取る付随データ（作成した Bet など） */
  extra: T;
}

type CasCompute<T, E> = (account: CasinoAccountRecord) => { ok: true; value: CasOutcome<T> } | { ok: false; error: E };

type CasResult<T, E> =
  | { ok: true; value: T; before: Balances; after: Balances }
  | { ok: false; error: E | "account_not_found" | "conflict" };

/**
 * 口座を読み込み、compute が計算した残高を compare-and-set で書き込む。
 * 他の更新とぶつかって false が返ったら口座を読み直して最大 CAS_RETRY 回まで再試行し、
 * それでも書けなければ "conflict"。口座自体が無いときは即 "account_not_found"
 * （updateBalances は「不一致」と「口座なし」の両方で false を返すため、毎回読み直して区別する）
 */
async function casUpdate<T, E>(studentId: string, compute: CasCompute<T, E>): Promise<CasResult<T, E>> {
  const repository = getRepository();
  for (let attempt = 0; attempt < CAS_RETRY; attempt += 1) {
    const account = await repository.getAccount(studentId);
    if (!account) return { ok: false, error: "account_not_found" };
    const computed = compute(account);
    if (!computed.ok) return { ok: false, error: computed.error };
    const before: Balances = { pointsBalance: account.pointsBalance, debtAmount: account.debtAmount };
    const written = await repository.updateBalances(studentId, before, computed.value.next);
    if (written) return { ok: true, value: computed.value.extra, before, after: computed.value.next };
  }
  return { ok: false, error: "conflict" };
}

/** CasOutcome に詰める残高（計算結果の口座から取り出すだけ） */
function balancesOf(account: { pointsBalance: number; debtAmount: number }): Balances {
  return { pointsBalance: account.pointsBalance, debtAmount: account.debtAmount };
}

// ---- 表示用データ ----

function players(bets: readonly Bet[]): number {
  return new Set(bets.map((b) => b.studentId)).size;
}

/**
 * 締切を実効値（種目の遅延 delayMin を反映した時刻）に差し替えた Market を返す。
 * 進行が遅れたら賭けの締切も同じだけ後ろにずれる（表示・受付判定の両方でこれを使う）
 */
async function withEffectiveDeadline(repository: Repository, market: Market): Promise<Market> {
  if (market.type !== "event" || market.eventId === null) return market;
  const event = await repository.getEvent(market.eventId);
  return { ...market, deadline: effectiveDeadline(market, event) };
}

/** 一覧向け。取得済みの種目一覧から実効締切を求める（Market ごとに種目を引き直さない） */
function withEffectiveDeadlineFrom(market: Market, events: readonly Event[]): Market {
  if (market.type !== "event" || market.eventId === null) return market;
  const event = events.find((e) => e.id === market.eventId) ?? null;
  return { ...market, deadline: effectiveDeadline(market, event) };
}

export async function getMarketView(marketId: string, studentId: string, now: Date): Promise<MarketView | null> {
  const repository = getRepository();
  const [stored, account, bets] = await Promise.all([
    repository.getMarket(marketId),
    repository.getAccount(studentId),
    repository.listBets({ marketId }),
  ]);
  if (!stored || !account) return null;
  // 表示する締切・ステータスは遅延を反映した実効値にする
  const market = await withEffectiveDeadline(repository, stored);
  const kinds: BetKind[] = ["win", "place", "trifecta"];
  return {
    market: {
      id: market.id,
      type: market.type,
      no: market.no,
      title: market.title,
      en: market.en,
      options: market.options,
      deadline: market.deadline,
      status: effectiveStatus(market, now),
      kinds: allowedKinds(market),
      resultOrder: market.resultOrder,
      trifectaOddsDefault: market.trifectaOddsDefault ?? DEFAULT_TRIFECTA_ODDS,
      trifectaOddsOverrides: market.trifectaOddsOverrides ?? {},
    },
    pools: Object.fromEntries(kinds.map((k) => [k, buildPool(bets, k)])) as Record<BetKind, Record<string, number>>,
    players: players(bets),
    account: balancesOf(account),
    myBets: bets
      .filter((b) => b.studentId === studentId)
      .map((b) => ({ id: b.id, kind: b.kind, selection: b.selection, amount: b.amount, payoutAmount: b.payoutAmount })),
    serverNow: now.toISOString(),
  };
}

export async function getMarketList(studentId: string, now: Date): Promise<MarketListView | null> {
  const repository = getRepository();
  const [markets, account, bets, events] = await Promise.all([
    repository.listMarkets(),
    repository.getAccount(studentId),
    repository.listBets(),
    repository.listEvents(),
  ]);
  if (!account) return null;
  const summaries: MarketSummary[] = markets.map((stored: Market) => {
    const m = withEffectiveDeadlineFrom(stored, events);
    const marketBets = bets.filter((b) => b.marketId === m.id);
    return {
      id: m.id,
      no: m.no,
      title: m.title,
      en: m.en,
      status: effectiveStatus(m, now),
      deadline: m.deadline,
      poolTotal:
        poolTotal(buildPool(marketBets, "win")) +
        poolTotal(buildPool(marketBets, "place")) +
        poolTotal(buildPool(marketBets, "trifecta")),
      players: players(marketBets),
      winnerName: m.resultOrder ? (m.options.find((o) => o.id === m.resultOrder?.[0])?.name ?? null) : null,
    };
  });
  return { markets: summaries, account: balancesOf(account), serverNow: now.toISOString() };
}

// ---- ベット ----

export async function submitBet(
  marketId: string,
  studentId: string,
  input: PlaceBetInput,
  now: Date,
): Promise<StoreResult> {
  const repository = getRepository();
  const stored = await repository.getMarket(marketId);
  if (!stored) return { ok: false, error: "market_not_found" };
  // 受付中かどうかも実効締切（種目の遅延を反映した時刻）で判定する
  const market = await withEffectiveDeadline(repository, stored);

  // 残高を先に押さえてからベットを挿入する（挿入が先だと、残高を引けなかったベットが残る）
  const betId = repository.newId("bet");
  const reserved = await casUpdate<Bet, BetError>(studentId, (account) => {
    const placed = placeBet(account, market, input, now, betId);
    if (!placed.ok) return { ok: false, error: placed.error };
    return { ok: true, value: { next: balancesOf(placed.value.account), extra: placed.value.bet } };
  });
  if (!reserved.ok) return { ok: false, error: reserved.error };

  try {
    await repository.insertBet(reserved.value);
  } catch {
    // 挿入に失敗したら押さえた残高を戻す（best-effort）
    await repository.updateBalances(studentId, reserved.after, reserved.before).catch(() => false);
    return { ok: false, error: "conflict" };
  }

  const view = await getMarketView(marketId, studentId, now);
  return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
}

export async function withdrawBet(betId: string, studentId: string, now: Date): Promise<StoreResult> {
  const repository = getRepository();
  const bet = await repository.getBet(betId);
  if (!bet) return { ok: false, error: "bet_not_found" };
  const [stored, account] = await Promise.all([repository.getMarket(bet.marketId), repository.getAccount(studentId)]);
  if (!stored) return { ok: false, error: "market_not_found" };
  if (!account) return { ok: false, error: "account_not_found" };
  // 取消の締切判定も実効締切で行う（事前チェックと CAS 内で同じ Market を使う）
  const market = await withEffectiveDeadline(repository, stored);
  // 削除する前に検証を済ませる（他人のベット・締切後は触らない）
  const check = cancelBet(account, market, bet, now);
  if (!check.ok) return { ok: false, error: check.error };

  // 「削除 → CAS」の順で行う。逆順（CAS → 削除）にすると削除に失敗したときに
  // 同じベットを何度も取り消して払戻を重複させられる（ポイントを不正に増やせる）。
  // 削除を先にすれば最悪でも「返金されないままベットが消える」方向にしか壊れず、
  // 返金できなかった場合はベットを入れ直して元に戻す
  if (!(await repository.deleteBet(betId))) return { ok: false, error: "bet_not_found" };
  const refunded = await casUpdate<null, BetError>(studentId, (a) => {
    const canceled = cancelBet(a, market, bet, now);
    if (!canceled.ok) return { ok: false, error: canceled.error };
    return { ok: true, value: { next: balancesOf(canceled.value.account), extra: null } };
  });
  if (!refunded.ok) {
    await repository.insertBet(bet).catch(() => undefined);
    return { ok: false, error: refunded.error };
  }

  const view = await getMarketView(market.id, studentId, now);
  return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
}

// ---- 借入れ・返済（F2 CREDIT） ----

async function changeCredit(studentId: string, amount: unknown, action: "borrow" | "repay"): Promise<CreditResult> {
  const repository = getRepository();
  const settings = await repository.getSettings();
  // 最終精算後は借入れ・返済ともできない
  const finalized = settings.finalSettledAt !== null;

  const changed = await casUpdate<null, DebtError>(studentId, (account) => {
    const r = action === "borrow" ? borrow(account, amount, finalized) : repay(account, amount, finalized);
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true, value: { next: balancesOf(r.value), extra: null } };
  });
  if (!changed.ok) return { ok: false, error: changed.error };

  const view = await getCreditView(studentId, new Date());
  return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
}

export function borrowPoints(studentId: string, amount: unknown): Promise<CreditResult> {
  return changeCredit(studentId, amount, "borrow");
}

export function repayPoints(studentId: string, amount: unknown): Promise<CreditResult> {
  return changeCredit(studentId, amount, "repay");
}

export async function getCreditView(studentId: string, now: Date): Promise<CreditView | null> {
  const repository = getRepository();
  const [account, settings] = await Promise.all([repository.getAccount(studentId), repository.getSettings()]);
  if (!account) return null;
  return {
    account: balancesOf(account),
    borrowMax: BORROW_MAX,
    interestPercent: Math.round((INTEREST_RATE - 1) * 100),
    repayMax: Math.min(account.pointsBalance, account.debtAmount),
    finalized: settings.finalSettledAt !== null,
    serverNow: now.toISOString(),
  };
}

// ---- ベット履歴（F3 HISTORY） ----

export async function getHistoryView(studentId: string, now: Date): Promise<HistoryView | null> {
  const repository = getRepository();
  const [account, markets, myBets, events] = await Promise.all([
    repository.getAccount(studentId),
    repository.listMarkets(),
    repository.listBets({ studentId }),
    repository.listEvents(),
  ]);
  if (!account) return null;

  const groups: HistoryMarketGroup[] = [];
  for (const stored of markets) {
    // 履歴のステータスも実効締切で判定する（遅延中の Market を締切済みに見せない）
    const market = withEffectiveDeadlineFrom(stored, events);
    const bets = myBets.filter((b) => b.marketId === market.id);
    if (bets.length === 0) continue;
    const nameOf = (id: string) => market.options.find((o) => o.id === id)?.name ?? id;
    const rows: HistoryBetRow[] = bets.map((b) => ({
      id: b.id,
      kind: b.kind,
      selectionNames: b.selection.map(nameOf),
      amount: b.amount,
      payoutAmount: b.payoutAmount,
    }));
    groups.push({
      marketId: market.id,
      no: market.no,
      title: market.title,
      en: market.en,
      status: effectiveStatus(market, now),
      bets: rows,
      stakeTotal: rows.reduce((a, r) => a + r.amount, 0),
      payoutTotal: rows.reduce((a, r) => a + (r.payoutAmount ?? 0), 0),
    });
  }

  const stakeTotal = groups.reduce((a, g) => a + g.stakeTotal, 0);
  const payoutTotal = groups.reduce((a, g) => a + g.payoutTotal, 0);
  return {
    groups,
    stakeTotal,
    payoutTotal,
    net: payoutTotal - stakeTotal,
    account: balancesOf(account),
    serverNow: now.toISOString(),
  };
}

// ---- 順位（F4 RANK） ----

export async function getRankView(studentId: string, now: Date): Promise<RankView | null> {
  const repository = getRepository();
  const [account, accounts, students, settings] = await Promise.all([
    repository.getAccount(studentId),
    repository.listAccounts(),
    repository.listStudents(),
    repository.getSettings(),
  ]);
  if (!account) return null;

  const finalized = settings.finalSettledAt !== null;
  // rankAccounts は未精算の口座も現在の純資産で順位付けする
  const ranked = rankAccounts(accounts, students);
  const mine = ranked.find((r) => r.studentId === studentId);
  return {
    finalized,
    myRank: mine?.rank ?? ranked.length + 1,
    myNetWorth: mine?.netWorth ?? account.pointsBalance - account.debtAmount,
    total: ranked.length,
    // 最終精算までは全体順位を公開しない（仕様書 機能9）
    rows: finalized ? ranked.map((r) => ({ ...r, me: r.studentId === studentId })) : [],
    account: balancesOf(account),
    serverNow: now.toISOString(),
  };
}

// ---- 口座の作成・認証（機能5） ----

/** 名簿にある学籍番号のみ登録できる。パスワードはハッシュ化して保存する */
export async function registerAccount(studentId: string, password: string, nickname: string): Promise<RegisterResult> {
  const repository = getRepository();
  // 検証の軽い順に判定する（scrypt は 1 回 100ms 程度かかる）
  if (!isValidPassword(password)) return { ok: false, error: "invalid_password" };
  if (!isValidNickname(nickname)) return { ok: false, error: "invalid_nickname" };
  const student = await repository.getStudent(studentId);
  if (!student) return { ok: false, error: "not_in_roster" };
  if (await repository.getAccount(studentId)) return { ok: false, error: "already_registered" };

  const account: CasinoAccountRecord = {
    studentId,
    pointsBalance: INITIAL_POINTS,
    debtAmount: 0,
    passwordHash: hashPassword(password),
    nickname,
    registeredAt: new Date().toISOString(),
    finalBalanceBefore: null,
    finalDebt: null,
  };
  // 同時に同じ学籍番号で登録された場合は insertAccount が false を返す
  const inserted = await repository.insertAccount(account);
  return inserted ? { ok: true } : { ok: false, error: "already_registered" };
}

/** 口座が無い場合もパスワード不一致と同じエラーにする（学籍番号の存在を漏らさない） */
export async function authenticateAccount(studentId: string, password: string): Promise<AuthResult> {
  const account = await getRepository().getAccount(studentId);
  if (!account) return { ok: false, error: "wrong_password" };
  return verifyPassword(password, account.passwordHash) ? { ok: true } : { ok: false, error: "wrong_password" };
}
