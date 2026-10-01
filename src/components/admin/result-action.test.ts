import { describe, expect, it, vi } from "vitest";
import { runResultAction } from "./result-action";

describe("結果入力の通信失敗", () => {
  it("例外の詳細を表示せず、同じ順位の再試行を案内する", async () => {
    const data = new FormData(); data.append("order", "t1");
    const action = vi.fn().mockRejectedValue(new Error("private database detail"));
    const state = await runResultAction(action, null, data);
    expect(state.ok).toBe(false);
    expect(state.message).toContain("同じ順位で再試行");
    expect(state.message).not.toContain("private database detail");
    expect(data.getAll("order")).toEqual(["t1"]);
  });
  it("サーバーの検証エラーと成功をそのまま返す", async () => {
    const result = { ok: false, message: "総合順位が不完全です" };
    expect(await runResultAction(async () => result, null, new FormData())).toEqual(result);
    expect(await runResultAction(async () => ({ ok: true, message: "確定済み" }), null, new FormData())).toEqual({ ok: true, message: "確定済み" });
  });
  it("認証切れの画面遷移を妨げない", async () => {
    const redirect = Object.assign(new Error("redirect"), { digest: "NEXT_REDIRECT;replace;/admin/login;307;" });
    await expect(runResultAction(async () => { throw redirect; }, null, new FormData())).rejects.toBe(redirect);
  });
});
