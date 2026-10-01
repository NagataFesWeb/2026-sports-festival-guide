import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRepository } from "./memory";
import { displayReads, invalidateDisplayCache } from "./display-cache";

afterEach(() => vi.useRealTimers());

describe("表示専用キャッシュ", () => {
  it("20人の並列表示と再訪でも共通取得は各1回、3秒後には再取得する", async () => {
    vi.useFakeTimers();
    const repo = new MemoryRepository();
    const markets = vi.spyOn(repo, "listMarkets");
    const events = vi.spyOn(repo, "listEvents");
    const bets = vi.spyOn(repo, "listBets");
    const shared = displayReads(repo);
    await Promise.all(Array.from({ length: 20 }, () => Promise.all([shared.listMarkets(), shared.listEvents(), shared.listBets()])));
    await shared.listMarkets();
    for (const call of [markets, events, bets]) expect(call).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(3001);
    await shared.listMarkets();
    expect(markets).toHaveBeenCalledTimes(2);
  });

  it("表示値の変更は共有キャッシュへ伝わらない", async () => {
    const repo = new MemoryRepository();
    const shared = displayReads(repo);
    const first = await shared.listMarkets();
    const title = first[0].title;
    first[0].title = "変更";
    expect((await shared.listMarkets())[0].title).toBe(title);
  });

  it("失敗をキャッシュせず再取得する", async () => {
    const repo = new MemoryRepository();
    const load = vi.spyOn(repo, "listMarkets").mockRejectedValueOnce(new Error("一時障害"));
    await expect(displayReads(repo).listMarkets()).rejects.toThrow("一時障害");
    await displayReads(repo).listMarkets();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("書込み後と取得中の無効化後は古い取得結果を再利用しない", async () => {
    const repo = new MemoryRepository();
    const load = vi.spyOn(repo, "listMarkets");
    const shared = displayReads(repo);
    const pending = shared.listMarkets();
    invalidateDisplayCache();
    await pending;
    await shared.listMarkets();
    expect(load).toHaveBeenCalledTimes(2);
    invalidateDisplayCache();
    await shared.listMarkets();
    expect(load).toHaveBeenCalledTimes(3);
    // 元Repositoryはキャッシュされず、書込みの検証には必ず最新値を使える。
    await repo.listMarkets();
    expect(load).toHaveBeenCalledTimes(4);
  });
});
