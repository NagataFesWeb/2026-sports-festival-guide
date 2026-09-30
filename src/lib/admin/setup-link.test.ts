import { describe, expect, it } from "vitest";
import { setupTokenFromHash } from "./setup-link";

describe("実行委員パスワード設定リンク", () => {
  it.each(["invite", "recovery", "signup"])("%s リンクからアクセストークンを取り出す", (type) => {
    expect(setupTokenFromHash(`#access_token=abc.def.ghi&type=${type}&refresh_token=private`)).toBe("abc.def.ghi");
  });

  it("通常のログインリンクとトークンなしの URL は拒否する", () => {
    expect(setupTokenFromHash("#access_token=abc&type=magiclink")).toBeNull();
    expect(setupTokenFromHash("#type=invite")).toBeNull();
    expect(setupTokenFromHash("")).toBeNull();
  });
});
