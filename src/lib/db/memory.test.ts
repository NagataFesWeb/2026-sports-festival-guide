// メモリ実装のテスト
import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_STUDENT_ID } from "../casino/fixtures";
import type { CasinoAccountRecord } from "../casino/types";
import type { EventResult, InviteEntry } from "../festival/types";
import { isMemoryState, MemoryRepository, resetMemoryState } from "./memory";

// JSON ファイルへの書き出しは無効にする（テストがファイルを汚さないため）
process.env.DB_PERSIST = "0";

let repo: MemoryRepository;

beforeEach(() => {
  // globalThis に状態を持つため、テストごとにシードへ戻す
  resetMemoryState();
  repo = new MemoryRepository();
});

describe("シードデータ", () => {
  it("チームは 8 件", async () => {
    const teams = await repo.listTeams();
    expect(teams).toHaveLength(8);
    expect(teams.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"]);
    for (const team of teams) expect(team.color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("生徒 2117 が名簿にいる（2年1組）", async () => {
    const student = await repo.getStudent(FIXTURE_STUDENT_ID);
    expect(student?.name).toBe("サンプル生徒04");
    expect(student?.grade).toBe(2);
    expect(student?.classNo).toBe(1);
  });

  it("生徒 2117 のカジノ口座がある", async () => {
    const account = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(account).not.toBeNull();
    expect(account?.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(account?.nickname).toBe("NODE79");
    expect(account?.finalBalanceBefore).toBeNull();
    expect(account?.finalDebt).toBeNull();
  });

  it("種目は演技台帳の 12 プログラム", async () => {
    const events = await repo.listEvents();
    expect(events.map((e) => e.no)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]);
    expect(events.map((e) => e.id)).toEqual(Array.from({ length: 12 }, (_, i) => `ev-${String(i + 1).padStart(2, "0")}`));
    // ヒートは最低 1 つ。遅延は 0 で始まる
    for (const event of events) {
      expect(event.heats.length).toBeGreaterThan(0);
      expect(event.delayMin).toBe(0);
    }
    // 学年別レースは 3 ヒート、それ以外は 1 ヒート
    const byId = new Map(events.map((e) => [e.id, e]));
    expect(byId.get("ev-03")?.heats.map((h) => h.id)).toEqual(["g1", "g2", "g3"]);
    expect(byId.get("ev-06")?.heats.map((h) => h.id)).toEqual(["all"]);
    expect(byId.get("ev-09")?.heats.map((h) => h.id)).toEqual(["g1"]);
  });

  it("種目には招集案内・詳細モーダル用の項目が入っている", async () => {
    const event = (await repo.listEvents()).find((e) => e.id === "ev-11");
    expect(event).toBeDefined();
    expect(event?.kind).toBe("field");
    expect(event?.participants).toBe("3年生全員");
    expect(event?.gatherPlace).toBe("フィールド");
    expect(event?.formation).toBe("horse");
    expect(event?.belongings.length).toBeGreaterThan(0);
    expect(event?.formationNote.length).toBeGreaterThan(0);
    expect(event?.description.length).toBeGreaterThan(0);
    // 定刻は当日（Asia/Tokyo）13:55
    expect(event?.startTime).toMatch(/T13:55:00\+09:00$/);
  });

  it("Market はヒート単位で立っている", async () => {
    const markets = await repo.listMarkets();
    const byId = new Map(markets.map((m) => [m.id, m]));
    expect(byId.get("race-04-g1")?.eventId).toBe("ev-04");
    expect(byId.get("race-04-g1")?.heatId).toBe("g1");
    // 複数ヒートの種目はヒート名を付ける／単一ヒートは付けない
    expect(byId.get("race-04-g1")?.title).toBe("男子スウェーデンリレー 1年");
    expect(byId.get("race-04-g1")?.en).toBe("BOYS SWEDEN RELAY Y1");
    expect(byId.get("field-06")?.title).toBe("玉入れ");
    expect(byId.get("field-06")?.heatId).toBe("all");
    // overall・custom は種目に紐づかない
    expect(byId.get("overall")?.heatId).toBeNull();
    expect(byId.get("special-general")?.heatId).toBeNull();
  });

  it("確定結果はヒートごとに入っている", async () => {
    const results = await repo.listEventResults();
    expect(results.map((r) => `${r.eventId}/${r.heatId}`)).toEqual([
      "ev-03/g1",
      "ev-03/g2",
      "ev-03/g3",
      "ev-04/g1",
    ]);

    const result = await repo.getEventResult("ev-04", "g1");
    expect(result?.order[0]).toBe("t2");
    // 順位点は演技台帳の 20/18/16/14/13/12/11/10
    expect(result?.points).toEqual({ t2: 20, t6: 18, t1: 16, t4: 14, t3: 13, t5: 12, t8: 11, t7: 10 });
  });

  it("設定は未精算・得点非公開", async () => {
    expect(await repo.getSettings()).toEqual({ finalSettledAt: null, scoresPublishedAt: null });
  });
});

describe("種目の結果は (eventId, heatId) で一意", () => {
  function result(eventId: string, heatId: string, order: string[]): EventResult {
    return {
      eventId,
      heatId,
      order,
      points: Object.fromEntries(order.map((id, i) => [id, 10 - i])),
      confirmedAt: "2026-09-26T00:00:00.000Z",
    };
  }

  it("同じ種目の別ヒートは別レコードとして取れる", async () => {
    expect((await repo.getEventResult("ev-03", "g1"))?.order).not.toEqual((await repo.getEventResult("ev-03", "g3"))?.order);
    expect(await repo.getEventResult("ev-03", "all")).toBeNull();
    expect(await repo.getEventResult("ev-05", "g1")).toBeNull();
  });

  it("upsert は同じヒートだけを差し替える", async () => {
    const before = (await repo.listEventResults()).length;
    await repo.upsertEventResult(result("ev-03", "g1", ["t8", "t7"]));
    expect(await repo.listEventResults()).toHaveLength(before);
    expect((await repo.getEventResult("ev-03", "g1"))?.order).toEqual(["t8", "t7"]);
    expect((await repo.getEventResult("ev-03", "g2"))?.order).not.toEqual(["t8", "t7"]);

    // 未登録のヒートは追加される
    await repo.upsertEventResult(result("ev-05", "g2", ["t1", "t2"]));
    expect(await repo.listEventResults()).toHaveLength(before + 1);
  });

  it("delete は指定ヒートだけを消す", async () => {
    await repo.deleteEventResult("ev-03", "g2");
    expect(await repo.getEventResult("ev-03", "g2")).toBeNull();
    expect(await repo.getEventResult("ev-03", "g1")).not.toBeNull();
    expect(await repo.getEventResult("ev-03", "g3")).not.toBeNull();
  });
});

describe("永続化ファイルの形の検証", () => {
  /** ヒート対応後の最小構成 */
  function current(): Record<string, unknown> {
    return {
      students: [],
      teams: [],
      events: [{ id: "ev-01", kind: "ceremony", delayMin: 0, heats: [{ id: "all", label: "総合" }] }],
      eventResults: [{ eventId: "ev-01", heatId: "all" }],
      invites: [{ id: "inv-1", tag: "" }],
      markets: [{ id: "overall", heatId: null }],
      bets: [],
      accounts: [],
      settings: { finalSettledAt: null, scoresPublishedAt: null },
      seq: 0,
    };
  }

  it("今の形は受け付ける", () => {
    expect(isMemoryState(current())).toBe(true);
  });

  it("オブジェクトでない・配列が欠けている値は拒否", () => {
    expect(isMemoryState(null)).toBe(false);
    expect(isMemoryState("{}")).toBe(false);
    expect(isMemoryState({ ...current(), bets: undefined })).toBe(false);
    expect(isMemoryState({ ...current(), seq: "0" })).toBe(false);
  });

  it("ヒート対応前の古いファイルは拒否してシードに戻す", () => {
    // events に heats・kind・delayMin が無い
    expect(isMemoryState({ ...current(), events: [{ id: "ev-01", category: "field" }] })).toBe(false);
    // eventResults に heatId が無い
    expect(isMemoryState({ ...current(), eventResults: [{ eventId: "ev-01", order: [] }] })).toBe(false);
    // markets に heatId が無い
    expect(isMemoryState({ ...current(), markets: [{ id: "overall", eventId: null }] })).toBe(false);
    // invites に tag が無い
    expect(isMemoryState({ ...current(), invites: [{ id: "inv-1", location: "" }] })).toBe(false);
    // settings に scoresPublishedAt が無い
    expect(isMemoryState({ ...current(), settings: { finalSettledAt: null } })).toBe(false);
  });
});

describe("updateBalances（compare-and-set）", () => {
  it("現在値と一致すれば更新する", async () => {
    const before = await repo.getAccount(FIXTURE_STUDENT_ID);
    if (!before) throw new Error("シードの口座がない");

    const ok = await repo.updateBalances(
      FIXTURE_STUDENT_ID,
      { pointsBalance: before.pointsBalance, debtAmount: before.debtAmount },
      { pointsBalance: before.pointsBalance - 100, debtAmount: before.debtAmount + 50 },
    );
    expect(ok).toBe(true);

    const after = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(after?.pointsBalance).toBe(before.pointsBalance - 100);
    expect(after?.debtAmount).toBe(before.debtAmount + 50);
  });

  it("現在値と違えば false を返し何も変えない", async () => {
    const before = await repo.getAccount(FIXTURE_STUDENT_ID);
    if (!before) throw new Error("シードの口座がない");

    const ok = await repo.updateBalances(
      FIXTURE_STUDENT_ID,
      { pointsBalance: before.pointsBalance + 1, debtAmount: before.debtAmount },
      { pointsBalance: 0, debtAmount: 0 },
    );
    expect(ok).toBe(false);
    expect(await repo.getAccount(FIXTURE_STUDENT_ID)).toEqual(before);
  });

  it("口座が無ければ false", async () => {
    const ok = await repo.updateBalances("9999", { pointsBalance: 0, debtAmount: 0 }, { pointsBalance: 1, debtAmount: 0 });
    expect(ok).toBe(false);
  });
});

describe("insertAccount", () => {
  function account(studentId: string): CasinoAccountRecord {
    return {
      studentId,
      pointsBalance: 1000,
      debtAmount: 0,
      passwordHash: "scrypt$00$00",
      nickname: "",
      registeredAt: "2026-09-26T00:00:00.000Z",
      finalBalanceBefore: null,
      finalDebt: null,
    };
  }

  it("新規なら true", async () => {
    expect(await repo.insertAccount(account("2101"))).toBe(true);
    expect((await repo.getAccount("2101"))?.pointsBalance).toBe(1000);
  });

  it("既にあれば false で上書きしない", async () => {
    const before = await repo.getAccount(FIXTURE_STUDENT_ID);
    expect(await repo.insertAccount(account(FIXTURE_STUDENT_ID))).toBe(false);
    expect(await repo.getAccount(FIXTURE_STUDENT_ID)).toEqual(before);
  });
});

describe("listBets の絞り込み", () => {
  it("marketId・studentId で絞れる", async () => {
    const all = await repo.listBets();
    const byMarket = await repo.listBets({ marketId: "race-04-g1" });
    expect(byMarket.length).toBeGreaterThan(0);
    expect(byMarket.length).toBeLessThan(all.length);
    expect(byMarket.every((b) => b.marketId === "race-04-g1")).toBe(true);

    const mine = await repo.listBets({ studentId: FIXTURE_STUDENT_ID });
    expect(mine.every((b) => b.studentId === FIXTURE_STUDENT_ID)).toBe(true);

    const both = await repo.listBets({ marketId: "race-04-g1", studentId: FIXTURE_STUDENT_ID });
    expect(both).toHaveLength(2); // 単勝・複勝の 2 件（fixtures の myBet）
  });

  it("updateBetPayouts で配当を記録する", async () => {
    const target = (await repo.listBets({ marketId: "race-03-g3" }))[0];
    await repo.updateBetPayouts([{ id: target.id, payoutAmount: 1234 }]);
    expect((await repo.getBet(target.id))?.payoutAmount).toBe(1234);
  });
});

describe("replaceInvites", () => {
  it("丸ごと入れ替える", async () => {
    expect((await repo.listInvites(FIXTURE_STUDENT_ID)).length).toBe(3);

    const entries: InviteEntry[] = [
      { id: "inv-x", studentId: "2101", eventName: "騎馬戦", gatherTime: "13:45", location: "フィールド", tag: "赤白帽" },
    ];
    await repo.replaceInvites(entries);

    expect(await repo.listInvites()).toEqual(entries);
    expect(await repo.listInvites(FIXTURE_STUDENT_ID)).toEqual([]);
  });
});

describe("返り値はコピー", () => {
  it("取得した配列を書き換えても保管データは変わらない", async () => {
    const teams = await repo.listTeams();
    teams[0].name = "書き換え";
    teams.pop();
    expect((await repo.listTeams())[0].name).not.toBe("書き換え");
    expect(await repo.listTeams()).toHaveLength(8);

    const account = await repo.getAccount(FIXTURE_STUDENT_ID);
    if (!account) throw new Error("シードの口座がない");
    account.pointsBalance = 999_999;
    expect((await repo.getAccount(FIXTURE_STUDENT_ID))?.pointsBalance).not.toBe(999_999);
  });

  it("保存した引数を後から書き換えても保管データは変わらない", async () => {
    const invites: InviteEntry[] = [
      { id: "inv-y", studentId: "2105", eventName: "玉入れ", gatherTime: "9:55", location: "フィールド", tag: "" },
    ];
    await repo.replaceInvites(invites);
    invites[0].location = "別の場所";
    expect((await repo.listInvites())[0].location).toBe("フィールド");
  });
});

describe("newId", () => {
  it("prefix + 連番で重複しない", async () => {
    const ids = [repo.newId("bet"), repo.newId("bet"), repo.newId("inv")];
    expect(new Set(ids).size).toBe(3);
    expect(ids[0].startsWith("bet-")).toBe(true);
    expect(ids[2].startsWith("inv-")).toBe(true);
  });
});
