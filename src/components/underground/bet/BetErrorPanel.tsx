"use client";
// その場で出すエラー表示（別ページに遷移しない）。演出だけでなく日本語の補助文で原因を伝える

export interface BetErrorView {
  title: string;
  body: string;
  pairs?: { l1: string; v1: string; l2: string; v2: string };
  retry?: boolean;
}

export function BetErrorPanel({ error, onRetry }: { error: BetErrorView; onRetry: () => void }) {
  return (
    <div role="alert" className="ug-pop mt-[13px] border border-lcd-red/60 bg-lcd-red/[.07] px-[11px] py-[9px]">
      <div className="text-[11px] tracking-[.22em] text-lcd-red">{error.title}</div>
      {error.pairs && (
        <div className="mt-[7px] flex gap-[22px] text-[10px] tracking-[.18em] text-lcd-dim">
          <div>
            {error.pairs.l1}
            <div className="text-[15px] tracking-[.02em] text-lcd-text">{error.pairs.v1}</div>
          </div>
          <div>
            {error.pairs.l2}
            <div className="text-[15px] tracking-[.02em] text-lcd-red">{error.pairs.v2}</div>
          </div>
        </div>
      )}
      <div className="mt-1.5 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">{error.body}</div>
      {error.retry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex min-h-11 cursor-pointer items-center border border-lcd-text/50 px-4 py-[7px] text-[11px] tracking-[.22em] text-lcd-text"
        >
          [ RETRY ]
        </button>
      )}
    </div>
  );
}
