// Cookie セッションの読み書き（Route Handler / Server Action / Server Component から使う）
// 表側（/login・/me）にはセッションが無い。ここで扱うのはカジノと実行委員の 2 系統だけ
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, createToken, sessionSecret, verifyToken, type TokenKind } from "./token";

/** カジノは 12 時間、実行委員は 24 時間 */
const MAX_AGE_SEC: Record<TokenKind, number> = { casino: 12 * 3600, admin: 24 * 3600 };

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Cookie に署名付きトークンを書く（Route Handler / Server Action 内でのみ呼べる） */
export async function startSession(kind: TokenKind, subject: string): Promise<void> {
  const token = createToken(sessionSecret(), { kind, subject, expiresAt: nowSec() + MAX_AGE_SEC[kind] });
  const store = await cookies();
  store.set({
    name: COOKIE_NAME[kind],
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC[kind],
  });
}

export async function endSession(kind: TokenKind): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME[kind]);
}

/** セッションの主体（カジノならユーザーID、実行委員ならメール）。無効なら null */
export async function readSession(kind: TokenKind): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME[kind])?.value;
  if (!raw) return null;
  return verifyToken(sessionSecret(), raw, kind, nowSec())?.subject ?? null;
}

/** カジノ入場済みのユーザーIDを返す。未入場なら /casino/enter へ */
export async function requireCasinoStudent(): Promise<string> {
  const id = await readSession("casino");
  if (!id) redirect("/casino/enter");
  return id;
}

/** 実行委員ログイン済みのメールを返す。未ログインなら /admin/login へ */
export async function requireAdmin(): Promise<string> {
  const email = await readSession("admin");
  if (!email) redirect("/admin/login");
  return email;
}
