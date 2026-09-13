// 実行委員がアップロードする CSV（招集案内・名簿）の解析。データ構造は docs/data-model.md を参照
import type { InviteEntry, Student } from "./types";

/**
 * 汎用 CSV パーサー。UTF-8 BOM・CRLF/LF・ダブルクォートで囲まれたカンマ/改行・
 * 連続ダブルクォート（""）によるエスケープに対応し、各フィールドの前後の空白を trim する。
 * 空行（内容の無い行）はスキップする。
 */
export function parseCsv(text: string): string[][] {
  // BOM 除去
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  // 改行コードを LF に統一（クォート内の改行はここでは変換されても影響しない）
  const normalized = src.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);

  return rows.map((r) => r.map((f) => f.trim())).filter((r) => !(r.length === 1 && r[0] === ""));
}

/** ヘッダー名 → 列インデックスの対応を作る。見つからなければ -1 */
function headerIndex(header: readonly string[], aliases: readonly string[]): number {
  return header.findIndex((h) => aliases.includes(h));
}

/** 列の値を取り出す（列が無ければ空文字） */
function cell(row: readonly string[], col: number): string {
  return col === -1 ? "" : (row[col] ?? "");
}

/** min〜max の整数として読む。空・数字以外・範囲外は null（任意列なのでエラーにはしない） */
function parseIntInRange(value: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

export interface ParseInviteCsvResult {
  entries: InviteEntry[];
  errors: string[];
}

/**
 * 招集案内 CSV を解析する。
 * ヘッダーは 学籍番号,種目名,集合時間,場所 または student_id,event_name,gather_time,location（列の並び順は問わない）。
 * 5 列目の 補足 / tag（"ゼッケン着用" など）は任意で、無ければ空文字。
 * 学籍番号・種目名が空の行はエラーとして記録し、その行はスキップする。
 * "行N" の N はヘッダー行を1として数えた行番号（データ1行目は2）
 */
export function parseInviteCsv(text: string, idFactory: () => string): ParseInviteCsvResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { entries: [], errors: ["ヘッダー行がありません"] };

  const header = rows[0];
  const studentIdCol = headerIndex(header, ["学籍番号", "student_id"]);
  const eventNameCol = headerIndex(header, ["種目名", "event_name"]);
  const gatherTimeCol = headerIndex(header, ["集合時間", "gather_time"]);
  const locationCol = headerIndex(header, ["場所", "location"]);
  const tagCol = headerIndex(header, ["補足", "tag"]);
  if (studentIdCol === -1 || eventNameCol === -1) {
    return { entries: [], errors: ["ヘッダー行が不正です（学籍番号・種目名の列が見つかりません）"] };
  }

  const entries: InviteEntry[] = [];
  for (let i = 1; i < rows.length; i++) {
    const line = i + 1;
    const row = rows[i];
    const studentId = row[studentIdCol] ?? "";
    const eventName = row[eventNameCol] ?? "";
    if (!studentId) {
      errors.push(`行${line}: 学籍番号が空です`);
      continue;
    }
    if (!eventName) {
      errors.push(`行${line}: 種目名が空です`);
      continue;
    }
    entries.push({
      id: idFactory(),
      studentId,
      eventName,
      gatherTime: cell(row, gatherTimeCol),
      location: cell(row, locationCol),
      tag: cell(row, tagCol),
    });
  }
  return { entries, errors };
}

export interface ParseRosterCsvResult {
  students: Student[];
  errors: string[];
}

/**
 * 生徒名簿 CSV を解析する。ヘッダーは 学籍番号,名前 または student_id,name（列の並び順は問わない）。
 * 学年 / grade（1〜3）と 組 / class_no（1〜8）は任意で、無い・数字以外・範囲外なら null。
 * 学籍番号が重複する行は最初の1件のみ残し、以降はエラーとして記録してスキップする。
 */
export function parseRosterCsv(text: string): ParseRosterCsvResult {
  const rows = parseCsv(text);
  const errors: string[] = [];
  if (rows.length === 0) return { students: [], errors: ["ヘッダー行がありません"] };

  const header = rows[0];
  const studentIdCol = headerIndex(header, ["学籍番号", "student_id"]);
  const nameCol = headerIndex(header, ["名前", "name"]);
  const gradeCol = headerIndex(header, ["学年", "grade"]);
  const classNoCol = headerIndex(header, ["組", "class_no"]);
  if (studentIdCol === -1 || nameCol === -1) {
    return { students: [], errors: ["ヘッダー行が不正です（学籍番号・名前の列が見つかりません）"] };
  }

  const students: Student[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < rows.length; i++) {
    const line = i + 1;
    const row = rows[i];
    const studentId = row[studentIdCol] ?? "";
    const name = row[nameCol] ?? "";
    if (!studentId) {
      errors.push(`行${line}: 学籍番号が空です`);
      continue;
    }
    if (seen.has(studentId)) {
      errors.push(`行${line}: 学籍番号が重複しています（${studentId}）`);
      continue;
    }
    seen.add(studentId);
    students.push({
      studentId,
      name,
      grade: parseIntInRange(cell(row, gradeCol), 1, 3),
      classNo: parseIntInRange(cell(row, classNoCol), 1, 8),
    });
  }
  return { students, errors };
}
