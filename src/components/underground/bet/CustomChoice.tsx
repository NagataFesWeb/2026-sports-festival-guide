"use client";
// custom Market（紅白の大将戦など）の二択UI

export interface CustomOption {
  id: string;
  num: string;
  name: string;
  odds: string;
  pool: string;
  selected: boolean;
  flash: boolean;
}

export function CustomChoice({ options, onPick }: { options: CustomOption[]; onPick: (id: string) => void }) {
  return (
    <div className="relative mt-4">
      <div className="grid grid-cols-2 gap-[34px]">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.selected}
            onClick={() => onPick(o.id)}
            className={`cursor-pointer border px-2 pb-3.5 pt-4 text-center ${
              o.selected ? "border-lcd-sel bg-lcd-sel/15 text-lcd-hi" : "border-lcd-text/30 text-lcd-text"
            }`}
          >
            <div className="text-[10px] tracking-[.28em] text-lcd-dim">{o.num}</div>
            <div className="mt-1.5 font-jp text-[clamp(17px,5vw,23px)] font-bold">{o.name}</div>
            <div className={`mt-2.5 text-[clamp(22px,6.4vw,30px)] tracking-[.02em] tabular-nums ${o.flash ? "ug-flash" : ""}`}>×{o.odds}</div>
            <div className="mt-1 text-[10px] tracking-[.14em] text-lcd-dim">POOL {o.pool} C</div>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-display text-[15px] tracking-[.1em] text-lcd-dim">
        VS
      </div>
    </div>
  );
}
