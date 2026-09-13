"use client";
// F2 CREDIT：借入れ（ADVANCE）・返済（REPAY）。金額の検証と残高の増減はすべてサーバー側
// ここでは入力の保持と表示（カンマ区切り・上限の案内）だけを行う
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseStake } from "@/lib/casino/betting";
import { formatClock, formatPoints } from "@/lib/casino/format";
import type { CreditApiResponse, CreditView } from "@/lib/casino/view";
import { BetErrorPanel, type BetErrorView } from "./bet/BetErrorPanel";
import { Cabinet } from "./Cabinet";
import { casinoFKeys, handleSectionKey, LCD_TABS } from "./fkeys";
import { HardwareControls } from "./HardwareControls";
import { Lcd } from "./Lcd";
import { useSound } from "./sound";
import { useServerClock } from "./useServerClock";

type Action = "borrow" | "repay";

/** サーバーのエラーコード → LCD の表示（日本語の補助文を必ず付ける） */
const ERROR_VIEW: Record<string, BetErrorView> = {
  invalid_amount: { title: "INVALID AMOUNT", body: "1以上の整数のみ。0・マイナス・小数は受け付けない。" },
  over_borrow_limit: { title: "OVER BORROW LIMIT", body: "1回の借入れ上限を超えている。上限までの額に分けて借りる。" },
  insufficient_balance: { title: "INSUFFICIENT BALANCE", body: "返済額が所持クレジットを超えている。" },
  over_debt: { title: "OVER DEBT", body: "返済額が借金額を超えている。借金の残りまでしか返済できない。" },
  finalized: { title: "FINALIZED", body: "最終精算済みのため借入れ・返済はできない。" },
  conflict: { title: "BUSY ・ RETRY", body: "他の操作と競合して書き込めなかった。もう一度実行する。", retry: true },
  account_not_found: { title: "NO ACCOUNT", body: "口座が見つからない。入場からやり直す。" },
  bad_request: { title: "BAD REQUEST", body: "入力が不正。金額を確認する。" },
  conn: { title: "CONNECTION ERROR", body: "NODE 79 との接続が切れた。入力内容は保持している。", retry: true },
  empty: { title: "AMOUNT REQUIRED", body: "金額を入力する。" },
};

const FALLBACK: BetErrorView = { title: "REJECTED", body: "処理できなかった。金額を確認して再試行する。" };

function QuickKey({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`min-h-11 flex-1 cursor-pointer border px-1.5 py-2 text-[11px] tracking-[.14em] tabular-nums ${
        disabled ? "border-lcd-mute text-lcd-mute" : "border-lcd-text/45 text-lcd-text"
      }`}
    >
      {label}
    </button>
  );
}

export function CreditScreen({ initial }: { initial: CreditView }) {
  const router = useRouter();
  const { blip } = useSound();
  const [view, setView] = useState(initial);
  const now = useServerClock(view.serverNow);

  const [action, setAction] = useState<Action>("borrow");
  const [borrowStr, setBorrowStr] = useState("100");
  const [repayStr, setRepayStr] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  const locked = view.finalized;
  const balance = view.account.pointsBalance;
  const debt = view.account.debtAmount;
  const amountStr = action === "borrow" ? borrowStr : repayStr;
  const amount = parseStake(amountStr);

  function setAmount(next: string, which: Action) {
    const clean = next.replace(/[^0-9]/g, "").slice(0, 7);
    if (which === "borrow") setBorrowStr(clean);
    else setRepayStr(clean);
    setAction(which);
    setErrorKey(null);
  }

  async function send(which: Action) {
    if (busy || locked) return;
    setAction(which);
    const value = parseStake(which === "borrow" ? borrowStr : repayStr);
    if (value === null) {
      setErrorKey("empty");
      blip(140, 0.18);
      return;
    }
    setBusy(true);
    setErrorKey(null);
    blip(820, 0.08);
    try {
      const res = await fetch("/api/casino/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: which, amount: value }),
      });
      const data = (await res.json()) as CreditApiResponse;
      if (!data.ok) {
        if (data.error === "unauthorized") {
          router.push("/casino/enter");
          return;
        }
        setErrorKey(data.error);
        blip(140, 0.2);
        return;
      }
      setView(data.view);
      setToast(
        which === "borrow"
          ? `ADVANCE ${formatPoints(value)} C ・ DEBT ${formatPoints(data.view.account.debtAmount)} C`
          : `REPAID ${formatPoints(value)} C ・ DEBT ${formatPoints(data.view.account.debtAmount)} C`,
      );
      if (which === "repay") setRepayStr("");
      blip(1180, 0.09);
    } catch {
      setErrorKey("conn");
      blip(160, 0.22, "sawtooth");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (handleSectionKey(e.key, router)) {
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      router.push("/casino");
      return;
    }
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      void send(action);
    }
  }

  const keyRef = useRef(onKey);
  useEffect(() => {
    keyRef.current = onKey;
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const error = errorKey ? (ERROR_VIEW[errorKey] ?? FALLBACK) : null;
  const status = locked
    ? "> FINALIZED — NO CREDIT OPS"
    : busy
      ? "> PROCESSING..."
      : toast
        ? `> ${toast}`
        : action === "borrow"
          ? `> ADVANCE ・ 1〜${formatPoints(view.borrowMax)} C PER REQUEST`
          : `> REPAY ・ UP TO ${formatPoints(view.repayMax)} C`;

  return (
    <Cabinet
      credit={balance}
      link={busy ? "busy" : errorKey === "conn" ? "lost" : "online"}
      controls={
        <HardwareControls
          fkeys={casinoFKeys("credit", router)}
          onBack={() => {
            blip(300, 0.07);
            router.push("/casino");
          }}
          onEnter={() => void send(action)}
          enterHint={locked ? "LOCKED" : action === "borrow" ? "ADVANCE" : "REPAY"}
          enterReady={!locked && !busy}
          led={locked ? "off" : debt > 0 ? "alert" : amount !== null ? "armed" : "ready"}
        />
      }
    >
      <Lcd
        tabs={LCD_TABS("credit")}
        clock={formatClock(now)}
        subTitle="CREDIT DESK / ADVANCE ・ REPAY"
        status={status}
        statusAlert={locked || errorKey !== null}
        statusRight={locked ? "FINALIZED" : debt > 0 ? "DEBT ACTIVE" : "NO DEBT"}
      >
        <div className="flex flex-wrap items-baseline gap-x-[22px] gap-y-1 text-[10.5px] tracking-[.18em] text-lcd-dim">
          <div>
            CREDIT <span className="text-[19px] tracking-[.02em] tabular-nums text-lcd-hi">{formatPoints(balance)}</span> C
          </div>
          <div>
            DEBT{" "}
            <span className={`text-[19px] tracking-[.02em] tabular-nums ${debt > 0 ? "text-lcd-red" : "text-lcd-faint"}`}>
              {formatPoints(debt)}
            </span>{" "}
            C
          </div>
          <div>
            NET <span className="text-[15px] tracking-[.02em] tabular-nums text-lcd-mid">{formatPoints(balance - debt)}</span> C
          </div>
        </div>
        <div className="mt-1.5 font-jp text-[10.5px] leading-[1.9] text-lcd-dim">
          結果確定ごとに借金 +{view.interestPercent}%（端数切り捨て）。借入れは1回 {formatPoints(view.borrowMax)} C まで、合計の上限は無い。
        </div>
        <div className="mb-[11px] mt-[9px] h-px bg-lcd-text/20" />

        {locked ? (
          <div className="border border-lcd-red/60 bg-lcd-red/[.07] px-[11px] py-[9px]">
            <div className="text-[11px] tracking-[.22em] text-lcd-red">FINALIZED — NO CREDIT OPS</div>
            <div className="mt-1.5 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">
              最終精算が済んでいるため、借入れ・返済はできない。順位は F4 RANK で確認する。
            </div>
          </div>
        ) : (
          <div className="grid gap-3.5">
            {/* ADVANCE（借入れ） */}
            <div
              onFocus={() => setAction("borrow")}
              className={`border px-[11px] py-[9px] ${action === "borrow" ? "border-lcd-sel" : "border-lcd-text/30"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[11px] tracking-[.24em] text-lcd-hi">ADVANCE</div>
                <div className="text-[10px] tracking-[.16em] text-lcd-dim">MAX {formatPoints(view.borrowMax)} C / REQUEST</div>
              </div>
              <div className="font-jp text-[10px] tracking-[.08em] text-lcd-faint">借りる（借金も同額増える）</div>
              <div className="mt-2 flex gap-2">
                {[100, 300, 500].map((v) => (
                  <QuickKey key={v} label={formatPoints(v)} onPress={() => setAmount(String(v), "borrow")} disabled={busy} />
                ))}
              </div>
              <div className="mt-2 flex items-stretch gap-2">
                <input
                  value={borrowStr}
                  onChange={(e) => setAmount(e.target.value, "borrow")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send("borrow");
                  }}
                  inputMode="numeric"
                  aria-label="借入れ金額"
                  className="min-h-11 w-full border border-lcd-text/45 bg-[rgba(6,11,4,.75)] px-2.5 py-2 text-right text-[16px] tabular-nums text-lcd-hi"
                />
                <button
                  type="button"
                  onClick={() => void send("borrow")}
                  disabled={busy}
                  className={`min-h-11 flex-none cursor-pointer border px-4 font-display text-[13px] tracking-[.18em] ${
                    busy ? "border-lcd-mute text-lcd-mute" : "border-lcd-sel bg-lcd-sel text-lcd-ink"
                  }`}
                >
                  BORROW
                </button>
              </div>
            </div>

            {/* REPAY（返済） */}
            <div
              onFocus={() => setAction("repay")}
              className={`border px-[11px] py-[9px] ${action === "repay" ? "border-lcd-sel" : "border-lcd-text/30"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[11px] tracking-[.24em] text-lcd-hi">REPAY</div>
                <div className="text-[10px] tracking-[.16em] text-lcd-dim">MAX {formatPoints(view.repayMax)} C</div>
              </div>
              <div className="font-jp text-[10px] tracking-[.08em] text-lcd-faint">返す（所持クレジットと借金が同額減る）</div>
              <div className="mt-2 flex gap-2">
                <QuickKey
                  label={`MAX ${formatPoints(view.repayMax)}`}
                  onPress={() => setAmount(String(view.repayMax), "repay")}
                  disabled={busy || view.repayMax < 1}
                />
              </div>
              <div className="mt-2 flex items-stretch gap-2">
                <input
                  value={repayStr}
                  onChange={(e) => setAmount(e.target.value, "repay")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void send("repay");
                  }}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="返済金額"
                  className="min-h-11 w-full border border-lcd-text/45 bg-[rgba(6,11,4,.75)] px-2.5 py-2 text-right text-[16px] tabular-nums text-lcd-hi placeholder:text-lcd-mute"
                />
                <button
                  type="button"
                  onClick={() => void send("repay")}
                  disabled={busy || view.repayMax < 1}
                  className={`min-h-11 flex-none cursor-pointer border px-4 font-display text-[13px] tracking-[.18em] ${
                    busy || view.repayMax < 1 ? "border-lcd-mute text-lcd-mute" : "border-lcd-sel bg-lcd-sel text-lcd-ink"
                  }`}
                >
                  REPAY
                </button>
              </div>
              {view.repayMax < 1 && (
                <div className="mt-1.5 font-jp text-[10px] text-lcd-faint">
                  {debt === 0 ? "借金は無い。" : "返済できる所持クレジットが無い。"}
                </div>
              )}
            </div>
          </div>
        )}

        {error && <BetErrorPanel error={error} onRetry={() => void send(action)} />}
      </Lcd>
    </Cabinet>
  );
}
