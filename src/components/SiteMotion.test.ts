import { afterEach, describe, expect, it, vi } from "vitest";
import { isMotionReduced } from "./SiteMotion";

afterEach(() => vi.unstubAllGlobals());

describe("サイト内の演出設定", () => {
  function setup(saved: string | null, reduced: boolean) {
    vi.stubGlobal("localStorage", { getItem: () => saved });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
  }
  it("未設定ならOSの設定を使う", () => {
    setup(null, true); expect(isMotionReduced()).toBe(true);
    setup(null, false); expect(isMotionReduced()).toBe(false);
  });
  it("旧ON/OFF設定は無視してOSの設定を使う", () => {
    setup("full", true); expect(isMotionReduced()).toBe(true);
    setup("reduced", false); expect(isMotionReduced()).toBe(false);
  });
  it("保存できない場合もOSの設定で表示できる", () => {
    setup(null, true);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(isMotionReduced()).toBe(true);
  });
});
