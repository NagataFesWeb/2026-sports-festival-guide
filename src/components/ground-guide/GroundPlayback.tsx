"use client";

import { useEffect, useMemo, useState } from "react";
import { createPlayback, playbackFrame } from "@/lib/ground-guide/playback";
import { relayWaitingGroups, type EventKey } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import styles from "./guide.module.css";
import { useSiteMotion } from "@/components/SiteMotion";

/** 初期停止。説明の再生は演出設定と独立した手動操作にし、非表示時は止める。 */
export function GroundPlayback({ event, participant }: { event: EventKey; participant?: { grade: number; classNo: number; runner: number | null } }) {
  const playback = useMemo(() => createPlayback(event), [event]);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1);
  const { enabled, ready } = useSiteMotion();
  const reduced = ready && !enabled;
  const frame = playbackFrame(playback, time);
  const ended = time >= playback.duration;
  const highlightedActorIds = participant ? playback.actors.filter(a => a.grade === participant.grade && a.classNo === participant.classNo && (participant.runner === null || a.runner === participant.runner)).map(a => a.id) : [];
  useEffect(() => {
    if (!playing || ended) return;
    let request = 0, last = 0;
    const tick = (now: number) => {
      if (last && !document.hidden) setTime(t => Math.min(playback.duration, t + Math.min((now-last)/1000, .1)*speed));
      last = now; request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const hide = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    return () => { cancelAnimationFrame(request); document.removeEventListener("visibilitychange", hide); };
  }, [playing, speed, playback.duration, ended]);
  const seek = (index: number) => { setPlaying(false); setTime(playback.phases.slice(0,index).reduce((s,p) => s+p.duration,0)); };
  return <section className={styles.playback} aria-label="競技の流れのアニメーション">
    <h2>集合から競技、退場まで</h2>
    <p className={styles.note}>動きを短縮した説明用の図です。実際の競技時間や順位を表すものではありません。{highlightedActorIds.length > 0 && "「自分」の印があなたの出場区分です。"}</p>
    <p className={styles.status} aria-live="polite"><strong>{frame.index+1} / {playback.phases.length}　{frame.phase.label}</strong><br/>{frame.phase.note}</p>
    <GroundScene event={event} actors={frame.actors} highlightedActorIds={highlightedActorIds} groups={[...relayWaitingGroups(event, "before"), ...relayWaitingGroups(event, "after")]}/>
    <div className={styles.toolbar}>
      <button type="button" className={styles.primary} onClick={() => { if (ended) setTime(0); setPlaying(!playing || ended); }}>{playing && !ended ? "一時停止" : ended ? "もう一度見る" : "流れを再生"}</button>
      <button type="button" disabled={frame.index === 0} onClick={() => seek(frame.index-1)}>前の場面</button>
      <button type="button" disabled={frame.index === playback.phases.length-1} onClick={() => seek(frame.index+1)}>次の場面</button>
    </div>
    {reduced && <p className={styles.note}>演出OFFでも「流れを再生」で確認できます。動かさずに見る場合は「次の場面」を使ってください。</p>}
    <details><summary>場面を選ぶ・再生速度を変える</summary>
      <div className={styles.controls}>
        <label>見たい場面<select value={frame.index} onChange={e => seek(Number(e.target.value))}>{playback.phases.map((p,i) => <option key={i} value={i}>{i+1}. {p.label}</option>)}</select></label>
        <label>再生速度<select value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5,1,2,4].map(n => <option key={n} value={n}>{n}倍</option>)}</select></label>
        <label>再生位置<input type="range" min="0" max={playback.duration} step="0.1" value={time} onChange={e => { setPlaying(false); setTime(Number(e.target.value)); }}/></label>
        <button type="button" onClick={() => { setPlaying(false); setTime(0); }}>最初に戻る</button>
      </div>
    </details>
    <details><summary>参加区分を確認する</summary><ul className={styles.actorList}>{frame.actors.map(a => <li key={a.id}>{a.active ? "●" : "○"} {a.label} — {a.status}</li>)}</ul></details>
  </section>;
}
