import { describe, expect, it } from "vitest";
import { fail, parseEnterInput, requestKey } from "./http";

describe("再送識別子", () => {
  it("未指定を許容し、不正な識別子を拒否する", () => {
    expect(requestKey(new Request("http://localhost"), "bet:me")).toBeUndefined();
    expect(requestKey(new Request("http://localhost", { headers: { "Idempotency-Key": "bad" } }), "bet:me")).toBeNull();
  });
  it("認証済み口座と操作ごとに識別子を分離する", () => {
    const req = new Request("http://localhost", { headers: { "Idempotency-Key": "12345678-1234-1234-1234-123456789012" } });
    expect(requestKey(req, "bet:me:m1")).toBe("bet:me:m1:12345678-1234-1234-1234-123456789012");
    expect(requestKey(req, "bet:other:m1")).not.toBe(requestKey(req, "bet:me:m1"));
  });
});

describe("カジノ入場リクエスト", () => {
  it("任意のユーザーIDと登録情報を受け取り、ID前後の空白を除く", () => {
    expect(parseEnterInput({ userId: " nagata_79 ", password: "secret123", mode: "register", nickname: "長田太郎" })).toEqual({
      userId: "nagata_79", password: "secret123", mode: "register", nickname: "長田太郎",
    });
  });

  it("ログインではニックネームを要求しない", () => {
    expect(parseEnterInput({ userId: "nagata79", password: "secret123", mode: "login" })?.nickname).toBe("");
  });

  it("学籍番号フィールドだけの旧リクエストや壊れた入力を拒否する", () => {
    for (const body of [null, {}, { studentId: "2117", password: "2117", mode: "login" },
      { userId: 2117, password: "2117", mode: "login" },
      { userId: "", password: "secret123", mode: "register" },
      { userId: "x".repeat(33), password: "secret123", mode: "register" },
      { userId: "nagata79", password: "secret123", mode: "other" }]) {
      expect(parseEnterInput(body)).toBeNull();
    }
  });

  it("ユーザーID不正は422、重複は409、認証失敗は401", () => {
    expect(fail("invalid_user_id").status).toBe(422);
    expect(fail("already_registered").status).toBe(409);
    expect(fail("wrong_password").status).toBe(401);
  });
});
