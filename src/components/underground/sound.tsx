"use client";
// 音は明示操作で開始し、ミュート・非表示・画面離脱で停止する。
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
type Blip = (freq: number, dur?: number, type?: OscillatorType) => void;
interface SoundValue { on: boolean; toggle: () => void; blip: Blip; }
const SoundContext = createContext<SoundValue | null>(null);
export function SoundProvider({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const enabled = useRef(false);
  const tone = useCallback((freq: number, dur: number, type: OscillatorType, volume: number) => {
    const ac = ctx.current;
    if (!enabled.current || !ac || ac.state !== "running" || document.hidden) return;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime);
    g.gain.linearRampToValueAtTime(volume, ac.currentTime + .012);
    g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + dur);
    o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }, []);
  const blip = useCallback<Blip>((freq, dur = .12, type = "square") => tone(freq, dur, type, .035), [tone]);
  const toggle = useCallback(() => {
    const next = !enabled.current;
    try {
      ctx.current ??= new AudioContext();
      enabled.current = next;
      setOn(next);
      if (next) void ctx.current.resume().then(() => tone(660, .12, "sine", .04)).catch(() => { enabled.current = false; setOn(false); });
      else void ctx.current.suspend().catch(() => {});
    } catch { enabled.current = false; setOn(false); }
  }, [tone]);
  useEffect(() => {
    if (!on) return;
    // オリジナルの短調ループ。低音と控えめなアルペジオで古い端末の空気を作る。
    const notes = [220, 261.63, 329.63, 246.94, 220, 293.66, 261.63, 207.65];
    let step = 0;
    const timer = setInterval(() => {
      tone(notes[step % notes.length], .38, "triangle", .014);
      if (step % 4 === 0) tone(step % 8 === 0 ? 55 : 65.41, .85, "sine", .035);
      step++;
    }, 300);
    const visibility = () => {
      if (document.hidden) void ctx.current?.suspend().catch(() => {});
      else if (enabled.current) void ctx.current?.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", visibility);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visibility); };
  }, [on, tone]);
  useEffect(() => () => { enabled.current = false; void ctx.current?.close().catch(() => {}); ctx.current = null; }, []);
  const value = useMemo(() => ({ on, toggle, blip }), [on, toggle, blip]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}
export function useSound(): SoundValue {
  const v = useContext(SoundContext);
  if (!v) throw new Error("useSound は SoundProvider の内側で使う");
  return v;
}
