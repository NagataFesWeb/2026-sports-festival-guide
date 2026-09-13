"use client";

import { useState } from "react";
import { GroundGuide } from "@/components/ground-guide/GroundGuide";
import { eventKey } from "@/lib/ground-guide/navigation";
// 「自分の出場競技」。出場競技表（data/学籍番号別出場競技.csv → 静的データ）だけで描くので
// DB を待たずに即表示できる。表示する値の組み立ては src/lib/festival/entries.ts 側で済ませる
import type { StudentEntry } from "@/lib/festival/entries";

/** 左ボーダーの色（モックの accent。ピンク→黄→青の繰り返し） */
const ACCENTS: string[] = ["#FF2D55", "#FFE600", "#245BFF"];

interface MyEntriesProps {
  /** 出場競技。出場競技表に無い学籍番号なら null */
  entries: StudentEntry[] | null;
  /** 出場競技表の版（差し替えの確認用） */
  version: string;
  studentId: string;
}

export function MyEntries({ entries, version, studentId }: MyEntriesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className="min-w-0">
      <h1 className="m-0 mb-1 font-om-mincho text-[clamp(20px,4vw,28px)] font-extrabold">自分の出場競技</h1>
      {/* 下の「自分の招集案内」「出場種目」と種目名が重なるので、各セクションの役割を一言で書く */}
      <div className="mb-3 text-[12px] text-om-gray-2">出場競技表から。競技ごとの自分の枠が分かります。</div>

      {entries === null ? (
        <div className="border-2 border-om-ink bg-white p-4">
          <p className="m-0 text-[15px] font-black">この学籍番号は出場競技表にありません</p>
          <p className="mt-2 mb-0 text-[12.5px] leading-[1.9] text-om-gray-2">
            番号の入力ちがいがないか確認してください。正しいのに出ない場合は、実行委員に伝えてください。
          </p>
        </div>
      ) : (
        <div className="grid gap-[6px]">
          {entries.map((entry, index) => (
            <div
              key={`${entry.event}/${entry.slot}/${index}`}
              style={{ borderLeftColor: ACCENTS[index % ACCENTS.length] }}
              className="grid grid-cols-[1fr_auto] items-center gap-[14px] border border-[rgba(17,17,17,.15)] border-l-[6px] bg-white px-4 py-[13px]"
            >
              <div className="min-w-0 text-[15px] font-black break-words">{entry.event}</div>
              {/* 枠は右の札だけに出す（本文にも書くと同じ文字が 2 回並ぶ） */}
              {entry.slot !== "" ? (
                <div className="text-right">
                  <div className="text-[9px] font-black tracking-[0.2em] text-om-gray-3">あなたは</div>
                  <div className="mt-[3px] bg-om-ink px-[9px] py-[5px] text-[13px] font-black whitespace-nowrap text-om-paper">
                    {entry.slot}
                  </div>
                </div>
              ) : (
                <div />
              )}
              {eventKey(entry.event) && <div className="col-span-2 min-w-0">
                <button type="button" aria-expanded={openIndex === index} aria-controls={`entry-guide-${index}`}
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="min-h-11 cursor-pointer border-2 border-om-ink bg-om-yellow px-3 text-[13px] font-black">
                  {openIndex === index ? "3D案内を閉じる" : "集合場所・移動を3Dで確認"}
                </button>
                {openIndex === index && <div id={`entry-guide-${index}`} className="mt-3">
                  <GroundGuide key={`${studentId}/${index}`} embedded initialStudentId={studentId} initialEvent={entry.event} initialSlot={entry.slot}/>
                </div>}
              </div>}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 mb-0 font-display text-[10px] tracking-[0.18em] text-om-gray-3">
        ENTRY LIST {version}
      </p>
    </section>
  );
}
