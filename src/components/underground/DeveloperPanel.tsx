"use client";
// 開発用の重い演出部品は確認パネルを開いたときだけ読み込む。
import dynamic from "next/dynamic";
import { useState } from "react";

const Content = dynamic(() => import("./DeveloperPanelContent").then(m => m.DeveloperPanelContent), {
  loading: () => <p className="p-3" role="status">確認パネルを読み込み中…</p>,
});

export function DeveloperPanel({ sharedSound = false }: { sharedSound?: boolean }) {
  const [open, setOpen] = useState(false);
  return <details className="ug-dev" onToggle={e => setOpen(e.currentTarget.open)}>
    <summary>DEV / カジノ確認</summary>
    {open && <Content sharedSound={sharedSound} />}
  </details>;
}
