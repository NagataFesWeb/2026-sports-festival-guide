"use client";

// マイページの「種目別 招集案内」（モック v2 の callCats / callList）。
// 区分で絞り込み、種目を押すとアコーディオンで招集の詳細と隊形図が開く
import { useState } from "react";
import type { Event, EventKind, Team } from "@/lib/festival/types";
import { GroundOverview } from "@/components/ground-guide/GroundOverview";
import { eventKey } from "@/lib/ground-guide/navigation";

/** 絞り込みチップの並びと EventKind の対応（モックの catList） */
const CATEGORIES: { label: string; kind: EventKind | null }[] = [
  { label: "すべて", kind: null },
  { label: "式典", kind: "ceremony" },
  { label: "トラック", kind: "track" },
  { label: "フィールド", kind: "field" },
  { label: "部活動", kind: "club" },
];

const KIND_LABEL: Record<EventKind, string> = {
  ceremony: "式典",
  track: "トラック",
  field: "フィールド",
  club: "部活動",
};

const CELL = "min-w-0 border border-[rgba(17,17,17,.12)] bg-[#faf8f3] px-3 py-[10px]";
const CELL_KEY = "text-[9.5px] font-black tracking-[0.18em] text-om-gray-3";

interface CallGuideProps {
  events: Event[];
  /** 種目 ID → 開始見込みの "HH:MM" */
  times: Record<string, string | null>;
  /** 招集案内がある種目 ID → 集合時間（CSV の文字列） */
  callTimes: Record<string, string>;
  /** 自分が出場する種目 ID */
  myEventIds: string[];
  teams: Team[];
  /** 自分の組のチーム ID（対象チップを黄で強調する） */
  myTeamId: string | null;
}

export function CallGuide({ events, times, callTimes, myEventIds, teams, myTeamId }: CallGuideProps) {
  const [category, setCategory] = useState<string>("すべて");
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = CATEGORIES.find((item) => item.label === category) ?? CATEGORIES[0];
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const mine = new Set(myEventIds);
  const shown = selected.kind === null ? events : events.filter((event) => event.kind === selected.kind);

  return (
    <section className="min-w-0">
      <h2 className="m-0 mb-1 font-om-mincho text-[clamp(20px,4vw,28px)] font-extrabold">種目別 招集案内</h2>
      <div className="mb-3 text-[12px] text-om-gray-2">
        区分で絞り込み、種目を押すと集合時間・持ち物と、競技全体の集合区分を3Dで確認できます。
      </div>

      <div className="mb-[10px] flex flex-wrap gap-[6px]">
        {CATEGORIES.map((item) => {
          const active = item.label === category;
          return (
            <button
              key={item.label}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setCategory(item.label);
                setOpenId(null);
              }}
              className={`min-h-11 cursor-pointer border-2 border-om-ink px-[13px] text-[11.5px] font-black ${
                active ? "bg-om-ink text-om-yellow" : "bg-white text-om-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="grid min-w-0 gap-[6px]">
        {shown.map((event) => {
          const open = openId === event.id;
          const guideEvent = eventKey(event.name);
          const isMine = mine.has(event.id);
          const accent = open ? "#FF2D55" : isMine ? "#FFE600" : "rgba(17,17,17,.18)";
          const tag = isMine
            ? "自分の出場"
            : event.kind === "ceremony"
              ? "全員参加"
              : event.participants || KIND_LABEL[event.kind];
          const chips =
            event.entries.length > 0
              ? event.entries.map((entry) => ({
                  key: `${entry.slot}-${entry.teamId}`,
                  name: teamById.get(entry.teamId)?.name ?? entry.teamId,
                  own: entry.teamId === myTeamId,
                }))
              : [
                  {
                    key: "all",
                    name:
                      event.kind === "ceremony"
                        ? "全学年 全クラス"
                        : event.kind === "club"
                          ? "全運動部"
                          : event.participants || "全員参加",
                    own: false,
                  },
                ];

          return (
            <div
              key={event.id}
              style={{ borderLeftColor: accent }}
              className="min-w-0 border border-[rgba(17,17,17,.15)] border-l-[6px] bg-white"
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`call-${event.id}`}
                onClick={() => setOpenId(open ? null : event.id)}
                className="grid w-full cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 px-[15px] py-3 text-left"
              >
                <div className={`font-display text-[22px] leading-none ${open ? "text-om-pink" : "text-om-ink"}`}>
                  {event.no}
                </div>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-black">{event.name}</div>
                  <div className="mt-[2px] text-[11.5px] text-om-gray-2">
                    {KIND_LABEL[event.kind]} ・ {times[event.id] ?? "未定"} スタート
                  </div>
                </div>
                <div
                  className={`px-[9px] py-[5px] text-[10px] font-black whitespace-nowrap ${
                    isMine ? "bg-om-pink text-white" : "bg-[rgba(17,17,17,.08)] text-om-gray-2"
                  }`}
                >
                  {tag}
                </div>
              </button>

              {open ? (
                <div id={`call-${event.id}`} className="grid min-w-0 gap-[10px] px-[15px] pb-[15px]">
                  <div className="grid min-w-0 gap-[7px] [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                    <div className={CELL}>
                      <div className={CELL_KEY}>招集開始 目安</div>
                      {callTimes[event.id] !== undefined ? (
                        <>
                          <div className="font-display text-[26px] leading-[1.1] text-om-pink">
                            {callTimes[event.id]}
                          </div>
                          <div className="mt-[2px] text-[11px] text-om-gray-2">{event.gatherStart || "時刻どおり招集"}</div>
                        </>
                      ) : (
                        <div className="mt-1 text-[13px] leading-[1.6] font-black">
                          {event.gatherStart || "時刻どおり招集"}
                        </div>
                      )}
                    </div>
                    <div className={CELL}>
                      <div className={CELL_KEY}>集合場所</div>
                      <div className="mt-1 text-[13px] leading-[1.6] font-black">{event.gatherPlace || "未定"}</div>
                    </div>
                    <div className={CELL}>
                      <div className={CELL_KEY}>持ち物・服装</div>
                      <div className="mt-1 text-[13px] leading-[1.6] font-black">{event.belongings || "なし"}</div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className={`${CELL_KEY} mb-[5px]`}>対象</div>
                    <div className="flex flex-wrap gap-[5px]">
                      {chips.map((chip) => (
                        <span
                          key={chip.key}
                          className={`border border-om-ink px-[10px] py-[5px] text-[11px] font-black text-om-ink ${
                            chip.own ? "bg-om-yellow" : "bg-white"
                          }`}
                        >
                          {chip.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {guideEvent ? <GroundOverview key={event.id} event={guideEvent}/> : <p className="text-[13px]">この種目の3D配置は未登録です。集合場所は上の案内を確認してください。</p>}

                  {event.formationNote !== "" ? (
                    <div className="text-[11.5px] leading-[1.9] text-om-gray-2">{event.formationNote}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
