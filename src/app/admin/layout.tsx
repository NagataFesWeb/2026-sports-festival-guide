// /admin 配下（管理画面・実行委員ログイン）の共通レイアウト。
// 管理画面だけの CSS はここで読み込む（globals.css は表画面の移植と衝突するため触らない）
import type { ReactNode } from "react";
import "@/components/admin/admin.css";

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="adm-page">{children}</div>;
}
