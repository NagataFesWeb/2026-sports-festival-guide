// schedule.ts のテスト。シード（fixtures.ts）に依存せず、各テストで自前のデータを作る
import { describe, expect, it } from "vitest";
import type { Market } from "@/lib/casino/types";
import { effectiveDeadline, effectiveStart, heatsDone, programStatus, resetDelays, shiftFrom } from "./schedule";
import type { Event, EventResult } from "./types";

const NOW = new Date("2026-10-01T04:00:00.000Z");

/** NOW から min 分後の ISO 文字列 */
function at(min: number): string {
  return new Date(NOW.getTime() + min * 60_000).toISOString();
}

function event(over: Partial<Event> = {}): Event {
  return {
    id: "ev-1",
    no: "01",
    name: "100m走",
    en: "100M DASH",
    kind: "track",
    category: "race",
    startTime: at(0),
    delayMin: 0,
    location: "第1トラック",
    entries: [],
    rankPoints: [10, 8, 6],
    heats: [{ id: "all", label: "総合" }],
    sortOrder: 1,
    participants: "",
    gatherStart: "",
    gatherPlace: "",
    belongings: "",
    formation: "none",
    formationNote: "",
    description: "",
    ...over,
  };
}

function result(over: Partial<EventResult> = {}): EventResult {
  return {
    eventId: "ev-1",
    heatId: "all",
    order: ["t1", "t2", "t3"],
    points: { t1: 10, t2: 8, t3: 6 },
    confirmedAt: at(-1),
    ...over,
  };
}

function market(over: Partial<Market> = {}): Market {
  return {
    id: "mkt-1",
    type: "event",
    eventId: "ev-1",
    heatId: "all",
    category: "race",
    no: "01",
    title: "100m走",
    en: "100M DASH",
    options: [],
    deadline: at(0),
    status: "open",
    resultOrder: null,
    ...over,
  };
}

describe("effectiveStart", () => {
  it("定刻に遅延分を足す", () => {
    expect(effectiveStart(event({ startTime: at(0), delayMin: 7 }))).toBe(at(7));
  });

  it("前倒し（マイナス）も反映する", () => {
    expect(effectiveStart(event({ startTime: at(0), delayMin: -3 }))).toBe(at(-3));
  });

  it("定刻が未定なら null", () => {
    expect(effectiveStart(event({ startTime: null, delayMin: 10 }))).toBeNull();
  });
});

describe("effectiveDeadline", () => {
  it("種目 Market は紐づく種目の遅延だけ締切がずれる", () => {
    expect(effectiveDeadline(market({ deadline: at(0) }), event({ delayMin: 5 }))).toBe(at(5));
  });

  it("遅延 0・種目なしなら締切はそのまま", () => {
    expect(effectiveDeadline(market({ deadline: at(0) }), event({ delayMin: 0 }))).toBe(at(0));
    expect(effectiveDeadline(market({ deadline: at(0) }), null)).toBe(at(0));
  });

  it("overall・custom Market は遅延の影響を受けない", () => {
    expect(effectiveDeadline(market({ type: "overall", deadline: at(0) }), event({ delayMin: 30 }))).toBe(at(0));
    expect(effectiveDeadline(market({ type: "custom", deadline: at(0) }), event({ delayMin: 30 }))).toBe(at(0));
  });
});

describe("shiftFrom", () => {
  const events = [
    event({ id: "ev-1", no: "01", sortOrder: 1 }),
    event({ id: "ev-2", no: "02", sortOrder: 2, delayMin: 3 }),
    event({ id: "ev-3", no: "03", sortOrder: 3 }),
  ];

  it("指定した種目とそれ以降だけを +1 分ずらす", () => {
    const changed = shiftFrom(events, "ev-2", 1);
    expect(changed.map((e) => [e.id, e.delayMin])).toEqual([
      ["ev-2", 4],
      ["ev-3", 1],
    ]);
  });

  it("null なら全種目をずらす", () => {
    const changed = shiftFrom(events, null, -1);
    expect(changed.map((e) => [e.id, e.delayMin])).toEqual([
      ["ev-1", -1],
      ["ev-2", 2],
      ["ev-3", -1],
    ]);
  });

  it("0 分・存在しない種目なら何も変えない", () => {
    expect(shiftFrom(events, "ev-2", 0)).toEqual([]);
    expect(shiftFrom(events, "ev-99", 1)).toEqual([]);
  });
});

describe("resetDelays", () => {
  it("遅延が入っている種目だけを定刻に戻す", () => {
    const events = [
      event({ id: "ev-1", delayMin: 0 }),
      event({ id: "ev-2", delayMin: 5 }),
      event({ id: "ev-3", delayMin: -2 }),
    ];
    expect(resetDelays(events).map((e) => [e.id, e.delayMin])).toEqual([
      ["ev-2", 0],
      ["ev-3", 0],
    ]);
  });
});

describe("heatsDone", () => {
  const relay = event({ id: "ev-r", heats: [{ id: "g1", label: "1年" }, { id: "g2", label: "2年" }] });

  it("全ヒートの結果が揃って初めて true", () => {
    expect(heatsDone(relay, [result({ eventId: "ev-r", heatId: "g1" })])).toBe(false);
    expect(
      heatsDone(relay, [result({ eventId: "ev-r", heatId: "g1" }), result({ eventId: "ev-r", heatId: "g2" })]),
    ).toBe(true);
  });

  it("他の種目の結果は数えない", () => {
    expect(heatsDone(relay, [result({ eventId: "ev-x", heatId: "g1" }), result({ eventId: "ev-x", heatId: "g2" })])).toBe(
      false,
    );
  });
});

describe("programStatus", () => {
  const events = [
    event({ id: "ev-1", no: "01", sortOrder: 1, startTime: at(-60) }),
    event({ id: "ev-2", no: "02", sortOrder: 2, startTime: at(-10) }),
    event({ id: "ev-3", no: "03", sortOrder: 3, startTime: at(20) }),
    event({ id: "ev-4", no: "04", sortOrder: 4, startTime: at(40) }),
  ];

  it("結果が揃った種目は done、開始済みで未確定なら live、その次が next", () => {
    const status = programStatus(events, [result({ eventId: "ev-1" })], NOW);
    expect([...status.entries()]).toEqual([
      ["ev-1", "done"],
      ["ev-2", "live"],
      ["ev-3", "next"],
      ["ev-4", "upcoming"],
    ]);
  });

  it("結果が無くても次の種目が始まっていれば done", () => {
    const status = programStatus(events, [], NOW);
    expect(status.get("ev-1")).toBe("done");
    expect(status.get("ev-2")).toBe("live");
  });

  it("遅延で開始見込みが未来になった種目は live にならず next になる", () => {
    const delayed = events.map((e) => (e.id === "ev-2" ? { ...e, delayMin: 30 } : e));
    const status = programStatus(delayed, [result({ eventId: "ev-1" })], NOW);
    expect(status.get("ev-1")).toBe("done");
    expect(status.get("ev-2")).toBe("next");
    expect(status.get("ev-3")).toBe("upcoming");
  });

  it("全ヒートの結果が揃うと live から done に変わる", () => {
    const relay = [
      event({ id: "ev-1", no: "01", sortOrder: 1, startTime: at(-10), heats: [{ id: "g1", label: "1年" }, { id: "g2", label: "2年" }] }),
      event({ id: "ev-2", no: "02", sortOrder: 2, startTime: at(30) }),
    ];
    const half = programStatus(relay, [result({ eventId: "ev-1", heatId: "g1" })], NOW);
    expect(half.get("ev-1")).toBe("live");
    expect(half.get("ev-2")).toBe("next");

    const all = programStatus(
      relay,
      [result({ eventId: "ev-1", heatId: "g1" }), result({ eventId: "ev-1", heatId: "g2" })],
      NOW,
    );
    expect(all.get("ev-1")).toBe("done");
    expect(all.get("ev-2")).toBe("next");
  });

  it("次の種目の定刻が未定なら、直前の種目は結果を確定するまで live のまま", () => {
    const mixed = [
      event({ id: "ev-1", no: "01", sortOrder: 1, startTime: at(-60) }),
      event({ id: "ev-2", no: "02", sortOrder: 2, startTime: null }),
      event({ id: "ev-3", no: "03", sortOrder: 3, startTime: at(-5) }),
    ];
    const status = programStatus(mixed, [], NOW);
    expect(status.get("ev-1")).toBe("live");
    // 未定の種目は「次が始まった」ので done、開始済みの ev-3 は live
    expect(status.get("ev-2")).toBe("done");
    expect(status.get("ev-3")).toBe("live");

    // 結果を確定すれば done になる
    const confirmed = programStatus(mixed, [result({ eventId: "ev-1" })], NOW);
    expect(confirmed.get("ev-1")).toBe("done");
  });

  it("開始時刻が未定の種目は upcoming（先頭なら next）", () => {
    const undecided = [event({ id: "ev-1", sortOrder: 1, startTime: null }), event({ id: "ev-2", no: "02", sortOrder: 2, startTime: null })];
    const status = programStatus(undecided, [], NOW);
    expect(status.get("ev-1")).toBe("next");
    expect(status.get("ev-2")).toBe("upcoming");
  });
});
