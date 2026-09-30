import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

describe("実行委員の認証入口", () => {
  it("招待リンクからパスワード設定画面を開ける", () => {
    const response = proxy(new NextRequest("https://example.com/admin/setup"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("未ログインの管理画面はログインページへ戻す", () => {
    const response = proxy(new NextRequest("https://example.com/admin"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/admin/login");
  });
});
