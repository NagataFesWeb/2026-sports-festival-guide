// 表画面（`/`・`/me`・`/ranking`）が使うデータ取得。React には依存しない（サーバー専用）
// 表示する値はここで組み立て、UI コンポーネントでは計算しない（AGENTS.md の規約）
import type { RankingRow } from "@/lib/casino/settlement";
import { festivalSnapshot } from "./snapshot.data";
import { effectiveStart, programStatus, type ProgramStatus } from "./schedule";
import { overallStandings, type StandingRow } from "./standings";
import type { Event, EventResult, InviteEntry, Team } from "./types";

export { normalizeStudentId } from "./student-id";
export type { RankingRow } from "@/lib/casino/settlement";
export type { StandingRow } from "./standings";
export type { ProgramStatus } from "./schedule";

/** 名簿が未アップロードのときに ABOUT の PLAYERS に出す全校人数 */
const ROSTER_FALLBACK = 960;

/** プログラムの並び順: sortOrder 昇順 → 同じなら番号の昇順 */
function byProgramOrder(a: Event, b: Event): number {
  return a.sortOrder - b.sortOrder || a.no.localeCompare(b.no, "ja");
}

/**
 * 招集案内の集合時間（"9:35" のような CSV 由来の文字列）を分に直す。
 * 文字列のまま比較すると "13:25" が "9:35" より前に来てしまうため、必ずここを通す
 */
function gatherMinutes(time: string): number {
  const matched = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(time);
  if (matched === null) return Number.MAX_SAFE_INTEGER;
  return Number(matched[1]) * 60 + Number(matched[2]);
}

/** 種目 ID → 実際の開始見込み（定刻＋遅延）。UI では時刻計算をしないのでここで配る */
function startsOf(events: readonly Event[]): Record<string, string | null> {
  const starts: Record<string, string | null> = {};
  for (const event of events) starts[event.id] = effectiveStart(event);
  return starts;
}

/** ABOUT の 3 つの数値 */
export interface TopCounts {
  players: number;
  teams: number;
  programs: number;
}

/** トップページ 1 画面ぶんのデータ */
export interface TopPageData {
  teams: Team[];
  /** プログラム順（sortOrder → 番号） */
  events: Event[];
  /** 確定結果（ヒート単位。1 種目に複数入る） */
  results: EventResult[];
  /** 種目 ID → 進行状況（クライアントに渡すので Map ではなくオブジェクト） */
  statuses: Record<string, ProgramStatus>;
  /** 種目 ID → 開始見込み（ISO 8601。未定なら null） */
  starts: Record<string, string | null>;
  /** 総合順位公開後だけ入る総合順位。非公開の間は null（表側に一切出さない） */
  standings: StandingRow[] | null;
  scoresPublishedAt: string | null;
  counts: TopCounts;
}

/** トップページのデータを一括で取得する */
export async function getTopPageData(now: Date): Promise<TopPageData> {
  const { teams, events: allEvents, results, studentCount, settings, overall: markets } = festivalSnapshot;

  const events = [...allEvents].sort(byProgramOrder);
  const sortedTeams = [...teams].sort((a, b) => a.sortOrder - b.sortOrder);

  const statuses: Record<string, ProgramStatus> = {};
  for (const [eventId, status] of programStatus(events, results, now)) statuses[eventId] = status;

  const published = settings.scoresPublishedAt !== null;
  return {
    teams: sortedTeams,
    events,
    results,
    statuses,
    starts: startsOf(events),
    standings: published ? overallStandings(sortedTeams, markets) : null,
    scoresPublishedAt: settings.scoresPublishedAt,
    counts: {
      // 名簿が全校分（数百人）入るまでは公称の人数を出す（開発用の数人の名簿で「10 PLAYERS」にならないように）
      players: studentCount >= 100 ? studentCount : ROSTER_FALLBACK,
      teams: sortedTeams.length,
      programs: events.length,
    },
  };
}

/** マイページ上部に出す本人。名簿に載っていない番号でも学籍番号だけは表示する */
export interface MeStudent {
  studentId: string;
  name: string;
  grade: number | null;
  classNo: number | null;
  /** 組（classNo）に対応するチーム。名簿に組が無ければ null */
  team: Team | null;
}

/** マイページ 1 画面ぶんのデータ */
export interface MePageData {
  /** 名簿にあれば本人、無ければ null */
  student: MeStudent | null;
  /** 集合時間の昇順 */
  invites: InviteEntry[];
  /** 招集案内の種目名と名前が一致した種目（プログラム順） */
  myEvents: Event[];
  /** 全種目（プログラム順） */
  events: Event[];
  /** 種目 ID → 開始見込み */
  starts: Record<string, string | null>;
  teams: Team[];
}

/** マイページのデータを一括で取得する */
export async function getMePageData(studentId: string): Promise<MePageData> {
  const { events: allEvents, teams } = festivalSnapshot;
  const inviteList = festivalSnapshot.invites.filter(invite => invite.studentId === studentId);

  const events = [...allEvents].sort(byProgramOrder);
  const sortedTeams = [...teams].sort((a, b) => a.sortOrder - b.sortOrder);
  const invites = [...inviteList].sort((a, b) => gatherMinutes(a.gatherTime) - gatherMinutes(b.gatherTime));

  // 招集案内は種目名（文字列）で紐づく。同じ種目名の案内が複数あっても種目は 1 回だけ出す
  const inviteNames = new Set(invites.map((invite) => invite.eventName));
  const myEvents = events.filter((event) => inviteNames.has(event.name));

  return {
    student: null,
    invites,
    myEvents,
    events,
    starts: startsOf(events),
    teams: sortedTeams,
  };
}

/** プログラム詳細に出すヒートごとの着順（上位のみ） */
export interface HeatResultView {
  heatId: string;
  heatLabel: string;
  /** 1 位から順のチーム名 */
  teamNames: string[];
}

/**
 * 1 種目の確定結果をヒートごとの着順（チーム名）に直す。結果が無いヒートは含めない。
 * limit は表示する順位の数（既定は 3 位まで）
 */
export function heatResultViews(
  event: Event,
  results: readonly EventResult[],
  teams: readonly Team[],
  limit = 3,
): HeatResultView[] {
  const nameById = new Map(teams.map((team) => [team.id, team.name]));
  if (event.formation === "horse" || event.name.includes("騎馬戦")) {
    nameById.set("red", "紅組");
    nameById.set("white", "白組");
  }
  const views: HeatResultView[] = [];
  for (const heat of event.heats) {
    const result = results.find((r) => r.eventId === event.id && r.heatId === heat.id);
    if (result === undefined) continue;
    views.push({
      heatId: heat.id,
      heatLabel: heat.label,
      teamNames: result.order.slice(0, limit).map((teamId) => nameById.get(teamId) ?? teamId),
    });
  }
  return views;
}

/** 最終順位ランキング。最終精算前は rows を空にして「未公開」を表す */
export async function getRankingData(): Promise<{ finalSettledAt: string | null; rows: RankingRow[] }> {
  const { settings, ranking } = festivalSnapshot;
  if (settings.finalSettledAt === null) return { finalSettledAt: null, rows: [] };

  return { finalSettledAt: settings.finalSettledAt, rows: ranking };
}
