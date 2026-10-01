"use client";

// トップのヒーロー（モック v2 の isTop 冒頭）。黒地に「滅！」と 2 段のマーキー、透かしの NAGATA
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSiteMotion } from "@/components/SiteMotion";
import { useIntro } from "./HomeExperience";

/** 背面のマーキー文字列（モックの bgLine / bgLineEn / heartLine） */
const BG_LINE = "青春 爆裂 青春 爆裂 青春 爆裂 青春 爆裂 青春 爆裂 ";
const BG_LINE_EN = "LOVE NAGATA ・ TOO MUCH NAGATA ・ LOVE NAGATA ・ TOO MUCH NAGATA ・ ";
const HEART_LINE = "♡ 青春爆裂愛してる ★ ".repeat(6);
/** 敷き詰める透かし文字 */
const WATERMARK = "NAGATA ".repeat(9).trim();

/** 「滅！」の巨大文字。字面は同じで色だけ変える（グリッチの二重像に使う） */
const MEI_CLASS = "font-om-mincho text-[min(58vw,30vh)] leading-[0.78] font-extrabold tracking-[-0.02em]";

export function Hero({ dateLabel, openLabel }: { dateLabel: string; openLabel: ReactNode }) {
  const { enabled } = useSiteMotion();
  const { introReady } = useIntro();
  const heroRef = useRef<HTMLElement>(null);
  const watermarkRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  /** クリックで「滅！」の登場アニメーションをやり直すためのキー */
  const [slamKey, setSlamKey] = useState(0);

  useEffect(() => {
    // ポインタ位置とスクロール量で透かしとマーキーを少しずらす（タッチでもスクロールで動く）
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    let inView = true;
    if (!enabled || !introReady) return;

    const apply = (): void => {
      frame = 0;
      if (!inView) return;
      const scrolled = window.scrollY;
      if (watermarkRef.current !== null) {
        watermarkRef.current.style.transform = `translate(${pointerX * -26}px,${pointerY * -18 - scrolled * 0.06}px)`;
      }
      if (marqueeRef.current !== null) {
        marqueeRef.current.style.transform = `translate(${pointerX * 16}px,${pointerY * 12 + scrolled * 0.04}px)`;
      }
    };

    const schedule = () => { if (!frame && inView) frame = requestAnimationFrame(apply); };

    const onMove = (event: PointerEvent): void => {
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
      schedule();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (heroRef.current) heroRef.current.dataset.motionVisible = String(inView);
      if (inView) schedule();
    });
    if (heroRef.current) observer.observe(heroRef.current);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [enabled, introReady]);

  return (
    <section ref={heroRef} data-intro-ready={introReady} className="om-hero relative flex min-h-[min(100vh,900px)] flex-col justify-center overflow-hidden bg-om-ink pt-[clamp(56px,10vh,96px)] text-om-paper">
      <div
        ref={watermarkRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[8%] font-display text-[clamp(56px,13vw,150px)] leading-[0.92] tracking-[-0.02em] break-all text-[rgba(245,242,233,.055)] transition-transform duration-300 ease-out"
      >
        {WATERMARK}
      </div>

      <div
        ref={marqueeRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex flex-col justify-between pt-[7vh] pb-[clamp(180px,30vh,260px)] transition-transform duration-[400ms] ease-out"
      >
        <div className="om-marquee-clip">
          <div className="om-marquee-row om-marquee-jp rotate-[-3deg]">
            <div className="font-om-mincho text-[clamp(30px,6vw,64px)] font-extrabold text-[rgba(255,45,85,.16)]">
              {BG_LINE}
            </div>
            <div className="font-om-mincho text-[clamp(30px,6vw,64px)] font-extrabold text-[rgba(255,45,85,.16)]">
              {BG_LINE}
            </div>
          </div>
        </div>
        <div className="om-marquee-clip rotate-[1.2deg] py-[0.34em]">
          <div className="om-marquee-row om-marquee-en">
            <div className="font-display text-[clamp(26px,5vw,54px)] tracking-[0.06em] text-[rgba(36,91,255,.22)]">
              {BG_LINE_EN}
            </div>
            <div className="font-display text-[clamp(26px,5vw,54px)] tracking-[0.06em] text-[rgba(36,91,255,.22)]">
              {BG_LINE_EN}
            </div>
          </div>
        </div>
      </div>

      <div key={`intro-${introReady}-${enabled}`} className={`${introReady && enabled ? "om-shake" : ""} relative px-[clamp(18px,5vw,60px)]`}>
        <div className="flex flex-wrap items-start justify-between gap-[14px]">
          <div className="font-display text-[clamp(10px,1.4vw,13px)] leading-[2] tracking-[0.32em]">
            NAGATA HIGH SCHOOL
            <br />
            <span className="text-om-yellow">79TH SPORTS FESTIVAL</span>
          </div>
          <div className="text-right font-display text-[clamp(10px,1.4vw,13px)] leading-[2] tracking-[0.22em] text-[rgba(245,242,233,.6)]">
            {dateLabel}
            <br />
            {openLabel}
          </div>
        </div>

        <div className="mt-[clamp(14px,3vh,34px)] font-om-mincho text-[clamp(20px,4.4vw,34px)] font-semibold tracking-[0.3em]">
          長田すぎて
        </div>

        <h1 className="relative m-0 mt-[-0.06em] leading-[0.78]">
          <span className="relative inline-block">
            <button
              type="button"
              key={`${slamKey}-${introReady}-${enabled}`}
              onClick={() => setSlamKey((key) => key + 1)}
              aria-label="滅！"
              className={`${introReady && enabled ? "om-slam" : ""} block cursor-pointer text-om-paper select-none ${MEI_CLASS}`}
            >
              滅<span className="text-om-pink">！</span>
            </button>
            {/* 赤と青の二重像。mix-blend-mode:screen でたまに版ずれしたように見せる */}
            <span
              aria-hidden="true"
              className={`om-glitch pointer-events-none absolute inset-0 text-om-pink mix-blend-screen ${MEI_CLASS}`}
            >
              滅！
            </span>
            <span
              aria-hidden="true"
              className={`om-glitch-b pointer-events-none absolute inset-0 text-om-blue mix-blend-screen ${MEI_CLASS}`}
            >
              滅！
            </span>
          </span>
        </h1>

        <div className="mt-[clamp(12px,2.6vh,26px)] flex flex-wrap items-baseline gap-[clamp(10px,2vw,22px)]">
          <div className="text-[clamp(15px,3.2vw,26px)] font-black tracking-[0.42em] text-om-yellow">
            青 春 爆 裂 愛 し て る
          </div>
          <div className="font-display text-[clamp(10px,1.3vw,12px)] tracking-[0.26em] text-[rgba(245,242,233,.5)]">
            TOO MUCH NAGATA.
          </div>
        </div>
      </div>

      <div className="relative mt-[clamp(22px,5vh,52px)] overflow-hidden border-t-2 border-om-paper bg-om-yellow py-2 text-om-ink">
        <div className="om-marquee-row om-marquee-band">
          <div className="text-[13px] font-black tracking-[0.14em]">{HEART_LINE}</div>
          <div className="text-[13px] font-black tracking-[0.14em]">{HEART_LINE}</div>
        </div>
      </div>
      <div className="relative z-[6] bg-om-ink px-[clamp(18px,5vw,60px)] pt-3 pb-[18px] font-display text-[12px] tracking-[0.3em] text-[rgba(245,242,233,.55)]">
        SCROLL TO 爆裂 ↓
      </div>
    </section>
  );
}
