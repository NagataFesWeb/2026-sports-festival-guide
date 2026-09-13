import { describe, expect, it } from "vitest";
import { parseCsv, parseInviteCsv, parseRosterCsv } from "./csv";

describe("parseCsv", () => {
  it("BOM付きUTF-8を除去する", () => {
    const text = "﻿a,b\n1,2";
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("CRLF・LFのどちらも1行として扱う", () => {
    expect(parseCsv("a,b\r\n1,2\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("ダブルクォートで囲まれたカンマ・改行を1フィールドとして扱う", () => {
    const text = 'name,note\n"Doe, John","line1\nline2"';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Doe, John", "line1\nline2"],
    ]);
  });

  it("連続するダブルクォートはエスケープされた1つのクォートになる", () => {
    const text = 'a\n"She said ""hi"""';
    expect(parseCsv(text)).toEqual([["a"], ['She said "hi"']]);
  });

  it("前後の空白をtrimし、空行はスキップする", () => {
    const text = "a,b\n\n 1 , 2 \n\n";
    expect(parseCsv(text)).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseInviteCsv", () => {
  let seq = 0;
  const idFactory = () => `inv${++seq}`;

  it("日本語ヘッダーを解析する", () => {
    const text = "学籍番号,種目名,集合時間,場所\n2117,綱引き,10:30,校庭";
    const r = parseInviteCsv(text, idFactory);
    expect(r.errors).toEqual([]);
    expect(r.entries).toEqual([
      { id: "inv1", studentId: "2117", eventName: "綱引き", gatherTime: "10:30", location: "校庭", tag: "" },
    ]);
  });

  it("英語ヘッダーを解析する", () => {
    const text = "student_id,event_name,gather_time,location\n2118,Tug of War,10:30,Field";
    const r = parseInviteCsv(text, idFactory);
    expect(r.entries).toEqual([
      { id: "inv2", studentId: "2118", eventName: "Tug of War", gatherTime: "10:30", location: "Field", tag: "" },
    ]);
  });

  it("ヘッダーの列順に依存しない", () => {
    const text = "場所,集合時間,学籍番号,種目名\n校庭,10:30,2119,綱引き";
    const r = parseInviteCsv(text, idFactory);
    expect(r.entries).toEqual([
      { id: "inv3", studentId: "2119", eventName: "綱引き", gatherTime: "10:30", location: "校庭", tag: "" },
    ]);
  });

  it("任意の 補足 / tag 列を読む", () => {
    const ja = parseInviteCsv("学籍番号,種目名,集合時間,場所,補足\n2117,綱引き,10:30,校庭,軍手持参", idFactory);
    expect(ja.entries[0].tag).toBe("軍手持参");

    const en = parseInviteCsv("student_id,event_name,gather_time,location,tag\n2118,Tug of War,10:30,Field,Gloves", idFactory);
    expect(en.entries[0].tag).toBe("Gloves");
  });

  it("学籍番号・種目名が空の行はエラーにしてスキップする", () => {
    const text = "学籍番号,種目名,集合時間,場所\n,綱引き,10:30,校庭\n2117,,10:30,校庭\n2118,騎馬戦,,";
    const r = parseInviteCsv(text, idFactory);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].studentId).toBe("2118");
    expect(r.errors).toEqual(["行2: 学籍番号が空です", "行3: 種目名が空です"]);
  });

  it("必須列が無いヘッダーはエラーを返す", () => {
    const r = parseInviteCsv("a,b\n1,2", idFactory);
    expect(r.entries).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("parseRosterCsv", () => {
  it("日本語・英語どちらのヘッダーも解析する", () => {
    const ja = parseRosterCsv("学籍番号,名前\n2117,佐藤");
    expect(ja.students).toEqual([{ studentId: "2117", name: "佐藤", grade: null, classNo: null }]);

    const en = parseRosterCsv("student_id,name\n2118,Suzuki");
    expect(en.students).toEqual([{ studentId: "2118", name: "Suzuki", grade: null, classNo: null }]);
  });

  it("任意の 学年 / 組 列を読み、範囲外・数字以外は null にする", () => {
    const ja = parseRosterCsv("学籍番号,名前,学年,組\n2117,佐藤,2,1\n2118,鈴木,4,9\n2119,高橋,,あ");
    expect(ja.students).toEqual([
      { studentId: "2117", name: "佐藤", grade: 2, classNo: 1 },
      { studentId: "2118", name: "鈴木", grade: null, classNo: null },
      { studentId: "2119", name: "高橋", grade: null, classNo: null },
    ]);

    const en = parseRosterCsv("student_id,name,grade,class_no\n2201,Sato,3,8");
    expect(en.students).toEqual([{ studentId: "2201", name: "Sato", grade: 3, classNo: 8 }]);
  });

  it("学籍番号が重複した行は最初の1件だけ残しエラーを記録する", () => {
    const text = "学籍番号,名前\n2117,佐藤\n2117,別人";
    const r = parseRosterCsv(text);
    expect(r.students).toEqual([{ studentId: "2117", name: "佐藤", grade: null, classNo: null }]);
    expect(r.errors).toEqual(["行3: 学籍番号が重複しています（2117）"]);
  });

  it("学籍番号が空の行はエラーにしてスキップする", () => {
    const text = "学籍番号,名前\n,佐藤";
    const r = parseRosterCsv(text);
    expect(r.students).toEqual([]);
    expect(r.errors).toEqual(["行2: 学籍番号が空です"]);
  });
});
