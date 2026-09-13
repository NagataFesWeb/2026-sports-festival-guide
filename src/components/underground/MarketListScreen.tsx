"use client";
// 競技（Market）一覧。賭け画面の「前画面」。端末リスト形式で、ENTER で卓に入る
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatClock, formatCountdown, formatPoints } from "@/lib/casino/format";
import type { MarketListView } from "@/lib/casino/view";
import { Cabinet } from "./Cabinet";
import { casinoFKeys, handleSectionKey, LCD_TABS } from "./fkeys";
import { HardwareControls } from "./HardwareControls";
import { Lcd } from "./Lcd";
import { useSound } from "./sound";
import { useServerClock } from "./useServerClock";

const ST_LABEL = { open: "MARKET OPEN", closed: "MARKET CLOSED", settled: "SETTLED" };

export function MarketListScreen({ view }: { view: MarketListView }) {
  const router = useRouter();
  const { blip } = useSound();
  const now = useServerClock(view.serverNow);
  const [cursor, setCursor] = useState(0);
  const [askExit, setAskExit] = useState(false);
  // 初回表示の時刻。これと違う serverNow が届いたら「更新された」とみなす
  const [initialSync] = useState(view.serverNow);

  // F1〜F4・キーボードからのセクション移動（移動前に DISCONNECT の確認を閉じる）
  const sectionNav = {
    push: (href: string) => {
      setAskExit(false);
      router.push(href);
    },
  };

  const rows = view.markets.map((mk) => {
    const rem = Date.parse(mk.deadline) - now;
    return { ...mk, rem, status: mk.status === "open" && rem <= 0 ? ("closed" as const) : mk.status };
  });
  const openRows = rows.filter((r) => r.status === "open");
  const next = [...openRows].sort((a, b) => a.rem - b.rem)[0] ?? null;
  // 自動・手動の更新直後だけ LIVE を UPDATE に変える
  const pulse = view.serverNow !== initialSync && now - Date.parse(view.serverNow) < 900;

  function enter(i: number) {
    const r = rows[i];
    if (!r) return;
    blip(300, 0.06);
    router.push(`/casino/markets/${encodeURIComponent(r.id)}`);
  }

  function move(d: number) {
    const n = rows.length;
    setCursor((c) => (c + d + n) % n);
    blip(560, 0.03);
  }

  function back() {
    blip(240, 0.07);
    setAskExit((v) => !v);
  }

  async function exit() {
    // セッション Cookie を消してから表の会場に戻る。失敗しても遷移は止めない
    try {
      await fetch("/api/casino/logout", { method: "POST" });
    } catch {
      // 通信できなくても Cookie は期限切れで無効になる
    }
    router.push("/");
  }

  function sync() {
    // サーバーコンポーネントを取り直して締切・プールを最新にする
    blip(1250, 0.03);
    router.refresh();
  }

  function onKey(e: KeyboardEvent) {
    if (handleSectionKey(e.key, sectionNav)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      back();
    } else if ((e.key === "r" || e.key === "R") && !askExit) {
      e.preventDefault();
      sync();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      if (askExit) void exit();
      else enter(cursor);
    }
  }

  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    // 締切・プールの更新はサーバーコンポーネントの再取得で反映する
    const t = setInterval(() => router.refresh(), 10_000);
    return () => {
      window.removeEventListener("keydown", h);
      clearInterval(t);
    };
  }, [router]);

  return (
    <Cabinet
      credit={view.account.pointsBalance}
      link="online"
      controls={
        <HardwareControls
          fkeys={casinoFKeys("market", sectionNav)}
          onBack={back}
          onEnter={() => (askExit ? void exit() : enter(cursor))}
          enterHint={askExit ? "DISCONNECT" : "SELECT"}
          enterReady
          led={next && next.rem < 60_000 ? "alert" : "ready"}
        />
      }
    >
      <Lcd
        tabs={LCD_TABS("market")}
        clock={formatClock(now)}
        sync={{
          label: "LAST SYNC",
          time: formatClock(Date.parse(view.serverNow)),
          live: pulse ? "UPDATE" : "LIVE",
          lost: false,
          pulse,
          keyLabel: "[R] SYNC",
          onSync: sync,
        }}
        status={askExit ? "> DISCONNECT? [ENTER] YES ・ [BACK] NO" : "> SELECT MARKET ・ UP/DOWN THEN [ENTER]"}
        statusRight={`OPEN ${String(openRows.length).padStart(2, "0")}`}
        overlay={
          askExit && (
            <div className="ug-pop absolute inset-0 z-[4] flex items-center justify-center bg-[rgba(3,7,2,.88)] p-[18px]">
              <div className="w-full max-w-[392px] border border-lcd-text/50 bg-[rgba(6,11,4,.97)] px-4 pb-3.5 pt-[15px] text-[12.5px] tracking-[.08em] text-lcd-text">
                <div className="mb-3 border-b border-dashed border-lcd-text/20 pb-1.5 text-[10.5px] tracking-[.22em] text-lcd-dim">
                  CONFIRM / DISCONNECT
                </div>
                <div className="text-lcd-hi">&gt; DISCONNECT FROM NODE 79?</div>
                <div className="mt-2 font-jp text-[10.5px] leading-[1.9] text-lcd-dim">
                  接続を切って表の会場に戻る。
                  <br />
                  ベットとクレジットは保持される。
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAskExit(false)}
                    className="min-h-11 flex-1 cursor-pointer border border-lcd-text/45 px-1.5 py-2 text-[11px] tracking-[.18em] text-lcd-text"
                  >
                    NO ・ BACK
                  </button>
                  <button
                    type="button"
                    onClick={() => void exit()}
                    className="min-h-11 flex-1 cursor-pointer border border-lcd-sel bg-lcd-sel px-1.5 py-2 text-[11px] tracking-[.18em] text-lcd-ink"
                  >
                    YES ・ ENTER
                  </button>
                </div>
              </div>
            </div>
          )
        }
      >
        <div className="mb-2.5 flex justify-between gap-3 text-[11px] tracking-[.14em] text-lcd-dim">
          <div>
            NEXT CLOSE{" "}
            <span className={`ug-rgb text-[15px] tracking-[.04em] tabular-nums ${next && next.rem < 5 * 60_000 ? "text-lcd-red" : "text-lcd-hi"}`}>
              {next ? formatCountdown(next.rem) : "--:--:--"}
            </span>{" "}
            <span className="text-lcd-mid">{next ? `${next.no} ${next.en}` : ""}</span>
          </div>
          <div className="flex-none">OPEN {String(openRows.length).padStart(2, "0")}</div>
        </div>
        {rows.map((r, i) => {
          const sel = cursor === i;
          const isNext = next?.id === r.id;
          const closed = r.status === "closed";
          const tag = isNext ? "NEXT" : closed ? "CLOSED" : r.status === "settled" ? "SETTLED" : "";
          const clock =
            r.status === "open" ? `CLOSE ${formatCountdown(r.rem)}` : r.status === "settled" ? `WINNER ${r.winnerName ?? "?"}` : "TALLYING";
          return (
            <button
              key={r.id}
              type="button"
              data-cursor={sel}
              onClick={() => {
                setCursor(i);
                enter(i);
              }}
              onMouseEnter={() => setCursor(i)}
              className={`ug-row mb-[3px] block w-full cursor-pointer border px-2 py-[7px] text-left ${sel ? "ug-sel" : "text-lcd-text"} ${
                isNext ? (next && next.rem < 60_000 ? "border-lcd-red" : "border-lcd-sel") : closed ? "border-lcd-red/25" : "border-transparent"
              } ${closed ? "line-through decoration-1 opacity-55" : ""}`}
            >
              <span className="flex items-baseline gap-2">
                <span className={`w-3 flex-none ${sel ? "text-lcd-ink" : "text-lcd-faint"}`}>{sel ? ">" : " "}</span>
                <span className="flex-none font-display text-[15px] tracking-[.1em]">{r.no}</span>
                <span className="min-w-0 truncate font-display text-[15px] tracking-[.14em]">{r.en}</span>
                <span className={`hidden truncate font-jp text-[11px] sm:inline ${sel ? "text-lcd-ink/70" : "text-lcd-dim"}`}>{r.title}</span>
                {tag && (
                  <span
                    className={`flex-none px-1.5 py-0.5 text-[9px] tracking-[.16em] ${
                      isNext
                        ? next && next.rem < 60_000
                          ? "bg-lcd-red text-lcd-ink"
                          : "bg-lcd-sel text-lcd-ink"
                        : closed ? "bg-lcd-red/85 text-[#160604]" : "bg-lcd-text/20 text-lcd-text"
                    }`}
                  >
                    {tag}
                  </span>
                )}
              </span>
              <span className={`block pl-5 text-[11px] tracking-[.1em] ${sel ? "text-lcd-ink/70" : "text-lcd-dim"}`}>
                {ST_LABEL[r.status]} ・ POOL {formatPoints(r.poolTotal)} C ・ PLAYERS {r.players} ・ {clock}
              </span>
            </button>
          );
        })}
      </Lcd>
    </Cabinet>
  );
}
