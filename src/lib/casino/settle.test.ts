import { describe, expect, it } from "vitest";
import { settleMarket } from "./settle";
import type { Bet, CasinoAccountRecord, Market } from "./types";

const NOW = new Date("2026-09-26T03:00:00.000Z");

function market(over: Partial<Market> = {}): Market {
  return {
    id: "m1",
    type: "event",
    eventId: "e1",
    heatId: "all",
    category: "field",
    no: "05",
    title: "玉入れ",
    en: "BALL TOSS",
    options: [
      { id: "t1", num: "01", name: "1組" },
      { id: "t2", num: "02", name: "2組" },
    ],
    deadline: "2026-09-26T02:00:00.000Z",
    status: "open",
    resultOrder: null,
    ...over,
  };
}

function raceMarket(over: Partial<Market> = {}): Market {
  return market({
    category: "race",
    options: ["t1", "t2", "t3", "t4"].map((id, i) => ({ id, num: `0${i + 1}`, name: `${i + 1}組` })),
    ...over,
  });
}

let seq = 0;
function bet(over: Partial<Bet> = {}): Bet {
  seq += 1;
  return {
    id: `b${seq}`,
    marketId: "m1",
    studentId: "s",
    kind: "win",
    selection: ["t1"],
    amount: 100,
    payoutAmount: null,
    createdAt: "2026-09-26T00:00:00.000Z",
    ...over,
  };
}

function account(over: Partial<CasinoAccountRecord> = {}): CasinoAccountRecord {
  return {
    studentId: "s",
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

describe("結果確定", () => {
  it("三連単は旧DBの既定・個別倍率を無視し50倍で口座残高まで精算する", () => {
    const selection = ["t1", "t2", "t3"];
    const winner = bet({ id: "tri-hit", kind: "trifecta", selection, amount: 100 });
    const loser = bet({ id: "tri-miss", kind: "trifecta", selection: ["t2", "t1", "t3"], amount: 500 });
    const r = settleMarket({
      market: raceMarket({ trifectaOddsDefault: 336, trifectaOddsOverrides: { "t1>t2>t3": 12.34 } }),
      bets: [winner, loser],
      accounts: [account()],
      order: selection,
      now: NOW,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.payouts).toEqual([{ id: "tri-hit", payoutAmount: 5000 }, { id: "tri-miss", payoutAmount: 0 }]);
    expect(r.value.accounts[0]?.pointsBalance).toBe(6000);
  });

  it("的中者は配当を受け取り、ベットしていない借金持ちにも利子が付く", () => {
    const betA = bet({ id: "bA", studentId: "A", selection: ["t1"], amount: 100 });
    const betB = bet({ id: "bB", studentId: "B", selection: ["t2"], amount: 100 });
    const accounts = [
      account({ studentId: "A", pointsBalance: 500, debtAmount: 0 }),
      account({ studentId: "B", pointsBalance: 500, debtAmount: 0 }),
      account({ studentId: "C", pointsBalance: 200, debtAmount: 300 }),
      account({ studentId: "D", pointsBalance: 200, debtAmount: 0 }),
    ];
    const r = settleMarket({ market: market(), bets: [betA, betB], accounts, order: ["t1"], now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.market.status).toBe("settled");
    expect(r.value.market.resultOrder).toEqual(["t1"]);

    const byId = new Map(r.value.accounts.map((a) => [a.studentId, a]));
    // A: 的中。最低5倍で受け取り 500+500=1000
    expect(byId.get("A")?.pointsBalance).toBe(1000);
    expect(byId.get("A")?.debtAmount).toBe(0);
    // B: 外れ。変化なしのため含まれない
    expect(byId.has("B")).toBe(false);
    // C: ベットしていないが借金があるので利子が付く（残高は変化なし）
    expect(byId.get("C")?.pointsBalance).toBe(200);
    expect(byId.get("C")?.debtAmount).toBe(330);
    // D: ベットも借金も無いので含まれない
    expect(byId.has("D")).toBe(false);

    expect(r.value.accounts).toHaveLength(2);
  });

  it("すでに確定済みなら already_settled", () => {
    const settled = market({ status: "settled", resultOrder: ["t1"] });
    const r = settleMarket({ market: settled, bets: [], accounts: [], order: ["t1"], now: NOW });
    expect(r).toEqual({ ok: false, error: "already_settled" });
  });

  it("空の着順・存在しない選択肢・重複は invalid_order", () => {
    expect(settleMarket({ market: market(), bets: [], accounts: [], order: [], now: NOW })).toEqual({
      ok: false,
      error: "invalid_order",
    });
    expect(
      settleMarket({ market: market(), bets: [], accounts: [], order: ["t9"], now: NOW }),
    ).toEqual({ ok: false, error: "invalid_order" });
    expect(
      settleMarket({ market: raceMarket(), bets: [], accounts: [], order: ["t1", "t1", "t2"], now: NOW }),
    ).toEqual({ ok: false, error: "invalid_order" });
  });

  it("選択肢3つ以上の race Market は着順を3件以上要求する", () => {
    const r2 = settleMarket({ market: raceMarket(), bets: [], accounts: [], order: ["t1", "t2"], now: NOW });
    expect(r2).toEqual({ ok: false, error: "invalid_order" });
    const r3 = settleMarket({ market: raceMarket(), bets: [], accounts: [], order: ["t1", "t2", "t3"], now: NOW });
    expect(r3.ok).toBe(true);
  });

  it("借金も無くベットもしていない口座は結果に含まれない", () => {
    const accounts = [account({ studentId: "D", pointsBalance: 200, debtAmount: 0 })];
    const r = settleMarket({ market: market(), bets: [], accounts, order: ["t1"], now: NOW });
    expect(r.ok && r.value.accounts).toEqual([]);
  });
});
