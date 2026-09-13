"use client";
// 結果発表の演出（機能6）。液晶の中で 3 つの窓が番号を回し、確定着順で止まってから当落を出す
// 立体的なボタン・角丸・紙吹雪は使わず、CSS の steps() アニメーションだけで機械的に動かす
import { useEffect, useRef, useState } from "react";
import { formatPoints } from "@/lib/casino/format";
import { useSound } from "../sound";
import { RANKS } from "./labels";

/** リールの窓に流す番号の個数（strip の長さ。CSS の steps() と一致させる） */
const STRIP_LEN = 8;
/** 各窓が止まるまでの時間（ミリ秒）。最後の窓で約 1.4 秒 */
const LOCK_AT = [900, 1150, 1400];

export interface ResultRevealProps {
  /** リールに流す番号（Market の選択肢の表示番号） */
  numbers: string[];
  /** 確定着順の番号（3 枠。足りない分は「―」） */
  finalNums: string[];
  /** 確定着順のチーム名（3 枠。足りない分は「―」） */
  finalNames: string[];
  hit: boolean;
  /** 払戻合計 */
  payout: number;
  /** この Market への賭け金合計 */
  staked: number;
  onClose: () => void;
  /** 3 つの窓が止まって当落を出した瞬間に 1 回呼ぶ（的中演出のきっかけ） */
  onDone?: () => void;
}

export function ResultReveal({ numbers, finalNums, finalNames, hit, payout, staked, onClose, onDone }: ResultRevealProps) {
  const { blip } = useSound();
  // 何番目の窓まで止まったか（3 で全部確定）
  const [locked, setLocked] = useState(0);
  const blipRef = useRef(blip);
  const doneRef = useRef(onDone);
  useEffect(() => {
    blipRef.current = blip;
    doneRef.current = onDone;
  });

  // 停止は CSS ではなくタイマーで進める（prefers-reduced-motion でアニメーションが無効でも必ず確定する）
  useEffect(() => {
    const timers = LOCK_AT.map((at, i) =>
      setTimeout(() => {
        setLocked(i + 1);
        blipRef.current(620 + i * 160, 0.07);
      }, at),
    );
    const last = setTimeout(() => {
      blipRef.current(hit ? 1180 : 150, hit ? 0.14 : 0.2);
      doneRef.current?.();
    }, LOCK_AT[LOCK_AT.length - 1] + 220);
    return () => {
      for (const t of timers) clearTimeout(t);
      clearTimeout(last);
    };
  }, [hit]);

  const done = locked >= LOCK_AT.length;
  // strip は常に STRIP_LEN 個（選択肢が少ない Market では番号を繰り返す）
  const strip = Array.from({ length: STRIP_LEN }, (_, i) => numbers[i % Math.max(1, numbers.length)] ?? "―");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="結果発表"
      className="ug-pop absolute inset-0 z-[4] flex items-center justify-center bg-[rgba(3,7,2,.9)] p-[18px]"
    >
      <div className="w-full max-w-[392px] border border-lcd-text/50 bg-[rgba(6,11,4,.97)] px-4 pb-3.5 pt-[15px] text-lcd-text">
        <div className="mb-3 border-b border-dashed border-lcd-text/20 pb-1.5 text-[10.5px] tracking-[.22em] text-lcd-dim">
          RESULT / OFFICIAL ORDER
        </div>

        <div className="flex justify-center gap-2.5">
          {[0, 1, 2].map((i) => {
            const stopped = locked > i;
            return (
              <div key={i} className="text-center">
                <div className="text-[9px] tracking-[.2em] text-lcd-dim">{RANKS[i]}</div>
                <div className="ug-reel" data-stopped={stopped}>
                  {stopped ? (
                    <div className="ug-reel-cell text-lcd-hi">{finalNums[i] ?? "―"}</div>
                  ) : (
                    <div className="ug-reel-strip" style={{ animationDuration: `${300 + i * 60}ms` }}>
                      {strip.map((n, k) => (
                        <div key={`${n}-${k}`} className="ug-reel-cell text-lcd-sel">
                          {n}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-1 h-6 w-[62px] truncate font-jp text-[9.5px] leading-[1.4] text-lcd-dim">
                  {stopped ? (finalNames[i] ?? "―") : "..."}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 min-h-[86px] border-t border-dashed border-lcd-text/20 pt-2.5" aria-live="polite">
          {done ? (
            <>
              <div className={`font-display text-[clamp(22px,6.4vw,30px)] tracking-[.14em] ${hit ? "text-lcd-ok" : "text-lcd-red"}`}>
                {hit ? `HIT  +${formatPoints(payout)} C` : `MISS  -${formatPoints(staked)} C`}
              </div>
              <div className="mt-1 font-jp text-[10.5px] leading-[1.9] text-lcd-dim">
                {hit
                  ? `的中。払戻 ${formatPoints(payout)} C を所持クレジットに加算した（賭け金合計 ${formatPoints(staked)} C）。`
                  : `外れ。賭け金 ${formatPoints(staked)} C は没収された。借金があるときは結果確定ごとに利子が付く。`}
              </div>
            </>
          ) : (
            <div className="text-[11px] tracking-[.2em] text-lcd-mid">CALCULATING ORDER...</div>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 w-full cursor-pointer border border-lcd-sel bg-lcd-sel px-1.5 py-2 text-[11px] tracking-[.18em] text-lcd-ink"
        >
          [ENTER] CLOSE
        </button>
      </div>
    </div>
  );
}
