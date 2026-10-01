import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRepository, resetMemoryState } from "../db/memory";
import { confirmEventResult, resetConfirmedMarket, settleOverallMarket } from "./service";

let repo: MemoryRepository;
const order = ["t3", "t5", "t1", "t4", "t2", "t7", "t8", "t6"];
beforeEach(() => { resetMemoryState(); repo = new MemoryRepository(); });

describe("確定した競技の検証用リセット", () => {
  it.each([
    { minutes: 60, delay: 0, expected: "open" },
    { minutes: -60, delay: 0, expected: "closed" },
    { minutes: -30, delay: 60, expected: "open" },
  ])("閉鎖してから確定した競技を、残り$minutes分・遅延$delay分なら$expectedに戻す", async ({ minutes, delay, expected }) => {
    const market = (await repo.getMarket("race-05-g1"))!;
    await repo.upsertMarket({ ...market, status: "closed", deadline: new Date(Date.now() + minutes * 60000).toISOString() });
    const event = (await repo.getEvent("ev-05"))!;
    await repo.upsertEvent({ ...event, delayMin: delay });
    expect((await confirmEventResult(repo, "ev-05", "g1", { order })).ok).toBe(true);
    expect((await resetConfirmedMarket(repo, market.id)).ok).toBe(true);
    expect((await repo.getMarket(market.id))?.status).toBe(expected);
  });
  it("配当・丸めた利子・ベット・順位を正確に戻し、再確定も同じ配当になる", async () => {
    const market = (await repo.getMarket("race-05-g1"))!;
    const before = await repo.listAccounts();
    const bets = await repo.listBets({ marketId: market.id });
    expect((await confirmEventResult(repo, "ev-05", "g1", { order })).ok).toBe(true);
    const settled = await repo.listAccounts();
    expect(settled).not.toEqual(before);
    expect((await resetConfirmedMarket(repo, market.id)).ok).toBe(true);
    expect(await repo.listAccounts()).toEqual(before);
    expect(await repo.getMarket(market.id)).toEqual(market);
    expect(await repo.listBets({ marketId: market.id })).toEqual(bets);
    expect(await repo.getEventResult("ev-05", "g1")).toBeNull();
    expect((await resetConfirmedMarket(repo, market.id)).ok).toBe(false);
    expect((await confirmEventResult(repo, "ev-05", "g1", { order })).ok).toBe(true);
    expect(await repo.listAccounts()).toEqual(settled);
  });

  it("確定後の借入・ベットなどで対象残高が変わった場合は一切戻さない", async () => {
    await confirmEventResult(repo, "ev-05", "g1", { order });
    const account = (await repo.getAccount("2117"))!;
    await repo.updateAccounts([{ ...account, pointsBalance: account.pointsBalance + 100 }]);
    const before = await repo.listAccounts();
    const market = await repo.getMarket("race-05-g1");
    expect((await resetConfirmedMarket(repo, "race-05-g1")).ok).toBe(false);
    expect(await repo.listAccounts()).toEqual(before);
    expect(await repo.getMarket("race-05-g1")).toEqual(market);
  });

  it("最終精算後と、記録のない旧確定は取り消せない", async () => {
    expect(await repo.resetMarketSettlement("race-04-g1")).toBe("no_snapshot");
    await confirmEventResult(repo, "ev-05", "g1", { order });
    await repo.updateSettings({ finalSettledAt: new Date().toISOString() });
    expect(await repo.resetMarketSettlement("race-05-g1")).toBe("finalized");
  });

  it("総合順位を戻したら公開設定も解除する", async () => {
    expect((await settleOverallMarket(repo, order)).ok).toBe(true);
    await repo.updateSettings({ scoresPublishedAt: new Date().toISOString() });
    expect((await resetConfirmedMarket(repo, "overall")).ok).toBe(true);
    expect((await repo.getSettings()).scoresPublishedAt).toBeNull();
  });
});
