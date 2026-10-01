"use client";
// 筐体（CABINET）：銘板・LED・SOUND スイッチ・CREDIT メーター。中に液晶と操作部を収める
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatPoints } from "@/lib/casino/format";
import { useSound } from "./sound";
import { isMotionReduced } from "@/components/SiteMotion";

export type LinkState = "online" | "busy" | "lost";

/** メーターの数字送りの時間 */
const ROLL_MS = 600;

/**
 * CREDIT メーターの表示値。値が変わると機械式カウンターのように送って、必ずサーバーの値に着地する。
 * 表示のためのアニメーションで、残高の計算はしない（prefers-reduced-motion では即座に切り替える）
 */
function useRollingCounter(value: number): number {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value) return;
    const reduced = isMotionReduced();
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = reduced ? 1 : Math.min(1, (t - t0) / ROLL_MS);
      // ease-out cubic。最後は必ず value ちょうどに合わせる
      const v = k >= 1 ? value : Math.round(from + (value - from) * (1 - (1 - k) ** 3));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return shown;
}

function Indicator({ label, tone }: { label: string; tone: string }) {
  return (
    <span className="flex flex-none flex-col items-center gap-0.5">
      <span className="ug-led" data-tone={tone} />
      <span className="text-[6.5px] tracking-[.08em] text-cab-label">{label}</span>
    </span>
  );
}

export function Cabinet({
  credit,
  link,
  children,
  controls,
}: {
  credit: number;
  link: LinkState;
  children: ReactNode;
  controls: ReactNode;
}) {
  const { on, toggle } = useSound();
  const shownCredit = useRollingCounter(credit);
  return (
    <div className="ug-stage">
      <div className="ug-cabinet">
        <div className="flex items-center justify-between gap-2 px-0.5 pb-1">
          <div className="flex min-w-0 items-center gap-2">
            <Indicator label="PWR" tone="power" />
            <Indicator label="LINK" tone={link === "lost" ? "alert" : link === "busy" ? "ok" : "off"} />
            <div className="truncate font-display text-[clamp(9px,2vw,11.5px)] tracking-[.13em] text-cab-text [text-shadow:0_1px_0_rgba(0,0,0,.8)]">
              NAGATA UNDERGROUND TERM 79
            </div>
          </div>
          <div className="flex flex-none items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              aria-pressed={on}
              aria-label={on ? "BGM・効果音をオフにする" : "BGM・効果音をオンにする"}
              className="flex cursor-pointer flex-col items-center gap-[3px] p-0.5 min-h-11 min-w-11"
            >
              <span className="flex items-center gap-[5px]">
                <span className="ug-led !h-[7px] !w-[7px]" data-tone={on ? "ok" : "off"} />
                <span className="ug-switch" data-on={on} />
              </span>
              <span className="text-[6.5px] tracking-[.14em] text-cab-label">SOUND</span>
            </button>
            <div className="ug-meter" aria-label={`所持クレジット ${formatPoints(credit)}`}>
              <div className="ug-meter-face">
                {/* 焼き付き：以前から使われ続けている端末の痕跡 */}
                <div className="pointer-events-none absolute right-[9px] top-3 text-[clamp(13px,3.2vw,16px)] text-[rgba(20,33,15,.13)]">
                  8,888 C
                </div>
                <div className="relative text-[7.5px] tracking-[.24em] text-[rgba(20,33,15,.62)]">CREDIT</div>
                <div className="relative text-right text-[clamp(13px,3.2vw,16px)] tabular-nums">{formatPoints(shownCredit)} C</div>
              </div>
            </div>
          </div>
        </div>
        <div className="ug-screen-bezel">{children}</div>
        {controls}
      </div>
    </div>
  );
}

