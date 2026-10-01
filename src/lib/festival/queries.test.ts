import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEED_EVENTS, SEED_TEAMS, SEED_EVENT_RESULTS, SEED_INVITES, createFixtureState } from "@/lib/casino/fixtures";
import { festivalSnapshot } from "./snapshot.data";
import { getMePageData, getRankingData, getTopPageData, heatResultViews, normalizeStudentId } from "./queries";

// 表画面からRepositoryを呼ぶ回帰を検出する。実在の生成データをテストへ持ち込まない。
vi.mock("@/lib/db", () => ({ getRepository: () => { throw new Error("表画面のDBアクセスは禁止"); } }));
vi.mock("./snapshot.data", () => ({ festivalSnapshot: {} }));

beforeEach(() => {
  Object.assign(festivalSnapshot, structuredClone({
    teams: SEED_TEAMS, events: SEED_EVENTS, results: SEED_EVENT_RESULTS,
    invites: SEED_INVITES, overall: [], studentCount: 960,
    settings: { finalSettledAt: null, scoresPublishedAt: null }, ranking: [],
  }));
});

describe("静的な表画面", () => {
  it("全角数字と空白を正規化し、不正な番号は拒否する", () => {
    expect(normalizeStudentId(" ２１１7 ")).toBe("2117");
    expect(normalizeStudentId("1")).toBe("1");
    expect(normalizeStudentId("12345678")).toBe("12345678");
    for (const value of ["", " ", "123456789", "21a7", "21-17", "２１１７番"]) {
      expect(normalizeStudentId(value)).toBeNull();
    }
  });

  it("DB・fetchなしでトップ・本人案内・ランキングを返す", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("通信禁止"));
    try {
      const top = await getTopPageData(new Date());
      expect(top.counts).toEqual({ players: 960, teams: 8, programs: 12 });
      expect(top.events.map(e => e.no)).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")));
      expect((await getMePageData("2117")).events).toHaveLength(12);
      expect(await getRankingData()).toEqual({ finalSettledAt: null, rows: [] });
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it("人数は固定値から返し、空名簿は公称値に補う", async () => {
    festivalSnapshot.studentCount = 946;
    expect((await getTopPageData(new Date())).counts.players).toBe(946);
    festivalSnapshot.studentCount = 0;
    expect((await getTopPageData(new Date())).counts.players).toBe(960);
  });

  it("スナップショットの遅延を開始見込みへ加える", async () => {
    const event = festivalSnapshot.events.find(e => e.id === "ev-06")!;
    event.delayMin = 5;
    const data = await getTopPageData(new Date());
    expect(Date.parse(data.starts[event.id]!)).toBe(Date.parse(event.startTime!) + 300_000);
    expect(Object.keys(data.statuses)).toHaveLength(12);
  });

  it("公開前の総合順位を返さず、公開済みの8組の順位を表示する", async () => {
    const overall = createFixtureState(new Date()).markets.find(m => m.type === "overall")!;
    const order = ["t8", "t2", "t6", "t3", "t1", "t7", "t4", "t5"];
    festivalSnapshot.overall = [{ ...overall, status: "settled", resultOrder: order }];
    expect((await getTopPageData(new Date())).standings).toBeNull();
    festivalSnapshot.settings.scoresPublishedAt = "2026-10-02T05:30:00Z";
    expect((await getTopPageData(new Date())).standings?.map(row => row.team.id)).toEqual(order);
  });

  it("個人案内は対象番号だけを集合時刻順にし、生徒名簿を表示しない", async () => {
    const data = await getMePageData("2117");
    expect(data.student).toBeNull();
    expect(data.invites.map(i => i.gatherTime)).toEqual(["9:35", "9:55", "13:25"]);
    expect(data.myEvents.map(e => e.no)).toEqual(["05", "06", "10"]);
    const unknown = await getMePageData("9999");
    expect(unknown.invites).toEqual([]);
    expect(unknown.myEvents).toEqual([]);
    expect(unknown.teams).toHaveLength(8);
  });

  it("確定したヒートの上位3組だけを表示する", async () => {
    const { events, results, teams } = await getTopPageData(new Date());
    const views = heatResultViews(events.find(e => e.id === "ev-03")!, results, teams);
    expect(views.map(v => v.heatId)).toEqual(["g1", "g2", "g3"]);
    for (const view of views) expect(view.teamNames).toHaveLength(3);
    expect(heatResultViews(events.find(e => e.id === "ev-11")!, results, teams)).toEqual([]);
  });

  it("精算前の個人ランキングを返さず、精算済みの公開値だけを表示する", async () => {
    festivalSnapshot.ranking = [{ rank: 1, studentId: "sample", name: "サンプル", displayName: "サンプル", netWorth: -400, pointsBalance: 600, debtAmount: 1000 }];
    expect((await getRankingData()).rows).toEqual([]);
    festivalSnapshot.settings.finalSettledAt = "2026-10-02T06:00:00Z";
    expect((await getRankingData()).rows[0].netWorth).toBe(-400);
  });
});
