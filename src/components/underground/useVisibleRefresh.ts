"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 表示中だけ最新の残高・配当・順位を取り直す */
export function useVisibleRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (!document.hidden) router.refresh(); };
    const timer = setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router]);
}
