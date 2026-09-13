// 実行委員ログイン（/admin/login）。生徒側の学籍番号入力とは別系統の認証
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { readSession } from "@/lib/auth/session";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "実行委員ログイン | 第79回 体育祭",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  // ログイン済みなら管理画面へ（redirect は例外を投げるため条件分岐の直下で呼ぶ）
  const already = await readSession("admin");
  if (already) redirect("/admin");

  return (
    <>
      <div className="adm-band">
        <div className="mx-auto w-full max-w-md">
          <div className="adm-band-label">COMMITTEE CONSOLE</div>
          <h1 className="adm-band-title">実行委員ログイン</h1>
        </div>
      </div>

      <main className="mx-auto w-full max-w-md px-4 py-8">
        <ActionForm action={loginAction} submitLabel="ログイン" className="adm-card">
          <div className="grid gap-3">
            <label className="adm-field">
              <span>メールアドレス</span>
              <input className="adm-input" type="email" name="email" autoComplete="username" inputMode="email" required />
            </label>
            <label className="adm-field">
              <span>パスワード</span>
              <input className="adm-input" type="password" name="password" autoComplete="current-password" required />
            </label>
          </div>
        </ActionForm>

        <p className="adm-note mt-6">
          このページは実行委員専用です。生徒の招集案内は
          <Link className="mx-1 underline" href="/">
            トップページ
          </Link>
          から確認してください。
        </p>
      </main>
    </>
  );
}
