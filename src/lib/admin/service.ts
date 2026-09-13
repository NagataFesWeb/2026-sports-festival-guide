// 実行委員の管理操作。Repository への読み書きと保存順序だけを担い、
// ポイント・オッズ・利子の計算は src/lib/casino/*、順位点は src/lib/festival/* の純粋関数に委譲する
import { effectiveStatus } from "@/lib/casino/betting";
import { finalizeAccount } from "@/lib/casino/debt";
import { buildPool, poolTotal } from "@/lib/casino/odds";
import { settleMarket } from "@/lib/casino/settle";
import type { CasinoAccountRecord, Market, MarketOption, MarketStatus } from "@/lib/casino/types";
import { getRepository, type Repository } from "@/lib/db";
import { parseInviteCsv, parseRosterCsv } from "@/lib/festival/csv";
import { effectiveDeadline, resetDelays, shiftFrom } from "@/lib/festival/schedule";
import { pointsFromOrder } from "@/lib/festival/standings";
import type {
  Event,
  EventCategory,
  EventEntry,
  EventKind,
  FormationType,
  Heat,
  Team,
} from "@/lib/festival/types";

// ---- 共通の戻り値 ----

export type AdminResult<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): AdminResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): AdminResult<T> {
  return { ok: false, error };
}

/** Market 確定の要約 */
export interface SettleSummary {
  /** Market を確定したか（Market が無い・既に確定済みなら false） */
  settled: boolean;
  /** 支払った配当の合計 */
  payoutTotal: number;
  /** 利子が付いた口座数 */
  interestApplied: number;
}

const NOT_SETTLED: SettleSummary = { settled: false, payoutTotal: 0, interestApplied: 0 };

// ---- 入力の検証ヘルパー ----

/** datetime-local（"2026-09-10T13:00"）でも ISO 8601 でも受け取り、ISO に正規化する */
export function toIsoDeadline(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  // input[type=datetime-local] の値（"2026-10-01T14:00"）はタイムゾーンを持たないので日本時間として解釈する
  // （サーバーが UTC の Vercel でもずれないようにする）
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const d = new Date(hasZone ? v : `${v}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isNonNegativeInteger(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0;
}

/** 表示区分（マイページの絞り込みチップ） */
const EVENT_KINDS: readonly EventKind[] = ["ceremony", "track", "field", "club"];

/** 招集隊形図の種類 */
const FORMATION_TYPES: readonly FormationType[] = [
  "grid",
  "track",
  "ball",
  "parade",
  "lane",
  "rope",
  "pole",
  "horse",
  "none",
];

/** ヒート未指定の種目に入れる既定のヒート（種目は必ず 1 ヒート以上持つ） */
const DEFAULT_HEATS: readonly Heat[] = [{ id: "all", label: "総合" }];

/** 新規作成時の表示順。既存の最大値の次にする（削除後に作っても既存と衝突しない） */
function nextSortOrder(items: readonly { sortOrder: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sortOrder), 0) + 1;
}

/** チームを Market の選択肢に変換する（表示順は sortOrder） */
function teamOptions(teams: readonly Team[]): MarketOption[] {
  return [...teams]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({ id: t.id, num: t.num, name: t.name }));
}

/** 着順の妥当性。race は 3 着まで、field は 1 着以上を必須にする */
function validateOrder(order: readonly string[], teams: readonly Team[], category: EventCategory): string | null {
  const need = category === "race" ? 3 : 1;
  if (order.length < need) return `着順は${need}位まで入力してください`;
  const ids = new Set(teams.map((t) => t.id));
  if (!order.every((id) => ids.has(id))) return "着順に存在しないチームが含まれています";
  if (new Set(order).size !== order.length) return "同じチームを複数の順位に指定できません";
  return null;
}

// ---- チーム ----

export interface TeamInput {
  /** 省略すると新規作成 */
  id?: string;
  num: string;
  name: string;
  color: string;
  sortOrder?: number;
}

export async function saveTeam(repo: Repository, input: TeamInput): Promise<AdminResult<Team>> {
  const name = input.name.trim();
  const num = input.num.trim();
  const color = input.color.trim();
  if (!name) return fail("チーム名を入力してください");
  if (!num) return fail("チーム番号を入力してください");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return fail("チームカラーは #RRGGBB 形式で入力してください");

  const teams = await repo.listTeams();
  const existing = input.id ? teams.find((t) => t.id === input.id) : undefined;
  if (input.id && !existing) return fail("チームが見つかりません");

  const team: Team = {
    id: existing?.id ?? repo.newId("team"),
    num,
    name,
    color,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? nextSortOrder(teams),
  };
  await repo.upsertTeam(team);
  return ok(team);
}

// ---- 種目 ----

export interface EventInput {
  /** 省略すると新規作成 */
  id?: string;
  no: string;
  name: string;
  en: string;
  kind: EventKind;
  category: EventCategory;
  /** ISO 8601 または datetime-local。未定なら null */
  startTime: string | null;
  /** 進行の遅延（分）。省略すると既存値（新規は 0） */
  delayMin?: number;
  location: string;
  entries: EventEntry[];
  rankPoints: number[];
  /** ヒート。省略すると既存値、新規で空なら「総合」1 ヒート */
  heats?: Heat[];
  sortOrder?: number;
  participants?: string;
  gatherStart?: string;
  gatherPlace?: string;
  belongings?: string;
  formation?: FormationType;
  formationNote?: string;
  description?: string;
}

/**
 * 入力されたヒートを整える。ID・名前が両方空の行は未入力として捨て、
 * 1 つも残らなければ「総合」1 ヒートにする（種目は必ず 1 ヒート以上持つ）
 */
function normalizeHeats(input: readonly Heat[]): AdminResult<Heat[]> {
  const rows = input
    .map((h) => ({ id: h.id.trim(), label: h.label.trim() }))
    .filter((h) => h.id !== "" || h.label !== "");
  if (rows.length === 0) return ok([...DEFAULT_HEATS]);
  if (rows.some((h) => h.id === "")) return fail("ヒートの ID を入力してください");
  if (rows.some((h) => h.label === "")) return fail("ヒートの名前を入力してください");
  if (new Set(rows.map((h) => h.id)).size !== rows.length) return fail("ヒートの ID が重複しています");
  return ok(rows);
}

export async function saveEvent(repo: Repository, input: EventInput): Promise<AdminResult<Event>> {
  const no = input.no.trim();
  const name = input.name.trim();
  if (!no) return fail("プログラム番号を入力してください");
  if (!name) return fail("種目名を入力してください");
  if (!EVENT_KINDS.includes(input.kind)) return fail("表示区分は ceremony / track / field / club です");
  if (input.category !== "race" && input.category !== "field") return fail("種目の区分は race か field です");
  if (input.formation !== undefined && !FORMATION_TYPES.includes(input.formation)) {
    return fail("招集隊形図の種類が不正です");
  }
  if (!input.rankPoints.every(isNonNegativeInteger)) return fail("順位点は 0 以上の整数で入力してください");
  if (input.delayMin !== undefined && !Number.isSafeInteger(input.delayMin)) {
    return fail("遅延（分）は整数で入力してください");
  }

  // 空の枠（チーム未選択）は組み合わせ未登録として捨てる
  const entries = input.entries.filter((e) => e.teamId.trim() !== "");
  const teamIds = new Set((await repo.listTeams()).map((t) => t.id));
  if (!entries.every((e) => teamIds.has(e.teamId))) return fail("組み合わせに存在しないチームが含まれています");
  if (entries.some((e) => e.slot.trim() === "")) return fail("組み合わせの枠名を入力してください");

  let startTime: string | null = null;
  if (input.startTime !== null && input.startTime.trim() !== "") {
    startTime = toIsoDeadline(input.startTime);
    if (startTime === null) return fail("開始時刻の形式が不正です");
  }

  const events = await repo.listEvents();
  const existing = input.id ? events.find((e) => e.id === input.id) : undefined;
  if (input.id && !existing) return fail("種目が見つかりません");

  const heats = normalizeHeats(input.heats ?? existing?.heats ?? []);
  if (!heats.ok) return fail(heats.error);

  const event: Event = {
    id: existing?.id ?? repo.newId("ev"),
    no,
    name,
    en: input.en.trim(),
    kind: input.kind,
    category: input.category,
    startTime,
    delayMin: input.delayMin ?? existing?.delayMin ?? 0,
    location: input.location.trim(),
    entries: entries.map((e) => ({ slot: e.slot.trim(), teamId: e.teamId })),
    rankPoints: [...input.rankPoints],
    heats: heats.value,
    sortOrder: input.sortOrder ?? existing?.sortOrder ?? nextSortOrder(events),
    participants: (input.participants ?? existing?.participants ?? "").trim(),
    gatherStart: (input.gatherStart ?? existing?.gatherStart ?? "").trim(),
    gatherPlace: (input.gatherPlace ?? existing?.gatherPlace ?? "").trim(),
    belongings: (input.belongings ?? existing?.belongings ?? "").trim(),
    formation: input.formation ?? existing?.formation ?? "none",
    formationNote: (input.formationNote ?? existing?.formationNote ?? "").trim(),
    description: (input.description ?? existing?.description ?? "").trim(),
  };
  await repo.upsertEvent(event);
  return ok(event);
}

/** 種目を削除する。確定結果と紐づく Market も一緒に消す */
export async function removeEvent(repo: Repository, eventId: string): Promise<AdminResult<{ removedMarkets: number }>> {
  const event = await repo.getEvent(eventId);
  if (!event) return fail("種目が見つかりません");

  const markets = (await repo.listMarkets()).filter((m) => m.eventId === eventId);
  // 賭けが乗っている Market を消すと生徒の賭け金が消えてしまうため拒否する（先に締切→結果確定で精算する）
  for (const market of markets) {
    const bets = await repo.listBets({ marketId: market.id });
    if (bets.length > 0) {
      return fail(`Market「${market.title}」に ${bets.length} 件のベットがあるため削除できません。結果を確定して精算してから削除してください`);
    }
  }
  // 結果はヒート単位で保存されているため、この種目の分をすべて消す
  const results = (await repo.listEventResults()).filter((r) => r.eventId === eventId);
  for (const result of results) await repo.deleteEventResult(eventId, result.heatId);
  for (const market of markets) await repo.deleteMarket(market.id);
  await repo.deleteEvent(eventId);
  return ok({ removedMarkets: markets.length });
}

// ---- Market ----

/** 学年ヒート（"1年"〜"3年"）なら裏画面用の英語サフィックス（"Y1"）を返す */
function heatEnSuffix(label: string): string | null {
  const m = /^([1-3])年$/.exec(label);
  return m ? `Y${m[1]}` : null;
}

/** 種目のヒートに紐づく Market を作る（1 ヒート 1 Market） */
export async function createEventMarket(
  repo: Repository,
  eventId: string,
  heatId: string,
  deadlineIso: string,
): Promise<AdminResult<Market>> {
  const deadline = toIsoDeadline(deadlineIso);
  if (!deadline) return fail("締切の日時を入力してください");

  const event = await repo.getEvent(eventId);
  if (!event) return fail("種目が見つかりません");
  const heat = event.heats.find((h) => h.id === heatId);
  if (!heat) return fail("ヒートが見つかりません");
  if ((await repo.listMarkets()).some((m) => m.eventId === eventId && m.heatId === heatId)) {
    return fail("この種目・ヒートの Market は既に作成済みです");
  }
  const teams = await repo.listTeams();
  if (teams.length === 0) return fail("チームが登録されていません");

  // 1 ヒートだけの種目は種目名をそのまま使い、複数ヒートならヒート名を添える（シードと同じ規則）
  const multi = event.heats.length > 1;
  const en = event.en || event.name;
  const enSuffix = multi ? heatEnSuffix(heat.label) : null;

  const market: Market = {
    id: repo.newId("mkt"),
    type: "event",
    eventId,
    heatId,
    category: event.category,
    no: event.no,
    title: multi ? `${event.name} ${heat.label}` : event.name,
    en: enSuffix ? `${en} ${enSuffix}` : en,
    options: teamOptions(teams),
    deadline,
    status: "open",
    resultOrder: null,
  };
  await repo.upsertMarket(market);
  return ok(market);
}

/** 全体優勝の Market を作る */
export async function createOverallMarket(repo: Repository, deadlineIso: string): Promise<AdminResult<Market>> {
  const deadline = toIsoDeadline(deadlineIso);
  if (!deadline) return fail("締切の日時を入力してください");
  const teams = await repo.listTeams();
  if (teams.length === 0) return fail("チームが登録されていません");

  const market: Market = {
    id: repo.newId("mkt"),
    type: "overall",
    eventId: null,
    heatId: null,
    category: null,
    no: "*",
    title: "体育祭 全体優勝",
    en: "OVERALL WINNER",
    options: teamOptions(teams),
    deadline,
    status: "open",
    resultOrder: null,
  };
  await repo.upsertMarket(market);
  return ok(market);
}

export interface CustomMarketInput {
  title: string;
  en: string;
  optionA: string;
  optionB: string;
  deadlineIso: string;
  /** 選択肢の表示番号。省略すると "A" / "B" */
  numA?: string;
  numB?: string;
}

/** 二択の custom Market（紅白の大将戦など）を作る */
export async function createCustomMarket(repo: Repository, input: CustomMarketInput): Promise<AdminResult<Market>> {
  const deadline = toIsoDeadline(input.deadlineIso);
  if (!deadline) return fail("締切の日時を入力してください");
  const title = input.title.trim();
  const optionA = input.optionA.trim();
  const optionB = input.optionB.trim();
  if (!title) return fail("Market の名前を入力してください");
  if (!optionA || !optionB) return fail("2 つの選択肢を入力してください");

  const market: Market = {
    id: repo.newId("mkt"),
    type: "custom",
    eventId: null,
    heatId: null,
    category: null,
    no: "#",
    title,
    en: input.en.trim() || title,
    options: [
      { id: "a", num: (input.numA ?? "A").trim() || "A", name: optionA },
      { id: "b", num: (input.numB ?? "B").trim() || "B", name: optionB },
    ],
    deadline,
    status: "open",
    resultOrder: null,
  };
  await repo.upsertMarket(market);
  return ok(market);
}

export async function updateMarketDeadline(
  repo: Repository,
  marketId: string,
  deadlineIso: string,
): Promise<AdminResult<Market>> {
  const deadline = toIsoDeadline(deadlineIso);
  if (!deadline) return fail("締切の日時を入力してください");
  const market = await repo.getMarket(marketId);
  if (!market) return fail("Market が見つかりません");
  if (market.status === "settled") return fail("確定済みの Market は変更できません");

  const next: Market = { ...market, deadline };
  await repo.upsertMarket(next);
  return ok(next);
}

/** 締切を待たずに締め切る */
export async function closeMarketNow(repo: Repository, marketId: string): Promise<AdminResult<Market>> {
  const market = await repo.getMarket(marketId);
  if (!market) return fail("Market が見つかりません");
  if (market.status === "settled") return fail("確定済みの Market は変更できません");

  const next: Market = { ...market, status: "closed" };
  await repo.upsertMarket(next);
  return ok(next);
}

/** 締め切った Market を再開する（deadline が過ぎていれば実質 closed のまま） */
export async function reopenMarket(repo: Repository, marketId: string): Promise<AdminResult<Market>> {
  const market = await repo.getMarket(marketId);
  if (!market) return fail("Market が見つかりません");
  if (market.status === "settled") return fail("確定済みの Market は再開できません");

  const next: Market = { ...market, status: "open" };
  await repo.upsertMarket(next);
  return ok(next);
}

export interface MarketSummaryRow {
  /** 保存されている Market（deadline は定刻ベース） */
  market: Market;
  /** 紐づく種目の遅延を反映した実効締切 */
  effectiveDeadline: string;
  /** 実効締切を考慮した実効ステータス */
  status: MarketStatus;
  /** ヒート名（種目 Market のみ。1 ヒートだけの種目・overall・custom は null） */
  heatLabel: string | null;
  /** 全賭式のプール合計 */
  poolTotal: number;
  betCount: number;
}

/** Market 一覧に出すプール・件数・実効締切をまとめる（UI では計算しない） */
export async function marketSummaries(repo: Repository, now: Date): Promise<MarketSummaryRow[]> {
  const [markets, bets, events] = await Promise.all([repo.listMarkets(), repo.listBets(), repo.listEvents()]);
  const eventById = new Map(events.map((e) => [e.id, e]));
  return markets.map((market) => {
    const mine = bets.filter((b) => b.marketId === market.id);
    const event = market.eventId === null ? null : (eventById.get(market.eventId) ?? null);
    const deadline = effectiveDeadline(market, event);
    const heat = event && event.heats.length > 1 ? event.heats.find((h) => h.id === market.heatId) : undefined;
    return {
      market,
      effectiveDeadline: deadline,
      // 締切が遅延ぶんずれるため、ステータスも実効締切で判定する
      status: effectiveStatus({ ...market, deadline }, now),
      heatLabel: heat?.label ?? null,
      poolTotal:
        poolTotal(buildPool(mine, "win")) + poolTotal(buildPool(mine, "place")) + poolTotal(buildPool(mine, "trifecta")),
      betCount: mine.length,
    };
  });
}

// ---- 結果確定 ----

/** settleMarket の結果を「Market → 配当 → 口座」の順で保存する（順序を変えない） */
async function persistSettlement(
  repo: Repository,
  market: Market,
  order: readonly string[],
  now: Date,
): Promise<AdminResult<SettleSummary>> {
  const [bets, accounts] = await Promise.all([repo.listBets({ marketId: market.id }), repo.listAccounts()]);
  const settled = settleMarket({ market, bets, accounts, order: [...order], now });
  if (!settled.ok) {
    return fail(settled.error === "already_settled" ? "この Market は既に確定済みです" : "着順が Market の選択肢と一致しません");
  }

  const before = new Map(accounts.map((a) => [a.studentId, a]));
  await repo.upsertMarket(settled.value.market);
  await repo.updateBetPayouts(settled.value.payouts);
  await repo.updateAccounts(settled.value.accounts);

  const payoutTotal = settled.value.payouts.reduce((sum, p) => sum + p.payoutAmount, 0);
  const interestApplied = settled.value.accounts.filter((a: CasinoAccountRecord) => {
    const prev = before.get(a.studentId);
    return prev !== undefined && a.debtAmount > prev.debtAmount;
  }).length;
  return ok({ settled: true, payoutTotal, interestApplied });
}

export interface EventResultInput {
  /** 着順（順位点がある種目は必須） */
  order?: string[];
  /** チームごとの得点。順位点が無い種目（玉入れ・棒引き）は必須、順位点がある種目では手動上書き */
  points?: Record<string, number>;
}

/** 得点から着順を導く。得点の多い順、同点はチームの表示順（sortOrder） */
function orderFromPoints(points: Record<string, number>, teams: readonly Team[]): string[] {
  const sortOrderOf = new Map(teams.map((t) => [t.id, t.sortOrder]));
  return Object.keys(points).sort(
    (a, b) => (points[b] ?? 0) - (points[a] ?? 0) || (sortOrderOf.get(a) ?? 0) - (sortOrderOf.get(b) ?? 0),
  );
}

/**
 * 精算に渡す着順。三連単があり得る race Market は着順が 3 件必要（settle.ts の requiredOrderLength）なので、
 * 得点入力から導いた着順が短いときだけ残りのチームを表示順（options の順）で埋める。
 * 埋めるのは精算用の配列だけで、EventResult に保存する着順は入力どおりのまま。
 * 配当は上位 3 着までしか見ない（odds.ts の hitKeys）ため、埋めた分が配当を変えることはない
 */
function settlementOrder(order: readonly string[], market: Market): string[] {
  const need = market.type === "event" && market.category === "race" && market.options.length >= 3 ? 3 : 1;
  if (order.length >= need) return [...order];
  const rest = market.options.map((o) => o.id).filter((id) => !order.includes(id));
  return [...order, ...rest.slice(0, need - order.length)];
}

/**
 * 種目のヒートの結果を確定する。得点を保存し、紐づく Market があれば同時に精算する。
 * 既に確定済みの Market には触れない（2 回目の確定で二重払いしない）
 */
export async function confirmEventResult(
  repo: Repository,
  eventId: string,
  heatId: string,
  input: EventResultInput,
): Promise<AdminResult<SettleSummary>> {
  const event = await repo.getEvent(eventId);
  if (!event) return fail("種目が見つかりません");
  if (!event.heats.some((h) => h.id === heatId)) return fail("ヒートが見つかりません");

  const teams = await repo.listTeams();
  if (input.points) {
    if (!Object.values(input.points).every(isNonNegativeInteger)) {
      return fail("得点は 0 以上の整数で入力してください");
    }
    if (!Object.keys(input.points).every((id) => teams.some((t) => t.id === id))) {
      return fail("得点に存在しないチームが含まれています");
    }
  }

  let order: string[];
  let points: Record<string, number>;
  if (event.rankPoints.length > 0) {
    // 順位点のある種目：着順を入力し、順位点から得点を計算する（points があればそれを優先）
    if (!input.order) return fail("着順を入力してください");
    const orderError = validateOrder(input.order, teams, event.category);
    if (orderError) return fail(orderError);
    order = [...input.order];
    points = input.points ?? pointsFromOrder(order, event.rankPoints);
  } else {
    // 順位点が無い種目（玉入れ・棒引き）：得点を直接入力し、着順は得点の多い順に導く
    const entries = Object.entries(input.points ?? {});
    if (entries.length === 0) return fail("得点を1チーム以上入力してください");
    points = Object.fromEntries(entries);
    order = orderFromPoints(points, teams);
  }

  const now = new Date();
  await repo.upsertEventResult({
    eventId,
    heatId,
    order,
    points,
    confirmedAt: now.toISOString(),
  });

  const market = (await repo.listMarkets()).find((m) => m.eventId === eventId && m.heatId === heatId);
  if (!market || market.status === "settled") return ok(NOT_SETTLED);
  return persistSettlement(repo, market, settlementOrder(order, market), now);
}

/** 確定したヒートの結果を取り消す。Market が確定済みの場合は取り消せない */
export async function removeEventResult(
  repo: Repository,
  eventId: string,
  heatId: string,
): Promise<AdminResult<{ eventId: string; heatId: string }>> {
  const result = await repo.getEventResult(eventId, heatId);
  if (!result) return fail("確定済みの結果がありません");
  const market = (await repo.listMarkets()).find((m) => m.eventId === eventId && m.heatId === heatId);
  if (market?.status === "settled") return fail("Market が確定済みのため結果を取り消せません");

  await repo.deleteEventResult(eventId, heatId);
  return ok({ eventId, heatId });
}

// ---- 進行（遅延）・得点公開 ----

export interface ScheduleShiftSummary {
  /** 遅延を動かした種目数 */
  changed: number;
}

/**
 * 進行の遅延を動かす。eventId を指定するとその種目以降（プログラム順）を、
 * null なら全種目をまとめて deltaMin 分ずらす
 */
export async function shiftSchedule(
  repo: Repository,
  eventId: string | null,
  deltaMin: number,
): Promise<AdminResult<ScheduleShiftSummary>> {
  if (!Number.isSafeInteger(deltaMin)) return fail("分は整数で入力してください");
  const events = await repo.listEvents();
  if (eventId !== null && !events.some((e) => e.id === eventId)) return fail("種目が見つかりません");

  const changed = shiftFrom(events, eventId, deltaMin);
  for (const event of changed) await repo.upsertEvent(event);
  return ok({ changed: changed.length });
}

/** 全種目を定刻に戻す */
export async function resetSchedule(repo: Repository): Promise<AdminResult<ScheduleShiftSummary>> {
  const changed = resetDelays(await repo.listEvents());
  for (const event of changed) await repo.upsertEvent(event);
  return ok({ changed: changed.length });
}

/** 得点・順位を表側に公開する（閉会式で実行する） */
export async function publishScores(repo: Repository): Promise<AdminResult<{ scoresPublishedAt: string }>> {
  const settings = await repo.getSettings();
  const scoresPublishedAt = settings.scoresPublishedAt ?? new Date().toISOString();
  await repo.updateSettings({ ...settings, scoresPublishedAt });
  return ok({ scoresPublishedAt });
}

/** 得点・順位を非公開に戻す */
export async function unpublishScores(repo: Repository): Promise<AdminResult<{ scoresPublishedAt: null }>> {
  const settings = await repo.getSettings();
  await repo.updateSettings({ ...settings, scoresPublishedAt: null });
  return ok({ scoresPublishedAt: null });
}

/** 全体優勝の Market を確定する */
export async function settleOverallMarket(repo: Repository, order: readonly string[]): Promise<AdminResult<SettleSummary>> {
  const market = (await repo.listMarkets()).find((m) => m.type === "overall" && m.status !== "settled");
  if (!market) return fail("未確定の全体優勝 Market がありません");

  const teams = await repo.listTeams();
  const orderError = validateOrder(order, teams, "field");
  if (orderError) return fail(orderError);
  return persistSettlement(repo, market, order, new Date());
}

/** custom Market（二択）の勝者を確定する */
export async function settleCustomMarket(
  repo: Repository,
  marketId: string,
  winningOptionId: string,
): Promise<AdminResult<SettleSummary>> {
  const market = await repo.getMarket(marketId);
  if (!market) return fail("Market が見つかりません");
  if (market.status === "settled") return fail("この Market は既に確定済みです");
  if (!market.options.some((o) => o.id === winningOptionId)) return fail("勝者を選択してください");
  return persistSettlement(repo, market, [winningOptionId], new Date());
}

// ---- CSV 取り込み ----

export interface ImportSummary {
  count: number;
  errors: string[];
}

/**
 * 招集案内 CSV を取り込み、既存データを丸ごと差し替える。
 * 1 行も読めなかったときは差し替えない（誤ったファイルで全件消さないため）
 */
export async function importInvites(repo: Repository, csvText: string): Promise<AdminResult<ImportSummary>> {
  const { entries, errors } = parseInviteCsv(csvText, () => repo.newId("inv"));
  if (entries.length === 0) {
    return fail(`取り込める行がありませんでした（${errors.join(" / ") || "データ行がありません"}）`);
  }
  await repo.replaceInvites(entries);
  return ok({ count: entries.length, errors });
}

/** 生徒名簿 CSV を取り込み、既存データを丸ごと差し替える */
export async function importRoster(repo: Repository, csvText: string): Promise<AdminResult<ImportSummary>> {
  const { students, errors } = parseRosterCsv(csvText);
  if (students.length === 0) {
    return fail(`取り込める行がありませんでした（${errors.join(" / ") || "データ行がありません"}）`);
  }
  await repo.replaceStudents(students);
  return ok({ count: students.length, errors });
}

// ---- 最終精算 ----

export interface FinalSettlementSummary {
  finalSettledAt: string;
  /** 精算した（または精算済みの）口座数 */
  accounts: number;
  /** 今回実行したのではなく、既に精算済みだった */
  alreadySettled: boolean;
}

export interface SettlementPreview {
  /** 口座数 */
  accounts: number;
  /** 借金の合計 */
  totalDebt: number;
  /** 所持ポイントの合計 */
  totalBalance: number;
  /** 最終精算の実行時刻。null なら未実施 */
  finalSettledAt: string | null;
  /** 得点・順位を表側に公開した時刻。null なら非公開 */
  scoresPublishedAt: string | null;
}

/** 最終精算の前に見せる集計（UI では合計を計算しない） */
export async function settlementPreview(repo: Repository): Promise<SettlementPreview> {
  const [accounts, settings] = await Promise.all([repo.listAccounts(), repo.getSettings()]);
  return {
    accounts: accounts.length,
    totalDebt: accounts.reduce((sum, a) => sum + a.debtAmount, 0),
    totalBalance: accounts.reduce((sum, a) => sum + a.pointsBalance, 0),
    finalSettledAt: settings.finalSettledAt,
    scoresPublishedAt: settings.scoresPublishedAt ?? null,
  };
}

/**
 * 最終精算。全口座に finalizeAccount を適用し、実行時刻を settings に記録する。
 * 冪等: 既に実行済みなら何も変えずに記録済みの時刻を返す
 */
export async function runFinalSettlement(repo: Repository): Promise<AdminResult<FinalSettlementSummary>> {
  const settings = await repo.getSettings();
  const accounts = await repo.listAccounts();
  if (settings.finalSettledAt) {
    return ok({ finalSettledAt: settings.finalSettledAt, accounts: accounts.length, alreadySettled: true });
  }

  await repo.updateAccounts(accounts.map(finalizeAccount));
  const finalSettledAt = new Date().toISOString();
  await repo.updateSettings({ ...settings, finalSettledAt });
  return ok({ finalSettledAt, accounts: accounts.length, alreadySettled: false });
}

// ---- 既定の Repository を束ねた入口 ----

/** Server Action から使う。Repository を getRepository() に固定した薄いラッパ */
export function adminService() {
  const repo = getRepository();
  return {
    repo,
    saveTeam: (input: TeamInput) => saveTeam(repo, input),
    saveEvent: (input: EventInput) => saveEvent(repo, input),
    removeEvent: (eventId: string) => removeEvent(repo, eventId),
    createEventMarket: (eventId: string, heatId: string, deadlineIso: string) =>
      createEventMarket(repo, eventId, heatId, deadlineIso),
    createOverallMarket: (deadlineIso: string) => createOverallMarket(repo, deadlineIso),
    createCustomMarket: (input: CustomMarketInput) => createCustomMarket(repo, input),
    updateMarketDeadline: (marketId: string, deadlineIso: string) => updateMarketDeadline(repo, marketId, deadlineIso),
    closeMarketNow: (marketId: string) => closeMarketNow(repo, marketId),
    reopenMarket: (marketId: string) => reopenMarket(repo, marketId),
    marketSummaries: (now: Date) => marketSummaries(repo, now),
    confirmEventResult: (eventId: string, heatId: string, input: EventResultInput) =>
      confirmEventResult(repo, eventId, heatId, input),
    removeEventResult: (eventId: string, heatId: string) => removeEventResult(repo, eventId, heatId),
    shiftSchedule: (eventId: string | null, deltaMin: number) => shiftSchedule(repo, eventId, deltaMin),
    resetSchedule: () => resetSchedule(repo),
    publishScores: () => publishScores(repo),
    unpublishScores: () => unpublishScores(repo),
    settleOverallMarket: (order: readonly string[]) => settleOverallMarket(repo, order),
    settleCustomMarket: (marketId: string, winningOptionId: string) => settleCustomMarket(repo, marketId, winningOptionId),
    importInvites: (csvText: string) => importInvites(repo, csvText),
    importRoster: (csvText: string) => importRoster(repo, csvText),
    settlementPreview: () => settlementPreview(repo),
    runFinalSettlement: () => runFinalSettlement(repo),
  };
}
