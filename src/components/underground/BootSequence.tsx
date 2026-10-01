"use client";
// モックv3のBOOT・bootStep・bootLinesListを液晶内へ移植する。
import { useEffect, useRef, useState } from "react";
import { useSound } from "./sound";
import { isMotionReduced } from "@/components/SiteMotion";
type Line = { k: "dim" | "out" | "in" | "ok"; s: string; p?: number };
export const BOOT: readonly Line[] = [
  { k: "dim", s: "NAGATA SYSTEMS  NODE 79" },
  { k: "dim", s: "ROM v7.9.26  (C) 1979-2026" },
  { k: "out", s: "POST ................. OK" },
  { k: "out", s: "MEM 640K ............. OK" },
  { k: "out", s: "LCD PANEL ............ OK" },
  { k: "out", s: "COIN HOPPER .......... OK" },
  { k: "out", s: "KEYPAD F1-F4 ......... OK" },
  { k: "in", s: "mount /dev/ug0", p: 140 },
  { k: "dim", s: "mounting underground volume" },
  { k: "ok", s: "[####################] 100%", p: 140 },
  { k: "in", s: "./gate --term 79", p: 140 },
  { k: "dim", s: "loading market table ... 4 OPEN" },
  { k: "dim", s: "loading pool ledger .... 12,480 C" },
  { k: "dim", s: "linking floor relay .... 34ms" },
  { k: "dim", s: "crypto handshake ....... AES" },
  { k: "out", s: "SESSION 0x4E414741" },
  { k: "out", s: "--------------------------------" },
  { k: "ok", s: "AUTHORIZED PERSONNEL ONLY", p: 200 },
  { k: "out", s: "GATE READY", p: 240 },
];
const colors = { in: "text-lcd-hi", dim: "text-lcd-dim", out: "text-lcd-text", ok: "text-lcd-sel" };
export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<Line[]>([]);
  const done = useRef(onComplete);
  const { blip } = useSound();
  const sound = useRef(blip);
  useEffect(() => { done.current = onComplete; sound.current = blip; });
  useEffect(() => {
    let index = 0; let char = 0; const completed: Line[] = [];
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => { sound.current(680, .18, "sine"); done.current(); };
    const step = () => {
      const ln = BOOT[index];
      if (!ln) { finish(); return; }
      const input = ln.k === "in";
      char = Math.min(ln.s.length, char + (input ? 1 : Math.max(3, Math.ceil(ln.s.length / 7))));
      const full = char >= ln.s.length;
      if (full) {
        completed.push(ln); index++; char = 0; setLines([...completed]);
        if (!input) sound.current(1500, .012, "square");
      } else {
        setLines([...completed, { ...ln, s: ln.s.slice(0, char) }]);
        if (input) sound.current(920, .015, "square");
      }
      timer = setTimeout(step, full ? (input ? 280 : ln.p || 42) : (input ? 46 : 18));
    };
    if (isMotionReduced()) {
      timer = setTimeout(() => { setLines([...BOOT]); timer = setTimeout(finish, 500); }, 0);
    } else timer = setTimeout(step, 1000);
    return () => clearTimeout(timer);
  }, []);
  return <div className="ug-boot-log" role="button" tabIndex={0} aria-label="端末起動ログ。クリックまたはEnterでスキップ" onClick={onComplete} onKeyDown={e => {
    e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape" || e.key === " ") { e.preventDefault(); onComplete(); }
  }}>
    {lines.slice(-24).map((line, i, all) => <div key={i} className={colors[line.k]}>{line.k === "in" ? "$ " : ""}{line.s}<span className="text-lcd-hi">{i === all.length - 1 ? "█" : ""}</span></div>).reverse()}
  </div>;
}
