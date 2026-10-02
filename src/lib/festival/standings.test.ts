import { describe, expect, it } from "vitest";
import { createFixtureState, SEED_TEAMS } from "@/lib/casino/fixtures";
import { overallStandings } from "./standings";

const order = ["t8", "t6", "t2", "t5", "t1", "t7", "t3", "t4"];
const overall = createFixtureState(new Date()).markets.find(m => m.type === "overall")!;
describe("入力した総合順位の表示", () => {
  it("3学年すべての順位が揃ったときだけ学年順に公開する", () => {
    const markets = [1, 2, 3].map(grade => ({ ...overall, id: `overall-g${grade}`, heatId: `g${grade}`, status: "settled" as const, resultOrder: grade === 2 ? [...order].reverse() : order }));
    expect(overallStandings(SEED_TEAMS, markets.slice(0, 2))).toBeNull();
    expect(overallStandings(SEED_TEAMS, markets.map(m => m.heatId === "g3" ? { ...m, status: "open" as const } : m))).toBeNull();
    const rows = overallStandings(SEED_TEAMS, markets)!;
    expect(rows).toHaveLength(24);
    expect(rows[0]).toMatchObject({ grade: 1, rank: 1 });
    expect(rows[8]).toMatchObject({ grade: 2, rank: 1, team: { id: order[7] } });
    expect(rows[16]).toMatchObject({ grade: 3, rank: 1 });
  });
  it("保存した並びを変更せず1〜8位として返す", () => {
    const rows = overallStandings(SEED_TEAMS, [{ ...overall, status: "settled", resultOrder: order }]);
    expect(rows?.map(row => row.team.id)).toEqual(order);
    expect(rows?.map(row => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(rows?.[0]).not.toHaveProperty("points");
  });
  it("未確定では順位を作らない", () => {
    expect(overallStandings(SEED_TEAMS, [{ ...overall, resultOrder: order }])).toBeNull();
    expect(overallStandings(SEED_TEAMS, [])).toBeNull();
  });
  it.each([["t1"], ["t1", "t1", "t2", "t3", "t4", "t5", "t6", "t7"], [...order.slice(0, 7), "unknown"]])("不完全な旧結果を総合順位にしない (%s)", (...invalid) => {
    expect(overallStandings(SEED_TEAMS, [{ ...overall, status: "settled", resultOrder: invalid }])).toBeNull();
  });
});
