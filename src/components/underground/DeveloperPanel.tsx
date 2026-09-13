"use client";
// 開発時の確認用。通常の認証を使い、API の権限は変更しない。
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BootSequence } from "./BootSequence";
import { SoundProvider, useSound } from "./sound";
import { WinFx } from "./bet/WinFx";
import { Cabinet } from "./Cabinet";
import { Lcd } from "./Lcd";
import { HardwareControls } from "./HardwareControls";

function Panel() {
  const router = useRouter();
  const [boot, setBoot] = useState(false);
  const [win, setWin] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const { on, toggle } = useSound();
  async function enter() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/casino/enter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: "2117", password: "2117", mode: "login" }) });
      const data = await res.json() as { ok: boolean };
      if (data.ok) router.push("/casino");
      else setMessage("開発用口座が利用できません。入場画面から認証してください。");
    } catch { setMessage("接続できませんでした。再試行してください。"); }
    finally { setBusy(false); }
  }
  return <><details className="ug-dev" onKeyDown={e => e.stopPropagation()}><summary>DEV / カジノ確認</summary><div className="grid gap-2 p-3">
    <p>開発環境専用・演出デモは残高に影響しません</p>
    <a href="/casino/enter">入場画面を開く</a>
    <button disabled={busy} onClick={() => void enter()}>{busy ? "接続中…" : "開発用口座でカジノを開く"}</button>
    <button onClick={() => setBoot(true)}>起動演出を再生</button>
    <button onClick={() => setWin(true)}>的中演出を再生</button>
    <button aria-pressed={on} onClick={toggle}>BGM・効果音 {on ? "ON" : "OFF"}</button>
    {message && <p role="alert">{message}</p>}
  </div></details>
  {(boot || win) && <div className="fixed inset-0 z-[150] font-term" onKeyDown={e => {
    e.stopPropagation(); if (e.key === "Enter" || e.key === "Escape") { setBoot(false); setWin(false); }
  }}>
    <Cabinet credit={1240} link="online" controls={<HardwareControls fkeys={[]}
      onBack={() => { setBoot(false); setWin(false); }} onEnter={() => { setBoot(false); setWin(false); }}
      enterHint="BACK TO PREVIEW" enterReady led="ready" />}>
      <Lcd tabs={[]} clock="" status={boot ? "> POWER ON SELF TEST" : "> DEMO / NO TRANSACTION"} statusRight="NODE 79"
        boot={boot ? <BootSequence onComplete={() => setBoot(false)} /> : undefined}
        overlay={win ? <WinFx amount="2,480" rate="4.96" race="DEMO / SWEDEN RELAY" pick="01 紅蓮" stake="500" onClose={() => setWin(false)} /> : undefined}>
        <p>DEVELOPMENT PREVIEW</p>
      </Lcd>
    </Cabinet>
  </div>}
  </>;
}
export function DeveloperPanel({ sharedSound = false }: { sharedSound?: boolean }) { return sharedSound ? <Panel /> : <SoundProvider><Panel /></SoundProvider>; }

