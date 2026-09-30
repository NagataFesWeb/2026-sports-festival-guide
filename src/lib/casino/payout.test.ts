import { describe, expect, it } from "vitest";
import { buildPool, estimateOdds, estimateReturn, formatOdds, settlePayouts, summarizeHits } from "./odds";
import type { Bet, BetKind } from "./types";

let seq = 0;
function bet(kind: BetKind, selection: string[], amount: number, studentId = "s"): Bet {
  seq += 1;
  return {
    id: `b${seq}`,
    marketId: "m",
    studentId,
    kind,
    selection,
    amount,
    payoutAmount: null,
    createdAt: "2026-09-26T00:00:00.000Z",
  };
}

describe("見込み倍率", () => {
  it("単勝は 全賭け金 ÷ 対象への賭け金", () => {
    const pool = buildPool([bet("win", ["t1"], 300), bet("win", ["t2"], 100)], "win");
    expect(estimateOdds(pool, "win", "t1")).toBeCloseTo(4 / 3);
    expect(estimateOdds(pool, "win", "t2")).toBe(4);
  });

  it("賭けが無い対象は null で「―」表示", () => {
    const pool = buildPool([bet("win", ["t1"], 300)], "win");
    expect(estimateOdds(pool, "win", "t9")).toBeNull();
    expect(formatOdds(null)).toBe("―");
  });

  it("複勝は 全賭け金 ÷ 3 ÷ 対象への賭け金", () => {
    const pool = buildPool([bet("place", ["t1"], 100), bet("place", ["t2"], 200)], "place");
    expect(estimateOdds(pool, "place", "t1")).toBe(1);
    expect(estimateOdds(pool, "place", "t2")).toBe(0.5);
  });

  it("三連単は組み合わせ単位のプールで計算する", () => {
    const pool = buildPool(
      [bet("trifecta", ["a", "b", "c"], 100), bet("trifecta", ["b", "a", "c"], 300)],
      "trifecta",
    );
    expect(estimateOdds(pool, "trifecta", "a>b>c")).toBe(4);
    expect(estimateOdds(pool, "trifecta", "c>b>a")).toBeNull();
  });

  it("倍率は小数2桁に切り捨てて表示する", () => {
    expect(formatOdds(1.869)).toBe("1.86");
    expect(formatOdds(4)).toBe("4.00");
  });

  it("見込み払戻は切り捨て、倍率なし・不正な金額は null", () => {
    expect(estimateReturn(1.86, 100)).toBe(186);
    expect(estimateReturn(1.869, 3)).toBe(5);
    expect(estimateReturn(null, 100)).toBeNull();
    expect(estimateReturn(2, 0)).toBeNull();
  });
});

describe("結果確定時の配当", () => {
  it("単勝：的中1人ならプール全額を受け取る", () => {
    const a = bet("win", ["t1"], 300, "A");
    const b = bet("win", ["t2"], 500, "B");
    const p = settlePayouts([a, b], ["t1", "t2", "t3"]);
    expect(p.get(a.id)).toBe(800);
    expect(p.get(b.id)).toBe(0);
  });

  it("単勝：的中が複数人なら賭け金比で按分し、各自切り捨て", () => {
    const a = bet("win", ["t1"], 100, "A");
    const b = bet("win", ["t1"], 200, "B");
    const c = bet("win", ["t2"], 700, "C");
    const p = settlePayouts([a, b, c], ["t1"]);
    // 1000 / 300 = 3.333… 倍
    expect(p.get(a.id)).toBe(333);
    expect(p.get(b.id)).toBe(666);
    expect(p.get(c.id)).toBe(0);
  });

  it("全員外れならすべて没収", () => {
    const a = bet("win", ["t1"], 100);
    const b = bet("win", ["t2"], 100);
    const p = settlePayouts([a, b], ["t3", "t1", "t2"]);
    expect(p.get(a.id)).toBe(0);
    expect(p.get(b.id)).toBe(0);
  });

  it("複勝：3着以内の対象でプールを等分する", () => {
    const a = bet("place", ["t1"], 100);
    const b = bet("place", ["t2"], 200);
    const c = bet("place", ["t3"], 300);
    const d = bet("place", ["t4"], 600);
    const p = settlePayouts([a, b, c, d], ["t3", "t1", "t2", "t4"]);
    // プール 1200 を 3 対象で等分 → 各 400
    expect(p.get(a.id)).toBe(400);
    expect(p.get(b.id)).toBe(400);
    expect(p.get(c.id)).toBe(400);
    expect(p.get(d.id)).toBe(0);
  });

  it("複勝：賭けが無い的中対象の分は、賭けがある的中対象で分ける", () => {
    const a = bet("place", ["t1"], 100);
    const d = bet("place", ["t4"], 500);
    const p = settlePayouts([a, d], ["t1", "t2", "t3", "t4"]);
    expect(p.get(a.id)).toBe(600);
    expect(p.get(d.id)).toBe(0);
  });

  it("三連単：着順まで一致したときだけ的中", () => {
    const hit = bet("trifecta", ["t1", "t2", "t3"], 100);
    const swapped = bet("trifecta", ["t2", "t1", "t3"], 100);
    const p = settlePayouts([hit, swapped], ["t1", "t2", "t3", "t4"]);
    expect(p.get(hit.id)).toBe(200);
    expect(p.get(swapped.id)).toBe(0);
  });

  it("三連単：賭け金プールではなく締切時の個別倍率、未設定なら既定倍率で払い戻す", () => {
    const hit = bet("trifecta", ["t1", "t2", "t3"], 101);
    const swapped = bet("trifecta", ["t2", "t1", "t3"], 500);
    const market = { trifectaOddsDefault: 336, trifectaOddsOverrides: { "t1>t2>t3": 12.34 } };
    const custom = settlePayouts([hit, swapped], ["t1", "t2", "t3"], market);
    expect(custom.get(hit.id)).toBe(1246);
    expect(custom.get(swapped.id)).toBe(0);
    const fallback = settlePayouts([hit], ["t1", "t2", "t3"], { trifectaOddsDefault: 336 });
    expect(fallback.get(hit.id)).toBe(33936);
  });

  it("賭式ごとに独立したプールで精算する", () => {
    const w = bet("win", ["t1"], 100);
    const wl = bet("win", ["t2"], 100);
    const pl = bet("place", ["t2"], 50);
    const p = settlePayouts([w, wl, pl], ["t1", "t2", "t3"]);
    expect(p.get(w.id)).toBe(200);
    expect(p.get(wl.id)).toBe(0);
    expect(p.get(pl.id)).toBe(50);
  });
});

describe("的中演出の集計", () => {
  it("払戻が 1 以上のベットだけを数え、実効倍率は 払戻合計 ÷ 賭け金合計", () => {
    const s = summarizeHits([
      { amount: 200, payoutAmount: 0 }, // 外れ
      { amount: 100, payoutAmount: 250 }, // 的中
      { amount: 300, payoutAmount: null }, // 未確定
      { amount: 50, payoutAmount: 150 }, // 的中
    ]);
    expect(s.count).toBe(2);
    expect(s.payout).toBe(400);
    expect(s.stake).toBe(150);
    expect(s.rate).toBeCloseTo(400 / 150);
  });

  it("的中が無ければ件数 0・倍率 null", () => {
    const s = summarizeHits([
      { amount: 100, payoutAmount: 0 },
      { amount: 100, payoutAmount: null },
    ]);
    expect(s).toEqual({ count: 0, payout: 0, stake: 0, rate: null });
  });
});
