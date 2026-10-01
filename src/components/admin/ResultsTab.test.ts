import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SEED_EVENTS, SEED_TEAMS, createFixtureState } from "@/lib/casino/fixtures";
import { ResultsTab } from "./ResultsTab";
import { DEFAULT_TAB, TabNav, toAdminTab } from "./TabNav";

vi.mock("@/app/admin/actions", () => ({
  confirmEventResultAction: vi.fn(async () => null),
  removeEventResultAction: vi.fn(async () => null),
  settleCustomAction: vi.fn(async () => null),
  settleOverallAction: vi.fn(async () => null),
  publishScoresAction: vi.fn(async () => null),
  unpublishScoresAction: vi.fn(async () => null),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const props = { events: [...SEED_EVENTS], teams: [...SEED_TEAMS], markets: [], results: [] };

describe("結果入力への導線とフォーム", () => {
  it("騎馬戦は紅白の2組を並べ、クラス別の入力を出さない", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, selectedEventId: "ev-11" }));
    expect((html.match(/name="order"/g) ?? []).length).toBe(2);
    expect(html).toContain('name="order" value="red"');
    expect(html).toContain('name="order" value="white"');
    expect(html).not.toContain('name="order" value="t1"');
    expect(html).toContain("勝った組を上にしてください");
  });
  it("管理画面の初期表示は結果入力で、全メニューが折り返して見える", () => {
    expect(DEFAULT_TAB).toBe("results");
    expect(toAdminTab(undefined)).toBe("results");
    const html = renderToStaticMarkup(createElement(TabNav, { current: "results" }));
    expect(html).toContain('href="/admin?tab=results"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("grid-cols-4");
    expect(html).not.toContain("min-w-max");
  });

  it("玉入れも得点欄なしで全8組を並べる", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, selectedEventId: "ev-06" }));
    expect(html).toContain('name="eventId" value="ev-06"');
    expect((html.match(/name="order"/g) ?? []).length).toBe(8);
    expect(html).not.toContain('name="points"');
    expect(html).not.toContain('name="scorePoints"');
    expect(html).not.toContain('name="eventId" value="ev-03"');
    expect(html).toContain('href="/admin?tab=results&amp;event=ev-03"');
  });

  it("選んだリレーはヒートごとに着順を入力できる", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, selectedEventId: "ev-03" }));
    expect(html).toContain('name="eventId" value="ev-03"');
    expect(html).toContain('name="heatId" value="g1"');
    expect(html).toContain("heat=g2");
    expect(html).toContain("heat=g3");
    expect((html.match(/name="order"/g) ?? []).length).toBe(8);
    expect(html).not.toContain('name="eventId" value="ev-06"');
  });

  it("総合順位も同じ並べ替えで入力し、得点の参考順位を出さない", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, markets: createFixtureState(new Date()).markets.filter(m => m.type === "overall"), selectedEventId: "overall" }));
    expect((html.match(/name="order"/g) ?? []).length).toBe(8);
    expect(html).toContain("順位を確認する");
    expect(html).not.toContain("現在の総合順位は");
    expect(html).not.toContain('name="winner"');
  });

  it("種目が無い場合も登録画面への入口を表示する", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, events: [] }));
    expect(html).toContain("結果入力できる種目がありません");
    expect(html).toContain('href="/admin?tab=events"');
  });
});
