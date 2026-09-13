// 出場競技表（data/学籍番号別出場競技.csv）の参照。DB を一切使わない静的データなので
// サーバー・クライアントのどちらからでも呼べる（node:fs などは import しない）
import { ENTRY_LABELS, STUDENT_ENTRIES } from "./entries.data";

export { ENTRY_DATA_VERSION } from "./entries.data";

/** 出場競技 1 件 */
export interface StudentEntry {
  /** 競技名（"大縄跳び 前半"） */
  event: string;
  /** その中での自分の枠（"16人目"・"第1走者"）。CSV に（）が無ければ空文字 */
  slot: string;
}

/** 学籍番号から読み取った所属（4 桁 = 学年1桁・組1桁・出席番号2桁） */
export interface StudentIdParts {
  grade: number;
  classNo: number;
  number: number;
}

/** 学籍番号 → 出場枠の添字。オブジェクトのプロトタイプを引かないよう Map にしておく */
const table = new Map<string, readonly number[]>(Object.entries(STUDENT_ENTRIES));

/**
 * "大縄跳び 前半（16人目）" を競技名と枠に分ける。
 * 末尾の全角（）だけを枠として扱い、（）が無ければ枠は空文字にする
 */
export function splitEntryLabel(label: string): StudentEntry {
  const matched = /^(.*)（([^（）]*)）$/.exec(label.trim());
  if (matched === null) return { event: label.trim(), slot: "" };
  return { event: matched[1].trim(), slot: matched[2].trim() };
}

/**
 * 学籍番号から学年・組・出席番号を読む。4 桁で学年 1〜3・組 1〜8 のときだけ返す。
 * 名簿（DB）を引かずに黒帯へ「2年3組」を出すために使う
 */
export function studentIdParts(studentId: string): StudentIdParts | null {
  if (!/^\d{4}$/.test(studentId)) return null;
  const grade = Number(studentId[0]);
  const classNo = Number(studentId[1]);
  const number = Number(studentId.slice(2));
  if (grade < 1 || grade > 3 || classNo < 1 || classNo > 8) return null;
  return { grade, classNo, number };
}

/**
 * 学籍番号の出場競技を CSV の並び順で返す。
 * 出場競技表に載っていない学籍番号は null（「該当なし」と「0 件」を区別するため）
 */
export function findStudentEntries(studentId: string): StudentEntry[] | null {
  const indexes = table.get(studentId);
  if (indexes === undefined) return null;
  return indexes.map((index) => splitEntryLabel(ENTRY_LABELS[index] ?? ""));
}
