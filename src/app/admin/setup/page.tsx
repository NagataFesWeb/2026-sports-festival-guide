import type { Metadata } from "next";
import { PasswordSetup } from "./password-setup";

export const metadata: Metadata = {
  title: "実行委員のパスワード設定 | 第79回 体育祭",
  robots: { index: false, follow: false },
};

export default function AdminPasswordSetupPage() {
  return (
    <>
      <div className="adm-band">
        <div className="mx-auto w-full max-w-md">
          <div className="adm-band-label">COMMITTEE CONSOLE</div>
          <h1 className="adm-band-title">パスワード設定</h1>
        </div>
      </div>
      <main className="mx-auto w-full max-w-md px-4 py-8">
        <PasswordSetup />
      </main>
    </>
  );
}
