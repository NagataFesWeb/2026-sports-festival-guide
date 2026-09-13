import { describe, expect, it } from "vitest";
import { computeStandings, eventPoints, pointsFromOrder } from "./standings";
import type { EventResult, Team } from "./types";

function team(over: Partial<Team> = {}): Team {
  return { id: "t1", num: "01", name: "1組", color: "#ff0000", sortOrder: 1, ...over };
}

function result(over: Partial<EventResult> = {}): EventResult {
  return {
    eventId: "e1",
    heatId: "all",
    order: ["t1", "t2", "t3"],
    points: {},
    confirmedAt: "2026-09-26T00:00:00.000Z",
    ...over,
  };
}

describe("pointsFromOrder", () => {
  it("着順に rankPoints を割り当てる", () => {
    expect(pointsFromOrder(["t1", "t2", "t3"], [10, 5, 3])).toEqual({ t1: 10, t2: 5, t3: 3 });
  });

  it("rankPoints が足りない順位は0点", () => {
    expect(pointsFromOrder(["t1", "t2", "t3"], [10])).toEqual({ t1: 10, t2: 0, t3: 0 });
  });
});

describe("computeStandings", () => {
  const t1 = team({ id: "t1", sortOrder: 1 });
  const t2 = team({ id: "t2", sortOrder: 2 });
  const t3 = team({ id: "t3", sortOrder: 3 });

  it("得点合計の降順に並べる", () => {
    const results: EventResult[] = [
      result({ points: { t1: 10, t2: 5, t3: 3 }, order: ["t1", "t2", "t3"] }),
      result({ points: { t1: 3, t2: 10, t3: 5 }, order: ["t2", "t3", "t1"] }),
    ];
    const rows = computeStandings([t1, t2, t3], results);
    expect(rows.map((r) => r.team.id)).toEqual(["t2", "t1", "t3"]);
    expect(rows.map((r) => r.points)).toEqual([15, 13, 8]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("優勝回数（order[0]）を数える", () => {
    const results: EventResult[] = [
      result({ points: { t1: 5 }, order: ["t1", "t2"] }),
      result({ points: { t1: 5 }, order: ["t1", "t3"] }),
      result({ points: { t2: 5 }, order: ["t2", "t1"] }),
    ];
    const rows = computeStandings([t1, t2, t3], results);
    expect(rows.find((r) => r.team.id === "t1")?.wins).toBe(2);
    expect(rows.find((r) => r.team.id === "t2")?.wins).toBe(1);
  });

  it("得点が同じなら並び順は優勝回数→sortOrderで決まるが、順位（rank）は得点だけで同着になる", () => {
    const results: EventResult[] = [
      result({ points: { t1: 5, t2: 5, t3: 5 }, order: ["t2", "t1", "t3"] }),
    ];
    const rows = computeStandings([t1, t2, t3], results);
    // 全チーム 5点。並び順は t2(優勝1回)→t1(sortOrder1)→t3(sortOrder3)
    expect(rows.map((r) => r.team.id)).toEqual(["t2", "t1", "t3"]);
    // 得点が同じなので同順位を共有する
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("結果が無いチームは0点0勝で扱われる", () => {
    const rows = computeStandings([t1, t2, t3], []);
    expect(rows.every((r) => r.points === 0 && r.wins === 0)).toBe(true);
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("同じ種目の複数ヒートを合計し、優勝回数はヒート単位で数える", () => {
    const results: EventResult[] = [
      result({ eventId: "e1", heatId: "g1", points: { t1: 10, t2: 8 }, order: ["t1", "t2"] }),
      result({ eventId: "e1", heatId: "g2", points: { t1: 8, t2: 10 }, order: ["t2", "t1"] }),
      result({ eventId: "e1", heatId: "g3", points: { t1: 10, t2: 8 }, order: ["t1", "t2"] }),
    ];
    const rows = computeStandings([t1, t2, t3], results);
    expect(rows.find((r) => r.team.id === "t1")?.points).toBe(28);
    expect(rows.find((r) => r.team.id === "t1")?.wins).toBe(2);
    expect(rows.find((r) => r.team.id === "t2")?.wins).toBe(1);
  });
});

describe("eventPoints", () => {
  it("種目の全ヒートの得点を合計する", () => {
    const results: EventResult[] = [
      result({ eventId: "e1", heatId: "g1", points: { t1: 10, t2: 8 } }),
      result({ eventId: "e1", heatId: "g2", points: { t1: 6, t3: 5 } }),
      result({ eventId: "e2", heatId: "all", points: { t1: 100 } }),
    ];
    expect(eventPoints(results, "e1")).toEqual({ t1: 16, t2: 8, t3: 5 });
  });

  it("結果が無い種目は空", () => {
    expect(eventPoints([], "e1")).toEqual({});
  });
});
