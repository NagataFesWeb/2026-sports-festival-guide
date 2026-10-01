"use client";

// OSの設定を初期値にし、サイト内で明示的に選んだ演出設定を優先する。
import { useEffect, useSyncExternalStore } from "react";

const KEY = "nagata-motion";
const CHANGE = "nagata-motion-change";
let temporaryPreference: "full" | "reduced" | null = null;

function snapshot(): "full" | "reduced" {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "full" || saved === "reduced") return saved;
  } catch { /* 保存できないブラウザでもOSの設定で表示する */ }
  if (temporaryPreference) return temporaryPreference;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
}

function subscribe(update: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", update);
  window.addEventListener("storage", update);
  window.addEventListener(CHANGE, update);
  return () => {
    media.removeEventListener("change", update);
    window.removeEventListener("storage", update);
    window.removeEventListener(CHANGE, update);
  };
}

export function useSiteMotion() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "pending" as const);
  return { enabled: mode === "full", ready: mode !== "pending" };
}

/** イベント処理やアニメーション開始時に使う（保存した設定を即座に反映する） */
export function isMotionReduced(): boolean {
  return snapshot() === "reduced";
}

export function SiteMotionControls() {
  const { enabled, ready } = useSiteMotion();
  useEffect(() => {
    if (ready) document.documentElement.dataset.motion = enabled ? "full" : "reduced";
  }, [enabled, ready]);

  const toggle = () => {
    const next = enabled ? "reduced" : "full";
    temporaryPreference = next;
    try { localStorage.setItem(KEY, next); } catch { /* 保存できなくても表示は切り替える */ }
    document.documentElement.dataset.motion = next;
    window.dispatchEvent(new Event(CHANGE));
  };

  return <button type="button" aria-pressed={enabled} onClick={toggle} className="site-motion-control">
    演出 {enabled ? "ON" : "OFF"}
  </button>;
}
