"use client";
// MY BETS：この Market の自分のベット。締切前は1件ずつ取消できる

export interface MyBetRow {
  id: string;
  kind: string;
  pick: string;
  amount: string;
  result: string;
  tone: "hit" | "miss" | "lock";
  cancelable: boolean;
}

const TONE = { hit: "text-lcd-ok", miss: "text-lcd-red", lock: "text-lcd-faint" };

export function MyBets({
  rows,
  open,
  onToggle,
  onCancel,
  onBack,
}: {
  rows: MyBetRow[];
  open: boolean;
  onToggle: () => void;
  onCancel: (id: string) => void;
  onBack: () => void;
}) {
  const has = rows.length > 0;
  return (
    <>
      <div className="mt-3 flex items-center justify-between gap-2.5 border-t border-lcd-text/20 pt-[7px] text-[10.5px] tracking-[.2em]">
        <button type="button" onClick={onBack} className="min-h-10 cursor-pointer text-lcd-mid">
          ‹ EVENTS
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={!has}
          aria-expanded={open && has}
          className={`min-h-10 ${has ? "cursor-pointer text-lcd-mid" : "cursor-default text-lcd-faint"}`}
        >
          MY BETS <span className="text-[15px] text-lcd-hi">{rows.length}</span> {has ? (open ? "▲" : "▼") : ""}
        </button>
      </div>
      {open && has && (
        <div className="ug-pop mt-1 border-t border-dashed border-lcd-text/20 pt-1.5">
          {rows.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2.5 py-[5px]">
              <div className="min-w-0">
                <div className="font-jp text-[10px] tracking-[.12em] text-lcd-dim">{b.kind}</div>
                <div className="truncate text-[12.5px] text-lcd-text">
                  {b.pick} ・ {b.amount} C
                </div>
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <span className={`text-[13px] ${TONE[b.tone]}`}>{b.result}</span>
                {b.cancelable && (
                  <button
                    type="button"
                    onClick={() => onCancel(b.id)}
                    className="inline-flex min-h-11 cursor-pointer items-center px-1 font-jp text-[10.5px] tracking-[.14em] text-lcd-red"
                  >
                    [ 取消 ]
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
