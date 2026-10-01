import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GroundPlayback } from "./GroundPlayback";

vi.mock("@/components/SiteMotion", () => ({
  useSiteMotion: () => ({ enabled: false, ready: true }),
}));

describe("競技説明の手動再生", () => {
  it.each(["girls", "swedish", "mixed", "pole"] as const)("演出OFFでも%sを再生でき、静止した場面送りも選べる", event => {
    const html = renderToStaticMarkup(createElement(GroundPlayback, { event }));
    const playButton = html.match(/<button\b[^>]*>流れを再生<\/button>/)?.[0];
    const nextButton = html.match(/<button\b[^>]*>次の場面<\/button>/)?.[0];
    expect(playButton).toBeDefined();
    expect(playButton).not.toContain("disabled");
    expect(nextButton).toBeDefined();
    expect(nextButton).not.toContain("disabled");
    expect(html).not.toContain("一時停止");
    expect(html).toContain("演出OFFでも「流れを再生」で確認できます");
  });
});
