import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SEED_EVENTS, SEED_TEAMS } from "@/lib/casino/fixtures";
import { ResultsTab } from "./ResultsTab";
import { DEFAULT_TAB, TabNav, toAdminTab } from "./TabNav";

vi.mock("@/app/admin/actions", () => ({
  confirmEventResultAction: vi.fn(async () => null),
  removeEventResultAction: vi.fn(async () => null),
  settleCustomAction: vi.fn(async () => null),
  settleOverallAction: vi.fn(async () => null),
}));

const props = { events: [...SEED_EVENTS], teams: [...SEED_TEAMS], markets: [], results: [], standings: [] };

describe("結果入力への導線とフォーム", () => {
  it("管理画面の初期表示は結果入力で、全メニューが折り返して見える", () => {
    expect(DEFAULT_TAB).toBe("results");
    expect(toAdminTab(undefined)).toBe("results");
    const html = renderToStaticMarkup(createElement(TabNav, { current: "results" }));
    expect(html).toContain('href="/admin?tab=results"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("grid-cols-2");
    expect(html).not.toContain("min-w-max");
  });

  it("選んだ玉入れの得点フォームだけを表示する", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, selectedEventId: "ev-06" }));
    expect(html).toContain('name="eventId" value="ev-06"');
    expect(html).toContain('name="mode" value="score"');
    expect(html).not.toContain('name="eventId" value="ev-03"');
    expect(html).toContain('href="/admin?tab=results&amp;event=ev-03"');
  });

  it("選んだリレーはヒートごとに着順を入力できる", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, selectedEventId: "ev-03" }));
    expect(html).toContain('name="eventId" value="ev-03"');
    expect(html).toContain('name="heatId" value="g1"');
    expect(html).toContain('name="heatId" value="g2"');
    expect(html).toContain('name="heatId" value="g3"');
    expect(html).toContain('name="mode" value="rank"');
    expect(html).not.toContain('name="eventId" value="ev-06"');
  });

  it("種目が無い場合も登録画面への入口を表示する", () => {
    const html = renderToStaticMarkup(createElement(ResultsTab, { ...props, events: [] }));
    expect(html).toContain("結果入力できる種目がありません");
    expect(html).toContain('href="/admin?tab=events"');
  });
});
