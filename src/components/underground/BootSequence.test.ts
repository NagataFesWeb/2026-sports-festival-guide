import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOOT } from "./BootSequence";

describe("モックv3の起動ログ", () => {
  it("全19行の種別・文字列・待ち時間を出典と一致させる", () => {
    const html = readFileSync("docs/mockup/体育祭サイト モック v3 賭け画面.dc.html", "utf8");
    const source = html.match(/const BOOT = \[([\s\S]*?)\];/)?.[1] ?? "";
    const lines = [...source.matchAll(/\{ k: '([^']+)',\s+s: '([^']*)'(?:, p: (\d+))? \}/g)].map(m => ({ k: m[1], s: m[2], ...(m[3] ? { p: Number(m[3]) } : {}) }));
    expect(lines).toHaveLength(19);
    expect(BOOT).toEqual(lines);
  });
});
