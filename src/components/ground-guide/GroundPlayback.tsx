"use client";

import { useEffect, useMemo, useState } from "react";
import { createPlayback, playbackFrame } from "@/lib/ground-guide/playback";
import { type EventKey } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import styles from "./guide.module.css";

/** 種目変更時には親のkeyで再生位置をリセットする。自動再生はしない。 */
export function GroundPlayback({ event }: { event: EventKey }) {
  const playback=useMemo(()=>createPlayback(event),[event]);
  const [time,setTime]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState(1);
  const [reduced,setReduced]=useState(false);
  const frame=playbackFrame(playback,time);
  const ended=time>=playback.duration;
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>{setReduced(media.matches);if(media.matches)setPlaying(false);};
    update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    if(!playing||ended)return;
    let request=0,last=0;
    const tick=(now:number)=>{
      if(last&&!document.hidden)setTime(t=>Math.min(playback.duration,t+Math.min((now-last)/1000,.1)*speed));
      last=now;request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);
    const hide=()=>{if(document.hidden)setPlaying(false);};
    document.addEventListener("visibilitychange",hide);
    return()=>{cancelAnimationFrame(request);document.removeEventListener("visibilitychange",hide);};
  },[playing,speed,playback.duration,ended]);
  const seek=(index:number)=>{setPlaying(false);setTime(playback.phases.slice(0,index).reduce((s,p)=>s+p.duration,0));};
  return <section className={styles.playback} aria-label="全区分の通しアニメーション">
    <h2>全区分の動きを通して見る</h2>
    <p className={styles.note}>集合から競技・退場まで。全区分を残し、動いている区分を●、待機を○で表示します。動線・時間は説明用に単純化しています。</p>
    <div className={styles.toolbar}>
      <button type="button" className={styles.primary} disabled={reduced} onClick={()=>{if(ended)setTime(0);setPlaying(!playing||ended);}}>{playing&&!ended?"一時停止":ended?"もう一度再生":"通し再生"}</button>
      <button type="button" onClick={()=>{setPlaying(false);setTime(0);}}>最初に戻る</button>
      <button type="button" disabled={frame.index===0} onClick={()=>seek(frame.index-1)}>前の場面</button>
      <button type="button" disabled={frame.index===playback.phases.length-1} onClick={()=>seek(frame.index+1)}>次の場面</button>
      <label>再生速度<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n=><option key={n} value={n}>{n}倍</option>)}</select></label>
    </div>
    {reduced&&<p className={styles.note}>動きを減らす設定のため、場面選択とスライダーで確認できます。</p>}
    <label>場面 {frame.index+1} / {playback.phases.length}<select value={frame.index} onChange={e=>seek(Number(e.target.value))}>{playback.phases.map((p,i)=><option key={i} value={i}>{i+1}. {p.label}</option>)}</select></label>
    <label>再生位置 {Math.floor(time)} / {Math.ceil(playback.duration)}秒<input type="range" min="0" max={playback.duration} step="0.1" value={time} onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/></label>
    <p className={styles.status} aria-live="polite"><strong>{frame.phase.label}</strong><br/>{frame.phase.note}</p>
    <GroundScene event={event} actors={frame.actors}/>
    <details><summary>全区分の一覧（{frame.actors.length}区分）</summary><ul className={styles.actorList}>{frame.actors.map(a=><li key={a.id}>{a.active?"●":"○"} {a.label} — {a.status}</li>)}</ul></details>
  </section>;
}
