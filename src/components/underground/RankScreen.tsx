"use client";
// F4 RANK：純資産の順位。最終精算前は自分の順位だけ、精算後は全体の順位表を出す（仕様書 機能9）
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { formatClock, formatPoints } from "@/lib/casino/format";
import type { RankView } from "@/lib/casino/view";
import { Cabinet } from "./Cabinet";
import { casinoFKeys, handleSectionKey, LCD_TABS } from "./fkeys";
import { HardwareControls } from "./HardwareControls";
import { Lcd } from "./Lcd";
import { useSound } from "./sound";
import { useServerClock } from "./useServerClock";

/** 符号つきの表示（表示専用） */
function signed(n: number): string {
  return `${n < 0 ? "-" : ""}${formatPoints(Math.abs(n))}`;
}

export function RankScreen({ view }: { view: RankView }) {
  const router = useRouter();
  const { blip } = useSound();
  const now = useServerClock(view.serverNow);

  function onKey(e: KeyboardEvent) {
    if (handleSectionKey(e.key, router)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape" || e.key === "Enter") {
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

  return (
    <Cabinet
      credit={view.account.pointsBalance}
      link="online"
      controls={
        <HardwareControls
          fkeys={casinoFKeys("rank", router)}
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
          led={view.finalized ? "armed" : "ready"}
        />
      }
    >
      <Lcd
        tabs={LCD_TABS("rank")}
        clock={formatClock(now)}
        subTitle={view.finalized ? "STANDINGS / FINAL" : "STANDINGS / PROVISIONAL"}
        status={
          view.finalized
            ? `> FINAL RANKING ・ ${view.total} ACCOUNT(S)`
            : "> FINAL RANKING SEALED UNTIL SETTLEMENT"
        }
        statusRight={`RANK ${view.myRank} / ${view.total}`}
      >
        {/* 自分の現在値は精算前でも常に出す */}
        <div className="border border-lcd-text/40 px-[11px] py-[9px]">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] tracking-[.26em] text-lcd-dim">MY NET WORTH</div>
            <div className="text-[10px] tracking-[.2em] text-lcd-dim">
              RANK <span className="text-[17px] tabular-nums text-lcd-hi">{view.myRank}</span> / {view.total}
            </div>
          </div>
          <div className={`text-[clamp(24px,7vw,36px)] tabular-nums ${view.myNetWorth < 0 ? "text-lcd-red" : "text-lcd-hi"}`}>
            {signed(view.myNetWorth)} C
          </div>
          <div className="mt-[3px] text-[10.5px] tracking-[.14em] text-lcd-mid">
            CREDIT {formatPoints(view.account.pointsBalance)} C ・ DEBT{" "}
            <span className={view.account.debtAmount > 0 ? "text-lcd-red" : "text-lcd-faint"}>
              {formatPoints(view.account.debtAmount)}
            </span>{" "}
            C
          </div>
          <div className="mt-1 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">
            純資産 = 所持クレジット − 借金額。{view.finalized ? "最終精算済みの確定値。" : "結果確定・利子で変動する暫定値。"}
          </div>
        </div>

        {!view.finalized ? (
          <div className="mt-3 border border-lcd-text/30 px-[11px] py-[13px]">
            <div className="text-[11px] tracking-[.22em] text-lcd-mid">FINAL RANKING SEALED UNTIL SETTLEMENT</div>
            <div className="mt-1.5 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">
              全体の順位表は最終精算のあとに公開する。今は自分の暫定順位だけ確認できる。
            </div>
          </div>
        ) : (
          <>
            <div className="mb-[7px] mt-3.5 flex gap-2 border-b border-dashed border-lcd-text/25 pb-1 text-[9.5px] tracking-[.16em] text-lcd-dim">
              <span className="w-8 flex-none text-right">#</span>
              <span className="w-[68px] flex-none">ID</span>
              <span className="min-w-0 flex-1">NAME</span>
              <span className="w-[76px] flex-none text-right">NET</span>
              <span className="hidden w-[76px] flex-none text-right sm:inline">CREDIT</span>
              <span className="hidden w-[68px] flex-none text-right sm:inline">DEBT</span>
            </div>
            {view.rows.map((r) => (
              <div
                key={r.studentId}
                className={`mb-px flex gap-2 px-1 py-[5px] text-[11.5px] ${r.me ? "ug-sel" : "text-lcd-text"}`}
              >
                <span className={`w-8 flex-none text-right tabular-nums ${r.me ? "text-lcd-ink" : "text-lcd-hi"}`}>{r.rank}</span>
                <span className="w-[68px] flex-none tabular-nums">{r.studentId}</span>
                <span className="min-w-0 flex-1 truncate font-jp">{r.displayName}</span>
                <span
                  className={`w-[76px] flex-none text-right tabular-nums ${
                    r.me ? "text-lcd-ink" : r.netWorth < 0 ? "text-lcd-red" : "text-lcd-hi"
                  }`}
                >
                  {signed(r.netWorth)}
                </span>
                <span className={`hidden w-[76px] flex-none text-right tabular-nums sm:inline ${r.me ? "text-lcd-ink/70" : "text-lcd-mid"}`}>
                  {formatPoints(r.pointsBalance)}
                </span>
                <span
                  className={`hidden w-[68px] flex-none text-right tabular-nums sm:inline ${
                    r.me ? "text-lcd-ink/70" : r.debtAmount > 0 ? "text-lcd-red" : "text-lcd-faint"
                  }`}
                >
                  {formatPoints(r.debtAmount)}
                </span>
              </div>
            ))}
            <div className="mt-2 font-jp text-[10px] leading-[1.8] text-lcd-dim">
              CREDIT・DEBT は最終精算の直前に記録した所持ポイントと借金額。同じ純資産なら同順位。
              NAME は口座作成時に登録したニックネーム。
            </div>
          </>
        )}
      </Lcd>
    </Cabinet>
  );
}
