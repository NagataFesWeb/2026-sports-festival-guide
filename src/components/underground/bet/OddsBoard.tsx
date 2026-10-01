"use client";
// 単勝・複勝のオッズ表示盤。8チームをカードではなく一枚の表として並べる

export interface OddsRow {
  id: string;
  num: string;
  name: string;
  tag: string;
  odds: string;
  hasOdds: boolean;
  pool: string;
  selected: boolean;
  cursor: boolean;
  flash: boolean;
}

const COLS = "grid grid-cols-[14px_minmax(0,1fr)_88px_74px] gap-2";

export function OddsBoard({
  rows,
  poolLabel,
  onPick,
  onHover,
}: {
  rows: OddsRow[];
  poolLabel: string;
  onPick: (id: string) => void;
  onHover: (i: number) => void;
}) {
  return (
    <div className="ug-odds mt-2">
      <div className={`ug-odds-head ${COLS} border-b border-dashed border-lcd-text/20 px-2 pb-[5px] text-[10px] tracking-[.12em] text-lcd-faint`}>
        <span />
        <span>TEAM</span>
        <span className="text-right">ODDS</span>
        <span className="text-right">{poolLabel}</span>
      </div>
      <div className="ug-odds-rows">
      {rows.map((r, i) => (
        <button
          key={r.id}
          type="button"
          aria-pressed={r.selected}
          aria-label={`${r.name}、倍率 ${r.odds}、プール ${r.pool} C`}
          data-cursor={r.cursor}
          onClick={() => onPick(r.id)}
          onMouseEnter={() => onHover(i)}
          className={`ug-row ug-odds-row ${COLS} min-h-11 w-full cursor-pointer items-center border-b border-lcd-text/[.07] px-2 py-1 text-left ${
            r.selected ? "ug-sel" : r.cursor ? "bg-lcd-sel/10 text-lcd-text" : "text-lcd-text"
          }`}
        >
          <span className="text-xs">{r.selected ? "▶" : ""}</span>
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="ug-odds-num flex-none font-display text-base tracking-[.08em]">{r.num}</span>
            <span className="truncate font-jp text-xs font-bold">{r.name}</span>
            <span className={`flex-none whitespace-nowrap text-[9px] tracking-[.14em] ${r.selected ? "text-lcd-ink/70" : "text-lcd-faint"}`}>
              {r.tag}
            </span>
          </span>
          <span
            className={`whitespace-nowrap text-right text-[19px] tracking-[.02em] tabular-nums ${r.flash ? "ug-flash" : ""} ${
              r.selected ? "text-lcd-ink" : r.hasOdds ? "text-lcd-hi" : "text-lcd-faint"
            }`}
          >
            {r.odds}
          </span>
          <span className={`whitespace-nowrap text-right text-[11.5px] tabular-nums ${r.selected ? "text-lcd-ink/70" : "text-lcd-faint"}`}>
            {r.pool}
          </span>
        </button>
      ))}
      </div>
    </div>
  );
}
