import type { StudentEntry } from "./entries";
import { studentIdParts } from "./entries";
import type { Event, InviteEntry } from "./types";
import { formatHourMinute } from "@/components/festival/format";
import { EVENTS, entryRunner, eventKey, guidePlan, type EventKey } from "@/lib/ground-guide/navigation";
import { FESTIVAL_DAY } from "./festival-day";
export { FESTIVAL_DAY } from "./festival-day";

// 2026-10-01提供の演技台帳PDF。明記された時刻だけを使い、所要時間から開始時刻を推測しない。
export interface AgendaItem {
  id: string;
  event: EventKey | null;
  title: string;
  entryLabel: string;
  slot: string;
  gather: string;
  place: string;
  start: string | null;
  belongings: string;
  note: string;
  common: boolean;
  order: number;
}

/** 出場枠と集合案内を統合。個人向けの実行委員案内を優先し、空欄は台帳から補う。 */
export function personalAgenda(studentId: string, entries: StudentEntry[] | null, events: Event[] = [], invites: InviteEntry[] = [], starts: Record<string, string | null> = {}): AgendaItem[] {
  const parts = studentIdParts(studentId);
  const rows: StudentEntry[] = [...(entries ?? [])];
  for (const name of ["開会式", "準備体操", "閉会式"]) {
    if (!rows.some(row => eventKey(row.event) === eventKey(name))) rows.push({ event: name, slot: "" });
  }
  const gradeEvent = parts ? ["大縄跳び", "棒引き", "騎馬戦"][parts.grade - 1] : null;
  if (gradeEvent && !rows.some(row => eventKey(row.event) === eventKey(gradeEvent))) rows.push({ event: gradeEvent, slot: "全員参加" });
  for (const invite of invites) {
    const key = eventKey(invite.eventName);
    if (!rows.some(row => key ? eventKey(row.event) === key : row.event === invite.eventName)) rows.push({ event: invite.eventName, slot: "" });
  }
  return rows.map((entry, index): AgendaItem => {
    const key = eventKey(entry.event);
    const event = events.find(e => key ? eventKey(e.name) === key : e.name === entry.event);
    const invite = invites.find(i => key ? eventKey(i.eventName) === key : i.eventName === entry.event);
    const plan = key ? guidePlan(key, parts?.grade ?? 1, parts?.classNo ?? 1, entryRunner(entry.event, entry.slot)) : null;
    const common = key === "opening" || key === "warmup" || key === "closing";
    const unknownRunner = ["girls", "swedish", "mixed"].includes(key ?? "") && !/第[1-8]走者/.test(entry.slot.normalize("NFKC"));
    const belongings = key === "ball" ? "クラス色のハチマキ。円内の玉出し担当は赤白帽。" : key === "horse" ? "上に乗る人は赤白帽・軍手。大将ははっぴ。" : key === "club" ? "部のユニフォーム" : "";
    const anchor = key === "girls" || key === "swedish" || key === "mixed";
    const isAnchor = anchor && entryRunner(entry.event, entry.slot) === (key === "mixed" ? 8 : 6);
    return {
      id: `${key ?? entry.event}-${index}`, event: key, title: entry.event, entryLabel: entry.event, slot: entry.slot,
      gather: invite?.gatherTime.trim() || plan?.timing || event?.gatherStart || "放送・招集係の指示で集合",
      place: invite?.location.trim() || (unknownRunner ? "フィールド（走順を確認して集合側を選んでください）" : plan?.assembly.label) || event?.gatherPlace || "招集係に確認してください",
      start: (event && formatHourMinute(starts[event.id])) || (key === "opening" ? FESTIVAL_DAY.opening : key === "closing" ? FESTIVAL_DAY.closing : null),
      belongings: [invite?.tag, anchor ? (isAnchor && !unknownRunner ? "クラス番号のゼッケン" : "") : belongings || event?.belongings].filter(text => text && !/[（(]?なし[）)]?/.test(text)).join(" ／ "),
      note: key === "opening" ? "8:30までに整列・点呼を完了。階段が混むので早めに移動してください。" : key === "warmup" ? "開会式後はその場で待ち、号令で体操隊形に広がります。終了後はクラステントへ。" : key === "closing" ? "いったん生徒席に戻り、放送があってから開会式と同じ位置へ。男女各1列。" : key === "ball" || key === "horse" ? "集合のタイミングは招集係・当日の放送で確認してください。" : "",
      common, order: key ? EVENTS.findIndex(e => e.key === key) : 20 + index,
    };
  }).sort((a, b) => a.order - b.order);
}
