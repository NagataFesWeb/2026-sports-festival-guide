"use client";
// F3 HISTORY：自分のベット履歴。Market ごとにまとめ、当落と収支を表示する（集計はサーバー側で計算済み）
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatClock, formatPoints } from "@/lib/casino/format";
import type { MarketStatus } from "@/lib/casino/types";
import type { HistoryView } from "@/lib/casino/view";
import { KIND_JP } from "./bet/labels";
import { Cabinet } from "./Cabinet";
import { casinoFKeys, handleSectionKey, LCD_TABS } from "./fkeys";
import { HardwareControls } from "./HardwareControls";
import { Lcd } from "./Lcd";
import { useSound } from "./sound";
import { useServerClock } from "./useServerClock";
import { useVisibleRefresh } from "./useVisibleRefresh";

const STATUS_LABEL: Record<MarketStatus, string> = { open: "OPEN", closed: "TALLYING", settled: "SETTLED" };

export function HistoryScreen({ view }: { view: HistoryView }) {
  useVisibleRefresh();
  const router = useRouter();
  const { blip } = useSound();
  const now = useServerClock(view.serverNow);

  function onKey(e: KeyboardEvent) {
    if (handleSectionKey(e.key, router)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape" || (e.key === "Enter" && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement))) {
      e.preventDefault();
      router.push("/casino");
    }
  }

  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const hasBets = view.groups.length > 0;

  return (
    <Cabinet
      credit={view.account.pointsBalance}
      link="online"
      controls={
        <HardwareControls
          fkeys={casinoFKeys("history", router)}
          onBack={() => {
            blip(300, 0.07);
            router.push("/casino");
          }}
          onEnter={() => {
            blip(300, 0.06);
            router.push("/casino");
          }}
          enterHint="MARKETS"
          enterReady
          led={view.net >= 0 ? "ready" : "alert"}
        />
      }
    >
      <Lcd
        tabs={LCD_TABS("history")}
        clock={formatClock(now)}
        subTitle="MY BETS / LEDGER"
        status={hasBets ? `> ${view.groups.length} MARKET(S) ・ ${statusTotal(view)}` : "> NO BETS ON RECORD"}
        statusRight={`NET ${view.net >= 0 ? "+" : "-"}${formatPoints(Math.abs(view.net))} C`}
      >
        <div className="flex flex-wrap items-baseline gap-x-[22px] gap-y-1 text-[10.5px] tracking-[.18em] text-lcd-dim">
          <div>
            STAKED <span className="text-[17px] tracking-[.02em] tabular-nums text-lcd-hi">{formatPoints(view.stakeTotal)}</span> C
          </div>
          <div>
            RETURNED <span className="text-[17px] tracking-[.02em] tabular-nums text-lcd-hi">{formatPoints(view.payoutTotal)}</span> C
          </div>
          <div>
            NET{" "}
            <span className={`text-[17px] tracking-[.02em] tabular-nums ${view.net >= 0 ? "text-lcd-ok" : "text-lcd-red"}`}>
              {view.net >= 0 ? "+" : "-"}
              {formatPoints(Math.abs(view.net))}
            </span>{" "}
            C
          </div>
        </div>
        <div className="mt-1 font-jp text-[10.5px] leading-[1.9] text-lcd-dim">
          賭け金合計 {formatPoints(view.stakeTotal)} C ・ 払戻合計 {formatPoints(view.payoutTotal)} C ・ 収支{" "}
          {view.net >= 0 ? "+" : "−"}
          {formatPoints(Math.abs(view.net))} C（未確定分の払戻は 0 として計算）
        </div>
        <div className="mb-[11px] mt-[9px] h-px bg-lcd-text/20" />

        {!hasBets && (
          <div className="border border-lcd-text/30 px-[11px] py-[13px]">
            <div className="text-[11px] tracking-[.22em] text-lcd-mid">NO BETS ON RECORD</div>
            <div className="mt-1.5 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">
              まだベットしていない。F1 MARKET から競技を選んで賭ける。
            </div>
          </div>
        )}

        {view.groups.map((g) => {
          const groupNet = g.payoutTotal - g.stakeTotal;
          const settled = g.status === "settled";
          return (
            <div key={g.marketId} className="mb-2.5 border border-lcd-text/25 px-2.5 py-2">
              <button
                type="button"
                onClick={() => {
                  blip(300, 0.06);
                  router.push(`/casino/markets/${encodeURIComponent(g.marketId)}`);
                }}
                className="flex min-h-11 w-full cursor-pointer items-baseline gap-2 text-left"
              >
                <span className="flex-none font-display text-[15px] tracking-[.1em] text-lcd-hi">{g.no}</span>
                <span className="min-w-0 truncate font-display text-[14px] tracking-[.14em] text-lcd-hi">{g.en}</span>
                <span className="min-w-0 truncate font-jp text-[10.5px] text-lcd-dim">{g.title}</span>
                <span
                  className={`ml-auto flex-none px-1.5 py-0.5 text-[9px] tracking-[.16em] ${
                    settled ? "bg-lcd-text/20 text-lcd-text" : g.status === "closed" ? "bg-lcd-red/85 text-[#160604]" : "bg-lcd-sel text-lcd-ink"
                  }`}
                >
                  {STATUS_LABEL[g.status]}
                </span>
              </button>
              {g.bets.map((b) => {
                const hit = b.payoutAmount !== null && b.payoutAmount > 0;
                const miss = b.payoutAmount !== null && b.payoutAmount === 0;
                return (
                  <div key={b.id} className="flex flex-wrap items-baseline gap-x-2.5 border-t border-dashed border-lcd-text/15 py-[5px] text-[11.5px]">
                    <span className="flex-none font-jp text-[10.5px] tracking-[.1em] text-lcd-dim">{KIND_JP[b.kind]}</span>
                    <span className="min-w-0 flex-1 truncate font-jp text-lcd-text">{b.selectionNames.join(" → ")}</span>
                    <span className="flex-none tabular-nums text-lcd-mid">{formatPoints(b.amount)} C</span>
                    <span
                      className={`w-[104px] flex-none text-right tabular-nums ${
                        hit ? "text-lcd-ok" : miss ? "text-lcd-red" : "text-lcd-faint"
                      }`}
                    >
                      {hit ? `HIT +${formatPoints(b.payoutAmount ?? 0)}` : miss ? "MISS" : "PENDING"}
                    </span>
                  </div>
                );
              })}
              <div className="border-t border-lcd-text/15 pt-[5px] text-[10px] tracking-[.16em] text-lcd-dim">
                STAKE {formatPoints(g.stakeTotal)} C ・ RETURN {formatPoints(g.payoutTotal)} C ・ NET{" "}
                <span className={groupNet >= 0 ? "text-lcd-ok" : "text-lcd-red"}>
                  {groupNet >= 0 ? "+" : "-"}
                  {formatPoints(Math.abs(groupNet))} C
                </span>
              </div>
            </div>
          );
        })}
      </Lcd>
    </Cabinet>
  );
}

/** ステータス行に出す短い集計（表示専用） */
function statusTotal(view: HistoryView): string {
  return `STAKED ${formatPoints(view.stakeTotal)} C ・ RETURNED ${formatPoints(view.payoutTotal)} C`;
}
