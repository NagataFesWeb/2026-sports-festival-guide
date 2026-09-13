"use client";
// モックv3と同じく5連打で筐体を表示し、液晶内で起動する。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
export function HiddenDoor({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const router = useRouter();
  const [taps, setTaps] = useState(0);
  const count = useRef(0);
  const opening = useRef(false);
  useEffect(() => {
    if (!taps) return;
    const timer = setTimeout(() => { count.current = 0; setTaps(0); }, 1400);
    return () => clearTimeout(timer);
  }, [taps]);
  function tap() {
    if (opening.current) return;
    count.current++;
    if (count.current >= 5) { opening.current = true; router.push("/casino/enter"); }
    else setTaps(count.current);
  }
  const colors = ["rgba(245,242,233,.75)", "rgba(245,242,233,.75)", "rgba(245,242,233,.85)", "#C8E6A6", "#FF2020"];
  return <button type="button" aria-label="79" onClick={tap} style={{ color: tone === "dark" ? colors[taps] : taps >= 3 ? "#FF2D55" : "rgba(17,17,17,.3)" }} className="inline-flex min-h-11 cursor-default items-center px-3 align-middle transition-colors duration-300 select-none">79</button>;
}
