// 本番用の永続化実装。PostgREST（Supabase の REST API）に fetch で直接アクセスする
// service role キーを使うためサーバー側専用。npm 依存を増やさないため公式クライアントは使わない
import type { Bet, BetKind, CasinoAccountRecord, EventCategory as MarketCategory, Market, MarketOption, MarketStatus, MarketType } from "../casino/types";
import type {
  Event,
  EventCategory,
  EventEntry,
  EventKind,
  EventResult,
  FormationType,
  Heat,
  InviteEntry,
  Settings,
  Student,
  Team,
} from "../festival/types";
import type { Balances, BetFilter, Repository } from "./repository";

/** 1 リクエストに載せる最大行数（URL 長・ペイロード対策） */
const INSERT_CHUNK = 500;
/** Supabase Data API の既定の取得上限に合わせ、全件取得はページ単位で行う */
const SELECT_PAGE_SIZE = 1000;
/** id=in.(...) に並べる最大件数（URL が長くなりすぎると 414 になる） */
const FILTER_CHUNK = 200;

// ---- 低レベル: PostgREST へのアクセス ----

function credentials(): { url: string; key: string } {
  // 環境変数はモジュール読み込み時ではなく呼び出しごとに読む（テスト・遅延設定に対応するため）
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase の環境変数（NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY）が未設定です");
  return { url: url.replace(/\/+$/, ""), key };
}

interface SendOptions {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Prefer ヘッダ（resolution=merge-duplicates / return=representation など） */
  prefer?: string;
  body?: unknown;
  range?: string;
}

async function send(pathAndQuery: string, options: SendOptions): Promise<Response> {
  const { url, key } = credentials();
  const headers: Record<string, string> = { apikey: key };
  // 新しい sb_secret_ キーは JWT ではないため Authorization に入れない
  if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.prefer) headers["Prefer"] = options.prefer;
  if (options.range) headers.Range = options.range;

  const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${options.method} ${pathAndQuery} が失敗しました (${res.status}): ${await res.text()}`);
  return res;
}

/** GET して行の配列を受け取る */
async function selectRows<R>(pathAndQuery: string): Promise<R[]> {
  const rows: R[] = [];
  for (let start = 0; ; start += SELECT_PAGE_SIZE) {
    const res = await send(pathAndQuery, {
      method: "GET",
      range: `${start}-${start + SELECT_PAGE_SIZE - 1}`,
    });
    const page = (await res.json()) as R[];
    rows.push(...page);
    if (page.length < SELECT_PAGE_SIZE) return rows;
  }
}

/** 主キー衝突時は既存行にマージする upsert */
async function upsertRows(table: string, rows: readonly unknown[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    await send(table, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: rows.slice(i, i + INSERT_CHUNK),
    });
  }
}

/** 全行削除。PostgREST は無条件 DELETE を拒否するため、常に真になるフィルタを付ける */
async function deleteAll(table: string, keyColumn: string): Promise<void> {
  await send(`${table}?${keyColumn}=neq.__none__`, { method: "DELETE", prefer: "return=minimal" });
}

function eq(column: string, value: string): string {
  return `${column}=eq.${encodeURIComponent(value)}`;
}

function chunk<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// ---- 行の型（jsonb 列も明示的に型を付ける） ----

interface StudentRow {
  student_id: string;
  name: string;
  grade: number | null;
  class_no: number | null;
}

interface TeamRow {
  id: string;
  num: string;
  name: string;
  color: string;
  sort_order: number;
}

interface EventRow {
  id: string;
  no: string;
  name: string;
  en: string;
  kind: EventKind;
  category: EventCategory;
  start_time: string | null;
  delay_min: number;
  location: string;
  entries: EventEntry[];
  rank_points: number[];
  heats: Heat[];
  sort_order: number;
  participants: string;
  gather_start: string;
  gather_place: string;
  belongings: string;
  formation: FormationType;
  formation_note: string;
  description: string;
}

interface EventResultRow {
  event_id: string;
  heat_id: string;
  order: string[];
  points: Record<string, number>;
  confirmed_at: string;
}

interface InviteRow {
  id: string;
  student_id: string;
  event_name: string;
  gather_time: string;
  location: string;
  tag: string;
}

interface MarketRow {
  id: string;
  type: MarketType;
  event_id: string | null;
  heat_id: string | null;
  category: MarketCategory | null;
  no: string;
  title: string;
  en: string;
  options: MarketOption[];
  deadline: string;
  status: MarketStatus;
  result_order: string[] | null;
}

interface BetRow {
  id: string;
  market_id: string;
  student_id: string;
  kind: BetKind;
  selection: string[];
  amount: number;
  payout_amount: number | null;
  created_at: string;
}

interface AccountRow {
  student_id: string;
  password_hash: string;
  nickname: string;
  points_balance: number;
  debt_amount: number;
  registered_at: string;
  final_balance_before: number | null;
  final_debt: number | null;
}

interface SettingsRow {
  id: number;
  final_settled_at: string | null;
  scores_published_at: string | null;
}

// ---- 行 ↔ ドメインオブジェクトの変換 ----

const toStudent = (r: StudentRow): Student => ({
  studentId: r.student_id,
  name: r.name,
  grade: r.grade ?? null,
  classNo: r.class_no ?? null,
});
const fromStudent = (s: Student): StudentRow => ({
  student_id: s.studentId,
  name: s.name,
  grade: s.grade,
  class_no: s.classNo,
});

const toTeam = (r: TeamRow): Team => ({ id: r.id, num: r.num, name: r.name, color: r.color, sortOrder: r.sort_order });
const fromTeam = (t: Team): TeamRow => ({ id: t.id, num: t.num, name: t.name, color: t.color, sort_order: t.sortOrder });

const toEvent = (r: EventRow): Event => ({
  id: r.id,
  no: r.no,
  name: r.name,
  en: r.en,
  kind: r.kind,
  category: r.category,
  startTime: r.start_time,
  delayMin: r.delay_min ?? 0,
  location: r.location,
  entries: r.entries ?? [],
  rankPoints: r.rank_points ?? [],
  heats: r.heats ?? [],
  sortOrder: r.sort_order,
  participants: r.participants ?? "",
  gatherStart: r.gather_start ?? "",
  gatherPlace: r.gather_place ?? "",
  belongings: r.belongings ?? "",
  formation: r.formation,
  formationNote: r.formation_note ?? "",
  description: r.description ?? "",
});
const fromEvent = (e: Event): EventRow => ({
  id: e.id,
  no: e.no,
  name: e.name,
  en: e.en,
  kind: e.kind,
  category: e.category,
  start_time: e.startTime,
  delay_min: e.delayMin,
  location: e.location,
  entries: e.entries,
  rank_points: e.rankPoints,
  heats: e.heats,
  sort_order: e.sortOrder,
  participants: e.participants,
  gather_start: e.gatherStart,
  gather_place: e.gatherPlace,
  belongings: e.belongings,
  formation: e.formation,
  formation_note: e.formationNote,
  description: e.description,
});

const toEventResult = (r: EventResultRow): EventResult => ({
  eventId: r.event_id,
  heatId: r.heat_id,
  order: r.order ?? [],
  points: r.points ?? {},
  confirmedAt: r.confirmed_at,
});
const fromEventResult = (r: EventResult): EventResultRow => ({
  event_id: r.eventId,
  heat_id: r.heatId,
  order: r.order,
  points: r.points,
  confirmed_at: r.confirmedAt,
});

const toInvite = (r: InviteRow): InviteEntry => ({
  id: r.id,
  studentId: r.student_id,
  eventName: r.event_name,
  gatherTime: r.gather_time,
  location: r.location,
  tag: r.tag ?? "",
});
const fromInvite = (i: InviteEntry): InviteRow => ({
  id: i.id,
  student_id: i.studentId,
  event_name: i.eventName,
  gather_time: i.gatherTime,
  location: i.location,
  tag: i.tag,
});

const toMarket = (r: MarketRow): Market => ({
  id: r.id,
  type: r.type,
  eventId: r.event_id,
  heatId: r.heat_id ?? null,
  category: r.category,
  no: r.no,
  title: r.title,
  en: r.en,
  options: r.options ?? [],
  deadline: r.deadline,
  status: r.status,
  resultOrder: r.result_order,
});
const fromMarket = (m: Market): MarketRow => ({
  id: m.id,
  type: m.type,
  event_id: m.eventId,
  heat_id: m.heatId,
  category: m.category,
  no: m.no,
  title: m.title,
  en: m.en,
  options: m.options,
  deadline: m.deadline,
  status: m.status,
  result_order: m.resultOrder,
});

const toBet = (r: BetRow): Bet => ({
  id: r.id,
  marketId: r.market_id,
  studentId: r.student_id,
  kind: r.kind,
  selection: r.selection ?? [],
  amount: r.amount,
  payoutAmount: r.payout_amount,
  createdAt: r.created_at,
});
const fromBet = (b: Bet): BetRow => ({
  id: b.id,
  market_id: b.marketId,
  student_id: b.studentId,
  kind: b.kind,
  selection: b.selection,
  amount: b.amount,
  payout_amount: b.payoutAmount,
  created_at: b.createdAt,
});

const toAccount = (r: AccountRow): CasinoAccountRecord => ({
  studentId: r.student_id,
  pointsBalance: r.points_balance,
  debtAmount: r.debt_amount,
  passwordHash: r.password_hash,
  // 旧行（nickname 列追加前）にも耐える
  nickname: r.nickname ?? "",
  registeredAt: r.registered_at,
  finalBalanceBefore: r.final_balance_before,
  finalDebt: r.final_debt,
});
const fromAccount = (a: CasinoAccountRecord): AccountRow => ({
  student_id: a.studentId,
  password_hash: a.passwordHash,
  nickname: a.nickname,
  points_balance: a.pointsBalance,
  debt_amount: a.debtAmount,
  registered_at: a.registeredAt,
  final_balance_before: a.finalBalanceBefore,
  final_debt: a.finalDebt,
});

export class SupabaseRepository implements Repository {
  // ---- 生徒名簿 ----

  async listStudents(): Promise<Student[]> {
    return (await selectRows<StudentRow>("students?select=*&order=student_id")).map(toStudent);
  }

  async getStudent(studentId: string): Promise<Student | null> {
    const rows = await selectRows<StudentRow>(`students?select=*&${eq("student_id", studentId)}&limit=1`);
    return rows.length > 0 ? toStudent(rows[0]) : null;
  }

  async replaceStudents(students: readonly Student[]): Promise<void> {
    // 名簿は CSV で丸ごと入れ替える運用。主キーは student_id なので削除フィルタもその列で行う
    await deleteAll("students", "student_id");
    await upsertRows("students", students.map(fromStudent));
  }

  // ---- チーム・種目・結果 ----

  async listTeams(): Promise<Team[]> {
    return (await selectRows<TeamRow>("teams?select=*&order=sort_order")).map(toTeam);
  }

  async upsertTeam(team: Team): Promise<void> {
    await upsertRows("teams", [fromTeam(team)]);
  }

  async deleteTeam(teamId: string): Promise<void> {
    await send(`teams?${eq("id", teamId)}`, { method: "DELETE", prefer: "return=minimal" });
  }

  async listEvents(): Promise<Event[]> {
    return (await selectRows<EventRow>("events?select=*&order=sort_order")).map(toEvent);
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const rows = await selectRows<EventRow>(`events?select=*&${eq("id", eventId)}&limit=1`);
    return rows.length > 0 ? toEvent(rows[0]) : null;
  }

  async upsertEvent(event: Event): Promise<void> {
    await upsertRows("events", [fromEvent(event)]);
  }

  async deleteEvent(eventId: string): Promise<void> {
    await send(`events?${eq("id", eventId)}`, { method: "DELETE", prefer: "return=minimal" });
  }

  async listEventResults(): Promise<EventResult[]> {
    // "order" は予約語のため、並べ替え・絞り込みには使わず select=* だけで取得する
    return (await selectRows<EventResultRow>("event_results?select=*")).map(toEventResult);
  }

  async getEventResult(eventId: string, heatId: string): Promise<EventResult | null> {
    const query = `${eq("event_id", eventId)}&${eq("heat_id", heatId)}`;
    const rows = await selectRows<EventResultRow>(`event_results?select=*&${query}&limit=1`);
    return rows.length > 0 ? toEventResult(rows[0]) : null;
  }

  async upsertEventResult(result: EventResult): Promise<void> {
    // 主キーが複合（event_id, heat_id）なので on_conflict を明示する（PostgREST はカンマ区切りをそのまま受ける）
    await upsertRows("event_results?on_conflict=event_id,heat_id", [fromEventResult(result)]);
  }

  async deleteEventResult(eventId: string, heatId: string): Promise<void> {
    const query = `${eq("event_id", eventId)}&${eq("heat_id", heatId)}`;
    await send(`event_results?${query}`, { method: "DELETE", prefer: "return=minimal" });
  }

  // ---- 招集案内 ----

  async listInvites(studentId?: string): Promise<InviteEntry[]> {
    const filter = studentId === undefined ? "" : `&${eq("student_id", studentId)}`;
    return (await selectRows<InviteRow>(`invites?select=*${filter}&order=id`)).map(toInvite);
  }

  async replaceInvites(entries: readonly InviteEntry[]): Promise<void> {
    await deleteAll("invites", "id");
    await upsertRows("invites", entries.map(fromInvite));
  }

  // ---- カジノ: Market・ベット ----

  async listMarkets(): Promise<Market[]> {
    // 同じ種目の学年別 Market は no が同じなので、id を第 2 キーにして並びを固定する
    return (await selectRows<MarketRow>("markets?select=*&order=no,id")).map(toMarket);
  }

  async getMarket(marketId: string): Promise<Market | null> {
    const rows = await selectRows<MarketRow>(`markets?select=*&${eq("id", marketId)}&limit=1`);
    return rows.length > 0 ? toMarket(rows[0]) : null;
  }

  async upsertMarket(market: Market): Promise<void> {
    await upsertRows("markets", [fromMarket(market)]);
  }

  async deleteMarket(marketId: string): Promise<void> {
    await send(`markets?${eq("id", marketId)}`, { method: "DELETE", prefer: "return=minimal" });
  }

  async listBets(filter?: BetFilter): Promise<Bet[]> {
    let query = "bets?select=*";
    if (filter?.marketId !== undefined) query += `&${eq("market_id", filter.marketId)}`;
    if (filter?.studentId !== undefined) query += `&${eq("student_id", filter.studentId)}`;
    return (await selectRows<BetRow>(`${query}&order=created_at`)).map(toBet);
  }

  async getBet(betId: string): Promise<Bet | null> {
    const rows = await selectRows<BetRow>(`bets?select=*&${eq("id", betId)}&limit=1`);
    return rows.length > 0 ? toBet(rows[0]) : null;
  }

  async insertBet(bet: Bet): Promise<void> {
    await send("bets", { method: "POST", prefer: "return=minimal", body: [fromBet(bet)] });
  }

  async deleteBet(betId: string): Promise<boolean> {
    const res = await send(`bets?${eq("id", betId)}`, { method: "DELETE", prefer: "return=representation" });
    const rows = (await res.json()) as { id: string }[];
    return rows.length === 1;
  }

  /**
   * 配当の一括記録。1 行ずつ PATCH すると結果確定時に数百リクエストになるため、
   * 対象行をまとめて取得 → payout_amount を差し替えて merge-duplicates で upsert する
   * （PostgREST に一括 PATCH は無い）。URL 長・ペイロード対策でどちらもチャンク分割する。
   * payout_amount 以外の列は取得した値をそのまま書き戻す（payout 専用の更新ではない点に注意）
   */
  async updateBetPayouts(payouts: readonly { id: string; payoutAmount: number }[]): Promise<void> {
    if (payouts.length === 0) return;
    const amounts = new Map(payouts.map((p) => [p.id, p.payoutAmount]));
    for (const ids of chunk(payouts.map((p) => p.id), FILTER_CHUNK)) {
      const list = ids.map((id) => encodeURIComponent(id)).join(",");
      const rows = await selectRows<BetRow>(`bets?select=*&id=in.(${list})`);
      const updated = rows.map((row) => ({ ...row, payout_amount: amounts.get(row.id) ?? row.payout_amount }));
      await upsertRows("bets", updated);
    }
  }

  // ---- カジノ: 口座 ----

  async listAccounts(): Promise<CasinoAccountRecord[]> {
    return (await selectRows<AccountRow>("casino_accounts?select=*&order=student_id")).map(toAccount);
  }

  async getAccount(studentId: string): Promise<CasinoAccountRecord | null> {
    const rows = await selectRows<AccountRow>(`casino_accounts?select=*&${eq("student_id", studentId)}&limit=1`);
    return rows.length > 0 ? toAccount(rows[0]) : null;
  }

  async insertAccount(account: CasinoAccountRecord): Promise<boolean> {
    // merge-duplicates は付けない。主キー衝突（409）は「既に口座がある」を意味する
    const { url, key } = credentials();
    const res = await fetch(`${url}/rest/v1/casino_accounts`, {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("sb_secret_") ? {} : { Authorization: `Bearer ${key}` }),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify([fromAccount(account)]),
      cache: "no-store",
    });
    if (res.status === 409) return false;
    if (!res.ok) throw new Error(`Supabase POST casino_accounts が失敗しました (${res.status}): ${await res.text()}`);
    return true;
  }

  async updateBalances(studentId: string, expected: Balances, next: Balances): Promise<boolean> {
    // compare-and-set: 期待値を WHERE 条件に入れ、更新できた行数で成否を判定する
    const query = [
      eq("student_id", studentId),
      `points_balance=eq.${expected.pointsBalance}`,
      `debt_amount=eq.${expected.debtAmount}`,
    ].join("&");
    const res = await send(`casino_accounts?${query}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: { points_balance: next.pointsBalance, debt_amount: next.debtAmount },
    });
    const rows = (await res.json()) as AccountRow[];
    return rows.length === 1;
  }

  async updateAccounts(accounts: readonly CasinoAccountRecord[]): Promise<void> {
    await upsertRows("casino_accounts", accounts.map(fromAccount));
  }

  // ---- 設定 ----

  async getSettings(): Promise<Settings> {
    const rows = await selectRows<SettingsRow>("settings?select=*&id=eq.1&limit=1");
    if (rows.length === 0) return { finalSettledAt: null, scoresPublishedAt: null };
    return { finalSettledAt: rows[0].final_settled_at, scoresPublishedAt: rows[0].scores_published_at ?? null };
  }

  async updateSettings(settings: Settings): Promise<void> {
    // id を明示しないと merge-duplicates の衝突対象が無く、2 行目が挿入されてしまう
    await upsertRows("settings", [
      { id: 1, final_settled_at: settings.finalSettledAt, scores_published_at: settings.scoresPublishedAt },
    ]);
  }

  newId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }
}
