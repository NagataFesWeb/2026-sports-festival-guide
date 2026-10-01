// サーバー側のカジノ操作（Market・ベット・借入れ・返済・口座）。永続化は Repository に委譲する
// 残高の増減はこのファイルと betting.ts / debt.ts でのみ行い、クライアントの計算値は受け取らない
import { hashPassword, isValidPassword, verifyPassword } from "../auth/password";
import { getRepository } from "../db";
import { displayReads } from "../db/display-cache";
import { SupabaseRepository } from "../db/supabase";
import type { Balances, Repository } from "../db/repository";
import { effectiveDeadline } from "../festival/schedule";
import type { Event } from "../festival/types";
import { allowedKinds, cancelBet, effectiveStatus, placeBet, type BetError, type PlaceBetInput } from "./betting";
import { borrow, BORROW_MAX, INTEREST_RATE, repay, type DebtError } from "./debt";
import { isValidNickname } from "./nickname";
import { isValidUserId } from "./user-id";
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

export type RegisterError = "invalid_user_id" | "already_registered" | "invalid_password" | "invalid_nickname" | "finalized" | "conflict";
export type RegisterResult = { ok: true } | { ok: false; error: RegisterError };

export type AuthResult = { ok: true } | { ok: false; error: "wrong_password" };

/** 表示用に残高だけを取り出す */
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
      trifectaOddsDefault: DEFAULT_TRIFECTA_ODDS,
      trifectaOddsOverrides: {},
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
  const shared = repository instanceof SupabaseRepository ? displayReads(repository) : repository;
  const [markets, account, bets, events] = await Promise.all([
    shared.listMarkets(),
    repository.getAccount(studentId),
    shared.listBets(),
    shared.listEvents(),
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
  marketId: string, studentId: string, input: PlaceBetInput, now: Date, requestKey?: string,
): Promise<StoreResult> {
  const repository = getRepository();
  for (let attempt = 0; attempt < CAS_RETRY; attempt++) {
    if (requestKey && await repository.hasCasinoReceipt(requestKey)) {
      const view = await getMarketView(marketId, studentId, new Date());
      return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
    }
    const [stored, account, settings] = await Promise.all([
      repository.getMarket(marketId), repository.getAccount(studentId), repository.getSettings(),
    ]);
    if (!stored) return { ok: false, error: "market_not_found" };
    if (!account) return { ok: false, error: "account_not_found" };
    if (settings.finalSettledAt) return { ok: false, error: "market_closed" };
    const event = stored.eventId ? await repository.getEvent(stored.eventId) : null;
    const market = { ...stored, deadline: effectiveDeadline(stored, event) };
    const placed = placeBet(account, market, input, now, repository.newId("bet"));
    if (!placed.ok) return placed;
    const written = await repository.commitCasinoMutation({
      expectedFinalSettledAt: null, expectedAccounts: [account], expectedMarkets: [stored],
      expectedEvents: event ? [event] : [], accounts: [{ ...account, ...placed.value.account }],
      insertBet: placed.value.bet, requestKey, acceptBefore: market.deadline,
    });
    if (written) {
      const view = await getMarketView(marketId, studentId, new Date());
      return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
    }
  }
  return { ok: false, error: "conflict" };
}

export async function withdrawBet(betId: string, studentId: string, now: Date): Promise<StoreResult> {
  const repository = getRepository();
  for (let attempt = 0; attempt < CAS_RETRY; attempt++) {
    const bet = await repository.getBet(betId);
    if (!bet) return { ok: false, error: "bet_not_found" };
    const [stored, account, settings] = await Promise.all([
      repository.getMarket(bet.marketId), repository.getAccount(studentId), repository.getSettings(),
    ]);
    if (!stored) return { ok: false, error: "market_not_found" };
    if (!account) return { ok: false, error: "account_not_found" };
    if (settings.finalSettledAt) return { ok: false, error: "market_closed" };
    const event = stored.eventId ? await repository.getEvent(stored.eventId) : null;
    const market = { ...stored, deadline: effectiveDeadline(stored, event) };
    const canceled = cancelBet(account, market, bet, now);
    if (!canceled.ok) return canceled;
    if (await repository.commitCasinoMutation({
      expectedFinalSettledAt: null, expectedAccounts: [account], expectedMarkets: [stored],
      expectedEvents: event ? [event] : [], expectedBets: [bet], deleteBetId: bet.id,
      accounts: [{ ...account, ...canceled.value.account }], acceptBefore: market.deadline,
    })) {
      const view = await getMarketView(market.id, studentId, new Date());
      return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
    }
  }
  return { ok: false, error: "conflict" };
}

// ---- 借入れ・返済（F2 CREDIT） ----
async function changeCredit(studentId: string, amount: unknown, action: "borrow" | "repay", requestKey?: string): Promise<CreditResult> {
  const repository = getRepository();
  for (let attempt = 0; attempt < CAS_RETRY; attempt++) {
    if (requestKey && await repository.hasCasinoReceipt(requestKey)) {
      const view = await getCreditView(studentId, new Date());
      return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
    }
    const [account, settings] = await Promise.all([repository.getAccount(studentId), repository.getSettings()]);
    if (!account) return { ok: false, error: "account_not_found" };
    const r = action === "borrow" ? borrow(account, amount, settings.finalSettledAt !== null) : repay(account, amount, settings.finalSettledAt !== null);
    if (!r.ok) return r;
    if (await repository.commitCasinoMutation({
      expectedFinalSettledAt: null, expectedAccounts: [account],
      accounts: [{ ...account, ...r.value }], requestKey,
    })) {
      const view = await getCreditView(studentId, new Date());
      return view ? { ok: true, view } : { ok: false, error: "account_not_found" };
    }
  }
  return { ok: false, error: "conflict" };
}

export function borrowPoints(studentId: string, amount: unknown, requestKey?: string): Promise<CreditResult> {
  return changeCredit(studentId, amount, "borrow", requestKey);
}
export function repayPoints(studentId: string, amount: unknown, requestKey?: string): Promise<CreditResult> {
  return changeCredit(studentId, amount, "repay", requestKey);
}
export async function getCreditView(studentId: string, now: Date): Promise<CreditView | null> {
  const repository = getRepository();
  const [account, settings] = await Promise.all([repository.getAccount(studentId), repository.getSettings()]);
  if (!account) return null;
  return {
    account: balancesOf(account), borrowMax: BORROW_MAX,
    interestPercent: Math.round((INTEREST_RATE - 1) * 100),
    repayMax: Math.max(0, Math.min(account.pointsBalance, account.debtAmount)),
    finalized: settings.finalSettledAt !== null, serverNow: now.toISOString(),
  };
}

// ---- ベット履歴（F3 HISTORY） ----

export async function getHistoryView(studentId: string, now: Date): Promise<HistoryView | null> {
  const repository = getRepository();
  const shared = repository instanceof SupabaseRepository ? displayReads(repository) : repository;
  const [account, markets, myBets, events] = await Promise.all([
    repository.getAccount(studentId),
    shared.listMarkets(),
    repository.listBets({ studentId }),
    shared.listEvents(),
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
  const [account, accounts, settings] = await Promise.all([
    repository.getAccount(studentId),
    repository.listAccounts(),
    repository.getSettings(),
  ]);
  if (!account) return null;

  const finalized = settings.finalSettledAt !== null;
  // rankAccounts は未精算の口座も現在の純資産で順位付けする
  const ranked = rankAccounts(accounts);
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

/** 任意のユーザーIDで登録する。パスワードはハッシュ化して保存する */
export async function registerAccount(userId: string, password: string, nickname: string): Promise<RegisterResult> {
  const repository = getRepository();
  // 検証の軽い順に判定する（scrypt は 1 回 100ms 程度かかる）
  if (!isValidUserId(userId)) return { ok: false, error: "invalid_user_id" };
  if (!isValidPassword(password)) return { ok: false, error: "invalid_password" };
  if (!isValidNickname(nickname)) return { ok: false, error: "invalid_nickname" };
  if (await repository.getAccount(userId)) return { ok: false, error: "already_registered" };

  const account: CasinoAccountRecord = {
    // 既存口座・ベット・DBとの互換性のため保存キーの名前を維持する。値はユーザーID。
    studentId: userId,
    pointsBalance: INITIAL_POINTS,
    debtAmount: 0,
    passwordHash: hashPassword(password),
    nickname,
    registeredAt: new Date().toISOString(),
    finalBalanceBefore: null,
    finalDebt: null,
  };
  // 同時に同じユーザーIDで登録された場合は insertAccount が false を返す
  if ((await repository.getSettings()).finalSettledAt) return { ok: false, error: "finalized" };
  const inserted = await repository.commitCasinoMutation({ expectedFinalSettledAt: null, expectedAccounts: [], insertAccount: account });
  if (inserted) return { ok: true };
  if ((await repository.getSettings()).finalSettledAt) return { ok: false, error: "finalized" };
  return { ok: false, error: await repository.getAccount(userId) ? "already_registered" : "conflict" };
}

/** 口座が無い場合もパスワード不一致と同じエラーにする（口座の存在を漏らさない） */
export async function authenticateAccount(userId: string, password: string): Promise<AuthResult> {
  const account = await getRepository().getAccount(userId);
  if (!account) return { ok: false, error: "wrong_password" };
  return verifyPassword(password, account.passwordHash) ? { ok: true } : { ok: false, error: "wrong_password" };
}
