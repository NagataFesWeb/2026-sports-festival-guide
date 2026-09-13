// プログラムの進行（遅延の反映・進行状況の判定）。時刻の計算は必ずここに集約し、UI では計算しない
import type { Market } from "@/lib/casino/types";
import type { Event, EventResult } from "./types";

/** 進行状況。done=終了 / live=進行中 / next=次の種目 / upcoming=それ以降 */
export type ProgramStatus = "done" | "live" | "next" | "upcoming";

/** 締切の計算に必要な Market の部分。type=event 以外は遅延の影響を受けない */
type DeadlineMarket = Pick<Market, "type" | "deadline">;

/** 遅延の計算に必要な種目の部分 */
type DelayEvent = Pick<Event, "delayMin">;

/** ISO 8601 の時刻を分だけずらす（不正な文字列は null） */
function shiftIso(iso: string, minutes: number): string | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + minutes * 60_000).toISOString();
}

/**
 * プログラム順（sortOrder 昇順 → 同じなら番号の昇順）。
 * queries.ts の並び順と同じ基準にする（遅延の連鎖が表示順とずれないようにする）
 */
function byProgramOrder(a: Event, b: Event): number {
  return a.sortOrder - b.sortOrder || a.no.localeCompare(b.no, "ja");
}

/**
 * 実際の開始見込み（定刻 startTime ＋ 遅延 delayMin 分）。
 * 定刻が未定なら null
 */
export function effectiveStart(event: Pick<Event, "startTime" | "delayMin">): string | null {
  if (event.startTime === null) return null;
  return shiftIso(event.startTime, event.delayMin);
}

/**
 * 実効締切。種目 Market（type=event）は紐づく種目の遅延だけ締切もずれる。
 * overall・custom、または種目が渡されなかったときは deadline をそのまま返す
 */
export function effectiveDeadline(market: DeadlineMarket, event: DelayEvent | null): string {
  if (market.type !== "event" || event === null || event.delayMin === 0) return market.deadline;
  return shiftIso(market.deadline, event.delayMin) ?? market.deadline;
}

/**
 * eventId 以降（プログラム順）の種目の遅延を deltaMin 分だけ動かす。
 * eventId が null なら全種目。戻り値は delayMin が変わった種目だけ（保存対象）
 */
export function shiftFrom(events: readonly Event[], eventId: string | null, deltaMin: number): Event[] {
  if (deltaMin === 0) return [];
  const sorted = [...events].sort(byProgramOrder);
  let from = 0;
  if (eventId !== null) {
    from = sorted.findIndex((e) => e.id === eventId);
    // 指定された種目が無ければ何も動かさない
    if (from === -1) return [];
  }
  return sorted.slice(from).map((e) => ({ ...e, delayMin: e.delayMin + deltaMin }));
}

/** 全種目を定刻に戻す。戻り値は delayMin が変わった種目だけ（保存対象） */
export function resetDelays(events: readonly Event[]): Event[] {
  return events.filter((e) => e.delayMin !== 0).map((e) => ({ ...e, delayMin: 0 }));
}

/** その種目の全ヒートに確定結果があるか */
export function heatsDone(event: Pick<Event, "id" | "heats">, results: readonly EventResult[]): boolean {
  if (event.heats.length === 0) return false;
  return event.heats.every((h) => results.some((r) => r.eventId === event.id && r.heatId === h.id));
}

/**
 * 種目ごとの進行状況を判定する。
 * - done: 全ヒートの結果が確定した、または次の種目の開始見込みが now を過ぎた
 * - live: 開始見込みが now 以前で、まだ done ではない
 * - next: 進行中の種目より後で最初の未開始種目（進行中が無ければ先頭の未開始種目）
 * - upcoming: それ以外
 *
 * 注: 次の種目の定刻が未定（startTime = null）の場合は「次が始まった」と見なせないため、
 * 直前の種目は結果を確定するまで live のままになる（未定の種目でプログラムを進めない）
 */
export function programStatus(
  events: readonly Event[],
  results: readonly EventResult[],
  now: Date,
): Map<string, ProgramStatus> {
  const sorted = [...events].sort(byProgramOrder);
  const nowMs = now.getTime();
  const started = sorted.map((e) => {
    const start = effectiveStart(e);
    return start !== null && Date.parse(start) <= nowMs;
  });

  const done = sorted.map((e, i) => heatsDone(e, results) || started[i + 1] === true);
  const live = sorted.map((_, i) => !done[i] && started[i]);

  const status = new Map<string, ProgramStatus>();
  sorted.forEach((e, i) => {
    status.set(e.id, done[i] ? "done" : live[i] ? "live" : "upcoming");
  });

  // 進行中の後ろで最初の未開始種目を「次」にする（進行中が無ければ先頭から探す）
  for (let i = live.lastIndexOf(true) + 1; i < sorted.length; i += 1) {
    if (status.get(sorted[i].id) === "upcoming") {
      status.set(sorted[i].id, "next");
      break;
    }
  }
  return status;
}
