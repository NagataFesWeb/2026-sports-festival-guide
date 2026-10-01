"use client";
// カジノ入場（/casino/enter）。ユーザーID＋パスワードで口座作成（NEW ACCOUNT）または入場（LOGIN）
// 認証はすべてサーバー（/api/casino/enter）で行い、ここでは入力の保持と表示だけを担う
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatClock, formatPoints } from "@/lib/casino/format";
import type { EnterApiResponse, EnterMode } from "@/lib/casino/view";
import { isValidUserId } from "@/lib/casino/user-id";
import { BetErrorPanel, type BetErrorView } from "./bet/BetErrorPanel";
import { Cabinet } from "./Cabinet";
import { HardwareControls, type FKey } from "./HardwareControls";
import { Lcd } from "./Lcd";
import { useSound } from "./sound";
import { useServerClock } from "./useServerClock";
import { BootSequence } from "./BootSequence";
import { GateSequence } from "./GateSequence";

/** サーバーのエラーコード → LCD の表示（日本語の補助文を必ず付ける） */
const ERROR_VIEW: Record<string, BetErrorView> = {
  finalized: { title: "FINALIZED", body: "最終精算が済んでいるため新しい口座は作成できない。登録済みの口座でLOGINすると結果を確認できる。" },
  conflict: { title: "BUSY", body: "処理が競合した。入力内容を確認して再試行する。", retry: true },
  wrong_password: {
    title: "ACCESS DENIED",
    body: "ユーザーIDまたはパスワードが違う。入力し直して再試行する。口座がまだ無い場合は NEW ACCOUNT で作成する。",
  },
  invalid_user_id: {
    title: "INVALID USER ID",
    body: "ユーザーIDは半角英数字・ハイフン・アンダースコアの4〜32文字で設定する。大文字と小文字は区別される。",
  },
  already_registered: {
    title: "ALREADY REGISTERED",
    body: "このユーザーIDは使用済み。別のIDを設定するか、LOGIN に切り替えて入場する。",
  },
  invalid_password: {
    title: "INVALID PASSWORD",
    body: "パスワードは4〜32文字。前後に空白は使えない。",
  },
  invalid_nickname: {
    title: "INVALID NICKNAME",
    body: "ニックネームは1〜12文字。前後の空白と改行は使えない。",
  },
  empty_nickname: {
    title: "NICKNAME REQUIRED",
    body: "順位表に表示するニックネームを入力する。",
  },
  bad_request: {
    title: "BAD REQUEST",
    body: "入力が不正。ユーザーIDとパスワードを確認する。",
  },
  conn: {
    title: "CONNECTION ERROR",
    body: "NODE 79 との接続が切れた。入力内容は保持している。",
    retry: true,
  },
  empty_id: {
    title: "USER ID REQUIRED",
    body: "ユーザーIDを入力する。初めて利用する場合は NEW ACCOUNT でID・パスワード・ニックネームを設定する。",
  },
  empty_password: {
    title: "PASSWORD REQUIRED",
    body: "パスワードを入力する。新規作成なら4〜32文字で決める。",
  },
};

const FALLBACK: BetErrorView = { title: "REJECTED", body: "入場できなかった。入力内容を確認して再試行する。" };

import { casinoFetch } from "./request";

export function EnterScreen({ initialPoints, serverNow, authenticated = false }: { initialPoints: number; serverNow: string; authenticated?: boolean }) {
  const router = useRouter();
  const { blip } = useSound();
  const now = useServerClock(serverNow);

  const [mode, setMode] = useState<EnterMode>("login");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [done, setDone] = useState(false);
  const [booting, setBooting] = useState(true);
  const [connecting, setConnecting] = useState(true);

  const isRegister = mode === "register";

  function selectMode(next: EnterMode) {
    setMode(next);
    setErrorKey(null);
    blip(560, 0.05);
  }

  async function submit() {
    if (booting || connecting || busyRef.current || done) return;
    if (userId.trim().length === 0) {
      setErrorKey("empty_id");
      blip(140, 0.18);
      return;
    }
    if (isRegister && !isValidUserId(userId.trim())) {
      setErrorKey("invalid_user_id");
      blip(140, 0.18);
      return;
    }
    if (password.length === 0) {
      setErrorKey("empty_password");
      blip(140, 0.18);
      return;
    }
    if (isRegister && nickname.trim().length === 0) {
      setErrorKey("empty_nickname");
      blip(140, 0.18);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setErrorKey(null);
    blip(880, 0.09);
    try {
      const res = await casinoFetch("/api/casino/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId.trim(), password, mode, nickname }),
      });
      const data = (await res.json()) as EnterApiResponse;
      if (!data.ok) {
        setErrorKey(data.error);
        blip(140, 0.2);
        return;
      }
      setDone(true);
      blip(1180, 0.1);
      router.push("/casino");
    } catch {
      setErrorKey("conn");
      blip(160, 0.22, "sawtooth");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (booting) {
      if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); setBooting(false); }
      return;
    }
    if (e.key === "F1") {
      e.preventDefault();
      selectMode("login");
    } else if (e.key === "F2") {
      e.preventDefault();
      selectMode("register");
    } else if (e.key === "Escape") {
      e.preventDefault();
      router.push("/");
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      void submit();
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

  const fkeys: FKey[] = [
    { code: "F1", label: "LOGIN", latched: !isRegister, onPress: () => selectMode("login") },
    { code: "F2", label: "NEW ACC", latched: isRegister, onPress: () => selectMode("register") },
    { code: "F3", label: "HISTORY", latched: false },
    { code: "F4", label: "RANK", latched: false },
  ];

  const error = errorKey ? (ERROR_VIEW[errorKey] ?? FALLBACK) : null;
  const status = done
    ? "> ACCESS GRANTED ・ CONNECTING..."
    : busy
      ? "> VERIFYING..."
      : isRegister
        ? "> NEW ACCOUNT ・ SET USER ID, PASSWORD AND NICKNAME"
        : "> LOGIN ・ ENTER USER ID AND PASSWORD";

  return (
    <Cabinet
      credit={0}
      link={done ? "online" : busy ? "busy" : errorKey ? "lost" : "online"}
      controls={
        <HardwareControls
          fkeys={fkeys}
          onBack={() => {
            if (booting) { setBooting(false); return; }
            blip(240, 0.07);
            router.push("/");
          }}
          onEnter={() => booting ? setBooting(false) : void submit()}
          enterHint={isRegister ? "CREATE" : "CONNECT"}
          enterReady={!busy && !done}
          led={errorKey ? "alert" : done ? "armed" : busy ? "ready" : "ready"}
        />
      }
    >
      <Lcd
        boot={booting ? <BootSequence onComplete={() => setBooting(false)} /> : connecting ? <GateSequence onComplete={() => { setConnecting(false); if (authenticated) router.push("/casino"); }} /> : undefined}
        tabs={[
          { label: "ACCESS", active: true },
          { label: "TERM 79", active: false },
        ]}
        clock={formatClock(now)}
        subTitle="NAGATA UNDERGROUND ・ TERM 79 ・ ACCESS"
        status={booting ? "> POWER ON SELF TEST" : connecting ? "> CONNECTING TO NODE 79..." : status}
        statusAlert={errorKey !== null}
        statusRight={booting || connecting ? "NODE 79" : isRegister ? "NEW ACCOUNT" : "LOGIN"}
      >
        <div className="text-[11px] leading-[1.9] tracking-[.14em] text-lcd-dim">
          &gt; LINK ESTABLISHED ・ NODE 79
          <br />
          &gt; IDENTIFY YOURSELF TO CONTINUE
        </div>

        {/* モード切替（液晶内は反転表示と枠線だけで表す） */}
        <div role="tablist" aria-label="入場モード" className="mt-3 flex border-b border-lcd-text/20">
          {(["login", "register"] as const).map((m) => {
            const on = m === mode;
            return (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => selectMode(m)}
                className={`flex min-h-11 flex-1 cursor-pointer flex-col justify-center gap-px border-b-2 px-3 pb-[7px] pt-1.5 ${
                  on ? "border-lcd-sel bg-lcd-sel/15 text-lcd-hi" : "border-transparent text-lcd-dim"
                }`}
              >
                <span className="text-[11px] tracking-[.2em]">{m === "login" ? "F1 LOGIN" : "F2 NEW ACCOUNT"}</span>
                <span className="font-jp text-[10px] tracking-[.1em] opacity-75">{m === "login" ? "入場する" : "口座を作る"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3.5 grid gap-3">
          <label className="block">
            <span className="block text-[10px] tracking-[.24em] text-lcd-dim">USER ID</span>
            <span className="mb-1 block font-jp text-[10px] tracking-[.08em] text-lcd-faint">ユーザーID{isRegister ? "（新規設定・4〜32文字）" : ""}</span>
            <input
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setErrorKey(null);
              }}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="例：nagata79"
              aria-label="ユーザーID"
              className="w-full min-h-11 border border-lcd-text/45 bg-[rgba(6,11,4,.75)] px-2.5 py-2 text-[16px] tracking-[.14em] tabular-nums text-lcd-hi placeholder:text-lcd-mute"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] tracking-[.24em] text-lcd-dim">PASSWORD</span>
            <span className="mb-1 block font-jp text-[10px] tracking-[.08em] text-lcd-faint">
              パスワード{isRegister ? "（新規設定・4〜32文字）" : ""}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value.slice(0, 32));
                setErrorKey(null);
              }}
              autoComplete={isRegister ? "new-password" : "current-password"}
              aria-label="パスワード"
              className="w-full min-h-11 border border-lcd-text/45 bg-[rgba(6,11,4,.75)] px-2.5 py-2 text-[16px] tracking-[.24em] text-lcd-hi placeholder:text-lcd-mute"
            />
          </label>
          {isRegister && (
            <label className="block">
              <span className="block text-[10px] tracking-[.24em] text-lcd-dim">NICKNAME</span>
              <span className="mb-1 block font-jp text-[10px] tracking-[.08em] text-lcd-faint">
                ニックネーム（順位表に表示・1〜12文字）
              </span>
              <input
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value.slice(0, 12));
                  setErrorKey(null);
                }}
                maxLength={12}
                autoComplete="nickname"
                placeholder="NODE79"
                aria-label="ニックネーム"
                className="w-full min-h-11 border border-lcd-text/45 bg-[rgba(6,11,4,.75)] px-2.5 py-2 text-[16px] tracking-[.14em] text-lcd-hi placeholder:text-lcd-mute"
              />
            </label>
          )}
        </div>

        {isRegister && (
          <div className="mt-3 border border-lcd-text/30 px-[11px] py-[9px]">
            <div className="text-[10px] tracking-[.26em] text-lcd-dim">INITIAL CREDIT</div>
            <div className="text-[clamp(19px,5vw,26px)] tabular-nums text-lcd-hi">{formatPoints(initialPoints)} C</div>
            <div className="mt-1 font-jp text-[10.5px] leading-[1.8] text-lcd-dim">
              口座を作ると初期クレジット {formatPoints(initialPoints)} C を付与する。ユーザーIDは半角英数字・ハイフン・アンダースコアで自由に設定できる（大文字・小文字を区別）。
              ニックネームは順位表に表示される。
            </div>
          </div>
        )}

        {error && <BetErrorPanel error={error} onRetry={() => void submit()} />}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || done}
          className={`mt-3.5 block min-h-11 w-full cursor-pointer border px-3 py-2.5 font-display text-[15px] tracking-[.22em] ${
            busy || done ? "border-lcd-mute text-lcd-mute" : "border-lcd-sel bg-lcd-sel text-lcd-ink"
          }`}
        >
          {busy ? "VERIFYING..." : done ? "CONNECTING..." : isRegister ? "CREATE ACCOUNT ・ ENTER" : "CONNECT ・ ENTER"}
        </button>
      </Lcd>
    </Cabinet>
  );
}
