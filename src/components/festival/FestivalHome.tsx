// 表画面トップ（機能1・2・3の入口）。モック v2「爆裂」の isTop をそのまま移植したもの。
// 裏画面への導線はフッターの「79」の連打だけ
import { cache, Suspense } from "react";
import { HomeExperience } from "@/components/festival/HomeExperience";
import { DeveloperPanel } from "@/components/underground/DeveloperPanel";
import { formatHourMinute } from "@/components/festival/format";
import { FESTIVAL_DAY } from "@/lib/festival/festival-day";
import { Hero } from "@/components/festival/Hero";
import { IdSearchForm } from "@/components/festival/IdSearchForm";
import { LoadingOverlay } from "@/components/festival/LoadingOverlay";
import { ProgramSection } from "@/components/festival/ProgramSection";
import { SiteFooter } from "@/components/festival/SiteFooter";
import { getTopPageData, heatResultViews, type HeatResultView } from "@/lib/festival/queries";

/** ABOUT の 3 つの数値 */
const KPI_KEYS: ["players", "teams", "programs"] = ["players", "teams", "programs"];
const KPI_LABEL: Record<string, string> = { players: "PLAYERS", teams: "TEAMS", programs: "PROGRAMS" };

/** タイムラインの色（モックの timeline） */
const TIMELINE_DOT: Record<string, string> = {
  live: "#FF2D55",
  next: "#FFE600",
  done: "rgba(245,242,233,.35)",
  upcoming: "rgba(245,242,233,.35)",
};
const TIMELINE_TIME: Record<string, string> = {
  live: "#FF2D55",
  next: "#FFE600",
  done: "rgba(245,242,233,.55)",
  upcoming: "rgba(245,242,233,.55)",
};

const loadTopData = cache(async () => getTopPageData(new Date()));

// 見出し・入力欄はDBを待たず表示し、プログラムと総合順位を後から流す。
export function FestivalHome({ staticPreview = false }: { staticPreview?: boolean }) {
  return (
    <HomeExperience><div className="om-page">
      {process.env.NODE_ENV === "development" && <DeveloperPanel />}
      <LoadingOverlay />
      <Hero dateLabel={FESTIVAL_DAY.dateLabel} openLabel={<Suspense fallback={`${FESTIVAL_DAY.opening} 開会`}><OpeningLabel /></Suspense>} />
      <section className="border-b-2 border-om-ink bg-om-paper px-[clamp(18px,5vw,60px)] py-6">
        <div className="mx-auto grid max-w-[1080px] gap-3">
          <h2 className="text-[20px] font-black">当日の集合を確認する</h2>
          <p className="text-[16px] leading-relaxed">{FESTIVAL_DAY.arrival} 登校完了 ／ {FESTIVAL_DAY.gathering} グラウンド集合 ／ {FESTIVAL_DAY.rollCall} 点呼完了</p>
          <IdSearchForm tone="page" buttonLabel="自分の案内を見る →" inputId="top-student-id" disabled={staticPreview}/>
          <p className="text-[16px]">昼休み {FESTIVAL_DAY.lunch} ／ 閉会式 {FESTIVAL_DAY.closing}〜</p>
        </div>
      </section>

      <Suspense fallback={<section aria-label="プログラム読み込み中" className="bg-om-paper px-6 py-12"><p role="status">プログラムを読み込み中…</p></section>}><TopContent /></Suspense>
      {/* ---- CTA ---- */}
      <section className="bg-om-pink px-[clamp(18px,5vw,60px)] py-[clamp(40px,7vw,80px)] text-white">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="font-om-mincho text-[clamp(22px,4.4vw,36px)] font-extrabold">自分の招集案内を見る</div>
            <div className="mt-[7px] text-[12.5px] opacity-85">
              {staticPreview ? "GitHub Pages の暫定公開版では、個人別の招集案内は利用できません。" : "学籍番号を入力すると、集合のタイミングと行く場所が分かります。"}
            </div>
          </div>
          <div className="w-full max-w-[360px] min-w-0">
            <IdSearchForm tone="cta" buttonLabel="CHECK IT OUT →" disabled={staticPreview} />
          </div>
        </div>
      </section>

      <SiteFooter staticPreview={staticPreview} />
    </div></HomeExperience>
  );
}

async function OpeningLabel() {
  const { events, starts } = await loadTopData();
  return <>{(events[0] && formatHourMinute(starts[events[0].id])) || FESTIVAL_DAY.opening} 開会</>;
}

async function TopContent() {
  // 総合順位・進行状況は毎リクエストで読み直す（通常版はビルド時に固めない）。
  const { teams, events, results, statuses, starts, standings, counts } = await loadTopData();

  // 時刻の整形と着順の組み立てはサーバー側で済ませ、クライアントには文字列だけを渡す
  const times: Record<string, string | null> = {};
  const heatResults: Record<string, HeatResultView[]> = {};
  for (const event of events) {
    times[event.id] = formatHourMinute(starts[event.id]);
    heatResults[event.id] = heatResultViews(event, results, teams);
  }
  const first = events.length > 0 ? times[events[0].id] : null;
  const last = events.length > 0 ? times[events[events.length - 1].id] : null;

  return <>
      {/* ---- ABOUT ---- */}
      <section className="bg-om-paper px-[clamp(18px,5vw,60px)] py-[clamp(46px,8vw,96px)]">
        <div className="mx-auto grid max-w-[1080px] items-center gap-[clamp(22px,4vw,44px)] [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          <div data-reveal="rise" className="min-w-0">
            <div className="font-display text-[12px] tracking-[0.34em] text-om-pink">ABOUT</div>
            <h2 className="mt-[10px] font-om-mincho text-[clamp(28px,5.4vw,46px)] leading-[1.25] font-extrabold">
              体育祭とは
            </h2>
            <p className="mt-4 max-w-[34em] text-[14px] leading-[2] text-pretty text-om-gray-1">
              3学年をまたいだ8色の対抗戦。全校960人が1日でぶつかる。開会式8:45、閉会式14:20。勝敗は得点で決まり、記憶は声で決まる。
            </p>
            <div className="mt-[26px] flex flex-wrap gap-[26px]">
              {KPI_KEYS.map((key) => (
                <div key={key}>
                  <div
                    className={`font-display text-[clamp(30px,5vw,46px)] leading-none ${key === "programs" ? "text-om-pink" : ""}`}
                  >
                    {counts[key]}
                  </div>
                  <div className="text-[10px] font-black tracking-[0.2em] text-om-gray-3">{KPI_LABEL[key]}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative min-w-0">
            <div className="om-stripes flex aspect-[4/3] max-w-full items-center justify-center border-2 border-om-ink">
              <div className="text-center font-mono text-[11px] leading-[1.9] text-[#7a756d]">
                ［写真］
                <br />
                全力疾走 / バトンパス
                <br />
                1600×1200 推奨
              </div>
            </div>
            <div className="absolute -bottom-4 -left-[10px] rotate-[-4deg] border-2 border-om-ink bg-om-pink px-[14px] py-[6px] font-display text-[clamp(16px,3vw,26px)] tracking-[0.1em] text-white">
              BAKURETSU
            </div>
            <div className="om-drift absolute -top-[14px] -right-2 flex size-11 items-center justify-center border-2 border-om-ink bg-om-yellow text-[20px]">
              ★
            </div>
          </div>
        </div>
      </section>

      {/* ---- 爆裂 8 CLASSES ---- */}
      <section className="bg-om-ink px-[clamp(18px,5vw,60px)] py-[clamp(40px,7vw,84px)] text-om-paper">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-2 flex flex-wrap items-baseline gap-[14px]">
            <h2 className="font-display text-[clamp(26px,5vw,44px)] tracking-[0.04em]">爆裂 8 CLASSES</h2>
            {standings === null ? (
              <span className="text-[11px] font-black tracking-[0.12em] text-om-yellow">総合順位は閉会式で公開</span>
            ) : (
              <span className="text-[11px] font-black tracking-[0.12em] text-om-yellow">総合成績</span>
            )}
          </div>
          {standings === null ? (
            <div className="mb-[22px] text-[12.5px] text-[rgba(245,242,233,.5)]">
              当日の途中経過は非公開。閉会式の総合成績発表で一斉に出ます。
            </div>
          ) : (
            <div className="mb-[22px] text-[12.5px] text-[rgba(245,242,233,.5)]">
              閉会式で発表した最終の総合成績です。
            </div>
          )}

          <div className="grid gap-[6px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
            {standings === null
              ? teams.map((team) => (
                  <div
                    key={team.id}
                    data-reveal="left" className="flex items-center gap-3 border border-[rgba(245,242,233,.14)] bg-[rgba(245,242,233,.03)] px-4 py-[14px]"
                  >
                    <span aria-hidden="true" style={{ background: team.color }} className="size-[14px] flex-none" />
                    <span className="min-w-0 text-[14px] font-black">{team.name}</span>
                  </div>
                ))
              : standings.map((row) => (
                  <div
                    key={row.team.id}
                    className={`om-rise-l flex items-center gap-3 border bg-[rgba(245,242,233,.03)] px-4 py-[14px] ${
                      row.rank === 1 ? "border-om-yellow" : "border-[rgba(245,242,233,.14)]"
                    }`}
                  >
                    <span
                      className={`font-display text-[22px] leading-none ${row.rank === 1 ? "text-om-yellow" : ""}`}
                    >
                      {row.rank}
                    </span>
                    <span aria-hidden="true" style={{ background: row.team.color }} className="size-[14px] flex-none" />
                    <span className="min-w-0 flex-1 truncate text-[14px] font-black">{row.team.name}</span>
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* ---- 爆裂 PROGRAM ---- */}
      <ProgramSection
        events={events}
        statuses={statuses}
        times={times}
        teams={teams}
        heatResults={heatResults}
      />

      {/* ---- TIMETABLE ---- */}
      <section className="bg-om-ink px-[clamp(18px,5vw,60px)] py-[clamp(44px,7vw,90px)] text-om-paper">
        <div className="mx-auto max-w-[820px]">
          <div className="font-display text-[12px] tracking-[0.34em] text-om-yellow">TIMETABLE</div>
          <h2 className="mt-[10px] mb-7 font-display text-[clamp(26px,5vw,44px)] tracking-[0.04em]">
            {first ?? "--:--"} → {last ?? "--:--"}
          </h2>
          <div className="grid">
            {events.map((event) => {
              const status = statuses[event.id] ?? "upcoming";
              return (
                <div data-reveal="rise" key={event.id} className="grid grid-cols-[74px_24px_1fr] items-start gap-3">
                  <div
                    style={{ color: TIMELINE_TIME[status] }}
                    className="pt-3 font-display text-[15px] tracking-[0.06em]"
                  >
                    {times[event.id] ?? "--:--"}
                  </div>
                  <div className="flex h-full flex-col items-center">
                    <div
                      aria-hidden="true"
                      style={{ background: TIMELINE_DOT[status], boxShadow: `0 0 0 2px ${TIMELINE_DOT[status]}` }}
                      className="mt-[13px] size-[13px] flex-none rounded-full border-2 border-om-ink"
                    />
                    <div className="min-h-[26px] w-[2px] flex-1 bg-[rgba(245,242,233,.2)]" />
                  </div>
                  <div className="min-w-0 pt-[9px] pb-[14px]">
                    <div
                      className={`text-[14.5px] font-black ${status === "done" ? "text-[rgba(245,242,233,.5)]" : "text-om-paper"}`}
                    >
                      {event.name}
                    </div>
                    <div className="mt-[3px] font-display text-[10.5px] tracking-[0.2em] text-[rgba(245,242,233,.4)]">
                      {event.en}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

  </>;
}
