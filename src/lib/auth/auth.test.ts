import { describe, expect, it } from "vitest";
import { hashPassword, isValidPassword, verifyPassword } from "./password";
import { COOKIE_NAME, createToken, verifyToken } from "./token";

const SECRET = "test-secret-at-least-16-chars";

describe("password", () => {
  it("ハッシュ化したパスワードは元のパスワードで検証できる", () => {
    const stored = hashPassword("himitsu123");
    expect(verifyPassword("himitsu123", stored)).toBe(true);
  });

  it("違うパスワードでは検証に失敗する", () => {
    const stored = hashPassword("himitsu123");
    expect(verifyPassword("chigau456", stored)).toBe(false);
  });

  it("不正な形式の保存文字列は検証に失敗する（例外を投げない）", () => {
    expect(verifyPassword("himitsu123", "not-a-valid-format")).toBe(false);
    expect(verifyPassword("himitsu123", "")).toBe(false);
    expect(verifyPassword("himitsu123", "scrypt$")).toBe(false);
  });

  it("isValidPassword は4〜32文字を受け付ける", () => {
    expect(isValidPassword("abc")).toBe(false);
    expect(isValidPassword("abcd")).toBe(true);
    expect(isValidPassword("a".repeat(32))).toBe(true);
    expect(isValidPassword("a".repeat(33))).toBe(false);
  });

  it("isValidPassword は前後に空白があると拒否する（空白のみも拒否）", () => {
    expect(isValidPassword(" abcd")).toBe(false);
    expect(isValidPassword("abcd ")).toBe(false);
    expect(isValidPassword("    ")).toBe(false);
  });
});

describe("token", () => {
  it("作成したトークンを検証すると同じ内容が返る", () => {
    const nowSec = 1_700_000_000;
    const token = createToken(SECRET, { kind: "casino", subject: "2117", expiresAt: nowSec + 3600 });
    const payload = verifyToken(SECRET, token, "casino", nowSec);
    expect(payload).toEqual({ kind: "casino", subject: "2117", expiresAt: nowSec + 3600 });
  });

  it("種別（kind）が違うと検証に失敗する", () => {
    const nowSec = 1_700_000_000;
    const token = createToken(SECRET, { kind: "casino", subject: "2117", expiresAt: nowSec + 3600 });
    expect(verifyToken(SECRET, token, "admin", nowSec)).toBeNull();
  });

  it("署名が改ざんされていると検証に失敗する", () => {
    const nowSec = 1_700_000_000;
    const token = createToken(SECRET, { kind: "casino", subject: "2117", expiresAt: nowSec + 3600 });
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    expect(verifyToken(SECRET, tampered, "casino", nowSec)).toBeNull();
  });

  it("有効期限が切れていると検証に失敗する", () => {
    const nowSec = 1_700_000_000;
    const token = createToken(SECRET, { kind: "casino", subject: "2117", expiresAt: nowSec - 1 });
    expect(verifyToken(SECRET, token, "casino", nowSec)).toBeNull();
  });

  it("主体（subject）にドットや非ASCII文字が含まれても往復できる", () => {
    const nowSec = 1_700_000_000;
    const subject = "2117.佐藤太郎";
    const token = createToken(SECRET, { kind: "admin", subject, expiresAt: nowSec + 60 });
    const payload = verifyToken(SECRET, token, "admin", nowSec);
    expect(payload?.subject).toBe(subject);
  });

  it("COOKIE_NAME はカジノと実行委員で異なる", () => {
    expect(COOKIE_NAME.casino).not.toBe(COOKIE_NAME.admin);
  });
});
