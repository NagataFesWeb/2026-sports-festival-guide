import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRepository } from "../db";
import { resetMemoryState } from "../db/memory";
import { confirmEventResult, createEventMarket, runFinalSettlement } from "../admin/service";
import { borrowPoints, registerAccount, submitBet, withdrawBet } from "./store";

const ME = "2117", MARKET = "race-05-g1";
const input = { kind: "win" as const, selection: ["t1"], amount: 100 };
beforeEach(() => resetMemoryState());
afterEach(() => vi.restoreAllMocks());

describe("当日の同時操作と障害復旧", () => {
  it.each(["win", "place", "trifecta"] as const)("参加者1人の%sを登録から結果確定まで通し、最低倍率で払う", async (kind) => {
    const repo = getRepository();
    const now = new Date();
    const created = await createEventMarket(repo, "ev-05", "g3", new Date(now.getTime() + 3600000).toISOString());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await registerAccount("solo-check", "test-password", "一人参加")).ok).toBe(true);
    const selection = kind === "trifecta" ? ["t1", "t2", "t3"] : ["t1"];
    expect((await submitBet(created.value.id, "solo-check", { kind, selection, amount: 100 }, now)).ok).toBe(true);
    expect((await repo.getAccount("solo-check"))?.pointsBalance).toBe(900);
    const order = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    expect((await confirmEventResult(repo, "ev-05", "g3", { order })).ok).toBe(true);
    const [ticket] = await repo.listBets({ marketId: created.value.id, studentId: "solo-check" });
    const payout = kind === "trifecta" ? 33600 : kind === "place" ? 266 : 800;
    expect(ticket.payoutAmount).toBe(payout);
    expect((await repo.getAccount("solo-check"))?.pointsBalance).toBe(900 + payout);
    expect((await confirmEventResult(repo, "ev-05", "g3", { order })).ok).toBe(true);
    expect((await repo.getAccount("solo-check"))?.pointsBalance).toBe(900 + payout);
  });
  it("同時ベットは残高と記録が一致し、残高を超えて受け付けない", async () => {
    const repo = getRepository();
    const results = await Promise.all(Array.from({ length: 20 }, () => submitBet(MARKET, ME, input, new Date())));
    const accepted = results.filter((r) => r.ok).length;
    expect(accepted).toBeGreaterThan(0);
    expect(accepted).toBeLessThanOrEqual(12);
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1240 - accepted * 100);
    expect(await repo.listBets({ marketId: MARKET, studentId: ME })).toHaveLength(accepted);
  });
  it("同じベットを同時に取り消しても返金は一度だけ", async () => {
    const repo = getRepository();
    await submitBet(MARKET, ME, input, new Date());
    const [bet] = await repo.listBets({ marketId: MARKET, studentId: ME });
    const results = await Promise.all([withdrawBet(bet.id, ME, new Date()), withdrawBet(bet.id, ME, new Date())]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1240);
    expect(await repo.getBet(bet.id)).toBeNull();
  });
  it("送信結果が消えたベットを同じ識別子で再送しても二重計上しない", async () => {
    const repo = getRepository();
    const key = "bet:2117:test-retry";
    expect((await submitBet(MARKET, ME, input, new Date(), key)).ok).toBe(true);
    expect((await submitBet(MARKET, ME, input, new Date(), key)).ok).toBe(true);
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1140);
    expect(await repo.listBets({ marketId: MARKET, studentId: ME })).toHaveLength(1);
  });
  it("同じ借入れ識別子の同時再送でも増えるのは一回分", async () => {
    const repo = getRepository();
    const results = await Promise.all([borrowPoints(ME, 500, "credit:retry"), borrowPoints(ME, 500, "credit:retry")]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1740);
    expect((await repo.getAccount(ME))?.debtAmount).toBe(1000);
  });
  it("保存前の例外で残高だけ減ったりベットだけ消えたりしない", async () => {
    const repo = getRepository();
    await submitBet(MARKET, ME, input, new Date());
    const [bet] = await repo.listBets({ marketId: MARKET, studentId: ME });
    vi.spyOn(repo, "commitCasinoMutation").mockRejectedValue(new Error("通信障害"));
    await expect(submitBet(MARKET, ME, input, new Date())).rejects.toThrow("通信障害");
    await expect(withdrawBet(bet.id, ME, new Date())).rejects.toThrow("通信障害");
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1140);
    expect(await repo.getBet(bet.id)).not.toBeNull();
  });
  it("結果確定と借入れが競合しても借入れと配当を失わない", async () => {
    const repo = getRepository();
    await submitBet(MARKET, ME, input, new Date());
    const [settled, borrowed] = await Promise.all([
      confirmEventResult(repo, "ev-05", "g1", { order: ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"] }),
      borrowPoints(ME, 100),
    ]);
    expect(settled.ok).toBe(true); expect(borrowed.ok).toBe(true);
    const bets = await repo.listBets({ marketId: MARKET, studentId: ME });
    expect((await repo.getAccount(ME))?.pointsBalance).toBe(1240 + (bets[0].payoutAmount ?? 0));
    expect([650, 660]).toContain((await repo.getAccount(ME))?.debtAmount);
  });
  it("確定済みの着順を変更して得点と配当を食い違わせない", async () => {
    const repo = getRepository();
    const order = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
    expect((await confirmEventResult(repo, "ev-05", "g1", { order })).ok).toBe(true);
    expect((await confirmEventResult(repo, "ev-05", "g1", { order: [...order].reverse() })).ok).toBe(false);
    expect((await repo.getEventResult("ev-05", "g1"))?.order).toEqual(order);
  });
  it("未確定Marketがあると最終精算を拒否し何も変更しない", async () => {
    const repo = getRepository();
    expect((await runFinalSettlement(repo)).ok).toBe(false);
    expect((await repo.getSettings()).finalSettledAt).toBeNull();
    expect((await repo.getAccount(ME))?.debtAmount).toBe(500);
  });
  it("精算後は口座作成・ベット・借入れを止める", async () => {
    const repo = getRepository();
    await repo.updateSettings({ finalSettledAt: new Date().toISOString(), scoresPublishedAt: null });
    expect(await registerAccount("test-end", "test-password", "テスト")).toEqual({ ok: false, error: "finalized" });
    expect(await borrowPoints(ME, 100)).toEqual({ ok: false, error: "finalized" });
    expect(await submitBet(MARKET, ME, input, new Date())).toEqual({ ok: false, error: "market_closed" });
  });
  it("集計中にベットが増えたら原子的保存は全変更を拒否する", async () => {
    const repo = getRepository();
    const market = (await repo.getMarket(MARKET))!;
    const account = (await repo.getAccount(ME))!;
    const bets = await repo.listBets({ marketId: MARKET });
    await submitBet(MARKET, ME, input, new Date());
    expect(await repo.commitCasinoMutation({ expectedFinalSettledAt: null, expectedAccounts: [account],
      expectedMarkets: [market], expectedBets: bets, betScope: MARKET, market: { ...market, status: "settled" },
    })).toBe(false);
    expect((await repo.getMarket(MARKET))?.status).toBe("open");
  });
});
