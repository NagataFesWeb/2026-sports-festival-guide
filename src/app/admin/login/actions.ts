"use server";

// 実行委員ログインの Server Action
import type { ActionState } from "@/components/admin/action-state";
import { verifyAdminCredentials } from "@/lib/admin/auth";
import { raw, text } from "@/lib/admin/form";
import { startSession } from "@/lib/auth/session";

export async function loginAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const email = text(formData, "email");
  const password = raw(formData, "password");
  if (!email || !password) {
    return { ok: false, message: "メールアドレスとパスワードを入力してください" };
  }

  if (!(await verifyAdminCredentials(email, password))) {
    // どちらが違うかは伝えない（総当たりの手がかりを与えない）
    return { ok: false, message: "メールアドレスまたはパスワードが違います" };
  }

  await startSession("admin", email);
  // Cookieの保存が完了してから、クライアントで管理画面を読み直す。
  return { ok: true, message: "ログインしました" };
}
