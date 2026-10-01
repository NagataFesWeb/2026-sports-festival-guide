"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { StudentEntry } from "@/lib/festival/entries";
import { FESTIVAL_DAY, type AgendaItem } from "@/lib/festival/ledger";
import styles from "./agenda.module.css";

// 個人の3D案内はボタンを押したときだけ読み込む。
const GroundGuide = dynamic(() => import("@/components/ground-guide/GroundGuide").then(m => m.GroundGuide), {
  loading: () => <p role="status">集合図を読み込み中…</p>,
});

export function MyEntries({ entries, studentId, agenda, updating = false }: {
  entries: StudentEntry[] | null; studentId: string; agenda: AgendaItem[]; updating?: boolean;
}) {
  const [open, setOpen] = useState<{ id: string; mode: "assembly" | "flow" } | null>(null);
  const toggle = (id: string, mode: "assembly" | "flow") => setOpen(open?.id === id && open.mode === mode ? null : { id, mode });
  return <section className={styles.agenda} aria-label="自分の当日案内">
    <div className={styles.intro}>
      <h1>いつ、どこに行く？</h1>
      <p>当日の順番で並んでいます。集合のタイミングと場所を確認してください。</p>
      <p className={styles.day}><time dateTime={FESTIVAL_DAY.date}>{FESTIVAL_DAY.dateLabel}</time></p>
      <div className={styles.morning}><strong>{FESTIVAL_DAY.arrival} 登校完了</strong><span>{FESTIVAL_DAY.gathering} グラウンド集合</span><span>{FESTIVAL_DAY.rollCall} 点呼完了</span></div>
    </div>
    <p className={styles.notice}><strong>ご注意：</strong>この案内はあくまでも参考情報です。正確な情報は演技台帳をご確認ください。</p>
    {entries === null && <p className={styles.notice} role="status">この学籍番号は出場競技表にありません。全員参加の案内を表示しています。番号を確認し、正しい場合は実行委員に伝えてください。</p>}
    {updating && <p className={styles.update} role="status">台帳の案内を表示中。実行委員の最新案内を確認しています…</p>}
    <ol className={styles.list}>
      {agenda.map((item, index) => <li key={item.id}>
        {item.order >= 6 && (index === 0 || agenda[index - 1].order < 6) && <div className={styles.lunch}><strong>{FESTIVAL_DAY.lunch}</strong> 昼休み</div>}
        <article className={styles.card} data-common={item.common}>
          <div className={styles.cardHeading}><h2>{item.title}</h2><span className={styles.slot}>{item.common ? "全員参加" : item.slot || "出場"}</span></div>
          <dl className={styles.facts}>
            <div><dt>集合のタイミング</dt><dd className={styles.gather}>{item.gather}</dd></div>
            <div><dt>行く場所</dt><dd>{item.place}</dd></div>
          </dl>
          {item.start && <p className={styles.start}>競技・式の開始予定 {item.start}</p>}
          {item.belongings && <p className={styles.note}><strong>持ち物・服装</strong> {item.belongings}</p>}
          {item.note && <p className={styles.note}>{item.note}</p>}
          {item.event && <>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} aria-expanded={open?.id === item.id && open.mode === "assembly"} aria-controls={`agenda-guide-${item.id}`} onClick={() => toggle(item.id, "assembly")}>集合場所を確認{open?.id === item.id && open.mode === "assembly" ? " −" : " →"}</button>
              <button type="button" aria-expanded={open?.id === item.id && open.mode === "flow"} aria-controls={`agenda-guide-${item.id}`} onClick={() => toggle(item.id, "flow")}>競技の流れを見る{open?.id === item.id && open.mode === "flow" ? " −" : " →"}</button>
            </div>
            {open?.id === item.id && <div className={styles.expanded} id={`agenda-guide-${item.id}`}><GroundGuide key={`${item.id}-${open.mode}`} embedded initialStudentId={studentId} initialEvent={item.entryLabel} initialSlot={item.slot} initialMode={open.mode}/></div>}
          </>}
        </article>
      </li>)}
    </ol>
  </section>;
}
