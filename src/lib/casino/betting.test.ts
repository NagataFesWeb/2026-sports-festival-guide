import { describe, expect, it } from "vitest";
import {
  allowedKinds,
  cancelBet,
  effectiveStatus,
  isValidSelection,
  parseStake,
  placeBet,
} from "./betting";
import type { CasinoAccount, Market } from "./types";

const NOW = new Date("2026-09-26T01:00:00.000Z");
const LATER = "2026-09-26T02:00:00.000Z";
const EARLIER = "2026-09-26T00:00:00.000Z";

function market(over: Partial<Market> = {}): Market {
  return {
    id: "m1",
    type: "event",
    eventId: null,
    heatId: null,
    category: "race",
    no: "05",
    title: "男女混合リレー",
    en: "MIXED RELAY",
    options: ["t1", "t2", "t3", "t4"].map((id, i) => ({ id, num: `0${i + 1}`, name: `${i + 1}組` })),
    deadline: LATER,
    status: "open",
    resultOrder: null,
    ...over,
  };
}

const account: CasinoAccount = { studentId: "2117", pointsBalance: 1000, debtAmount: 0 };

describe("賭け金の入力", () => {
  it("1以上の整数だけを受け付ける", () => {
    expect(parseStake("1")).toBe(1);
    expect(parseStake(" 500 ")).toBe(500);
    expect(parseStake("0")).toBeNull();
    expect(parseStake("-100")).toBeNull();
    expect(parseStake("10.5")).toBeNull();
    expect(parseStake("")).toBeNull();
    expect(parseStake("1e3")).toBeNull();
  });
});

describe("賭式", () => {
  it.each(["大縄跳び", "騎馬戦", "玉入れ", "棒引き"])("%sは旧race設定でも単勝だけを受け付ける", (title) => {
    const target = market({ title });
    expect(allowedKinds(target)).toEqual(["win"]);
    expect(placeBet(account, target, { kind: "place", selection: ["t1"], amount: 100 }, NOW, "b1")).toEqual({ ok: false, error: "invalid_kind" });
    expect(placeBet(account, target, { kind: "trifecta", selection: ["t1", "t2", "t3"], amount: 100 }, NOW, "b1")).toEqual({ ok: false, error: "invalid_kind" });
  });
  it("race 競技は単勝・複勝・三連単、それ以外は単勝のみ", () => {
    expect(allowedKinds(market())).toEqual(["win", "place", "trifecta"]);
    expect(allowedKinds(market({ category: "field" }))).toEqual(["win"]);
    expect(allowedKinds(market({ type: "overall", category: null }))).toEqual(["win", "place", "trifecta"]);
    expect(allowedKinds(market({ type: "custom", category: null }))).toEqual(["win"]);
  });

  it("三連単は同じチームを複数の着順に指定できない", () => {
    const m = market();
    expect(isValidSelection(m, "trifecta", ["t1", "t2", "t3"])).toBe(true);
    expect(isValidSelection(m, "trifecta", ["t1", "t1", "t3"])).toBe(false);
    expect(isValidSelection(m, "trifecta", ["t1", "t2"])).toBe(false);
    expect(isValidSelection(m, "win", ["t9"])).toBe(false);
  });
});

describe("ベット", () => {
  it("成功すると残高から賭け金が引かれる", () => {
    const r = placeBet(account, market(), { kind: "win", selection: ["t1"], amount: 300 }, NOW, "b1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.account.pointsBalance).toBe(700);
      expect(r.value.bet).toMatchObject({ kind: "win", selection: ["t1"], amount: 300, payoutAmount: null });
    }
  });

  it("残高ちょうどは賭けられ、超えると拒否", () => {
    const m = market();
    expect(placeBet(account, m, { kind: "win", selection: ["t1"], amount: 1000 }, NOW, "b").ok).toBe(true);
    expect(placeBet(account, m, { kind: "win", selection: ["t1"], amount: 1001 }, NOW, "b")).toEqual({
      ok: false,
      error: "insufficient_balance",
    });
  });

  it("不正な金額は拒否（クライアントの値を信用しない）", () => {
    const m = market();
    for (const amount of [0, -100, 10.5, "100", null]) {
      expect(placeBet(account, m, { kind: "win", selection: ["t1"], amount }, NOW, "b")).toEqual({
        ok: false,
        error: "invalid_stake",
      });
    }
  });

  it("締切後・結果確定後は拒否", () => {
    const closed = market({ deadline: EARLIER });
    expect(effectiveStatus(closed, NOW)).toBe("closed");
    expect(placeBet(account, closed, { kind: "win", selection: ["t1"], amount: 1 }, NOW, "b")).toEqual({
      ok: false,
      error: "market_closed",
    });
    const settled = market({ status: "settled", resultOrder: ["t1"] });
    expect(placeBet(account, settled, { kind: "win", selection: ["t1"], amount: 1 }, NOW, "b").ok).toBe(false);
  });

  it("許可されていない賭式は拒否", () => {
    const field = market({ category: "field" });
    expect(placeBet(account, field, { kind: "place", selection: ["t1"], amount: 1 }, NOW, "b")).toEqual({
      ok: false,
      error: "invalid_kind",
    });
  });

  it("同じ Market に続けて追加ベットできる", () => {
    const m = market();
    const r1 = placeBet(account, m, { kind: "win", selection: ["t1"], amount: 500 }, NOW, "b1");
    if (!r1.ok) throw new Error("1回目が失敗");
    const r2 = placeBet(r1.value.account, m, { kind: "win", selection: ["t3"], amount: 300 }, NOW, "b2");
    expect(r2.ok && r2.value.account.pointsBalance).toBe(200);
  });
});

describe("取消", () => {
  const placed = placeBet(account, market(), { kind: "win", selection: ["t1"], amount: 300 }, NOW, "b1");
  if (!placed.ok) throw new Error("前提のベットが失敗");
  const { account: after, bet } = placed.value;

  it("締切前なら全額戻る", () => {
    const r = cancelBet(after, market(), bet, NOW);
    expect(r.ok && r.value.account.pointsBalance).toBe(1000);
  });

  it("締切後は取り消せない", () => {
    expect(cancelBet(after, market({ deadline: EARLIER }), bet, NOW)).toEqual({ ok: false, error: "market_closed" });
  });

  it("他人のベットは取り消せない", () => {
    const other: CasinoAccount = { studentId: "9999", pointsBalance: 0, debtAmount: 0 };
    expect(cancelBet(other, market(), bet, NOW)).toEqual({ ok: false, error: "bet_not_found" });
  });
});
