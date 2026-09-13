// 署名付きセッショントークン（HMAC-SHA256）。Cookie に入れてサーバーだけが検証する
// 形式: "<種別>.<主体>.<有効期限 epoch 秒>.<署名 base64url>"
import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenKind = "casino" | "admin";

/** Cookie 名（proxy.ts と session.ts で共有） */
export const COOKIE_NAME: Record<TokenKind, string> = { casino: "casino_session", admin: "admin_session" };

export interface TokenPayload {
  kind: TokenKind;
  subject: string;
  /** epoch 秒 */
  expiresAt: number;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/** "." で区切るため、encodeURIComponent では素通りするドットも明示的にエスケープする */
function encodeSubject(subject: string): string {
  return encodeURIComponent(subject).replace(/\./g, "%2E");
}

export function createToken(secret: string, payload: TokenPayload): string {
  const body = `${payload.kind}.${encodeSubject(payload.subject)}.${payload.expiresAt}`;
  return `${body}.${sign(secret, body)}`;
}

/** 署名と有効期限を検証し、不正なら null */
export function verifyToken(secret: string, token: string, kind: TokenKind, nowSec: number): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [k, subjectEnc, expStr, sig] = parts;
  if (k !== kind) return null;
  const body = `${k}.${subjectEnc}.${expStr}`;
  const expected = sign(secret, body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowSec) return null;
  return { kind, subject: decodeURIComponent(subjectEnc), expiresAt };
}

/** 署名用の秘密鍵。本番では SESSION_SECRET を必ず設定する */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET（16文字以上）を環境変数に設定してください");
  }
  return "dev-only-session-secret-change-me";
}
