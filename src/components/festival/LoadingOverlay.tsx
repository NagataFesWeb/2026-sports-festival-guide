"use client";

// トップの読み込み演出（モック v2 の loading）。「青春 充填中」のバーが満ちたら消える
import { useEffect, useState } from "react";
import { useSiteMotion } from "@/components/SiteMotion";
import { useIntro } from "./HomeExperience";

/** バーを進める間隔と 1 回の増分（140ms × 20 回 = 2.8 秒で満タン） */
const TICK_MS = 140;
const STEP = 5;
/** 100% の「爆裂」を見せてからフェードする */
const HOLD_MS = 700;
/** 満タンから消えるまでのフェード */
const FADE_MS = 300;

/** 進み具合に応じた小さなラベル（モックの loadLabel） */
function loadLabel(progress: number): string {
  if (progress < 40) return "CHARGING";
  return progress < 100 ? "限界突破まで" : "爆 裂";
}

export function LoadingOverlay() {
  const motion = useSiteMotion();
  const { finishIntro } = useIntro();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  function finish() {
    try { sessionStorage.setItem("nagata-intro-seen", "1"); } catch { /* 保存なしでも操作できる */ }
    setVisible(false);
    finishIntro();
  }

  useEffect(() => {
    if (!motion.ready || !visible) return;
    let seen = false;
    try { seen = sessionStorage.getItem("nagata-intro-seen") === "1"; } catch { /* 保存なしでは初回扱い */ }
    // 動きを控える設定と再訪問では待たずに開ける。
    if (!motion.enabled || seen) {
      const skip = window.setTimeout(() => { setVisible(false); finishIntro(); }, 0);
      return () => window.clearTimeout(skip);
    }
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          return 100;
        }
        return Math.min(100, current + STEP);
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [motion.ready, motion.enabled, visible, finishIntro]);

  useEffect(() => {
    if (progress < 100) return;
    const fade = window.setTimeout(() => setFading(true), HOLD_MS);
    const hide = window.setTimeout(() => {
      try { sessionStorage.setItem("nagata-intro-seen", "1"); } catch { /* 保存なしでも表示する */ }
      setVisible(false);
      finishIntro();
    }, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [progress, finishIntro]);

  if (!visible) return null;

  return (
    <div
      aria-label="青春充填中"
      style={{ opacity: fading ? 0 : 1, transition: `opacity ${FADE_MS}ms linear` }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-[22px] bg-om-ink p-6 text-om-paper"
    >
      <div className="font-display text-[12px] tracking-[0.42em] text-om-yellow">NAGATA ENERGY</div>
      <div className="font-om-mincho text-[clamp(26px,7vw,46px)] font-extrabold tracking-[0.16em]">
        青春 充填中
      </div>
      <div className="h-4 w-[min(78vw,420px)] border-2 border-om-paper p-[2px]">
        <div
          style={{ width: `${progress}%`, transition: "width .12s linear" }}
          className="h-full bg-om-pink"
        />
      </div>
      <div className="font-display text-[clamp(30px,9vw,64px)] leading-none text-om-yellow">
        {progress}
        <span className="text-[0.4em]">%</span>
      </div>
      <div className="text-[11px] tracking-[0.3em] text-[rgba(245,242,233,.45)]">{loadLabel(progress)}</div>
      <button type="button" onClick={finish} className="min-h-11 cursor-pointer border border-om-paper/40 px-5 text-[12px] tracking-[.12em]">スキップ →</button>
    </div>
  );
}
