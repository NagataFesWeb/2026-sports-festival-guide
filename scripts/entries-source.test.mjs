import { describe, expect, it } from "vitest";
import { readEntriesSource, storageConfig } from "./entries-source.mjs";

const env = { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/", SUPABASE_SECRET_KEY: "sb_secret_test" };
describe("出場表の取得元", () => {
  it("ローカルCSVは通信せず優先する", async () => {
    expect(await readEntriesSource("学籍番号,出場競技\n", env, () => { throw new Error("通信禁止"); })).toEqual({ text: "学籍番号,出場競技\n", source: "ローカルCSV" });
  });
  it("接続情報もCSVもないチェックアウトだけ空データにする", async () => {
    expect((await readEntriesSource(null, {})).source).toContain("空データ");
  });
  it("秘密キーをヘッダーだけで送り、非公開オブジェクトを読む", async () => {
    const result = await readEntriesSource(null, env, async (url, options) => {
      expect(url).toBe("https://example.supabase.co/storage/v1/object/authenticated/festival-private/entries/2026.csv");
      expect(options.headers).toEqual({ apikey: "sb_secret_test" });
      expect(options.redirect).toBe("error");
      return new Response("学籍番号,出場競技\n1101,テスト（1人目）\n");
    });
    expect(result.source).toBe("非公開Supabase Storage");
  });
  it("旧JWTキーはAuthorizationにも付ける", () => {
    expect(storageConfig({ NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: "jwt" }).headers.Authorization).toBe("Bearer jwt");
  });
  it("通信障害と未配置は空の案内へ切り替えず失敗する", async () => {
    await expect(readEntriesSource(null, env, async () => { throw new Error("秘密データ"); })).rejects.toThrow("ビルドを停止");
    await expect(readEntriesSource(null, env, async () => new Response("秘密データ", { status: 403 }))).rejects.toThrow("HTTP 403");
    await expect(readEntriesSource(null, env, async () => new Response(""))).rejects.toThrow("CSVが空");
    await expect(readEntriesSource(null, env, async () => new Response("学籍番号,出場競技\n"))).rejects.toThrow("CSVが空");
  });
});
