// パスワードのハッシュ化（node:crypto の scrypt。外部依存なし）
// 形式: "scrypt$<salt hex>$<hash hex>"
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password.normalize("NFKC"), salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** カジノのパスワード要件: 4〜32 文字（空白のみは不可） */
export function isValidPassword(password: string): boolean {
  const p = password.trim();
  return p.length >= 4 && p.length <= 32 && p === password;
}
