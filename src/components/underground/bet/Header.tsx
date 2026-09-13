"use client";
// 賭け画面の上部：STATUS（残高・借金）／ EVENT HEADER（競技・締切）／ 賭式タブ ／ 結果
import type { BetKind, MarketStatus } from "@/lib/casino/types";
import { KIND_EN, KIND_JP } from "./labels";

export function StatusBar({ balance, debt, hasDebt, onBack }: { balance: string; debt: string; hasDebt: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4 text-[10.5px] tracking-[.18em] text-lcd-dim">
      <div className="flex items-baseline gap-[18px]">
        <div>
          BALANCE <span className="text-[17px] tracking-[.02em] tabular-nums text-lcd-hi">{balance}</span> C
        </div>
        <div>
          DEBT <span className={`text-[17px] tracking-[.02em] tabular-nums ${hasDebt ? "text-lcd-red" : "text-lcd-faint"}`}>{debt}</span> C
        </div>
      </div>
      <button type="button" onClick={onBack} className="flex-none cursor-pointer py-1 tracking-[.22em] text-lcd-mid">
        ‹ EVENTS
      </button>
    </div>
  );
}

const STATUS_LABEL: Record<MarketStatus, { label: string; cls: string }> = {
  open: { label: "BET CLOSE", cls: "text-lcd-dim" },
  closed: { label: "CLOSED", cls: "text-lcd-red" },
  settled: { label: "SETTLED", cls: "text-lcd-hi" },
};

export function EventHeader({
  no,
  title,
  sub,
  status,
  clock,
  urgent,
}: {
  no: string;
  title: string;
  sub: string;
  status: MarketStatus;
  clock: string;
  urgent: boolean;
}) {
  const st = STATUS_LABEL[status];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="ug-rgb font-display text-[clamp(22px,6.4vw,34px)] tracking-[.06em] text-lcd-hi">{no}</span>
          <h1 className="m-0 font-jp text-[clamp(14px,3.8vw,19px)] font-bold text-lcd-hi">{title}</h1>
        </div>
        <div className="mt-[3px] text-[10px] tracking-[.2em] text-lcd-dim">{sub}</div>
      </div>
      <div className="flex-none text-right">
        <div className={`text-[10px] tracking-[.26em] ${st.cls}`}>{st.label}</div>
        <div
          className={`ug-rgb text-[clamp(20px,5.6vw,28px)] tracking-[.04em] tabular-nums ${
            status === "closed" || urgent ? "text-lcd-red" : "text-lcd-hi"
          }`}
        >
          {clock}
        </div>
      </div>
    </div>
  );
}

export function BetTypeTabs({ kinds, current, onSelect }: { kinds: BetKind[]; current: BetKind; onSelect: (k: BetKind) => void }) {
  return (
    <div role="tablist" aria-label="賭式" className="mt-3 flex overflow-x-auto border-b border-lcd-text/20 [scrollbar-width:none]">
      {kinds.map((k) => {
        const on = k === current;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(k)}
            className={`flex min-h-11 flex-none cursor-pointer flex-col justify-center gap-px border-b-2 px-4 pb-[7px] pt-1.5 ${
              on ? "border-lcd-sel bg-lcd-sel/15 text-lcd-hi" : "border-transparent text-lcd-dim"
            }`}
          >
            <span className="text-[11px] tracking-[.22em]">{KIND_EN[k]}</span>
            <span className="font-jp text-[10px] tracking-[.12em] opacity-75">{KIND_JP[k]}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SettledPanel({ winner, payRate, myResult, hit }: { winner: string; payRate: string; myResult: string; hit: boolean }) {
  return (
    <div className="mt-3 border border-lcd-text/40 px-[11px] py-[9px]">
      <div className="text-[10px] tracking-[.26em] text-lcd-dim">WINNER</div>
      <div className="font-display text-[clamp(19px,5vw,28px)] tracking-[.06em] text-lcd-hi">{winner}</div>
      <div className="mt-[3px] text-[11.5px] text-lcd-mid">
        単勝 PAYOUT <span className="text-[15px] text-lcd-hi">{payRate}x</span> ・ YOUR RESULT{" "}
        <span className={`text-[15px] ${hit ? "text-lcd-ok" : "text-lcd-red"}`}>{myResult}</span>
      </div>
    </div>
  );
}
