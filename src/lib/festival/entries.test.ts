import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { ENTRY_LABELS, STUDENT_ENTRIES } from "./entries.data";
import { findStudentEntries, splitEntryLabel, studentIdParts } from "./entries";

/** 出場競技表の元データ（生成元 CSV） */
const SOURCE = fileURLToPath(new URL("../../../data/学籍番号別出場競技.csv", import.meta.url));

describe("splitEntryLabel", () => {
  it("末尾の（）を自分の枠として切り出す", () => {
    expect(splitEntryLabel("大縄跳び 前半（16人目）")).toEqual({ event: "大縄跳び 前半", slot: "16人目" });
    expect(splitEntryLabel("男女混合リレー7~8走（第1走者）")).toEqual({
      event: "男女混合リレー7~8走",
      slot: "第1走者",
    });
  });

  it("競技名の末尾の空白は落とす（CSV には「女子６×100ｍリレー （第5走者）」のような表記がある）", () => {
    expect(splitEntryLabel("女子６×100ｍリレー （第5走者）")).toEqual({
      event: "女子６×100ｍリレー",
      slot: "第5走者",
    });
  });

  it("（）が無ければ枠は空文字にする", () => {
    expect(splitEntryLabel("開会式")).toEqual({ event: "開会式", slot: "" });
  });
});

describe("studentIdParts", () => {
  it("4 桁の学籍番号を 学年・組・出席番号 に分ける", () => {
    expect(studentIdParts("1101")).toEqual({ grade: 1, classNo: 1, number: 1 });
    expect(studentIdParts("2334")).toEqual({ grade: 2, classNo: 3, number: 34 });
    expect(studentIdParts("3739")).toEqual({ grade: 3, classNo: 7, number: 39 });
  });

  it("桁数・学年・組が想定外なら null", () => {
    expect(studentIdParts("101")).toBeNull();
    expect(studentIdParts("12345")).toBeNull();
    expect(studentIdParts("4101")).toBeNull();
    expect(studentIdParts("1901")).toBeNull();
  });
});

describe("findStudentEntries", () => {
  it("CSV の並び順で出場競技を返す", () => {
    const first = Object.entries(STUDENT_ENTRIES)[0];
    if (!first) { expect(findStudentEntries("1101")).toBeNull(); return; }
    expect(findStudentEntries(first[0])).toEqual(first[1].map(i=>splitEntryLabel(ENTRY_LABELS[i])));
  });

  it("出場競技表に無い学籍番号は null（0 件と区別する）", () => {
    expect(findStudentEntries("9999")).toBeNull();
    expect(findStudentEntries("")).toBeNull();
  });

  it("Object のプロトタイプ由来のキーを拾わない", () => {
    expect(findStudentEntries("constructor")).toBeNull();
    expect(findStudentEntries("toString")).toBeNull();
  });
});

describe("生成データと CSV の一致", () => {
  // 生成スクリプト（scripts/generate-entries.mjs）は依存を増やさないため独自に CSV を割っている。
  // ここでは本番と同じ parseCsv で読み直し、生成物を復号した結果と突き合わせる。
  // 「CSV を差し替えたのに npm run entries を忘れた」も「割り方が本物の CSV 解析とずれた」も、
  // どちらもこのテストで落ちる
  it("生成された静的データは CSV をそのまま復元できる", () => {
    // Storageから生成した環境ではローカルCSVがない。辞書の参照整合性を確認する。
    if (!existsSync(SOURCE)) {
      expect(Object.values(STUDENT_ENTRIES).flat().every(index => ENTRY_LABELS[index] !== undefined)).toBe(true);
      return;
    }
    const rows = parseCsv(existsSync(SOURCE) ? readFileSync(SOURCE, "utf8") : "学籍番号,出場競技\n");
    expect(rows[0]).toEqual(["学籍番号", "出場競技"]);

    const fromCsv = rows.slice(1).map((row) => [row[0], row[1]] as const);
    expect(fromCsv.length).toBe(Object.keys(STUDENT_ENTRIES).length);

    const decoded = fromCsv.map(([studentId]) => {
      const indexes = STUDENT_ENTRIES[studentId] ?? [];
      return [studentId, indexes.map((index) => ENTRY_LABELS[index]).join("｜")] as const;
    });
    expect(decoded).toEqual(fromCsv);
  });

  it("辞書に使われていない出場枠が残っていない", () => {
    const used = new Set<number>();
    for (const indexes of Object.values(STUDENT_ENTRIES)) for (const index of indexes) used.add(index);
    expect(used.size).toBe(ENTRY_LABELS.length);
  });
});
