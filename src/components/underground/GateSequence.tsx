"use client";
// モックのstartGate/gateStepに合わせ、接続文字列とバーを順に表示する。
import { useEffect, useRef, useState } from "react";
import { useSound } from "./sound";
import { isMotionReduced } from "@/components/SiteMotion";
const SCRIPT = ["NAGATA SYSTEMS", "PRIVATE NETWORK", "CONNECTING TO NODE 79...", "", "CONNECTION ESTABLISHED"];
export function GateSequence({ onComplete }: { onComplete: () => void }) {
  const [shown, setShown] = useState<string[]>([]);
  const { blip } = useSound();
  const latest = useRef({ onComplete, blip });
  useEffect(() => { latest.current = { onComplete, blip }; });
  useEffect(() => {
    let index = 0; let char = 0; let timer: ReturnType<typeof setTimeout>;
    const values: string[] = [];
    const step = () => {
      if (index === SCRIPT.length) { latest.current.blip(680, .18, "sine"); latest.current.onComplete(); return; }
      const text = SCRIPT[index];
      if (index === 3) { values[index] = "bar"; setShown([...values]); index++; timer = setTimeout(step, 720); return; }
      char = Math.min(text.length, char + Math.max(3, Math.ceil(text.length / 7)));
      values[index] = text.slice(0, char); setShown([...values]);
      const done = char === text.length;
      if (done) { index++; char = 0; latest.current.blip(1500, .012, "square"); }
      timer = setTimeout(step, done ? 42 : 18);
    };
    timer = setTimeout(isMotionReduced() ? () => latest.current.onComplete() : step, 300);
    return () => clearTimeout(timer);
  }, []);
  return <div className="ug-gate-script">{SCRIPT.map((_, i) => i === 3 ? <div key={i} className="ug-gate-bar" style={{ visibility: shown[3] ? "visible" : "hidden" }}>{shown[3] && <div />}</div> : <div key={i} className={i === 4 ? "text-lcd-sel" : i < 2 ? "text-lcd-dim" : "text-lcd-text"}>{shown[i]}{shown.length - 1 === i && <span className="text-lcd-hi">█</span>}</div>)}</div>;
}
