"use client";

import { useState } from "react";
import { assemblyGroups, type EventKey } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import { AssemblyLegend } from "./AssemblyLegend";
import styles from "./guide.module.css";
import { GroundPlayback } from "./GroundPlayback";

/** 種目別案内は所属・出発地・GPSを持たず、競技全体の集合区分だけを表示する。 */
export function GroundOverview({ event }: { event: EventKey }) {
  const [round,setRound]=useState(1);
  const groups=assemblyGroups(event,round);
  return <section className={`om-page ${styles.guide} ${styles.embedded}`} aria-label="競技全体の3D集合案内">
    <GroundPlayback key={event} event={event}/>
    <p className={styles.overviewNote}>競技全体の集合場所です。図の区分と下の一覧を照らし合わせてください。</p>
    {event==="horse"&&<label>1回戦・総当たりの試合<select value={round} onChange={e=>setRound(Number(e.target.value))}>{[1,2,3,4].map(n=><option key={n} value={n}>第{n}試合</option>)}</select></label>}
    <GroundScene event={event} groups={groups}/>
    <AssemblyLegend groups={groups}/>
    {event==="horse"&&<p className={styles.note}>2回戦の大将戦は別隊形です。この図は1回戦の総当たりを示します。</p>}
    <p className={styles.note}>集合区分の広がりは概略です。テントはトラックの外周に沿って配置しています。</p>
  </section>;
}
