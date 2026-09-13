// 永続化実装の選択（本番で Supabase 未設定のまま動かさない）
import { describe, expect, it } from "vitest";
import { selectDriver } from "./index";

const supabase = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" };

describe("selectDriver", () => {
  it("Supabase の URL と service role key が揃っていれば supabase", () => {
    expect(selectDriver({ ...supabase, NODE_ENV: "production" })).toBe("supabase");
    expect(selectDriver({ ...supabase, NODE_ENV: "development" })).toBe("supabase");
  });

  it("開発・テストでは未設定なら memory", () => {
    expect(selectDriver({ NODE_ENV: "development" })).toBe("memory");
    expect(selectDriver({ NODE_ENV: "test" })).toBe("memory");
    expect(selectDriver({})).toBe("memory");
  });

  it("本番で未設定なら例外（黙ってメモリ実装に落とさない）", () => {
    expect(() => selectDriver({ NODE_ENV: "production" })).toThrow(/Supabase/);
    // 片方だけでも不足
    expect(() => selectDriver({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: supabase.NEXT_PUBLIC_SUPABASE_URL })).toThrow();
  });

  it("本番でも ALLOW_MEMORY_DB=1 なら memory、next build 中も memory", () => {
    expect(selectDriver({ NODE_ENV: "production", ALLOW_MEMORY_DB: "1" })).toBe("memory");
    expect(selectDriver({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe("memory");
  });
});
