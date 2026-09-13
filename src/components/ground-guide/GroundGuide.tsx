"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findStudentEntries, studentIdParts } from "@/lib/festival/entries";
import { EVENTS, ORIGINS, classSeat, assemblyGroups, personalGroupId, eventKey, guidePlan, projectGps, validCalibration, type Calibration, type EventKey, type Place } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import { AssemblyLegend } from "./AssemblyLegend";
import styles from "./guide.module.css";
import { GroundPlayback } from "./GroundPlayback";

// 座標はユーザー確認済み。模式図上の階段位置は概略で、GPSの較正点として流用しない。
const STAIRS: Place = { x: -19, z: 52, label: "校舎からの階段（位置は概略）" };

const normalize = (id: string) => id.normalize("NFKC").trim();
export function GroundGuide({ initialStudentId = "", initialEvent = "", initialSlot = "", embedded = false }: { initialStudentId?: string; initialEvent?: string; initialSlot?: string; embedded?: boolean }) {
  const [id, setId] = useState(normalize(initialStudentId));
  const [draft, setDraft] = useState(normalize(initialStudentId));
  const parts = studentIdParts(id);
  const entries = findStudentEntries(id);
  const [event, setEvent] = useState<EventKey>(eventKey(initialEvent) ?? EVENTS.find(e=>e.key===initialEvent)?.key ?? "opening");
  const [grade, setGrade] = useState(parts?.grade ?? 1);
  const [classNo, setClassNo] = useState(parts?.classNo ?? 1);
  const [runner, setRunner] = useState(() => { const n = Number(/第([1-8])走者/.exec(initialSlot)?.[1] ?? 1); return initialEvent.includes("7~8") ? (n === 2 ? 8 : 7) : n; });
  const [round, setRound] = useState(1);
  const [stage, setStage] = useState<1|2>(1);
  const [origin, setOrigin] = useState(0);
  const STARTS = [classSeat(grade, classNo), STAIRS, ...ORIGINS];
  const Container = embedded ? "section" : "main";
  const [gps, setGps] = useState<Place|null>(null);
  const [gpsStatus, setGpsStatus] = useState("現在地はボタンを押したときだけ取得します。位置情報は送信・保存しません。");
  const [watching, setWatching] = useState(false);
  const [calibration, setCalibration] = useState<Calibration|null>(null);
  const [calError, setCalError] = useState("");
  const [error, setError] = useState("");
  const watch = useRef<number|null>(null);
  const generation = useRef(0);
  useEffect(()=>()=>{generation.current++;if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);},[]);
  const plan = guidePlan(event, grade, classNo, runner, round);
  const groups = assemblyGroups(event, round);
  const ownGroup = personalGroupId(event, grade, classNo, runner);
  const relay = ["girls","swedish","mixed"].includes(event);
  function stopGps() {
    generation.current++;
    if(watch.current!==null) navigator.geolocation.clearWatch(watch.current);
    watch.current=null;setWatching(false);setGps(null);
  }
  function locate() {
    stopGps();
    if(!window.isSecureContext || !navigator.geolocation) {setGpsStatus("位置情報にはHTTPSと対応ブラウザが必要です。出発地点を選択してください。");return;}
    const token=generation.current;
    setWatching(true);setGpsStatus("現在地を取得しています…");
    watch.current=navigator.geolocation.watchPosition(position=>{
      if(token!==generation.current)return;
      const {latitude,longitude,accuracy}=position.coords;
      const d=Math.hypot((latitude-34.669162)*111320,(longitude-135.143414)*111320*Math.cos(latitude*Math.PI/180));
      if(Date.now()-position.timestamp>30000 || accuracy>20 || !Number.isFinite(accuracy)) {setGps(null);setGpsStatus(`GPS精度が不足しています（誤差約${Math.round(accuracy)}m）。出発地点を手動で選択してください。`);return;}
      if(!calibration) {setGps(null);setGpsStatus(`現在地取得済み・誤差約${Math.round(accuracy)}m。階段まで直線で約${Math.round(d)}m。地図への重ね合わせには下の「GPS位置合わせ」が必要です。`);return;}
      const p=projectGps({latitude,longitude},calibration);
      setGps(p?{...p,label:`現在地（GPS誤差約${Math.round(accuracy)}m）`}:null);
      setGpsStatus(p?`現在地からの概略矢印を更新中（誤差約${Math.round(accuracy)}m）。` : "会場範囲外です。会場までの経路は表示しません。出発地点を選択してください。");
    }, e=>{if(token!==generation.current)return;stopGps();setGpsStatus(e.code===1?"位置情報が許可されませんでした。出発地点を手動で選択できます。":e.code===3?"現在地の取得がタイムアウトしました。もう一度取得するか出発地点を選択してください。":"現在地を取得できません。出発地点を手動で選択してください。");}, {enableHighAccuracy:true,maximumAge:0,timeout:15000});
  }
  function changeEvent(value: EventKey) {setEvent(value);setStage(1);setRunner(1);setRound(1);}
  return <Container className={`om-page ${styles.guide} ${embedded ? styles.embedded : ""}`}>
    {!embedded && <header className={styles.heading}><small>NAGATA 79TH / GROUND GUIDE</small><h1>集合場所へ、迷わず。</h1><p>出発地点 → 集合場所 → 競技位置。立体図で順番に確認。</p></header>}
    <div className={styles.grid}>
      <aside className={styles.controls}>
        {!embedded && <form className={styles.wide} onSubmit={e=>{e.preventDefault();const value=normalize(draft),p=studentIdParts(value);if(!p || p.number<1){setError("4桁の学籍番号（1〜3年・1〜8組・出席番号01以上）を入力してください。");return;}setError("");setId(value);setGrade(p.grade);setClassNo(p.classNo);setStage(1);}}>
          <div className={styles.row}><label>学籍番号<input value={draft} onChange={e=>setDraft(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="例：2117" maxLength={12}/></label><button className={styles.primary} type="submit">確認</button></div>
          {error&&<p role="alert" className={styles.note}>{error}</p>}
        </form>}
        {!embedded && id&&<div className={styles.wide}><p className={styles.note}>{parts?`${parts.grade}年${parts.classNo}組 ／ ${id}`:"学籍番号を確認してください"}</p>{entries===null?<p className={styles.note}>出場競技表にない番号です。競技・学年・組を選んで図を確認できます。</p>:<label>出場競技から案内を選ぶ<select value="" onChange={e=>{const entry=entries[Number(e.target.value)];if(!entry)return;const key=eventKey(entry.event);if(key){changeEvent(key);const n=/第([1-8])走者/.exec(entry.slot);if(entry.event.includes("7~8"))setRunner(n&&Number(n[1])===2?8:7);else if(n)setRunner(Number(n[1]));}}}><option value="">競技を選択（{entries.length}件）</option>{entries.map((entry,i)=><option key={i} value={i} disabled={!eventKey(entry.event)}>{entry.event} ／ {entry.slot}</option>)}</select></label>}</div>}
        {!embedded && <label className={styles.wide}>案内するプログラム<select value={event} onChange={e=>changeEvent(e.target.value as EventKey)}>{EVENTS.map((e,i)=><option key={e.key} value={e.key}>{String(i+1).padStart(2,"0")}　{e.label}</option>)}</select></label>}
        <div className={`${styles.fields} ${styles.wide}`}><label>学年<select value={grade} onChange={e=>setGrade(Number(e.target.value))}>{[1,2,3].map(n=><option key={n} value={n}>{n}年</option>)}</select></label><label>組<select value={classNo} onChange={e=>setClassNo(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}組</option>)}</select></label></div>
        {relay&&<label className={styles.wide}>競技全体での走順（確認してください）<select value={runner} onChange={e=>{setRunner(Number(e.target.value));setStage(1);}}>{Array.from({length:event==="mixed"?8:6},(_,i)=><option key={i} value={i+1}>第{i+1}走者</option>)}</select>{event==="mixed"&&<span className={styles.note}>「7〜8走」の枠内の第1・第2走者は、全体の第7・第8走者を選んでください。</span>}</label>}
        {event==="horse"&&<label className={styles.wide}>1回戦・総当たりの試合<select value={round} onChange={e=>{setRound(Number(e.target.value));setStage(1);}}>{[1,2,3,4].map(n=><option key={n} value={n}>第{n}試合</option>)}</select></label>}
        <label className={styles.wide}>出発地点<select value={origin} onChange={e=>{setOrigin(Number(e.target.value));stopGps();setStage(1);setGpsStatus("選択した地点から案内します。");}}>{STARTS.map((p,i)=><option key={p.label} value={i}>{p.label}</option>)}</select></label>
        <div className={`${styles.row} ${styles.wide}`}><button type="button" onClick={locate}>現在地を取得</button>{watching&&<button type="button" onClick={()=>{stopGps();setGpsStatus("GPSを停止しました。選択した出発地点から案内します。");}}>GPS停止</button>}</div>
        <p className={`${styles.status} ${styles.wide}`} role="status">{gpsStatus}</p>
        <details className={styles.wide}><summary>GPS位置合わせ</summary><p className={styles.note}>本部前の外周中央と、向かいの生徒席側の外周中央の緯度・経度を入力します。学校ピンや階段の座標を代用しないでください。設定はこの画面を閉じると消えます。</p>
          <form onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);const num=(k:string)=>{const v=String(data.get(k)??"").trim();return v?Number(v):NaN;};const c:Calibration={headquarters:{latitude:num("hqLat"),longitude:num("hqLon")},back:{latitude:num("backLat"),longitude:num("backLon")}};if(!validCalibration(c)){setCalError("会場付近の2点を入力してください。2点間の距離は30〜180mが必要です。");return;}stopGps();setCalibration(c);setCalError("");setGpsStatus("位置合わせを設定しました。「現在地を取得」で案内を開始できます。");}}>
            <label>本部前・緯度<input name="hqLat" inputMode="decimal" required placeholder="34.…"/></label><label>本部前・経度<input name="hqLon" inputMode="decimal" required placeholder="135.…"/></label><label>生徒席側・緯度<input name="backLat" inputMode="decimal" required placeholder="34.…"/></label><label>生徒席側・経度<input name="backLon" inputMode="decimal" required placeholder="135.…"/></label>
            <button type="submit">位置合わせを設定</button>{calError&&<p role="alert">{calError}</p>}
          </form>
        </details>
      </aside>
      <section>
        <GroundPlayback key={event} event={event}/>
        <div className={styles.steps}><button type="button" aria-pressed={stage===1} onClick={()=>setStage(1)}>① 出発 → ② 集合</button><button type="button" aria-pressed={stage===2} onClick={()=>setStage(2)}>② 集合 → ③ 競技</button></div>
        <GroundScene event={event} start={gps??STARTS[origin]} assembly={plan.assembly} destination={plan.destination} stage={stage} groups={groups} highlightedGroup={ownGroup}/>
        <AssemblyLegend groups={groups} highlightedGroup={ownGroup}/>
        <ol className={styles.route}><li>① {gps?.label??STARTS[origin].label}</li><li>② {plan.assembly.label}</li><li>③ {plan.destination.label}</li></ol>
        <h2>{EVENTS.find(e=>e.key===event)?.label}の案内</h2>
        <p className={styles.note}>集合：{plan.timing}</p><p>{plan.note}</p>
        {((event==="rope"&&grade!==1)||(event==="pole"&&grade!==2)||(event==="horse"&&grade!==3))&&<p role="status">この競技の対象学年と選択中の学年が異なります。見学用の図として表示しています。</p>}
        <p className={styles.note}>写真の上側が本部側。図は本部を下に揃えています（写真から180度回転）。矢印は概略動線です。集合場所・競技位置へはトラックを横断できます。テントの大きさと位置は概略です。</p>
        {!embedded && <Link href={id?`/me?id=${encodeURIComponent(id)}`:"/login"}>← 出場競技の案内へ</Link>}
      </section>
    </div>
  </Container>;
}
