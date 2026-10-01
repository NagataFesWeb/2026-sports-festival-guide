"use client";

import { useState } from "react";
import { assemblyGroups, type EventKey } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import { AssemblyLegend } from "./AssemblyLegend";
import styles from "./guide.module.css";
import { GroundPlayback } from "./GroundPlayback";

/** 他の競技を紹介するための全体図。個人の案内は含めない。 */
export function GroundOverview({ event }: { event: EventKey }) {
  const [mode, setMode] = useState<"assembly" | "flow">("assembly");
  const [round, setRound] = useState(1);
  const groups = assemblyGroups(event, round);
  return <section className={`om-page ${styles.guide} ${styles.embedded}`} aria-label="競技全体の案内">
    <div className={styles.steps}><button type="button" aria-pressed={mode === "assembly"} onClick={() => setMode("assembly")}>集合場所</button><button type="button" aria-pressed={mode === "flow"} onClick={() => setMode("flow")}>競技の流れ</button></div>
    {mode === "flow" ? <GroundPlayback key={event} event={event}/> : <>
      <p className={styles.overviewNote}>図の記号と一覧で、集合場所を確認してください。</p>
      {event === "horse" && <label>総当たりの試合<select value={round} onChange={e => setRound(Number(e.target.value))}>{[1,2,3,4].map(n => <option key={n} value={n}>第{n}試合</option>)}</select></label>}
      <GroundScene event={event} groups={groups}/><AssemblyLegend groups={groups}/>
      {event === "horse" && <p className={styles.note}>この図は総当たり戦です。大将戦は「競技の流れ」で確認できます。</p>}
    </>}
  </section>;
}
