import { describe, expect, it } from "vitest";
import { BORROW_MAX, INTEREST_RATE, applyInterest, borrow, finalizeAccount, repay } from "./debt";
import type { CasinoAccount, CasinoAccountRecord } from "./types";

const account: CasinoAccount = { studentId: "2117", pointsBalance: 1000, debtAmount: 0 };

function record(over: Partial<CasinoAccountRecord> = {}): CasinoAccountRecord {
  return {
    studentId: "2117",
    pointsBalance: 1000,
    debtAmount: 300,
    passwordHash: "scrypt$aa$bb",
    nickname: "",
    registeredAt: "2026-09-26T00:00:00.000Z",
    finalBalanceBefore: null,
    finalDebt: null,
    ...over,
  };
}

describe("借入れ", () => {
  it("1〜500の整数は借りられ、points_balance・debt_amount の両方に加算される", () => {
    const r = borrow(account, 500, false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.pointsBalance).toBe(1500);
      expect(r.value.debtAmount).toBe(500);
    }
  });

  it("BORROW_MAX は 500", () => {
    expect(BORROW_MAX).toBe(500);
  });

  it("0以下・501以上は拒否", () => {
    expect(borrow(account, 0, false)).toEqual({ ok: false, error: "invalid_amount" });
    expect(borrow(account, -1, false)).toEqual({ ok: false, error: "invalid_amount" });
    expect(borrow(account, 501, false)).toEqual({ ok: false, error: "over_borrow_limit" });
  });

  it("非整数・文字列は invalid_amount", () => {
    expect(borrow(account, 10.5, false)).toEqual({ ok: false, error: "invalid_amount" });
    expect(borrow(account, "100", false)).toEqual({ ok: false, error: "invalid_amount" });
    expect(borrow(account, null, false)).toEqual({ ok: false, error: "invalid_amount" });
  });

  it("合計の借入上限は無い（複数回借りて debt_amount が 500 を超えてよい）", () => {
    const r1 = borrow(account, 500, false);
    if (!r1.ok) throw new Error("1回目が失敗");
    const r2 = borrow(r1.value, 500, false);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.value.debtAmount).toBe(1000);
  });

  it("精算済みなら拒否", () => {
    expect(borrow(account, 100, true)).toEqual({ ok: false, error: "finalized" });
  });
});

describe("返済", () => {
  const debtor: CasinoAccount = { studentId: "2117", pointsBalance: 1000, debtAmount: 300 };

  it("points_balance・debt_amount の両方から減算される", () => {
    const r = repay(debtor, 200, false);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.pointsBalance).toBe(800);
      expect(r.value.debtAmount).toBe(100);
    }
  });

  it("debt_amount を超える返済は拒否", () => {
    expect(repay(debtor, 301, false)).toEqual({ ok: false, error: "over_debt" });
  });

  it("points_balance を超える返済は拒否", () => {
    const poor: CasinoAccount = { studentId: "2117", pointsBalance: 100, debtAmount: 300 };
    expect(repay(poor, 200, false)).toEqual({ ok: false, error: "insufficient_balance" });
  });

  it("非整数・0以下は invalid_amount", () => {
    expect(repay(debtor, 0, false)).toEqual({ ok: false, error: "invalid_amount" });
    expect(repay(debtor, 10.5, false)).toEqual({ ok: false, error: "invalid_amount" });
  });

  it("精算済みなら拒否", () => {
    expect(repay(debtor, 100, true)).toEqual({ ok: false, error: "finalized" });
  });
});

describe("利子", () => {
  it("500 → 550 (× 1.1)", () => {
    const a: CasinoAccount = { studentId: "s", pointsBalance: 0, debtAmount: 500 };
    expect(applyInterest(a).debtAmount).toBe(550);
  });

  it("555 → 610 (端数切り捨て)", () => {
    const a: CasinoAccount = { studentId: "s", pointsBalance: 0, debtAmount: 555 };
    expect(applyInterest(a).debtAmount).toBe(610);
  });

  it("複利で2回適用すると1回ずつ切り捨てながら増える", () => {
    const a: CasinoAccount = { studentId: "s", pointsBalance: 0, debtAmount: 555 };
    const once = applyInterest(a);
    const twice = applyInterest(once);
    expect(twice.debtAmount).toBe(Math.floor(610 * INTEREST_RATE));
  });

  it("debt_amount が 0 なら変化しない", () => {
    const a: CasinoAccount = { studentId: "s", pointsBalance: 100, debtAmount: 0 };
    expect(applyInterest(a)).toEqual(a);
  });

  it("points_balance には影響しない", () => {
    const a: CasinoAccount = { studentId: "s", pointsBalance: 123, debtAmount: 500 };
    expect(applyInterest(a).pointsBalance).toBe(123);
  });
});

describe("最終精算", () => {
  it("精算直前の値をスナップショットし、points_balance -= debt_amount, debt_amount = 0 にする", () => {
    const r = finalizeAccount(record({ pointsBalance: 400, debtAmount: 300 }));
    expect(r.finalBalanceBefore).toBe(400);
    expect(r.finalDebt).toBe(300);
    expect(r.pointsBalance).toBe(100);
    expect(r.debtAmount).toBe(0);
  });

  it("返しきれない場合はマイナスのまま確定する", () => {
    const r = finalizeAccount(record({ pointsBalance: 100, debtAmount: 300 }));
    expect(r.pointsBalance).toBe(-200);
    expect(r.debtAmount).toBe(0);
  });

  it("冪等: 既に精算済みなら何もしない", () => {
    const already = record({ pointsBalance: 100, debtAmount: 0, finalBalanceBefore: 400, finalDebt: 300 });
    expect(finalizeAccount(already)).toEqual(already);
  });
});
