import { describe, expect, it } from "vitest";
import { MemoryRepository, resetMemoryState } from "@/lib/db/memory";
import { createOverallMarket, settleOverallMarket } from "./service";
import { FIXTURE_STUDENT_ID } from "@/lib/casino/fixtures";

describe("学年別優勝の精算", () => {
  it("指定した学年だけを確定し、再送で二重に配当しない", async () => {
    resetMemoryState();
    const repo = new MemoryRepository();
    const markets = [];
    for (const grade of [1, 2, 3]) {
      const result = await createOverallMarket(repo, "2099-10-02T12:00", grade);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.error);
      markets.push(result.value);
    }
    expect((await createOverallMarket(repo, "2099-10-02T12:00", 2)).ok).toBe(false);
    expect((await createOverallMarket(repo, "2099-10-02T12:00", 4)).ok).toBe(false);
    const order = markets[1].options.map(o => o.id);
    const accountBefore = (await repo.getAccount(FIXTURE_STUDENT_ID))!;
    for (const kind of ["win", "place", "trifecta"] as const) {
      await repo.insertBet({ id: `grade-${kind}`, marketId: markets[1].id, studentId: FIXTURE_STUDENT_ID, kind,
        selection: kind === "trifecta" ? order.slice(0, 3) : [order[0]], amount: 100, payoutAmount: null, createdAt: new Date().toISOString() });
    }
    expect((await settleOverallMarket(repo, order)).ok).toBe(false);
    expect((await settleOverallMarket(repo, order, markets[1].id)).ok).toBe(true);
    expect((await repo.listBets({ marketId: markets[1].id })).map(b => b.payoutAmount)).toEqual([800, 266, 33600]);
    expect((await repo.getAccount(FIXTURE_STUDENT_ID))?.pointsBalance).toBe(accountBefore.pointsBalance + 34666);
    expect((await repo.getMarket(markets[0].id))?.status).toBe("open");
    expect((await repo.getMarket(markets[2].id))?.status).toBe("open");
    const before = await repo.listAccounts();
    expect((await settleOverallMarket(repo, order, markets[1].id)).ok).toBe(true);
    expect(await repo.listAccounts()).toEqual(before);
    expect((await settleOverallMarket(repo, order, "race-05-g1")).ok).toBe(false);
  });
});
