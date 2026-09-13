import { beforeEach, describe, expect, it } from "vitest";
import { getRepository } from "@/lib/db";
import { resetMemoryState } from "@/lib/db/memory";
import {
  getMePageData,
  getRankingData,
  getTopPageData,
  heatResultViews,
  normalizeStudentId,
} from "./queries";

describe("normalizeStudentId", () => {
  it("前後の空白を除いた数字を受け付ける", () => {
    expect(normalizeStudentId(" 2117 ")).toBe("2117");
  });

  it("全角数字を半角に変換する", () => {
    expect(normalizeStudentId("２１１７")).toBe("2117");
    expect(normalizeStudentId(" ２１１7 ")).toBe("2117");
  });

  it("1〜8 桁まで受け付ける", () => {
    expect(normalizeStudentId("1")).toBe("1");
    expect(normalizeStudentId("12345678")).toBe("12345678");
    expect(normalizeStudentId("123456789")).toBeNull();
  });

  it("空・数字以外・記号混じりは null", () => {
    expect(normalizeStudentId("")).toBeNull();
    expect(normalizeStudentId("   ")).toBeNull();
    expect(normalizeStudentId("21a7")).toBeNull();
    expect(normalizeStudentId("21-17")).toBeNull();
    expect(normalizeStudentId("２１１７番")).toBeNull();
  });
});

describe("getTopPageData（仮データ）", () => {
  beforeEach(() => {
    resetMemoryState();
  });

  it("チーム 8 件・プログラム 12 件を番組順で返す", async () => {
    const data = await getTopPageData(new Date());
    expect(data.teams).toHaveLength(8);
    expect(data.events).toHaveLength(12);
    expect(data.events.map((event) => event.no)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
      "07",
      "08",
      "09",
      "10",
      "11",
      "12",
    ]);
    // 名簿が 100 人未満（開発用シードは 10 人）の間は公称の 960 を出す
    expect(data.counts).toEqual({ players: 960, teams: 8, programs: 12 });
  });

  it("ヒートごとの結果を落とさずに返す（ev-03 は 3 ヒート）", async () => {
    const data = await getTopPageData(new Date());
    const ev03 = data.results.filter((result) => result.eventId === "ev-03");
    expect(ev03.map((result) => result.heatId).sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("全種目に進行状況が付き、開始見込みは定刻＋遅延になる", async () => {
    const repository = getRepository();
    const event = await repository.getEvent("ev-06");
    if (event === null) throw new Error("ev-06 が無い");
    await repository.upsertEvent({ ...event, delayMin: 5 });

    const data = await getTopPageData(new Date());
    expect(Object.keys(data.statuses)).toHaveLength(12);
    for (const status of Object.values(data.statuses)) {
      expect(["done", "live", "next", "upcoming"]).toContain(status);
    }
    const planned = Date.parse(event.startTime ?? "");
    expect(Date.parse(data.starts["ev-06"] ?? "")).toBe(planned + 5 * 60_000);
  });

  it("得点公開前は standings が null、公開後は 8 チームぶん返る", async () => {
    const before = await getTopPageData(new Date());
    expect(before.scoresPublishedAt).toBeNull();
    expect(before.standings).toBeNull();

    const repository = getRepository();
    await repository.updateSettings({
      finalSettledAt: null,
      scoresPublishedAt: "2026-09-26T05:30:00.000Z",
    });

    const after = await getTopPageData(new Date());
    expect(after.scoresPublishedAt).toBe("2026-09-26T05:30:00.000Z");
    expect(after.standings).toHaveLength(8);
    expect(after.standings?.[0].rank).toBe(1);
    // 順位は 1 位から昇順に並ぶ
    const ranks = after.standings?.map((row) => row.rank) ?? [];
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("名簿が空なら PLAYERS は 960 にフォールバックする", async () => {
    await getRepository().replaceStudents([]);
    const data = await getTopPageData(new Date());
    expect(data.counts.players).toBe(960);
  });
});

describe("getMePageData（仮データ）", () => {
  beforeEach(() => {
    resetMemoryState();
  });

  it("2117 は名簿の 2年1組で、招集案内 3 件を集合時間の昇順で返す", async () => {
    const data = await getMePageData("2117");
    expect(data.student?.name).toBe("サンプル生徒04");
    expect(data.student?.grade).toBe(2);
    expect(data.student?.classNo).toBe(1);
    // 組 → チーム（Team.num は "01" 形式なので数値で突き合わせる）
    expect(data.student?.team?.num).toBe("01");

    expect(data.invites).toHaveLength(3);
    // "13:25" を文字列比較すると先頭に来てしまうので分に直して並べる
    expect(data.invites.map((invite) => invite.gatherTime)).toEqual(["9:35", "9:55", "13:25"]);
    expect(data.invites.map((invite) => invite.tag)).toEqual(["ゼッケン着用", "ハチマキ着用", "軍手持参"]);
  });

  it("出場種目は招集案内の種目名と一致した種目（05・06・10）", async () => {
    const data = await getMePageData("2117");
    expect(data.myEvents.map((event) => event.no)).toEqual(["05", "06", "10"]);
  });

  it("全種目とその開始見込みも返る", async () => {
    const data = await getMePageData("2117");
    expect(data.events).toHaveLength(12);
    expect(data.teams).toHaveLength(8);
    expect(data.starts["ev-01"]).not.toBeNull();
  });

  it("名簿に無い学籍番号は student が null、招集案内も空", async () => {
    const data = await getMePageData("9999");
    expect(data.student).toBeNull();
    expect(data.invites).toEqual([]);
    expect(data.myEvents).toEqual([]);
    // 種目一覧は誰が見ても同じものを出す
    expect(data.events).toHaveLength(12);
  });
});

describe("heatResultViews", () => {
  beforeEach(() => {
    resetMemoryState();
  });

  it("結果が確定したヒートだけを 3 位までのチーム名で返す", async () => {
    const { events, results, teams } = await getTopPageData(new Date());
    const ev03 = events.find((event) => event.id === "ev-03");
    if (ev03 === undefined) throw new Error("ev-03 が無い");

    const views = heatResultViews(ev03, results, teams);
    expect(views.map((view) => view.heatLabel)).toEqual(["1年", "2年", "3年"]);
    for (const view of views) expect(view.teamNames).toHaveLength(3);

    // ev-04 は g1 のみ確定
    const ev04 = events.find((event) => event.id === "ev-04");
    if (ev04 === undefined) throw new Error("ev-04 が無い");
    expect(heatResultViews(ev04, results, teams).map((view) => view.heatId)).toEqual(["g1"]);

    // 未確定の種目は空
    const ev11 = events.find((event) => event.id === "ev-11");
    if (ev11 === undefined) throw new Error("ev-11 が無い");
    expect(heatResultViews(ev11, results, teams)).toEqual([]);
  });
});

describe("getRankingData（仮データ）", () => {
  beforeEach(() => {
    resetMemoryState();
  });

  it("最終精算前は未公開（rows が空）", async () => {
    const { finalSettledAt, rows } = await getRankingData();
    expect(finalSettledAt).toBeNull();
    expect(rows).toEqual([]);
  });

  it("最終精算後は純資産の降順で返る（マイナスも含む）", async () => {
    const repository = getRepository();
    await repository.updateSettings({
      finalSettledAt: "2026-09-10T15:00:00.000Z",
      scoresPublishedAt: "2026-09-10T14:50:00.000Z",
    });
    await repository.updateAccounts([
      {
        studentId: "2101",
        pointsBalance: 3000,
        debtAmount: 0,
        passwordHash: "x",
        nickname: "",
        registeredAt: "2026-09-10T00:00:00.000Z",
        finalBalanceBefore: 3000,
        finalDebt: 0,
      },
      {
        studentId: "2105",
        pointsBalance: -400,
        debtAmount: 0,
        passwordHash: "x",
        nickname: "",
        registeredAt: "2026-09-10T00:00:00.000Z",
        finalBalanceBefore: 600,
        finalDebt: 1000,
      },
    ]);

    const { finalSettledAt, rows } = await getRankingData();
    expect(finalSettledAt).toBe("2026-09-10T15:00:00.000Z");
    expect(rows[0].rank).toBe(1);
    expect(rows[0].studentId).toBe("2101");
    // 純資産は降順
    expect(rows.map((row) => row.netWorth)).toEqual([...rows.map((row) => row.netWorth)].sort((a, b) => b - a));
    // マイナスの純資産と、精算前の所持・借入が併記できる
    const minus = rows.find((row) => row.studentId === "2105");
    expect(minus?.netWorth).toBe(-400);
    expect(minus?.pointsBalance).toBe(600);
    expect(minus?.debtAmount).toBe(1000);
  });
});
