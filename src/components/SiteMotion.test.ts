import { afterEach, describe, expect, it, vi } from "vitest";
import { isMotionReduced } from "./SiteMotion";

afterEach(() => vi.unstubAllGlobals());

describe("サイト内の演出設定", () => {
  function setup(saved: string | null, reduced: boolean) {
    vi.stubGlobal("localStorage", { getItem: () => saved });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  }
  it("OS設定にかかわらず演出を有効にする", () => {
    setup(null, true); expect(isMotionReduced()).toBe(false);
    setup(null, false); expect(isMotionReduced()).toBe(false);
  });
  it("旧ON/OFF設定にかかわらず演出を有効にする", () => {
    setup("full", true); expect(isMotionReduced()).toBe(false);
    setup("reduced", false); expect(isMotionReduced()).toBe(false);
  });
  it("保存できない場合もOSの設定で表示できる", () => {
    setup(null, true);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(isMotionReduced()).toBe(false);
  });
});
