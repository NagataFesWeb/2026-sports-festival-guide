"use client";
// 三連単：336通りを一覧せず、1着・2着・3着を個別に指定する

export interface TriSlot {
  rank: string;
  val: string;
  name: string;
  active: boolean;
  filled: boolean;
}

export interface PickCell {
  id: string;
  num: string;
  sub: string;
  blocked: boolean;
  here: boolean;
}

export function TrifectaPicker({
  slots,
  onSlot,
  combo,
  odds,
  hasOdds,
  pickRank,
  cells,
  onPick,
  onClose,
}: {
  slots: TriSlot[];
  onSlot: (i: number) => void;
  combo: string;
  odds: string;
  hasOdds: boolean;
  pickRank: string | null;
  cells: PickCell[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="mt-3.5">
        <div className="grid grid-cols-3 gap-[9px]">
          {slots.map((t, i) => (
            <button
              key={t.rank}
              type="button"
              onClick={() => onSlot(i)}
              aria-expanded={t.active}
              aria-label={`${t.rank}を選ぶ`}
              className="cursor-pointer text-center"
            >
              <div className={`text-[10px] tracking-[.26em] ${t.active ? "text-lcd-sel" : "text-lcd-dim"}`}>{t.rank}</div>
              <div
                className={`mt-[5px] flex min-h-[60px] items-center justify-center border font-display text-[clamp(20px,6.4vw,30px)] tracking-[.06em] ${
                  t.active ? "border-lcd-sel bg-lcd-sel/15" : "border-lcd-text/30"
                } ${t.filled ? "text-lcd-hi" : "text-lcd-faint"}`}
              >
                {t.val}
              </div>
              <div className="mt-1 truncate font-jp text-[9.5px] text-lcd-dim">{t.name}</div>
            </button>
          ))}
        </div>
        <div className="mt-[13px] text-center text-[clamp(15px,4.2vw,20px)] tracking-[.26em] text-lcd-text">{combo}</div>
        <div className="mt-[7px] text-center">
          <div className="text-[10px] tracking-[.26em] text-lcd-dim">ODDS ・ 見込み倍率</div>
          <div className={`text-[clamp(24px,7vw,34px)] tracking-[.04em] tabular-nums ${hasOdds ? "text-lcd-hi" : "text-lcd-faint"}`}>{odds}</div>
        </div>
      </div>
      {pickRank && (
        <div className="ug-pop mt-[13px] border border-lcd-text/35 p-2.5">
          <div className="flex justify-between gap-2.5 text-[10.5px] tracking-[.22em] text-lcd-sel">
            <span>SELECT {pickRank}</span>
            <button type="button" onClick={onClose} className="cursor-pointer text-lcd-dim">
              [ CLOSE ]
            </button>
          </div>
          <div className="mt-[9px] grid grid-cols-4 gap-1.5">
            {cells.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={c.blocked}
                onClick={() => onPick(c.id)}
                className={`min-h-12 border px-0.5 py-2 text-center ${
                  c.blocked
                    ? "cursor-not-allowed border-lcd-text/10 text-lcd-mute"
                    : c.here
                      ? "cursor-pointer border-lcd-sel bg-lcd-sel/20 text-lcd-text"
                      : "cursor-pointer border-lcd-text/30 text-lcd-text"
                }`}
              >
                <div className="font-display text-[19px] tracking-[.04em]">{c.num}</div>
                <div className={`truncate text-[9px] tracking-[.1em] ${c.blocked ? "text-lcd-mute" : "text-lcd-faint"}`}>{c.sub}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
