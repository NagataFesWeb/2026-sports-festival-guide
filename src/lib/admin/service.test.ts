// 実行委員の管理操作のテスト。メモリ実装のシードデータ（src/lib/casino/fixtures.ts）を前提にする。
// ヒートを持たない種目や独自の組み合わせが必要なテストは、その場で種目を作って使う
import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_STUDENT_ID } from "@/lib/casino/fixtures";
import { MemoryRepository, resetMemoryState } from "@/lib/db/memory";
import type { Event, Heat } from "@/lib/festival/types";
import {
  confirmEventResult,
  createCustomMarket,
  createEventMarket,
  createOverallMarket,
  closeMarketNow,
  importInvites,
  importRoster,
  marketSummaries,
  publishScores,
  removeEvent,
  removeEventResult,
  reopenMarket,
  resetSchedule,
  runFinalSettlement,
  saveEvent,
  saveTeam,
  settleCustomMarket,
  settleOverallMarket,
  settlementPreview,
  shiftSchedule,
  toIsoDeadline,
  unpublishScores,
  updateMarketDeadline,
  updateTrifectaOdds,
} from "./service";

let repo: MemoryRepository;

/** ev-05 1年（男女混合リレー / race）の着順。t3 は単勝プールがある（t6 は賭けが無い） */
const ORDER_05 = ["t3", "t5", "t1", "t4", "t2", "t7", "t8", "t6"];

function eventOf(over: Partial<Event> & { id: string }): Event {
  const base: Event = {
    id: "ev-tmp",
    no: "99",
    name: "種目",
    en: "EVENT",
    kind: "track",
    category: "race",
    startTime: null,
    delayMin: 0,
    location: "",
    entries: [],
    rankPoints: [10, 8, 6],
    heats: [{ id: "all", label: "総合" }],
    sortOrder: 99,
    participants: "",
    gatherStart: "",
    gatherPlace: "",
    belongings: "",
    formation: "none",
    formationNote: "",
    description: "",
  };
  return { ...base, ...over };
}

/** 学年別 3 ヒート */
const GRADE_HEATS: Heat[] = [
  { id: "g1", label: "1年" },
  { id: "g2", label: "2年" },
  { id: "g3", label: "3年" },
];

beforeEach(() => {
  // 状態は globalThis に持つため、テストごとにシードへ戻す
  resetMemoryState();
  repo = new MemoryRepository();
});

describe("種目結果の確定（順位点のある種目）", () => {
  it("紐づく Market（race-05-g1）を精算し、配当と利子を保存する", async () => {
    const before = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(before?.debtAmount).toBe(500);

    const result = await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.settled).toBe(true);
    expect(result.value.payoutTotal).toBeGreaterThan(0);
    // 借金がある口座（2117）に利子が付く
    expect(result.value.interestApplied).toBe(1);

    // 配当が全ベットに記録され、的中ベットには 1pt 以上が入る
    const bets = await repo.listBets({ marketId: "race-05-g1" });
    expect(bets.length).toBeGreaterThan(0);
    expect(bets.every((b) => b.payoutAmount !== null)).toBe(true);
    expect(bets.filter((b) => (b.payoutAmount ?? 0) > 0).length).toBeGreaterThan(0);

    // 利子は 500 → floor(500 * 1.1) = 550
    const after = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(after?.debtAmount).toBe(550);

    // Market は settled になり着順が記録される
    const market = await repo.getMarket("race-05-g1");
    expect(market?.status).toBe("settled");
    expect(market?.resultOrder).toEqual(ORDER_05);

    // 順位点は event.rankPoints から自動計算（男女混合リレーは 1 位 25 点）。結果はヒート単位で保存する
    const saved = await repo.getEventResult("ev-05", "g1");
    expect(saved?.heatId).toBe("g1");
    expect(saved?.order).toEqual(ORDER_05);
    expect(saved?.points.t3).toBe(25);
    expect(saved?.points.t5).toBe(23);
  });

  it("2 回確定しても Market は二重に精算されない（利子も 1 回だけ）", async () => {
    const first = await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05 });
    expect(first.ok && first.value.settled).toBe(true);

    const second = await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05 });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value).toEqual({ settled: false, payoutTotal: 0, interestApplied: 0 });

    const after = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(after?.debtAmount).toBe(550);
  });

  it("ヒートごとに確定でき、他のヒートの Market は open のまま", async () => {
    const result = await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05 });
    expect(result.ok && result.value.settled).toBe(true);
    expect((await repo.getMarket("race-05-g1"))?.status).toBe("settled");
    expect((await repo.getMarket("race-05-g2"))?.status).toBe("open");
    // 2年のヒートも同じ種目として別に確定できる
    const g2 = await confirmEventResult(repo, "ev-05", "g2", { order: ["t2", "t4", "t6"] });
    expect(g2.ok && g2.value.settled).toBe(true);
    expect((await repo.listEventResults()).filter((r) => r.eventId === "ev-05")).toHaveLength(2);
  });

  it("得点の手動上書きが順位点より優先される", async () => {
    const result = await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05, points: { t3: 20, t5: 1 } });
    expect(result.ok).toBe(true);
    const saved = await repo.getEventResult("ev-05", "g1");
    expect(saved?.points).toEqual({ t3: 20, t5: 1 });
  });

  it("race 競技は 3 位まで、重複・存在しないチームは拒否する", async () => {
    expect(await confirmEventResult(repo, "ev-05", "g1", { order: ["t3", "t5"] })).toEqual({
      ok: false,
      error: "着順は3位まで入力してください",
    });
    expect(await confirmEventResult(repo, "ev-05", "g1", { order: ["t3", "t3", "t1"] })).toEqual({
      ok: false,
      error: "同じチームを複数の順位に指定できません",
    });
    expect(await confirmEventResult(repo, "ev-05", "g1", { order: ["t3", "t5", "t99"] })).toEqual({
      ok: false,
      error: "着順に存在しないチームが含まれています",
    });
    expect(await confirmEventResult(repo, "ev-99", "g1", { order: ORDER_05 })).toEqual({
      ok: false,
      error: "種目が見つかりません",
    });
  });

  it("着順の入力が無い・存在しないヒートは拒否する", async () => {
    expect(await confirmEventResult(repo, "ev-05", "g1", {})).toEqual({ ok: false, error: "着順を入力してください" });
    // ev-05 のヒートは g1〜g3（"all" は無い）
    expect(await confirmEventResult(repo, "ev-05", "all", { order: ORDER_05 })).toEqual({
      ok: false,
      error: "ヒートが見つかりません",
    });
  });

  it("field 競技は 1 位だけで確定できる", async () => {
    const saved = await saveEvent(repo, {
      no: "90",
      name: "クラス対抗綱引き",
      en: "TUG",
      kind: "field",
      category: "field",
      startTime: null,
      location: "フィールド",
      entries: [],
      rankPoints: [10, 8],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const result = await confirmEventResult(repo, saved.value.id, "all", { order: ["t2"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Market が無いので精算はされないが、得点は保存される
    expect(result.value.settled).toBe(false);
    expect((await repo.getEventResult(saved.value.id, "all"))?.points.t2).toBe(10);
  });

  it("得点の手動上書きに負数・存在しないチームを入れると拒否する", async () => {
    expect(await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05, points: { t3: -1 } })).toEqual({
      ok: false,
      error: "得点は 0 以上の整数で入力してください",
    });
    expect(await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05, points: { t99: 1 } })).toEqual({
      ok: false,
      error: "得点に存在しないチームが含まれています",
    });
  });

  it("Market が無い種目（ev-09 大縄跳び）でも順位点だけ確定できる", async () => {
    const result = await confirmEventResult(repo, "ev-09", "g1", { order: ["t1", "t2", "t3"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.settled).toBe(false);
    expect((await repo.getEventResult("ev-09", "g1"))?.points.t1).toBe(25);
  });
});

describe("種目結果の確定（得点入力の種目）", () => {
  it("玉入れ（順位点なし）は得点入力で確定し、Market も精算する", async () => {
    const result = await confirmEventResult(repo, "ev-06", "all", { points: { t5: 30, t2: 30, t1: 12 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.settled).toBe(true);
    expect(result.value.payoutTotal).toBeGreaterThan(0);

    // 着順は得点の多い順、同点はチームの表示順（t2 は sortOrder 2、t5 は 5）
    const saved = await repo.getEventResult("ev-06", "all");
    expect(saved?.order).toEqual(["t2", "t5", "t1"]);
    expect(saved?.points).toEqual({ t5: 30, t2: 30, t1: 12 });
    expect((await repo.getMarket("field-06"))?.resultOrder).toEqual(["t2", "t5", "t1"]);
  });

  it("得点が無い・負数・存在しないチームは拒否する", async () => {
    expect(await confirmEventResult(repo, "ev-06", "all", {})).toEqual({
      ok: false,
      error: "得点を1チーム以上入力してください",
    });
    expect(await confirmEventResult(repo, "ev-06", "all", { points: { t1: 1.5 } })).toEqual({
      ok: false,
      error: "得点は 0 以上の整数で入力してください",
    });
    expect(await confirmEventResult(repo, "ev-06", "all", { points: { t99: 3 } })).toEqual({
      ok: false,
      error: "得点に存在しないチームが含まれています",
    });
  });

  it("race Market の精算では 3 着まで埋めるが、保存する着順は入力どおり", async () => {
    const saved = await saveEvent(repo, {
      no: "91",
      name: "得点制レース",
      en: "SCORE RACE",
      kind: "field",
      category: "race",
      startTime: null,
      location: "トラック",
      entries: [],
      rankPoints: [],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const market = await createEventMarket(repo, saved.value.id, "all", "2026-10-01T15:00");
    expect(market.ok).toBe(true);
    if (!market.ok) return;

    const result = await confirmEventResult(repo, saved.value.id, "all", { points: { t3: 5, t1: 9 } });
    expect(result.ok && result.value.settled).toBe(true);

    // 保存する着順は入力から導いた 2 件のまま
    expect((await repo.getEventResult(saved.value.id, "all"))?.order).toEqual(["t1", "t3"]);
    // 精算用の着順は 3 件（不足分をチームの表示順で埋める）
    const settled = await repo.getMarket(market.value.id);
    expect(settled?.status).toBe("settled");
    expect(settled?.resultOrder).toEqual(["t1", "t3", "t2"]);
  });
});

describe("結果の取り消し", () => {
  it("Market が無い・未確定のヒートは取り消せる", async () => {
    // ev-03 の 1年（g1）はシードで結果済み・Market なし
    expect((await removeEventResult(repo, "ev-03", "g1")).ok).toBe(true);
    expect(await repo.getEventResult("ev-03", "g1")).toBeNull();
    // 他のヒートの結果は残る
    expect(await repo.getEventResult("ev-03", "g2")).not.toBeNull();
  });

  it("Market が確定済みなら取り消せない", async () => {
    await confirmEventResult(repo, "ev-05", "g1", { order: ORDER_05 });
    expect(await removeEventResult(repo, "ev-05", "g1")).toEqual({
      ok: false,
      error: "Market が確定済みのため結果を取り消せません",
    });
    expect(await repo.getEventResult("ev-05", "g1")).not.toBeNull();
  });

  it("確定結果が無ければエラー", async () => {
    expect(await removeEventResult(repo, "ev-02", "all")).toEqual({ ok: false, error: "確定済みの結果がありません" });
  });
});

describe("全体優勝・custom Market の確定", () => {
  it("全体優勝は着順を記録して精算する", async () => {
    const result = await settleOverallMarket(repo, ["t2", "t6", "t1"]);
    expect(result.ok && result.value.settled).toBe(true);
    const market = await repo.getMarket("overall");
    expect(market?.status).toBe("settled");
    expect(market?.resultOrder).toEqual(["t2", "t6", "t1"]);
  });

  it("確定済みの全体優勝 Market は 2 回精算できない", async () => {
    await settleOverallMarket(repo, ["t2"]);
    expect(await settleOverallMarket(repo, ["t1"])).toEqual({
      ok: false,
      error: "未確定の全体優勝 Market がありません",
    });
  });

  it("custom Market は勝者の選択肢で精算する", async () => {
    const result = await settleCustomMarket(repo, "special-general", "red");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.payoutTotal).toBeGreaterThan(0);
    expect((await repo.getMarket("special-general"))?.resultOrder).toEqual(["red"]);
  });

  it("存在しない選択肢は拒否する", async () => {
    expect(await settleCustomMarket(repo, "special-general", "blue")).toEqual({
      ok: false,
      error: "勝者を選択してください",
    });
  });
});

describe("Market の作成・締切", () => {
  it("三連単の全組み合わせに既定倍率を適用し、個別補正と解除を締切まで許可する", async () => {
    const created = await createEventMarket(repo, "ev-05", "g3", "2026-10-01T10:00");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;
    const now = new Date("2026-09-30T00:00:00Z");
    expect(created.value.trifectaOddsDefault).toBe(336);
    expect((await updateTrifectaOdds(repo, id, { mode: "default", odds: 250.5 }, now)).ok).toBe(true);
    expect((await updateTrifectaOdds(repo, id, { mode: "override", order: ["t1", "t2", "t3"], odds: 12.34 }, now)).ok).toBe(true);
    expect((await repo.getMarket(id))?.trifectaOddsOverrides).toEqual({ "t1>t2>t3": 12.34 });
    expect((await updateTrifectaOdds(repo, id, { mode: "reset", order: ["t1", "t2", "t3"] }, now)).ok).toBe(true);
    expect((await repo.getMarket(id))?.trifectaOddsOverrides).toEqual({});
    expect((await updateTrifectaOdds(repo, id, { mode: "override", order: ["t1", "t1", "t3"], odds: 10 }, now)).ok).toBe(false);
    expect((await updateTrifectaOdds(repo, id, { mode: "default", odds: 1000.01 }, now)).ok).toBe(false);
    expect((await updateTrifectaOdds(repo, id, { mode: "default", odds: 9.999 }, now)).ok).toBe(false);
    expect((await updateTrifectaOdds(repo, id, { mode: "default", odds: 9 }, new Date("2026-10-01T02:00:00Z"))).ok).toBe(false);
  });

  it("同じ種目・ヒートに 2 つ目の Market は作れない", async () => {
    const dup = await createEventMarket(repo, "ev-05", "g1", "2026-10-01T10:00");
    expect(dup).toEqual({ ok: false, error: "この種目・ヒートの Market は既に作成済みです" });
  });

  it("Market が無いヒートには作れる（学年ヒートは英語名に Y1〜Y3 を付ける）", async () => {
    const created = await createEventMarket(repo, "ev-05", "g3", "2026-10-01T10:00");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.type).toBe("event");
    expect(created.value.eventId).toBe("ev-05");
    expect(created.value.heatId).toBe("g3");
    expect(created.value.category).toBe("race");
    expect(created.value.no).toBe("05");
    expect(created.value.title).toBe("男女混合リレー 3年");
    expect(created.value.en).toBe("MIXED RELAY Y3");
    expect(created.value.status).toBe("open");
    expect(created.value.options.map((o) => o.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"]);
    expect(created.value.id.startsWith("mkt-")).toBe(true);
  });

  it("1 ヒートだけの種目は種目名・英語名をそのまま使う", async () => {
    const created = await createEventMarket(repo, "ev-01", "all", "2026-10-01T09:00");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.title).toBe("開会式");
    expect(created.value.en).toBe("OPENING CEREMONY");
    expect(created.value.category).toBe("field");
  });

  it("学年ヒート以外の複数ヒートはヒート名だけを足す", async () => {
    await repo.upsertEvent(
      eventOf({
        id: "ev-club",
        no: "14",
        name: "部活対抗リレー",
        en: "CLUB RELAY",
        heats: [
          { id: "a", label: "A組" },
          { id: "b", label: "B組" },
        ],
      }),
    );
    const b = await createEventMarket(repo, "ev-club", "b", "2026-10-01T14:30");
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.title).toBe("部活対抗リレー B組");
    expect(b.value.en).toBe("CLUB RELAY");
  });

  it("存在しないヒート・締切が空や不正なら作れない", async () => {
    expect(await createEventMarket(repo, "ev-01", "g1", "2026-10-01T10:00")).toEqual({
      ok: false,
      error: "ヒートが見つかりません",
    });
    expect(await createEventMarket(repo, "ev-01", "all", "")).toEqual({ ok: false, error: "締切の日時を入力してください" });
    expect(await createEventMarket(repo, "ev-01", "all", "きのう")).toEqual({
      ok: false,
      error: "締切の日時を入力してください",
    });
  });

  it("全体優勝・custom Market を作れる（ヒートは持たない）", async () => {
    const overall = await createOverallMarket(repo, "2026-10-01T16:00");
    expect(overall.ok && overall.value.no).toBe("*");
    if (overall.ok) expect(overall.value.heatId).toBeNull();
    const custom = await createCustomMarket(repo, {
      title: "大将戦 青黄",
      en: "",
      optionA: "青組",
      optionB: "黄組",
      deadlineIso: "2026-10-01T15:00",
    });
    expect(custom.ok).toBe(true);
    if (!custom.ok) return;
    expect(custom.value.no).toBe("#");
    expect(custom.value.heatId).toBeNull();
    // en 未入力なら title を使う
    expect(custom.value.en).toBe("大将戦 青黄");
    expect(custom.value.options).toEqual([
      { id: "a", num: "A", name: "青組" },
      { id: "b", num: "B", name: "黄組" },
    ]);
  });

  it("締切の変更・締切・再開ができ、確定済みには効かない", async () => {
    const updated = await updateMarketDeadline(repo, "race-05-g1", "2026-10-01T10:30");
    expect(updated.ok).toBe(true);
    if (updated.ok) expect(updated.value.deadline).toBe(toIsoDeadline("2026-10-01T10:30"));

    expect((await closeMarketNow(repo, "race-05-g1")).ok).toBe(true);
    expect((await repo.getMarket("race-05-g1"))?.status).toBe("closed");
    expect((await reopenMarket(repo, "race-05-g1")).ok).toBe(true);
    expect((await repo.getMarket("race-05-g1"))?.status).toBe("open");

    // race-04-g1 はシードで settled
    expect(await closeMarketNow(repo, "race-04-g1")).toEqual({ ok: false, error: "確定済みの Market は変更できません" });
    expect(await reopenMarket(repo, "race-04-g1")).toEqual({ ok: false, error: "確定済みの Market は再開できません" });
    expect(await updateMarketDeadline(repo, "race-04-g1", "2026-10-01T10:30")).toEqual({
      ok: false,
      error: "確定済みの Market は変更できません",
    });
  });

  it("一覧は種目の遅延を反映した実効締切とヒート名を返す", async () => {
    expect((await shiftSchedule(repo, "ev-05", 5)).ok).toBe(true);
    const rows = await marketSummaries(repo, new Date());

    const row = rows.find((r) => r.market.id === "race-05-g1");
    expect(row).toBeDefined();
    if (!row) return;
    // 保存されている締切は定刻のまま、実効締切は 5 分後
    expect(row.effectiveDeadline).toBe(new Date(Date.parse(row.market.deadline) + 5 * 60_000).toISOString());
    expect(row.heatLabel).toBe("1年");

    // 1 ヒートだけの種目はヒート名を出さず、overall は遅延の影響を受けない
    const field06 = rows.find((r) => r.market.id === "field-06");
    expect(field06?.heatLabel).toBeNull();
    const overall = rows.find((r) => r.market.id === "overall");
    expect(overall?.effectiveDeadline).toBe(overall?.market.deadline);
  });
});

describe("チーム・種目の保存", () => {
  it("チーム名と色を更新できる", async () => {
    const saved = await saveTeam(repo, { id: "t1", num: "01", name: "1組 烈火", color: "#FF0000" });
    expect(saved.ok).toBe(true);
    const teams = await repo.listTeams();
    expect(teams.find((t) => t.id === "t1")?.name).toBe("1組 烈火");
    expect(teams.find((t) => t.id === "t1")?.color).toBe("#FF0000");
    expect(teams).toHaveLength(8);
  });

  it("空の名前・不正な色は拒否する", async () => {
    expect(await saveTeam(repo, { id: "t1", num: "01", name: " ", color: "#FF0000" })).toEqual({
      ok: false,
      error: "チーム名を入力してください",
    });
    expect(await saveTeam(repo, { id: "t1", num: "01", name: "1組", color: "red" })).toEqual({
      ok: false,
      error: "チームカラーは #RRGGBB 形式で入力してください",
    });
  });

  it("種目を新規作成でき、チーム未選択の枠は捨て、ヒート未指定なら「総合」1 ヒートになる", async () => {
    const saved = await saveEvent(repo, {
      no: "11",
      name: "部活対抗リレー",
      en: "CLUB RELAY",
      kind: "club",
      category: "race",
      startTime: "2026-10-01T14:00",
      location: "トラック",
      entries: [
        { slot: "1コース", teamId: "t1" },
        { slot: "2コース", teamId: "" },
      ],
      rankPoints: [10, 8, 6],
      participants: " 部活動 ",
      formation: "lane",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.entries).toEqual([{ slot: "1コース", teamId: "t1" }]);
    expect(saved.value.startTime).toBe(toIsoDeadline("2026-10-01T14:00"));
    expect(saved.value.kind).toBe("club");
    expect(saved.value.heats).toEqual([{ id: "all", label: "総合" }]);
    expect(saved.value.delayMin).toBe(0);
    expect(saved.value.participants).toBe("部活動");
    expect(saved.value.formation).toBe("lane");
    expect((await repo.listEvents()).some((e) => e.id === saved.value.id)).toBe(true);
  });

  it("ヒート・招集情報を保存し、更新時は未指定の項目を保つ", async () => {
    const created = await saveEvent(repo, {
      no: "12",
      name: "学年別リレー",
      en: "GRADE RELAY",
      kind: "track",
      category: "race",
      startTime: null,
      location: "トラック",
      entries: [],
      rankPoints: [10, 8, 6],
      heats: GRADE_HEATS,
      gatherStart: "準備体操退場後",
      gatherPlace: "フィールド（本部側）",
      belongings: "ゼッケン",
      formationNote: "本部に向かって右から1年→2年→3年",
      description: "各学年 8 チームで走る",
      delayMin: 3,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.heats).toEqual(GRADE_HEATS);

    const updated = await saveEvent(repo, {
      id: created.value.id,
      no: "12",
      name: "学年別リレー（決勝）",
      en: "GRADE RELAY",
      kind: "track",
      category: "race",
      startTime: null,
      location: "トラック",
      entries: [],
      rankPoints: [10, 8, 6],
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    // heats・delayMin・招集情報は未指定なら既存値を保つ
    expect(updated.value.heats).toEqual(GRADE_HEATS);
    expect(updated.value.delayMin).toBe(3);
    expect(updated.value.gatherStart).toBe("準備体操退場後");
    expect(updated.value.description).toBe("各学年 8 チームで走る");
  });

  it("削除後に作った種目の表示順が既存と衝突しない", async () => {
    await removeEvent(repo, "ev-05");
    const saved = await saveEvent(repo, {
      no: "13",
      name: "部活対抗リレー",
      en: "",
      kind: "club",
      category: "field",
      startTime: null,
      location: "",
      entries: [],
      rankPoints: [10],
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const others = (await repo.listEvents()).filter((e) => e.id !== saved.value.id);
    expect(others.some((e) => e.sortOrder === saved.value.sortOrder)).toBe(false);
  });

  it("順位点の負数・存在しないチーム・不正な区分・ヒート重複は拒否する", async () => {
    const base = {
      no: "11",
      name: "部活対抗リレー",
      en: "",
      kind: "club" as const,
      category: "race" as const,
      startTime: null,
      location: "",
      entries: [],
      rankPoints: [10, 8],
    };
    expect(await saveEvent(repo, { ...base, rankPoints: [10, -1] })).toEqual({
      ok: false,
      error: "順位点は 0 以上の整数で入力してください",
    });
    expect(await saveEvent(repo, { ...base, entries: [{ slot: "1コース", teamId: "t99" }] })).toEqual({
      ok: false,
      error: "組み合わせに存在しないチームが含まれています",
    });
    // 型では弾けない値（フォーム由来）を想定した検証
    expect(await saveEvent(repo, { ...base, kind: "unknown" as unknown as "club" })).toEqual({
      ok: false,
      error: "表示区分は ceremony / track / field / club です",
    });
    expect(await saveEvent(repo, { ...base, formation: "spiral" as unknown as "none" })).toEqual({
      ok: false,
      error: "招集隊形図の種類が不正です",
    });
    expect(
      await saveEvent(repo, {
        ...base,
        heats: [
          { id: "g1", label: "1年" },
          { id: "g1", label: "2年" },
        ],
      }),
    ).toEqual({ ok: false, error: "ヒートの ID が重複しています" });
    expect(await saveEvent(repo, { ...base, heats: [{ id: "", label: "1年" }] })).toEqual({
      ok: false,
      error: "ヒートの ID を入力してください",
    });
    expect(await saveEvent(repo, { ...base, delayMin: 1.5 })).toEqual({
      ok: false,
      error: "遅延（分）は整数で入力してください",
    });
  });

  it("ベットが乗っている Market を持つ種目は削除できない（賭け金を消さない）", async () => {
    const removed = await removeEvent(repo, "ev-05");
    expect(removed.ok).toBe(false);
    if (!removed.ok) expect(removed.error).toContain("ベット");
    expect(await repo.getEvent("ev-05")).not.toBeNull();
    expect(await repo.getMarket("race-05-g1")).not.toBeNull();
  });

  it("ベットの無い種目を削除すると全ヒートの結果と Market も消える", async () => {
    // ev-01（開会式）には Market が無いので、締切を付けて Market を作ってから削除する
    const created = await createEventMarket(repo, "ev-01", "all", "2026-10-01T09:00");
    expect(created.ok).toBe(true);
    // ev-01 は順位点が無いので得点入力で確定する
    await confirmEventResult(repo, "ev-01", "all", { points: { t1: 5 } });
    expect(await repo.getEventResult("ev-01", "all")).not.toBeNull();

    const removed = await removeEvent(repo, "ev-01");
    expect(removed.ok).toBe(true);
    if (removed.ok) expect(removed.value.removedMarkets).toBe(1);
    expect(await repo.getEvent("ev-01")).toBeNull();
    expect((await repo.listMarkets()).some((m) => m.eventId === "ev-01")).toBe(false);
    expect((await repo.listEventResults()).some((r) => r.eventId === "ev-01")).toBe(false);
  });
});

describe("進行（遅延）の操作", () => {
  async function delayOf(eventId: string): Promise<number | undefined> {
    return (await repo.getEvent(eventId))?.delayMin;
  }

  it("指定した種目以降の遅延だけを動かす", async () => {
    // ev-11（騎馬戦・sortOrder 11）以降は ev-11・ev-12 の 2 種目
    const result = await shiftSchedule(repo, "ev-11", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.changed).toBe(2);
    expect(await delayOf("ev-10")).toBe(0);
    expect(await delayOf("ev-11")).toBe(1);
    expect(await delayOf("ev-12")).toBe(1);
  });

  it("全体をまとめて動かし、定刻に戻せる", async () => {
    const all = await shiftSchedule(repo, null, -2);
    expect(all.ok).toBe(true);
    const events = await repo.listEvents();
    if (all.ok) expect(all.value.changed).toBe(events.length);
    expect(await delayOf("ev-01")).toBe(-2);

    const reset = await resetSchedule(repo);
    expect(reset.ok).toBe(true);
    if (reset.ok) expect(reset.value.changed).toBe(events.length);
    expect((await repo.listEvents()).every((e) => e.delayMin === 0)).toBe(true);
  });

  it("整数以外・存在しない種目は拒否する", async () => {
    expect(await shiftSchedule(repo, "ev-11", 0.5)).toEqual({ ok: false, error: "分は整数で入力してください" });
    expect(await shiftSchedule(repo, "ev-zzz", 1)).toEqual({ ok: false, error: "種目が見つかりません" });
    expect(await delayOf("ev-11")).toBe(0);
  });
});

describe("得点の公開", () => {
  it("公開すると時刻が記録され、2 回目は同じ時刻を返す", async () => {
    expect((await repo.getSettings()).scoresPublishedAt).toBeNull();

    const first = await publishScores(repo);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect((await repo.getSettings()).scoresPublishedAt).toBe(first.value.scoresPublishedAt);

    const second = await publishScores(repo);
    expect(second.ok && second.value.scoresPublishedAt).toBe(first.value.scoresPublishedAt);
    expect((await settlementPreview(repo)).scoresPublishedAt).toBe(first.value.scoresPublishedAt);
  });

  it("非公開に戻せる", async () => {
    await publishScores(repo);
    expect((await unpublishScores(repo)).ok).toBe(true);
    expect((await repo.getSettings()).scoresPublishedAt).toBeNull();
    expect((await settlementPreview(repo)).scoresPublishedAt).toBeNull();
  });
});

describe("CSV 取り込み", () => {
  it("招集案内は全件を差し替え、補足タグも取り込む", async () => {
    const csv = [
      "学籍番号,種目名,集合時間,場所,補足",
      "2117,男女混合リレー,11:05,フィールド,ゼッケン着用",
      ",玉入れ,13:50,フィールド,",
    ].join("\n");
    const result = await importInvites(repo, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.count).toBe(1);
    expect(result.value.errors).toEqual(["行3: 学籍番号が空です"]);

    // シードの 9 件は差し替えられている
    const invites = await repo.listInvites();
    expect(invites).toHaveLength(1);
    expect(invites[0].eventName).toBe("男女混合リレー");
    expect(invites[0].tag).toBe("ゼッケン着用");
    expect(invites[0].id.startsWith("inv-")).toBe(true);
  });

  it("1 行も読めないときは既存データを消さない", async () => {
    const result = await importInvites(repo, "でたらめ,ヘッダー\n1,2");
    expect(result.ok).toBe(false);
    expect(await repo.listInvites()).toHaveLength(9);
  });

  it("生徒名簿は学年・組も取り込める", async () => {
    const result = await importRoster(repo, "学籍番号,名前,学年,組\n3101,新入 生徒,1,3\n3101,重複 生徒,1,3");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.count).toBe(1);
    expect(result.value.errors).toEqual(["行3: 学籍番号が重複しています（3101）"]);
    const students = await repo.listStudents();
    expect(students).toHaveLength(1);
    expect(students[0].grade).toBe(1);
    expect(students[0].classNo).toBe(3);
  });
});

describe("最終精算", () => {
  it("全口座を精算して実行時刻を記録する", async () => {
    const result = await runFinalSettlement(repo);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.alreadySettled).toBe(false);
    expect(result.value.accounts).toBe(1);

    const account = await repo.getAccount(FIXTURE_STUDENT_ID);
    // 1240 - 500 = 740、精算前の値はスナップショットされる
    expect(account?.pointsBalance).toBe(740);
    expect(account?.debtAmount).toBe(0);
    expect(account?.finalBalanceBefore).toBe(1240);
    expect(account?.finalDebt).toBe(500);
    expect((await repo.getSettings()).finalSettledAt).toBe(result.value.finalSettledAt);
  });

  it("冪等: 2 回実行しても残高は変わらず、記録済みの時刻を返す", async () => {
    const first = await runFinalSettlement(repo);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await runFinalSettlement(repo);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.alreadySettled).toBe(true);
    expect(second.value.finalSettledAt).toBe(first.value.finalSettledAt);

    const account = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(account?.pointsBalance).toBe(740);
    expect(account?.finalBalanceBefore).toBe(1240);
  });
});
