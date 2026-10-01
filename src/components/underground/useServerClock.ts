"use client";
import { useEffect, useRef, useState } from "react";

/**
 * サーバー時刻に合わせた現在時刻（ms）。
 * 初回描画はサーバー時刻を使い、ハイドレーションのずれを防ぐ
 */
export function useServerClock(serverNow: string, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.parse(serverNow));
  const offset = useRef(0);

  useEffect(() => {
    offset.current = Date.parse(serverNow) - Date.now();
  }, [serverNow]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset.current), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return now;
}
