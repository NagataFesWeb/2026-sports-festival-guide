import { describe, expect, it } from "vitest";
import { rankAccounts } from "./settlement";
import type { CasinoAccountRecord } from "./types";
import type { Student } from "../festival/types";

function account(over: Partial<CasinoAccountRecord> = {}): CasinoAccountRecord {
  return {
    studentId: "2117",
    pointsBalance: 1000,
    debtAmount: 0,
    passwordHash: "scrypt$aa$bb",
    nickname: "",
    registeredAt: "2026-09-26T00:00:00.000Z",
    finalBalanceBefore: null,
    finalDebt: null,
    ...over,
  };
}

const students: Student[] = [
  { studentId: "2117", name: "佐藤", grade: 2, classNo: 1 },
  { studentId: "2118", name: "鈴木", grade: 2, classNo: 2 },
  { studentId: "2119", name: "高橋", grade: 3, classNo: 4 },
];

describe("最終順位", () => {
  it("純資産の降順で並べる（未精算は points_balance - debt_amount）", () => {
    const accounts = [
      account({ studentId: "2117", pointsBalance: 1000, debtAmount: 200 }), // 800
      account({ studentId: "2118", pointsBalance: 1500, debtAmount: 0 }), // 1500
      account({ studentId: "2119", pointsBalance: 500, debtAmount: 0 }), // 500
    ];
    const rows = rankAccounts(accounts, students);
    expect(rows.map((r) => r.studentId)).toEqual(["2118", "2117", "2119"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.netWorth)).toEqual([1500, 800, 500]);
  });

  it("同着は同じ順位を共有し、次の順位は人数分飛ぶ（1,1,3）", () => {
    const accounts = [
      account({ studentId: "2119", pointsBalance: 1000, debtAmount: 0 }),
      account({ studentId: "2117", pointsBalance: 1000, debtAmount: 0 }),
      account({ studentId: "2118", pointsBalance: 500, debtAmount: 0 }),
    ];
    const rows = rankAccounts(accounts, students);
    // netWorth 同点は studentId 昇順
    expect(rows.map((r) => r.studentId)).toEqual(["2117", "2119", "2118"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("精算済みは finalBalanceBefore/finalDebt を表示用に使い、netWorth は精算後 pointsBalance", () => {
    const accounts = [
      account({
        studentId: "2117",
        pointsBalance: -200,
        debtAmount: 0,
        finalBalanceBefore: 100,
        finalDebt: 300,
      }),
    ];
    const rows = rankAccounts(accounts, students);
    expect(rows[0]).toMatchObject({
      netWorth: -200,
      pointsBalance: 100,
      debtAmount: 300,
    });
  });

  it("名簿に無い学籍番号は studentId をそのまま氏名に使う", () => {
    const accounts = [account({ studentId: "9999", pointsBalance: 1000, debtAmount: 0 })];
    const rows = rankAccounts(accounts, students);
    expect(rows[0].name).toBe("9999");
  });

  it("nickname があれば displayName はそれになり、無ければ名簿の氏名（名簿にも無ければ studentId）", () => {
    const accounts = [
      account({ studentId: "2117", nickname: "テスター" }),
      account({ studentId: "2118", nickname: "" }),
      account({ studentId: "9999", nickname: "" }),
    ];
    const rows = rankAccounts(accounts, students);
    const byId = new Map(rows.map((r) => [r.studentId, r]));
    expect(byId.get("2117")?.displayName).toBe("テスター");
    expect(byId.get("2118")?.displayName).toBe("鈴木");
    expect(byId.get("9999")?.displayName).toBe("9999");
  });
});
