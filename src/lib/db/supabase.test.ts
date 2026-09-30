// PostgREST へのリクエスト内容（URL・クエリ・ヘッダ・body・Prefer）を fetch のスタブで検証する
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CasinoAccountRecord } from "../casino/types";
import type { Event, EventResult, Team } from "../festival/types";
import { SupabaseRepository } from "./supabase";

const BASE = "https://example.supabase.co";
const KEY = "sb_secret_test-key";

const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
let repo: SupabaseRepository;

/** スタブに記録された n 番目のリクエストを取り出す */
function call(n: number): { url: string; method: string; headers: Record<string, string>; body: unknown } {
  const [url, init] = fetchMock.mock.calls[n];
  const headers = (init.headers ?? {}) as Record<string, string>;
  return {
    url,
    method: init.method ?? "GET",
    headers,
    body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
  process.env.SUPABASE_SECRET_KEY = KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  repo = new SupabaseRepository();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("認証ヘッダ", () => {
  it("apikey と Authorization を付ける", async () => {
    fetchMock.mockResolvedValue(json([{ student_id: "2117", name: "サンプル生徒04", grade: 2, class_no: 1 }]));
    const students = await repo.listStudents();

    expect(students).toEqual([{ studentId: "2117", name: "サンプル生徒04", grade: 2, classNo: 1 }]);
    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/students?select=*&order=student_id`);
    expect(req.method).toBe("GET");
    expect(req.headers.apikey).toBe(KEY);
    expect(req.headers.Authorization).toBeUndefined();
    expect(req.headers.Range).toBe("0-999");
  });

  it("1000 件を超えるベットも全ページ取得する", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, i) => ({
      id: `bet-${i}`, market_id: "market-1", student_id: "2117", kind: "win", selection: ["t1"],
      amount: 1, payout_amount: null, created_at: "2026-09-26T00:00:00.000Z",
    }));
    fetchMock.mockResolvedValueOnce(json(firstPage)).mockResolvedValueOnce(json([{ ...firstPage[0], id: "bet-1000" }]));

    const bets = await repo.listBets({ marketId: "market-1" });
    expect(bets).toHaveLength(1001);
    expect(call(0).headers.Range).toBe("0-999");
    expect(call(1).headers.Range).toBe("1000-1999");
  });

  it("環境変数が無ければ例外", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    await expect(repo.listStudents()).rejects.toThrow(/環境変数/);
  });

  it("旧 service_role JWT も移行期間中は利用できる", async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "legacy-jwt";
    fetchMock.mockResolvedValue(json([]));
    await repo.listStudents();
    expect(call(0).headers.Authorization).toBe("Bearer legacy-jwt");
  });

  it("2xx 以外はステータスと本文を含む例外", async () => {
    fetchMock.mockResolvedValue(new Response("permission denied", { status: 401 }));
    await expect(repo.listStudents()).rejects.toThrow(/401[\s\S]*permission denied/);
  });
});

describe("upsertTeam", () => {
  it("merge-duplicates 付きの POST で snake_case の行を送る", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    const team: Team = { id: "t1", num: "01", name: "1組 紅蓮", color: "#d92b2b", sortOrder: 1 };
    await repo.upsertTeam(team);

    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/teams`);
    expect(req.method).toBe("POST");
    expect(req.headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
    expect(req.headers["Content-Type"]).toBe("application/json");
    expect(req.body).toEqual([{ id: "t1", num: "01", name: "1組 紅蓮", color: "#d92b2b", sort_order: 1 }]);
  });
});

describe("students の名簿差し替え", () => {
  it("学年・組が無い生徒は null で送る", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await repo.replaceStudents([{ studentId: "2117", name: "サンプル生徒04", grade: null, classNo: null }]);

    expect(call(1).body).toEqual([{ student_id: "2117", name: "サンプル生徒04", grade: null, class_no: null }]);
  });
});

describe("events（種目）", () => {
  const event: Event = {
    id: "ev-11",
    no: "11",
    name: "騎馬戦",
    en: "KIBASEN",
    kind: "field",
    category: "race",
    startTime: "2026-09-26T04:55:00.000Z",
    delayMin: 5,
    location: "フィールド",
    entries: [{ slot: "1コース", teamId: "t1" }],
    rankPoints: [25, 21, 18],
    heats: [{ id: "all", label: "総合" }],
    sortOrder: 11,
    participants: "3年生全員",
    gatherStart: "玉入れ退場後",
    gatherPlace: "フィールド",
    belongings: "赤白帽・軍手",
    formation: "horse",
    formationNote: "各サークルの待機位置に整列",
    description: "1回戦は総当たり戦、2回戦は大将戦。",
  };

  it("増えた列を snake_case で送り、取得したら元の形に戻る", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await repo.upsertEvent(event);

    const sent = call(0).body as Record<string, unknown>[];
    expect(sent[0]).toEqual({
      id: "ev-11",
      no: "11",
      name: "騎馬戦",
      en: "KIBASEN",
      kind: "field",
      category: "race",
      start_time: "2026-09-26T04:55:00.000Z",
      delay_min: 5,
      location: "フィールド",
      entries: [{ slot: "1コース", teamId: "t1" }],
      rank_points: [25, 21, 18],
      heats: [{ id: "all", label: "総合" }],
      sort_order: 11,
      participants: "3年生全員",
      gather_start: "玉入れ退場後",
      gather_place: "フィールド",
      belongings: "赤白帽・軍手",
      formation: "horse",
      formation_note: "各サークルの待機位置に整列",
      description: "1回戦は総当たり戦、2回戦は大将戦。",
    });

    // 同じ行を GET したら元のドメインオブジェクトに戻る
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(sent));
    expect(await repo.getEvent("ev-11")).toEqual(event);
  });
});

describe("event_results（ヒート単位の確定結果）", () => {
  const result: EventResult = {
    eventId: "ev-03",
    heatId: "g3",
    order: ["t2", "t4"],
    points: { t2: 20, t4: 18 },
    confirmedAt: "2026-09-26T00:30:00.000Z",
  };

  it("複合主キーなので on_conflict=event_id,heat_id を付けて upsert する", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await repo.upsertEventResult(result);

    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/event_results?on_conflict=event_id,heat_id`);
    expect(req.method).toBe("POST");
    expect(req.headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
    expect(req.body).toEqual([
      {
        event_id: "ev-03",
        heat_id: "g3",
        order: ["t2", "t4"],
        points: { t2: 20, t4: 18 },
        confirmed_at: "2026-09-26T00:30:00.000Z",
      },
    ]);
  });

  it("取得・削除は event_id と heat_id の両方で絞る", async () => {
    fetchMock.mockResolvedValue(
      json([{ event_id: "ev-03", heat_id: "g3", order: ["t2", "t4"], points: { t2: 20, t4: 18 }, confirmed_at: "2026-09-26T00:30:00.000Z" }]),
    );
    expect(await repo.getEventResult("ev-03", "g3")).toEqual(result);
    expect(call(0).url).toBe(`${BASE}/rest/v1/event_results?select=*&event_id=eq.ev-03&heat_id=eq.g3&limit=1`);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await repo.deleteEventResult("ev-03", "g3");
    const del = call(0);
    expect(del.method).toBe("DELETE");
    expect(del.url).toBe(`${BASE}/rest/v1/event_results?event_id=eq.ev-03&heat_id=eq.g3`);
  });
});

describe("markets", () => {
  it("heat_id 列を往復させる", async () => {
    fetchMock.mockResolvedValue(
      json([
        {
          id: "race-03-g3", type: "event", event_id: "ev-03", heat_id: "g3", category: "race", no: "03",
          title: "女子6×100mリレー 3年", en: "GIRLS 6×100m RELAY Y3", options: [], deadline: "2026-09-26T00:00:00.000Z",
          status: "open", result_order: null,
        },
      ]),
    );
    const market = await repo.getMarket("race-03-g3");
    expect(market?.heatId).toBe("g3");

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    if (!market) throw new Error("Market が取れていない");
    await repo.upsertMarket(market);
    expect((call(0).body as Record<string, unknown>[])[0].heat_id).toBe("g3");
  });
});

describe("updateBalances", () => {
  const expected = { pointsBalance: 1240, debtAmount: 500 };
  const next = { pointsBalance: 1140, debtAmount: 500 };

  it("期待値をクエリに入れた PATCH を送り、1 行更新なら true", async () => {
    fetchMock.mockResolvedValue(json([{ student_id: "2117" }]));
    const ok = await repo.updateBalances("2117", expected, next);

    expect(ok).toBe(true);
    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/casino_accounts?student_id=eq.2117&points_balance=eq.1240&debt_amount=eq.500`);
    expect(req.method).toBe("PATCH");
    expect(req.headers.Prefer).toBe("return=representation");
    expect(req.body).toEqual({ points_balance: 1140, debt_amount: 500 });
  });

  it("更新行が無ければ false（同時更新の検出）", async () => {
    fetchMock.mockResolvedValue(json([]));
    expect(await repo.updateBalances("2117", expected, next)).toBe(false);
  });
});

describe("deleteBet", () => {
  it("削除行がある場合だけ true を返す", async () => {
    fetchMock.mockResolvedValueOnce(json([{ id: "bet-1" }])).mockResolvedValueOnce(json([]));
    expect(await repo.deleteBet("bet-1")).toBe(true);
    expect(await repo.deleteBet("bet-1")).toBe(false);
    expect(call(0).headers.Prefer).toBe("return=representation");
  });
});

describe("insertAccount", () => {
  const account: CasinoAccountRecord = {
    studentId: "2118",
    pointsBalance: 1000,
    debtAmount: 0,
    passwordHash: "scrypt$aa$bb",
    nickname: "テスター",
    registeredAt: "2026-09-26T00:00:00.000Z",
    finalBalanceBefore: null,
    finalDebt: null,
  };

  it("merge-duplicates を付けずに POST し、成功なら true", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    expect(await repo.insertAccount(account)).toBe(true);

    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/casino_accounts`);
    expect(req.method).toBe("POST");
    expect(req.headers.Prefer).toBe("return=minimal");
    expect(req.body).toEqual([
      {
        student_id: "2118",
        password_hash: "scrypt$aa$bb",
        nickname: "テスター",
        points_balance: 1000,
        debt_amount: 0,
        registered_at: "2026-09-26T00:00:00.000Z",
        final_balance_before: null,
        final_debt: null,
      },
    ]);
  });

  it("409（主キー衝突）は「既に口座がある」なので false", async () => {
    fetchMock.mockResolvedValue(new Response("duplicate key value violates unique constraint", { status: 409 }));
    expect(await repo.insertAccount(account)).toBe(false);
  });
});

describe("replaceInvites", () => {
  it("全件 DELETE してから POST する", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await repo.replaceInvites([
      { id: "inv-1", studentId: "2117", eventName: "棒引き", gatherTime: "13:25", location: "フィールド", tag: "軍手持参" },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const del = call(0);
    expect(del.method).toBe("DELETE");
    expect(del.url).toBe(`${BASE}/rest/v1/invites?id=neq.__none__`);

    const post = call(1);
    expect(post.method).toBe("POST");
    expect(post.url).toBe(`${BASE}/rest/v1/invites`);
    expect(post.headers.Prefer).toBe("resolution=merge-duplicates,return=minimal");
    expect(post.body).toEqual([
      { id: "inv-1", student_id: "2117", event_name: "棒引き", gather_time: "13:25", location: "フィールド", tag: "軍手持参" },
    ]);
  });
});

describe("settings", () => {
  it("id=1 を明示して upsert する", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    await repo.updateSettings({ finalSettledAt: "2026-09-26T09:00:00.000Z", scoresPublishedAt: null });

    const req = call(0);
    expect(req.url).toBe(`${BASE}/rest/v1/settings`);
    expect(req.body).toEqual([
      { id: 1, final_settled_at: "2026-09-26T09:00:00.000Z", scores_published_at: null },
    ]);
  });

  it("行が無ければ両方 null を返す", async () => {
    fetchMock.mockResolvedValue(json([]));
    expect(await repo.getSettings()).toEqual({ finalSettledAt: null, scoresPublishedAt: null });
  });

  it("得点公開時刻を読み取る", async () => {
    fetchMock.mockResolvedValue(
      json([{ id: 1, final_settled_at: null, scores_published_at: "2026-09-26T05:20:00.000Z" }]),
    );
    expect(await repo.getSettings()).toEqual({
      finalSettledAt: null,
      scoresPublishedAt: "2026-09-26T05:20:00.000Z",
    });
  });
});

describe("newId", () => {
  it("prefix + UUID", () => {
    const id = repo.newId("bet");
    expect(id).toMatch(/^bet-[0-9a-f-]{36}$/);
  });
});
