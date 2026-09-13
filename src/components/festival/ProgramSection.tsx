"use client";

// トップの「爆裂 PROGRAM」（モック v2 の program とその詳細モーダル）。
// 表示する値はサーバー側（queries.ts）で組み立てたものを受け取るだけにする
import { useEffect, useRef, useState } from "react";
import type { HeatResultView, ProgramStatus } from "@/lib/festival/queries";
import type { Event, Team } from "@/lib/festival/types";

/** 進行状況ごとのカード・タグの色（モックの statusStyle） */
const STATUS_STYLE: Record<ProgramStatus, { label: string; bg: string; fg: string; tagBg: string; tagFg: string }> = {
  live: { label: "進行中", bg: "#FF2D55", fg: "#ffffff", tagBg: "#FFE600", tagFg: "#111111" },
  next: { label: "次", bg: "#FFE600", fg: "#111111", tagBg: "#111111", tagFg: "#FFE600" },
  done: { label: "終了", bg: "#ffffff", fg: "#111111", tagBg: "rgba(17,17,17,.1)", tagFg: "#6f6a63" },
  upcoming: { label: "予定", bg: "#ffffff", fg: "#111111", tagBg: "#245BFF", tagFg: "#ffffff" },
};

const STAT_KEY = "mt-[2px] text-[10px] font-black tracking-[0.18em] text-om-gray-3";
const BLOCK_KEY = "font-display text-[11px] tracking-[0.24em] text-om-pink";
const BLOCK_BODY = "mt-[5px] text-[13.5px] leading-[1.9] text-om-gray-1";

interface ProgramSectionProps {
  events: Event[];
  statuses: Record<string, ProgramStatus>;
  /** 種目 ID → 開始見込みの "HH:MM"（未定なら null） */
  times: Record<string, string | null>;
  teams: Team[];
  /** 種目 ID → ヒートごとの着順 */
  heatResults: Record<string, HeatResultView[]>;
}

export function ProgramSection({ events, statuses, times, teams, heatResults }: ProgramSectionProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const colorById = new Map(teams.map((team) => [team.id, team]));
  const open = events.find((event) => event.id === openId) ?? null;

  useEffect(() => {
    if (openId === null) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      setOpenId(null);
      // Esc で閉じたときも、開いたカードにフォーカスを戻す
      cardRefs.current.get(openId)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  /** 閉じたら開いたカードにフォーカスを戻す */
  function close(id: string): void {
    setOpenId(null);
    cardRefs.current.get(id)?.focus();
  }

  return (
    <section className="bg-om-paper px-[clamp(18px,5vw,60px)] py-[clamp(44px,7vw,90px)]">
      <div className="mx-auto max-w-[1080px]">
        <div className="font-display text-[12px] tracking-[0.34em] text-om-pink">PROGRAM</div>
        <h2 className="mt-[10px] mb-6 font-om-mincho text-[clamp(28px,5.4vw,46px)] font-extrabold">
          爆裂 PROGRAM
        </h2>
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
          {events.map((event) => {
            const style = STATUS_STYLE[statuses[event.id] ?? "upcoming"];
            return (
              <button
                key={event.id}
                type="button"
                ref={(element) => {
                  if (element === null) cardRefs.current.delete(event.id);
                  else cardRefs.current.set(event.id, element);
                }}
                onClick={() => setOpenId(event.id)}
                style={{ background: style.bg, color: style.fg }}
                className="relative cursor-pointer overflow-hidden border-2 border-om-ink px-4 pt-4 pb-[18px] text-left transition-transform duration-200 hover:translate-x-[-3px] hover:translate-y-[-3px] hover:shadow-[6px_6px_0_#111]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-display text-[clamp(40px,7vw,62px)] leading-[0.85]">{event.no}</div>
                  <div
                    style={{ background: style.tagBg, color: style.tagFg }}
                    className="px-2 py-1 text-[9.5px] font-black tracking-[0.14em] whitespace-nowrap"
                  >
                    {style.label}
                  </div>
                </div>
                <div className="mt-2 text-[clamp(15px,2.6vw,18px)] leading-[1.4] font-black">{event.name}</div>
                <div className="mt-[5px] font-display text-[11px] tracking-[0.2em] opacity-60">{event.en}</div>
                <div className="mt-[14px] flex items-baseline justify-between gap-2 text-[11px] font-bold opacity-75">
                  <span className="min-w-0">
                    {times[event.id] ?? "未定"} ・ {event.location}
                  </span>
                  <span className="font-display tracking-[0.16em]">MORE →</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {open !== null ? (
        <div
          onClick={() => close(open.id)}
          className="om-fade fixed inset-0 z-[58] flex items-center justify-center bg-[rgba(17,17,17,.86)] p-[clamp(10px,3vw,28px)]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${open.no} ${open.name}`}
            onClick={(event) => event.stopPropagation()}
            className="om-pop max-h-[min(86vh,880px)] w-full max-w-[860px] overflow-auto border-2 border-t-4 border-om-ink border-t-om-pink bg-om-paper p-[clamp(22px,4vw,40px)] text-om-ink"
          >
            <div className="flex items-start justify-between gap-[14px]">
              <div className="font-display text-[clamp(56px,14vw,120px)] leading-[0.82]">{open.no}</div>
              <button
                type="button"
                ref={closeRef}
                onClick={() => close(open.id)}
                className="min-h-11 cursor-pointer border-2 border-om-ink bg-om-yellow px-3 py-2 font-display text-[12px] tracking-[0.16em]"
              >
                CLOSE ✕
              </button>
            </div>
            <div className="mt-1 font-om-mincho text-[clamp(24px,5vw,40px)] font-extrabold">{open.name}</div>
            <div className="mt-2 font-display text-[clamp(13px,2.4vw,18px)] tracking-[0.22em] text-om-pink">
              {open.en}
            </div>
            {open.participants !== "" ? (
              <div className="mt-3 inline-block border border-om-ink bg-white px-[11px] py-[5px] text-[11px] font-black">
                {open.participants}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3 border-t-2 border-b-2 border-om-ink py-[18px] [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
              <div className="min-w-0">
                <div className="font-display text-[clamp(26px,4.6vw,40px)] leading-none">
                  {times[open.id] ?? "未定"}
                </div>
                <div className={STAT_KEY}>START</div>
              </div>
              <div className="min-w-0">
                <div className="text-[clamp(16px,3vw,24px)] leading-tight font-black">
                  {STATUS_STYLE[statuses[open.id] ?? "upcoming"].label}
                </div>
                <div className={STAT_KEY}>STATUS</div>
              </div>
              <div className="min-w-0">
                <div className="text-[clamp(15px,2.6vw,20px)] leading-tight font-black break-words">
                  {open.location}
                </div>
                <div className={STAT_KEY}>PLACE</div>
              </div>
            </div>

            <div className="mt-5 grid gap-[14px]">
              {open.description !== "" ? (
                <div>
                  <div className={BLOCK_KEY}>内容</div>
                  <div className={BLOCK_BODY}>{open.description}</div>
                </div>
              ) : null}
              <div>
                <div className={BLOCK_KEY}>集合場所</div>
                <div className={BLOCK_BODY}>{open.gatherPlace || "未定"}</div>
              </div>
              <div>
                <div className={BLOCK_KEY}>招集開始</div>
                <div className={BLOCK_BODY}>{open.gatherStart || "未定"}</div>
              </div>
              <div>
                <div className={BLOCK_KEY}>持ち物</div>
                <div className={BLOCK_BODY}>{open.belongings || "（なし）"}</div>
              </div>
              {(heatResults[open.id] ?? []).length > 0 ? (
                <div>
                  <div className={BLOCK_KEY}>着順</div>
                  <div className={BLOCK_BODY}>
                    {(heatResults[open.id] ?? []).map((heat) => (
                      <div key={heat.heatId}>
                        {heat.heatLabel}：
                        {heat.teamNames.map((name, index) => `${index + 1}位 ${name}`).join(" ／ ")}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {open.entries.length > 0 ? (
              <div className="mt-[22px]">
                <div className={BLOCK_KEY}>組み合わせ</div>
                <div className="mt-2 flex flex-wrap gap-[6px]">
                  {open.entries.map((entry) => (
                    <span
                      key={`${entry.slot}-${entry.teamId}`}
                      className="inline-flex items-center gap-2 border border-om-ink bg-white px-[11px] py-[6px] text-[11px] font-black"
                    >
                      <span
                        aria-hidden="true"
                        style={{ background: colorById.get(entry.teamId)?.color ?? "#111" }}
                        className="size-[10px] flex-none"
                      />
                      {entry.slot} {colorById.get(entry.teamId)?.name ?? entry.teamId}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
