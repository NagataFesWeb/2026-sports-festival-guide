"use client";
// 操作部（HARDWARE CONTROLS）：F1〜F4・BACK・LED・ENTER。液晶の色は使わない

export type LedTone = "off" | "ready" | "armed" | "alert";

export interface FKey {
  code: "F1" | "F2" | "F3" | "F4";
  label: string;
  latched: boolean;
  /** 未実装のセクションは undefined（押せない） */
  onPress?: () => void;
}

export function HardwareControls({
  fkeys,
  onBack,
  onEnter,
  enterHint,
  enterReady,
  led,
}: {
  fkeys: FKey[];
  onBack: () => void;
  onEnter: () => void;
  enterHint: string;
  enterReady: boolean;
  led: LedTone;
}) {
  return (
    <div className="ug-control-deck grid flex-none gap-[7px]">
      <div className="flex gap-[5px] overflow-x-auto [scrollbar-width:none]">
        {fkeys.map((f) => (
          <button
            key={f.code}
            type="button"
            className="ug-fkey"
            data-latched={f.latched}
            disabled={!f.onPress}
            onClick={f.onPress}
            title={f.onPress ? undefined : "準備中"}
          >
            <span className="block text-[9px] font-normal opacity-80">{f.code}</span>
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex items-stretch gap-2">
        <button type="button" className="ug-back" onClick={onBack}>
          ◀ BACK
          <span className="block text-[8.5px] font-normal text-[#93887e]">ESC</span>
        </button>
        <div className="flex flex-none flex-col items-center justify-center gap-[5px] px-[3px]">
          <span className="ug-led !h-[11px] !w-[11px]" data-tone={led} />
          <span className="text-[8px] tracking-[.1em] text-[#7d726a]">LED</span>
        </div>
        <button type="button" className="ug-enter" data-ready={enterReady} onClick={onEnter}>
          ● ENTER
          <span className="block font-term text-[9px] tracking-[.14em] opacity-80">{enterHint}</span>
        </button>
      </div>
    </div>
  );
}
