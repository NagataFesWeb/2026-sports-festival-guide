import { beforeEach, describe, expect, it } from "vitest";
import { confirmEventResult, createEventMarket } from "../admin/service";
import { getRepository } from "../db";
import { resetMemoryState } from "../db/memory";
import { HORSE_OPTIONS } from "./event-rules";
import { getMarketView, registerAccount, submitBet } from "./store";

beforeEach(() => resetMemoryState());

describe("騎馬戦の紅白予想", () => {
  it("紅白だけを受け付け、紅組勝利で的中だけに配当し、再送でも二重払いしない", async () => {
    const repo = getRepository();
    const market = (await repo.listMarkets()).find(m => m.eventId === "ev-11")!;
    for (const bet of await repo.listBets({ marketId: market.id })) await repo.deleteBet(bet.id);
    const now = new Date();
    await registerAccount("horse-test", "test-password", "検証");
    expect((await getMarketView(market.id, "horse-test", now))?.market.kinds).toEqual(["win"]);
    expect((await submitBet(market.id, "horse-test", { kind: "win", selection: ["t1"], amount: 100 }, now)).ok).toBe(false);
    for (const side of ["red", "white"]) {
      expect((await submitBet(market.id, "horse-test", { kind: "win", selection: [side], amount: 100 }, now)).ok).toBe(true);
    }
    expect((await confirmEventResult(repo, "ev-11", "all", { order: ["red"] })).ok).toBe(false);
    expect((await confirmEventResult(repo, "ev-11", "all", { order: ["red", "white"] })).ok).toBe(true);
    expect((await repo.getAccount("horse-test"))?.pointsBalance).toBe(1000);
    const bets = await repo.listBets({ marketId: market.id, studentId: "horse-test" });
    expect(bets.map(b => b.payoutAmount)).toEqual([200, 0]);
    expect((await repo.getEventResult("ev-11", "all"))?.order).toEqual(["red", "white"]);
    expect((await confirmEventResult(repo, "ev-11", "all", { order: ["red", "white"] })).ok).toBe(true);
    expect((await repo.getAccount("horse-test"))?.pointsBalance).toBe(1000);
    expect((await confirmEventResult(repo, "ev-11", "all", { order: ["white", "red"] })).ok).toBe(false);
  });

  it("新規作成する騎馬戦Marketも紅白にする", async () => {
    const repo = getRepository();
    const event = (await repo.getEvent("ev-11"))!;
    await repo.upsertEvent({ ...event, id: "horse-new" });
    const result = await createEventMarket(repo, "horse-new", "all", new Date(Date.now() + 3600000).toISOString());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.options).toEqual(HORSE_OPTIONS);
  });
});
