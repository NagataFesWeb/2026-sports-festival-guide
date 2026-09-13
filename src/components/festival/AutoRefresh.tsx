"use client";

// 得点・進行の速報用。一定間隔でサーバーコンポーネントを再取得する（表示する値の計算はサーバー側のまま）
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 既定の更新間隔（30 秒） */
const DEFAULT_INTERVAL_MS = 30_000;

export function AutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      // タブが見えていないときは通信しない
      if (document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs]);

  return null;
}
