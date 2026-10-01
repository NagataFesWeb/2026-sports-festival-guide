"use client";

import { useState } from "react";
import Link from "next/link";
import { findStudentEntries, studentIdParts } from "@/lib/festival/entries";
import { EVENTS, ORIGINS, classSeat, assemblyGroups, personalGroupId, eventKey, entryRunner, guidePlan, type EventKey } from "@/lib/ground-guide/navigation";
import { GroundScene } from "./GroundScene";
import { AssemblyLegend } from "./AssemblyLegend";
import { GroundPlayback } from "./GroundPlayback";
import styles from "./guide.module.css";

export function GroundGuide({ initialStudentId = "", initialEvent = "", initialSlot = "", embedded = false, initialMode = "assembly" }: {
  initialStudentId?: string; initialEvent?: string; initialSlot?: string; embedded?: boolean; initialMode?: "assembly" | "flow";
}) {
  const [id, setId] = useState(initialStudentId.normalize("NFKC").trim());
  const [draft, setDraft] = useState(id);
  const parts = studentIdParts(id);
  const entries = findStudentEntries(id);
  const [event, setEvent] = useState<EventKey>(eventKey(initialEvent) ?? EVENTS.find(e => e.key === initialEvent)?.key ?? "opening");
  const [grade, setGrade] = useState(parts?.grade ?? 1);
  const [classNo, setClassNo] = useState(parts?.classNo ?? 1);
  const [runner, setRunner] = useState(/第[1-8]走者/.test(initialSlot.normalize("NFKC")) ? entryRunner(initialEvent, initialSlot) : 0);
  const [round, setRound] = useState(1);
  const [stage, setStage] = useState<1 | 2>(1);
  const [mode, setMode] = useState(initialMode);
  const [origin, setOrigin] = useState(0);
  const [error, setError] = useState("");
  const starts = [classSeat(grade, classNo), ...ORIGINS];
  const plan = guidePlan(event, grade, classNo, runner, round);
  const groups = assemblyGroups(event, round);
  const ownGroup = personalGroupId(event, grade, classNo, runner);
  const own = groups.filter(g => g.id === ownGroup);
  const relay = ["girls", "swedish", "mixed"].includes(event);
  const Container = embedded ? "section" : "main";
  const changeEvent = (value: EventKey) => { setEvent(value); setRunner(0); setRound(1); setStage(1); };
  const runnerField = <label>走順<select value={runner} onChange={e => { setRunner(Number(e.target.value)); setStage(1); }}><option value={0}>自分の走順を選ぶ</option>{Array.from({ length: event === "mixed" ? 8 : 6 }, (_, i) => <option key={i} value={i + 1}>第{i + 1}走者</option>)}</select></label>;
  const fields = <div className={styles.controls}>
    <div className={styles.fields}><label>学年<select value={grade} onChange={e => setGrade(Number(e.target.value))}>{[1,2,3].map(n => <option key={n} value={n}>{n}年</option>)}</select></label><label>組<select value={classNo} onChange={e => setClassNo(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}組</option>)}</select></label></div>
    {relay && runnerField}
    {event === "horse" && <label>総当たりの試合<select value={round} onChange={e => { setRound(Number(e.target.value)); setStage(1); }}>{[1,2,3,4].map(n => <option key={n} value={n}>第{n}試合</option>)}</select></label>}
    <label>出発する場所<select value={origin} onChange={e => { setOrigin(Number(e.target.value)); setStage(1); }}>{starts.map((p,i) => <option key={i} value={i}>{p.label}</option>)}</select></label>
  </div>;
  return <Container className={`om-page ${styles.guide} ${embedded ? styles.embedded : ""}`}>
    {!embedded && <>
      <header className={styles.heading}><h1>集合場所と競技の流れ</h1><p>学籍番号を入れて、自分の集合場所を確認できます。</p></header>
      <form className={styles.row} onSubmit={e => { e.preventDefault(); const value = draft.normalize("NFKC").trim(), p = studentIdParts(value); if (!p || p.number < 1) { setError("4桁の学籍番号を確認してください。"); return; } setError(""); setId(value); setGrade(p.grade); setClassNo(p.classNo); setStage(1); }}><label>学籍番号<input inputMode="numeric" value={draft} onChange={e => setDraft(e.target.value)} placeholder="例：2117"/></label><button type="submit">確認</button></form>
      {error && <p role="alert">{error}</p>}
      <label>プログラム<select value={event} onChange={e => changeEvent(e.target.value as EventKey)}>{EVENTS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}</select></label>
      {entries && <label>自分の出場競技<select value="" onChange={e => { const entry = entries[Number(e.target.value)]; if (!entry) return; const key = eventKey(entry.event); if (key) { changeEvent(key); setRunner(entryRunner(entry.event, entry.slot)); } }}><option value="">競技を選ぶ</option>{entries.map((entry,i) => <option key={i} value={i}>{entry.event} {entry.slot}</option>)}</select></label>}
    </>}
    <div className={styles.steps} aria-label="案内の表示切替"><button type="button" aria-pressed={mode === "assembly"} onClick={() => setMode("assembly")}>集合場所</button><button type="button" aria-pressed={mode === "flow"} onClick={() => setMode("flow")}>競技の流れ</button></div>
    <p className={styles.identity}>{grade}年{classNo}組{relay && runner > 0 ? ` ／ 第${runner}走者` : ""}</p>
    {mode === "flow" ? <GroundPlayback key={event} event={event} participant={relay && runner === 0 ? undefined : { grade, classNo, runner: relay ? runner : event === "rope" ? initialEvent.includes("前半") ? 0 : initialEvent.includes("後半") ? 1 : null : null }}/> : relay && runner === 0 ? <><p>走順によって集合側が変わります。自分の走順を選んでください。</p>{runnerField}</> : <>
      <ol className={styles.route}><li>① {starts[origin].label}</li><li>② {plan.assembly.label}</li><li>③ {plan.destination.label}</li></ol>
      <div className={styles.steps}><button type="button" aria-pressed={stage === 1} onClick={() => setStage(1)}>集合場所まで</button><button type="button" aria-pressed={stage === 2} onClick={() => setStage(2)}>集合後、競技位置へ</button></div>
      <GroundScene event={event} start={starts[origin]} assembly={plan.assembly} destination={plan.destination} stage={stage} groups={groups} highlightedGroup={ownGroup}/>
      <AssemblyLegend groups={own} highlightedGroup={ownGroup} allGroups={groups}/>
      <p>{plan.note}</p>
      <details><summary>ほかの集合区分を見る</summary><AssemblyLegend groups={groups.filter(g => g.id !== ownGroup)} allGroups={groups}/></details>
      {embedded ? <details><summary>出発する場所・走順を変更</summary>{fields}</details> : fields}
      {((event === "rope" && grade !== 1) || (event === "pole" && grade !== 2) || (event === "horse" && grade !== 3)) && <p role="status">選択中の学年はこの競技の対象学年と異なります。学年の選択を確認してください。</p>}
    </>}
    {!embedded && <Link href={id ? `/me?id=${encodeURIComponent(id)}` : "/login"}>← 自分の当日案内へ</Link>}
  </Container>;
}
