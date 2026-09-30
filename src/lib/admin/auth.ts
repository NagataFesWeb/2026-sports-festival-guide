// 実行委員（管理者）ログインの認証。生徒（カジノ）の認証とは別系統
// 優先順位: ADMIN_EMAIL で許可した Supabase Auth ユーザー → 環境変数 → 開発時のみ既定値
import { timingSafeEqual } from "node:crypto";

/** 環境変数が何も無いときに開発だけで使う既定アカウント */
const DEV_EMAIL = "admin@example.com";
const DEV_PASSWORD = "admin";

// 既定値の警告はサーバー起動中 1 回だけ出す
let devFallbackWarned = false;

function warnDevFallbackOnce(): void {
  if (devFallbackWarned) return;
  devFallbackWarned = true;
  console.warn(
    `[admin] ADMIN_EMAIL / ADMIN_PASSWORD が未設定のため、開発用の既定アカウント（${DEV_EMAIL} / ${DEV_PASSWORD}）で認証します`,
  );
}

/** 文字列比較（長さが同じときは一定時間で比較する） */
function safeEquals(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** Supabase Auth のパスワードグラントで照合する。200 が返れば正しい資格情報 */
async function verifyWithSupabase(url: string, anonKey: string, email: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    return res.status === 200;
  } catch {
    // 通信できないときは「認証できなかった」として扱う（通してはいけない）
    return false;
  }
}

/**
 * 実行委員の資格情報を照合する。
 * - Supabase の URL と anon キーが揃っていれば Supabase Auth に問い合わせる
 * - 揃っていなければ ADMIN_EMAIL / ADMIN_PASSWORD と照合する
 * - どちらも無い場合、本番では常に false、開発では既定アカウントのみ許可する
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<boolean> {
  const inputEmail = email.trim().toLowerCase();
  if (!inputEmail || !password) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const envEmail = process.env.ADMIN_EMAIL;
  if (url && anonKey) {
    // Supabase のサインアップ設定に関わらず、管理者として許可したアドレスだけを通す
    if (!envEmail || !safeEquals(inputEmail, envEmail.trim().toLowerCase())) return false;
    return verifyWithSupabase(url, anonKey, inputEmail, password);
  }

  const envPassword = process.env.ADMIN_PASSWORD;
  if (envEmail && envPassword) {
    return safeEquals(inputEmail, envEmail.trim().toLowerCase()) && safeEquals(password, envPassword);
  }

  // 本番で資格情報が未設定なら誰も入れない（既定値を本番に持ち込まない）
  if (process.env.NODE_ENV === "production") return false;
  warnDevFallbackOnce();
  return safeEquals(inputEmail, DEV_EMAIL) && safeEquals(password, DEV_PASSWORD);
}
