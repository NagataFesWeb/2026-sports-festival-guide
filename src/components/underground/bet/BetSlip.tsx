"use client";
// BET SLIP：未選択時は最小化、選択すると展開して金額入力・見込み払戻・確定ボタンを出す

export interface StakeKey {
  label: string;
  onPress: () => void;
}

export function BetSlip({
  ready,
  minHint,
  kindLabel,
  selLabel,
  oddsLabel,
  oddsText,
  stakeStr,
  stakeOk,
  onStake,
  onStakeEnter,
  keys,
  subKeys,
  retText,
  betLabel,
  betArmed,
  betDisabled,
  onBet,
}: {
  ready: boolean;
  minHint: string;
  kindLabel: string;
  selLabel: string;
  oddsLabel: string;
  oddsText: string;
  stakeStr: string;
  stakeOk: boolean;
  onStake: (v: string) => void;
  onStakeEnter: () => void;
  keys: StakeKey[];
  subKeys: StakeKey[];
  retText: string;
  betLabel: string;
  betArmed: boolean;
  betDisabled: boolean;
  onBet: () => void;
}) {
  return (
    <div className="mt-3.5 border-t border-dashed border-lcd-text/25 pt-2.5">
      {!ready && (
        <div className="flex justify-between gap-2.5 text-[10.5px] tracking-[.2em] text-lcd-faint">
          <span>BET SLIP</span>
          <span className="font-jp tracking-[.1em]">{minHint}</span>
        </div>
      )}
      {ready && (
        <div className="ug-pop">
          <div className="flex flex-wrap items-end gap-[26px]">
            <div className="min-w-0">
              <div className="text-[10px] tracking-[.26em] text-lcd-dim">SELECTED ・ {kindLabel}</div>
              <div className="truncate font-jp text-[clamp(15px,4.2vw,19px)] font-bold text-lcd-hi">{selLabel}</div>
            </div>
            <div className="flex-none">
              <div className="text-[10px] tracking-[.26em] text-lcd-dim">{oddsLabel}</div>
              <div className="text-[clamp(20px,5.6vw,26px)] tracking-[.02em] tabular-nums text-lcd-hi">{oddsText}</div>
            </div>
          </div>

          <label htmlFor="stake" className="mt-[11px] block text-[10px] tracking-[.26em] text-lcd-dim">
            STAKE
          </label>
          <div
            className={`mt-1 flex items-center justify-center gap-1.5 border bg-lcd-sel/5 px-2.5 py-[9px] ${
              stakeOk ? "border-lcd-text/45" : "border-lcd-red/50"
            }`}
          >
            <input
              id="stake"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={stakeStr}
              aria-invalid={!stakeOk}
              onChange={(e) => onStake(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onStakeEnter();
                }
              }}
              className="min-h-[38px] w-[120px] border-none bg-transparent text-center font-term text-2xl tracking-[.06em] text-lcd-hi outline-none"
            />
            <span className="text-[13px] tracking-[.2em] text-lcd-dim">C</span>
          </div>
          <div className="mt-[7px] flex flex-wrap gap-1.5">
            {keys.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={k.onPress}
                className="flex min-h-11 min-w-16 flex-1 cursor-pointer items-center justify-center border border-lcd-text/30 text-xs tracking-[.14em] text-lcd-text"
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="mt-[5px] flex flex-wrap gap-1.5">
            {subKeys.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={k.onPress}
                className="flex min-h-10 min-w-16 flex-1 cursor-pointer items-center justify-center border border-lcd-text/20 text-[11.5px] tracking-[.14em] text-lcd-dim"
              >
                {k.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2.5">
            <div className="text-[10px] tracking-[.24em] text-lcd-dim">EST. RETURN ・ 見込み払戻</div>
            <div className="text-[clamp(20px,5.6vw,26px)] tracking-[.02em] tabular-nums text-lcd-sel">{retText} C</div>
          </div>
          <div className="mt-0.5 font-jp text-[9.5px] leading-[1.8] text-lcd-faint">
            他の端末のベットで倍率は変動する。確定時の配当は保証されない。
          </div>

          <button
            type="button"
            onClick={onBet}
            disabled={betDisabled}
            className={`mt-[11px] flex min-h-[52px] w-full items-center justify-center border font-display text-base tracking-[.18em] ${
              betArmed
                ? "cursor-pointer border-lcd-sel bg-lcd-sel text-lcd-ink"
                : betDisabled
                  ? "cursor-default border-lcd-text/30 text-lcd-dim"
                  : "cursor-pointer border-lcd-text/30 text-lcd-faint"
            }`}
          >
            {betLabel}
          </button>
        </div>
      )}
    </div>
  );
}
