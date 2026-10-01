"use client";
// 的中演出（HIT）。結果演出のリールが止まって的中していたら、液晶を暗転させて払戻額を大きく出す（モック v3）
// 紙吹雪は依存を増やさず Canvas 2D で液晶の内側に描く。3.4 秒で自動的に消え、タップ・キーでも閉じられる
import { useEffect, useRef } from "react";
import { useSound } from "../sound";
import { isMotionReduced } from "@/components/SiteMotion";

/** 表示時間（CSS の ug-winbg と一致させる） */
const SHOW_MS = 3400;
const CONFETTI_MS = 2600;
const CONFETTI_COUNT = 110;
const CONFETTI_COLORS = ["#9FE07A", "#FF4A3D", "#EAF7DC", "#C8E6A6", "#7CE07C"];

export interface WinFxProps {
  /** 払戻合計（表示用に整形済み） */
  amount: string;
  /** 実効倍率（表示用に整形済み） */
  rate: string;
  /** 競技の表示（例: RACE 04 ・ SWEDEN RELAY） */
  race: string;
  /** 的中したベットの対象 */
  pick: string;
  /** 的中したベットの賭け金合計（表示用に整形済み） */
  stake: string;
  onClose: () => void;
}

/** 紙吹雪を 1 回だけ降らせる。戻り値で途中停止できる */
function runConfetti(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext("2d");
  if (!ctx) return () => {};
  const dpr = window.devicePixelRatio || 1;
  cv.width = cv.clientWidth * dpr;
  cv.height = cv.clientHeight * dpr;
  const parts = Array.from({ length: CONFETTI_COUNT }, () => ({
    x: cv.width * (0.2 + Math.random() * 0.6),
    y: cv.height * 0.35,
    vx: (Math.random() - 0.5) * 13 * dpr,
    vy: (-9 - Math.random() * 9) * dpr,
    w: (5 + Math.random() * 6) * dpr,
    h: (3 + Math.random() * 5) * dpr,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3,
    c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
  }));
  const t0 = performance.now();
  let raf = 0;
  const draw = () => {
    const el = performance.now() - t0;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (const p of parts) {
      p.vy += 0.42 * dpr;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      p.vx *= 0.992;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / CONFETTI_MS);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (el < CONFETTI_MS) raf = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, cv.width, cv.height);
  };
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, cv.width, cv.height);
  };
}

export function WinFx({ amount, rate, race, pick, stake, onClose }: WinFxProps) {
  const { blip } = useSound();
  const cvRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef(onClose);
  const blipRef = useRef(blip);
  useEffect(() => {
    closeRef.current = onClose;
    blipRef.current = blip;
  });

  // 表示した瞬間に紙吹雪と上昇する 3 音を鳴らし、SHOW_MS 後に自分で閉じる
  useEffect(() => {
    const cv = cvRef.current;
    const reduced = isMotionReduced();
    const stop = cv && !reduced ? runConfetti(cv) : () => {};
    blipRef.current(880, 0.18);
    const t1 = setTimeout(() => blipRef.current(1320, 0.22), 150);
    const t2 = setTimeout(() => blipRef.current(1760, 0.26), 320);
    const t3 = setTimeout(() => closeRef.current(), SHOW_MS);
    const fanfare = [1046.5, 1318.5, 1568, 2093].map((note, i) =>
      setTimeout(() => blipRef.current(note, i === 3 ? .65 : .18, "triangle"), 520 + i * 140),
    );
    return () => {
      stop();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      fanfare.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        autoFocus
        aria-label={`的中 払戻 ${amount} C。タップで閉じる`}
        className="ug-win absolute inset-0 z-[8] flex cursor-pointer flex-col items-center justify-center bg-[rgba(2,5,1,.93)] p-4 text-center"
      >
        <span className="ug-win-pop flex w-full flex-col items-center gap-[5px]">
          <span className="ug-win-blink text-[10.5px] tracking-[.4em] text-lcd-ok">▲ HIT ・ 的中 ▲</span>
          <span className="whitespace-nowrap font-display text-[clamp(34px,9vw,64px)] leading-[.92] tracking-[.03em] text-lcd-hi [text-shadow:0_0_22px_rgba(159,224,122,.75)]">
            +{amount}
          </span>
          <span className="whitespace-nowrap text-[11.5px] tracking-[.26em] text-lcd-sel">CREDIT ・ {rate}x</span>
          <span className="mt-1 max-w-full truncate border-t border-dashed border-lcd-text/30 pt-1.5 text-[11px] tracking-[.14em] text-lcd-text">
            {race}
          </span>
          <span className="max-w-full truncate text-[11px] tracking-[.14em] text-lcd-dim">
            PICK {pick} ・ STAKE {stake} C
          </span>
          <span className="mt-1 text-[9.5px] tracking-[.24em] text-lcd-faint">TAP TO DISMISS</span>
        </span>
      </button>
      <canvas ref={cvRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[9] h-full w-full" />
    </>
  );
}

