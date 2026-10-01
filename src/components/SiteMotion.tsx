"use client";

// 演出切り替えUIは出さず、OSの動きを減らす設定を尊重する。
import { useEffect, useSyncExternalStore } from "react";


function snapshot(): "full" | "reduced" {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

function subscribe(update: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", update);
  return () => {
    media.removeEventListener("change", update);
  };
}

export function useSiteMotion() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "pending" as const);
  return { enabled: mode === "full", ready: mode !== "pending" };
}

/** イベント処理やアニメーション開始時に使う。 */
export function isMotionReduced(): boolean {
  return snapshot() === "reduced";
}

export function SiteMotionControls() {
  const { enabled, ready } = useSiteMotion();
  useEffect(() => {
    if (ready) document.documentElement.dataset.motion = enabled ? "full" : "reduced";
  }, [enabled, ready]);

  return null;
}
