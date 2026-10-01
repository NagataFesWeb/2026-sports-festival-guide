import { describe, expect, it } from "vitest";
import { buildPool, estimateOdds, estimateReturn, formatOdds, minimumOdds, settlePayouts, summarizeHits } from "./odds";
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
  it.each([[3, 6], [4, 24], [6, 120], [8, 336]])("三連単は%i組の順列数%iを最低倍率として表示・精算する", (count, permutations) => {
    const ticket = bet("trifecta", ["a", "b", "c"], 100);
    expect(minimumOdds("trifecta", count)).toBe(permutations);
    expect(estimateOdds({}, "trifecta", "a>b>c", count)).toBe(permutations);
    expect(estimateOdds({ "a>b>c": 100 }, "trifecta", "a>b>c", count)).toBe(permutations);
    expect(settlePayouts([ticket], ["a", "b", "c"], count).get(ticket.id)).toBe(permutations * 100);
  });

  it("三連単は3組未満では成立しない", () => {
    expect(() => minimumOdds("trifecta", 2)).toThrow(RangeError);
  });
  it.each([2, 4, 6, 8])("%i組の単勝・複勝の最低保証は均等な的中確率の逆数", (count) => {
    expect(minimumOdds("win", count) * (1 / count)).toBeCloseTo(1);
    expect(minimumOdds("place", count) * (Math.min(3, count) / count)).toBeCloseTo(1);
  });

  it("紅白の単勝は最低2倍で表示と精算が一致する", () => {
    const ticket = bet("win", ["red"], 100);
    expect(estimateOdds({ red: 100 }, "win", "red", 2)).toBe(2);
    expect(settlePayouts([ticket], ["red", "white"], 2).get(ticket.id)).toBe(200);
  });

  it("三連単は336倍を超えると追加・取消によって変動し、最終プールで払う", () => {
    const hit = bet("trifecta", ["a", "b", "c"], 100);
    const miss = bet("trifecta", ["b", "a", "c"], 79900);
    const extra = bet("trifecta", ["a", "b", "c"], 100);
    expect(estimateOdds(buildPool([hit], "trifecta"), "trifecta", "a>b>c")).toBe(336);
    expect(estimateOdds(buildPool([hit, miss], "trifecta"), "trifecta", "a>b>c")).toBe(800);
    expect(estimateOdds(buildPool([hit, miss, extra], "trifecta"), "trifecta", "a>b>c")).toBe(400.5);
    expect(settlePayouts([hit, miss, extra], ["a", "b", "c"]).get(hit.id)).toBe(40050);
    expect(settlePayouts([hit, miss], ["a", "b", "c"]).get(hit.id)).toBe(80000);
    expect(settlePayouts([hit, miss], ["a", "b", "c"]).get(miss.id)).toBe(0);
  });
  it("均等な8組のプールでは単勝8倍、複勝8/3倍で、空プールも賭式別になる", () => {
    const pool = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`t${i + 1}`, 100]));
    expect(estimateOdds(pool, "win", "t1")).toBe(8);
    expect(estimateOdds(pool, "place", "t1")).toBeCloseTo(8 / 3);
    expect(estimateOdds({}, "win", "t1")).toBe(8);
    expect(estimateOdds({}, "place", "t1")).toBe(8 / 3);
    expect(estimateOdds(pool, "place", "t9")).toBe(8 / 3);
  });
  it("単勝はプールで計算し、参加が少なくても最低8倍", () => {
    const pool = buildPool([bet("win", ["t1"], 300), bet("win", ["t2"], 100)], "win");
    expect(estimateOdds(pool, "win", "t1")).toBe(8);
    expect(estimateOdds(pool, "win", "t2")).toBe(8);
  });

  it("賭けが無い対象にも最低8倍を表示", () => {
    const pool = buildPool([bet("win", ["t1"], 300)], "win");
    expect(estimateOdds(pool, "win", "t9")).toBe(8);
    expect(formatOdds(null)).toBe("―");
  });

  it("複勝は3分割の見込み倍率にも最低8/3倍を適用", () => {
    const pool = buildPool([bet("place", ["t1"], 100), bet("place", ["t2"], 200)], "place");
    expect(estimateOdds(pool, "place", "t1")).toBe(8 / 3);
    expect(estimateOdds(pool, "place", "t2")).toBe(8 / 3);
  });

  it("三連単は賭けが無い組み合わせも最低336倍", () => {
    const pool = buildPool(
      [bet("trifecta", ["a", "b", "c"], 100), bet("trifecta", ["b", "a", "c"], 300)],
      "trifecta",
    );
    expect(estimateOdds(pool, "trifecta", "a>b>c")).toBe(336);
    expect(estimateOdds(pool, "trifecta", "c>b>a")).toBe(336);
  });

  it("最低保証を超えるプール倍率はそのまま表示する", () => {
    expect(estimateOdds({ a: 100, b: 900 }, "win", "a")).toBe(10);
    expect(estimateOdds({ a: 100, b: 2000 }, "place", "a")).toBe(7);
  });

  it.each(["win", "place", "trifecta"] as const)("参加者1人の%sは表示と払戻が一致する", (kind) => {
    const selection = kind === "trifecta" ? ["a", "b", "c"] : ["a"];
    const ticket = bet(kind, selection, 100);
    const odds = estimateOdds(buildPool([ticket], kind), kind, selection.join(">"));
    expect(odds).toBe(kind === "trifecta" ? 336 : kind === "place" ? 8 / 3 : 8);
    expect(settlePayouts([ticket], ["a", "b", "c"]).get(ticket.id)).toBe(estimateReturn(odds, 100));
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
  it("単勝：プールが小さくても的中者に8倍を払う", () => {
    const a = bet("win", ["t1"], 300, "A");
    const b = bet("win", ["t2"], 500, "B");
    const p = settlePayouts([a, b], ["t1", "t2", "t3"]);
    expect(p.get(a.id)).toBe(2400);
    expect(p.get(b.id)).toBe(0);
  });

  it("単勝：的中が複数人なら賭け金比で按分し、各自切り捨て", () => {
    const a = bet("win", ["t1"], 100, "A");
    const b = bet("win", ["t1"], 200, "B");
    const c = bet("win", ["t2"], 2300, "C");
    const p = settlePayouts([a, b, c], ["t1"]);
    // 2600 / 300 = 8.666… 倍（最低8倍超は按分）
    expect(p.get(a.id)).toBe(866);
    expect(p.get(b.id)).toBe(1733);
    expect(p.get(c.id)).toBe(0);
  });

  it("全員外れならすべて没収", () => {
    const a = bet("win", ["t1"], 100);
    const b = bet("win", ["t2"], 100);
    const p = settlePayouts([a, b], ["t3", "t1", "t2"]);
    expect(p.get(a.id)).toBe(0);
    expect(p.get(b.id)).toBe(0);
  });

  it("複勝：3着以内の各対象への払戻に最低8/3倍を適用", () => {
    const a = bet("place", ["t1"], 100);
    const b = bet("place", ["t2"], 200);
    const c = bet("place", ["t3"], 300);
    const d = bet("place", ["t4"], 600);
    const p = settlePayouts([a, b, c, d], ["t3", "t1", "t2", "t4"]);
    // プールでは各400。t2・t3は最低8/3倍まで補填する
    expect(p.get(a.id)).toBe(400);
    expect(p.get(b.id)).toBe(533);
    expect(p.get(c.id)).toBe(800);
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
    expect(p.get(hit.id)).toBe(33600);
    expect(p.get(swapped.id)).toBe(0);
  });

  it("三連単：参加が1人でも多数でも最低336倍で払い戻す", () => {
    const hit = bet("trifecta", ["t1", "t2", "t3"], 101);
    const swapped = bet("trifecta", ["t2", "t1", "t3"], 500);
    const custom = settlePayouts([hit, swapped], ["t1", "t2", "t3"]);
    expect(custom.get(hit.id)).toBe(33936);
    expect(custom.get(swapped.id)).toBe(0);
    const fallback = settlePayouts([hit], ["t1", "t2", "t3"]);
    expect(fallback.get(hit.id)).toBe(33936);
  });

  it("賭式ごとに独立したプールで精算する", () => {
    const w = bet("win", ["t1"], 100);
    const wl = bet("win", ["t2"], 100);
    const pl = bet("place", ["t2"], 50);
    const p = settlePayouts([w, wl, pl], ["t1", "t2", "t3"]);
    expect(p.get(w.id)).toBe(800);
    expect(p.get(wl.id)).toBe(0);
    expect(p.get(pl.id)).toBe(133);
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
