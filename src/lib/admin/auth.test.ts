// 実行委員ログインの認証テスト。fetch は差し替えて Supabase に実アクセスしない
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyAdminCredentials } from "./auth";

/** Supabase・管理者の環境変数をすべて未設定にする */
function clearAuthEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
  vi.stubEnv("ADMIN_EMAIL", undefined);
  vi.stubEnv("ADMIN_PASSWORD", undefined);
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  clearAuthEnv();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// 「1 回だけ警告する」はモジュールの状態に依存するため、この describe を先頭に置く
describe("開発用の既定アカウント", () => {
  it("環境変数が無ければ admin@example.com / admin で認証でき、警告は 1 回だけ出る", async () => {
    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // 2 回目以降は警告を繰り返さない
    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("メールの大文字・前後の空白は無視する", async () => {
    expect(await verifyAdminCredentials("  Admin@Example.com ", "admin")).toBe(true);
  });

  it("パスワードが違えば false", async () => {
    expect(await verifyAdminCredentials("admin@example.com", "wrong")).toBe(false);
  });

  it("空のメール・パスワードは false", async () => {
    expect(await verifyAdminCredentials("", "admin")).toBe(false);
    expect(await verifyAdminCredentials("admin@example.com", "")).toBe(false);
  });

  it("本番では既定アカウントを使わない（常に false）", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(false);
  });
});

describe("環境変数（ADMIN_EMAIL / ADMIN_PASSWORD）", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "iinkai@nagata.example.jp");
    vi.stubEnv("ADMIN_PASSWORD", "taiikusai2026");
  });

  it("設定した値と一致すれば true", async () => {
    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "taiikusai2026")).toBe(true);
  });

  it("設定済みなら既定アカウントは通らない", async () => {
    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(false);
  });

  it("パスワードの長さだけ違う場合も false", async () => {
    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "taiikusai")).toBe(false);
  });

  it("片方だけ設定されている場合は環境変数を使わない（開発なら既定アカウント）", async () => {
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "taiikusai2026")).toBe(false);
    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(true);
  });
});

describe("Supabase Auth", () => {
  const url = "https://proj.supabase.co";
  const anonKey = "anon-key-123";

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
  });

  it("200 が返れば true。URL・ヘッダー・本文が仕様どおり", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "himitsu")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${url}/auth/v1/token?grant_type=password`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ apikey: anonKey, "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({ email: "iinkai@nagata.example.jp", password: "himitsu" });
  });

  it("400 が返れば false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "chigau")).toBe(false);
  });

  it("通信エラーでも例外を投げず false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await verifyAdminCredentials("iinkai@nagata.example.jp", "himitsu")).toBe(false);
  });

  it("Supabase 設定時は環境変数の既定アカウントを参照しない", async () => {
    vi.stubEnv("ADMIN_EMAIL", "admin@example.com");
    vi.stubEnv("ADMIN_PASSWORD", "admin");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await verifyAdminCredentials("admin@example.com", "admin")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("末尾スラッシュ付きの URL でもパスが二重にならない", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${url}/`);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await verifyAdminCredentials("a@b.co", "pw");
    expect(fetchMock.mock.calls[0][0]).toBe(`${url}/auth/v1/token?grant_type=password`);
  });
});
