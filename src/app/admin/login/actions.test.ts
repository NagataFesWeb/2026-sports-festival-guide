import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "./actions";
import { verifyAdminCredentials } from "@/lib/admin/auth";
import { startSession } from "@/lib/auth/session";

vi.mock("@/lib/admin/auth", () => ({ verifyAdminCredentials: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ startSession: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("管理者ログインの保存完了", () => {
  it("認証とCookie保存が成功してから画面へ成功を返す", async () => {
    vi.mocked(verifyAdminCredentials).mockResolvedValue(true);
    vi.mocked(startSession).mockResolvedValue(undefined);
    const data = new FormData(); data.set("email", "review@example.com"); data.set("password", "review-password");
    expect((await loginAction(null, data)).ok).toBe(true);
    expect(startSession).toHaveBeenCalledWith("admin", "review@example.com");
  });
  it("誤った資格情報ではセッションを保存しない", async () => {
    vi.mocked(verifyAdminCredentials).mockResolvedValue(false);
    const data = new FormData(); data.set("email", "review@example.com"); data.set("password", "wrong");
    expect((await loginAction(null, data)).ok).toBe(false);
    expect(startSession).not.toHaveBeenCalled();
  });
});
