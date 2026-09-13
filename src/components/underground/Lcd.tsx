"use client";
// 液晶（LCD）：タブ・時計・同期表示・本文・ステータス行。立体的なボタンは置かない
import type { ReactNode } from "react";

export interface LcdTab {
  label: string;
  active: boolean;
}

export interface LcdSync {
  label: string;
  time: string;
  live: string;
  lost: boolean;
  /** 自動・手動の更新直後（約 0.9 秒）。LIVE 表示を明るく点す */
  pulse?: boolean;
  keyLabel: string;
  onSync: () => void;
}

export function Lcd({
  tabs,
  clock,
  sync,
  subTitle,
  status,
  statusAlert,
  statusRight,
  overlay,
  boot,
  children,
}: {
  tabs: LcdTab[];
  clock: string;
  sync?: LcdSync;
  subTitle?: string;
  status: string;
  statusAlert?: boolean;
  statusRight: string;
  overlay?: ReactNode;
  boot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ug-lcd">
      {overlay}
      <div className="ug-lcd-body" data-lcd>
        {boot ? boot : <>
        <div className="mb-3 flex items-center justify-between gap-2.5 border-b border-dashed border-lcd-text/25 pb-[7px] text-[11px] tracking-[.14em]">
          <div className="flex min-w-0 overflow-x-auto [scrollbar-width:none]">
            {tabs.map((t) => (
              <span
                key={t.label}
                className={`flex-none whitespace-nowrap px-[7px] py-0.5 tracking-[.12em] ${t.active ? "ug-sel" : "text-lcd-dim"}`}
              >
                {t.label}
              </span>
            ))}
          </div>
          <div className="flex-none text-right">
            <div className="tabular-nums text-lcd-mid" suppressHydrationWarning>
              {clock}
            </div>
            {sync && (
              <button
                type="button"
                onClick={sync.onSync}
                className="mt-[3px] flex cursor-pointer items-center justify-end gap-2 text-[9px] tracking-[.13em]"
              >
                <span className="whitespace-nowrap text-lcd-faint" suppressHydrationWarning>
                  {sync.label} {sync.time}
                </span>
                <span className={`inline-flex items-center gap-1 whitespace-nowrap ${sync.lost ? "text-lcd-red" : sync.pulse ? "text-lcd-hi" : "text-lcd-ok"}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_6px_currentColor]" />
                  {sync.live}
                </span>
                <span className={`whitespace-nowrap ${sync.lost ? "text-lcd-red" : "text-lcd-dim"}`}>{sync.keyLabel}</span>
              </button>
            )}
          </div>
        </div>
        {subTitle && <div className="-mt-1.5 mb-2.5 text-[10.5px] tracking-[.2em] text-lcd-dim">{subTitle}</div>}
        {children}
        <div className="h-6" />
        </>}
      </div>
      <div
        role="status"
        aria-live="polite"
        className="relative z-[4] flex flex-none justify-between gap-2.5 border-t border-lcd-text/15 bg-[rgba(6,10,4,.85)] px-[clamp(12px,2.4vw,20px)] py-[7px] text-[11px] tracking-[.1em]"
      >
        <div className={`truncate ${statusAlert ? "text-lcd-red" : "text-lcd-text"}`}>
          {status}
          <span className="ug-caret">_</span>
        </div>
        <div className="flex-none text-lcd-faint">{statusRight}</div>
      </div>
    </div>
  );
}
