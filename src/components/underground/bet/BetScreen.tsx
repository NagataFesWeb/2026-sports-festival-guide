"use client";
// 賭け画面。競技一覧で選んだ1競技へのベットに集中する（競技の切替は一覧へ戻って行う）
// 金額の検証・残高の増減はサーバーが行い、ここでは表示と入力の保持だけを担う
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseStake } from "@/lib/casino/betting";
import { formatClock, formatCountdown, formatPoints } from "@/lib/casino/format";
import {
  estimateOdds,
  estimateReturn,
  formatOdds,
  poolTotal,
  selectionKey,
  sumPayouts,
  sumStakes,
  summarizeHits,
} from "@/lib/casino/odds";
import type { BetKind } from "@/lib/casino/types";
import type { ApiErrorCode, ApiResponse, MarketView } from "@/lib/casino/view";
import { Cabinet } from "../Cabinet";
import { casinoFKeys, handleSectionKey, LCD_TABS } from "../fkeys";
import { HardwareControls, type LedTone } from "../HardwareControls";
import { Lcd } from "../Lcd";
import { useSound } from "../sound";
import { useServerClock } from "../useServerClock";
import { BetErrorPanel, type BetErrorView } from "./BetErrorPanel";
import { BetSlip } from "./BetSlip";
import { CustomChoice } from "./CustomChoice";
import { BetTypeTabs, EventHeader, SettledPanel, StatusBar } from "./Header";
import { KIND_JP, RANKS } from "./labels";
import { MyBets } from "./MyBets";
import { OddsBoard } from "./OddsBoard";
import { ResultReveal } from "./ResultReveal";
import { TrifectaPicker } from "./TrifectaPicker";
import { WinFx } from "./WinFx";

type ScreenError = "balance" | "stake" | "closed" | "conn";
type Tri = [string | null, string | null, string | null];
type Retry = { type: "refresh" } | { type: "place" } | { type: "cancel"; betId: string };

const EMPTY_TRI: Tri = [null, null, null];
const POLL_MS = 10_000;
const URGENT_MS = 5 * 60_000;
/** 更新直後に LIVE を UPDATE に変えて点す時間 */
const PULSE_MS = 900;

/** 結果演出を見たかどうかの記録先（1 Market につき 1 回だけ流す） */
function revealKey(marketId: string): string {
  return `ug-revealed:${marketId}`;
}

export function BetScreen({ initial }: { initial: MarketView }) {
  const router = useRouter();
  const { blip } = useSound();

  const [view, setView] = useState(initial);
  const [kind, setKind] = useState<BetKind>(initial.market.kinds[0] ?? "win");
  const [target, setTarget] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>(EMPTY_TRI);
  const [picking, setPicking] = useState(0); // 0=閉 / 1〜3=選択中の着順
  const [stakeStr, setStakeStr] = useState("100");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<ScreenError | null>(null);
  const [retry, setRetry] = useState<Retry | null>(null);
  const [mineOpen, setMineOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const [flash, setFlash] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [accept, setAccept] = useState<{ line1: string; line2: string } | null>(null);
  const [link, setLink] = useState<"online" | "lost">("online");
  const [lastSync, setLastSync] = useState(initial.serverNow);
  const [reveal, setReveal] = useState(false);
  const [win, setWin] = useState(false);
  const now = useServerClock(view.serverNow);

  const viewRef = useRef(view);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // ---- 表示用の値 ----
  const m = view.market;
  const balance = view.account.pointsBalance;
  const remaining = Date.parse(m.deadline) - now;
  const status = m.status === "open" && remaining <= 0 ? "closed" : m.status;
  const open = status === "open";
  const isTri = kind === "trifecta";
  const isCustom = m.type === "custom";
  const selection: string[] | null = isTri
    ? tri[0] && tri[1] && tri[2]
      ? [tri[0], tri[1], tri[2]]
      : null
    : target
      ? [target]
      : null;
  const pool = view.pools[kind];
  const curOdds = selection
    ? isTri
      ? m.trifectaOddsOverrides[selectionKey(selection)] ?? m.trifectaOddsDefault
      : estimateOdds(pool, kind, selectionKey(selection))
    : null;
  const amount = parseStake(stakeStr);
  const stakeOk = amount !== null && amount <= balance;

  const numOf = (id: string) => m.options.find((o) => o.id === id)?.num ?? "??";
  const nameOf = (id: string) => m.options.find((o) => o.id === id)?.name ?? "?";
  const pickLabel = (k: BetKind, sel: readonly string[]) => (k === "trifecta" ? sel.map(numOf).join(" → ") : nameOf(sel[0]));

  // ---- 状態更新 ----
  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }

  function clearInputError() {
    setError((e) => (e === "conn" ? e : null));
  }

  function applyView(next: MarketView, withFlash: boolean) {
    if (withFlash) {
      const prev = viewRef.current;
      const changed: string[] = [];
      for (const k of next.market.kinds) {
        for (const [key, v] of Object.entries(next.pools[k])) {
          if ((prev.pools[k][key] ?? 0) !== v) changed.push(`${k}:${key}`);
        }
      }
      if (changed.length > 0) {
        setFlash(changed);
        setTimeout(() => setFlash([]), 450);
      }
    }
    setView(next);
    setLastSync(next.serverNow);
    setLink("online");
    setRetry(null);
    setError((e) => (e === "conn" ? null : e));
  }

  function lostLink(r: Retry) {
    setLink("lost");
    setError("conn");
    setRetry(r);
    blip(160, 0.22, "sawtooth");
  }

  async function refresh(manual: boolean) {
    try {
      const res = await fetch(`/api/casino/markets/${encodeURIComponent(m.id)}`, { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) throw new Error(data.error);
      applyView(data.view, true);
      if (manual) {
        showToast("SYNC COMPLETE");
        blip(900, 0.1, "sine");
      }
    } catch {
      lostLink({ type: "refresh" });
    }
  }

  function rejectBet(code: ApiErrorCode) {
    blip(140, 0.2);
    if (code === "insufficient_balance") setError("balance");
    else if (code === "invalid_stake") setError("stake");
    else if (code === "market_closed") {
      setError("closed");
      void refresh(false);
    } else showToast(`REJECTED ・ ${code.toUpperCase()}`);
  }

  async function place() {
    if (processing) return;
    if (!open) {
      setError("closed");
      blip(140, 0.16);
      return;
    }
    if (!selection) {
      showToast(isTri ? "SELECT 1ST・2ND・3RD FIRST" : "SELECT TARGET FIRST");
      blip(140, 0.12);
      return;
    }
    if (amount === null) {
      setError("stake");
      blip(140, 0.2);
      return;
    }
    if (amount > balance) {
      setError("balance");
      blip(140, 0.2);
      return;
    }
    setProcessing(true);
    setError(null);
    blip(880, 0.1);
    const betKind = kind;
    const before = balance;
    try {
      const res = await fetch(`/api/casino/markets/${encodeURIComponent(m.id)}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: betKind, selection, amount }),
      });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        rejectBet(data.error);
        return;
      }
      applyView(data.view, false);
      setAccept({
        line1: `${isCustom ? "二択" : KIND_JP[betKind]} ・ ${pickLabel(betKind, selection)} ・ ${formatPoints(amount)} C`,
        line2: `${formatPoints(before)} → ${formatPoints(data.view.account.pointsBalance)}`,
      });
      setTimeout(() => setAccept(null), 1500);
      setTarget(null);
      setTri(EMPTY_TRI);
      setPicking(0);
      blip(1180, 0.09);
    } catch {
      lostLink({ type: "place" });
    } finally {
      setProcessing(false);
    }
  }

  async function cancel(betId: string) {
    const b = view.myBets.find((x) => x.id === betId);
    if (!b) return;
    if (!open) {
      showToast("LOCKED ・ CANCEL DISABLED");
      blip(140, 0.16);
      return;
    }
    try {
      const res = await fetch(`/api/casino/bets/${encodeURIComponent(betId)}`, { method: "DELETE" });
      const data = (await res.json()) as ApiResponse;
      if (!data.ok) {
        showToast(data.error === "market_closed" ? "LOCKED ・ CANCEL DISABLED" : `REJECTED ・ ${data.error.toUpperCase()}`);
        blip(140, 0.16);
        return;
      }
      applyView(data.view, false);
      showToast(`BET VOID ・ ${formatPoints(b.amount)} C RETURNED`);
      blip(300, 0.1);
    } catch {
      lostLink({ type: "cancel", betId });
    }
  }

  function doRetry() {
    if (retry?.type === "place") void place();
    else if (retry?.type === "cancel") void cancel(retry.betId);
    else void refresh(true);
  }

  function back() {
    blip(300, 0.07);
    router.push("/casino");
  }

  function pick(id: string) {
    if (!open) {
      setError("closed");
      blip(140, 0.16);
      return;
    }
    setTarget(id);
    clearInputError();
    blip(640, 0.06);
  }

  function selectKind(k: BetKind) {
    setKind(k);
    setPicking(0);
    setCursor(-1);
    clearInputError();
    blip(560, 0.05);
  }

  function openSlot(i: number) {
    if (!open) {
      setError("closed");
      blip(140, 0.16);
      return;
    }
    setPicking((p) => (p === i + 1 ? 0 : i + 1));
  }

  function setTriAt(i: number, id: string) {
    const next: Tri = [...tri];
    next[i] = id;
    setTri(next);
    setPicking(i < 2 && !next[i + 1] ? i + 2 : 0);
    clearInputError();
    blip(660, 0.05);
  }

  function editStake(v: string) {
    setStakeStr(v.replace(/[^0-9.-]/g, "").slice(0, 7));
    clearInputError();
  }

  function addStake(n: number) {
    setStakeStr(String(Math.max(0, (parseStake(stakeStr) ?? 0) + n)));
    clearInputError();
    blip(n < 0 ? 460 : 700, 0.04);
  }

  function move(d: number) {
    const n = m.options.length;
    if (isTri || n === 0) return;
    setCursor((c) => ((c < 0 ? (d > 0 ? -1 : 0) : c) + d + n) % n);
    blip(560, 0.03);
  }

  function enterKey() {
    if (!open) {
      setError("closed");
      blip(140, 0.16);
      return;
    }
    const rowId = !isTri && cursor >= 0 ? m.options[cursor]?.id : undefined;
    if (rowId && rowId !== target) {
      pick(rowId);
      return;
    }
    void place();
  }

  // 結果確定済みで自分のベットがあり、まだ演出を見ていなければ 1 回だけ流す
  const settledWithBets = status === "settled" && view.myBets.length > 0;
  useEffect(() => {
    if (!settledWithBets) return;
    let seen = true;
    try {
      seen = window.localStorage.getItem(revealKey(m.id)) !== null;
    } catch {
      // localStorage が使えないブラウザでは演出を出さない（情報は MY BETS 側で確認できる）
    }
    if (seen) return;
    // 端末が結果を検出して演出を始める間（描画直後の setState を避ける意味もある）
    const t = setTimeout(() => setReveal(true), 120);
    return () => clearTimeout(t);
  }, [settledWithBets, m.id]);

  function closeReveal() {
    setReveal(false);
    try {
      window.localStorage.setItem(revealKey(m.id), "1");
    } catch {
      // 記録できなくても閉じる操作は成立させる
    }
    blip(300, 0.07);
  }

  function closeWin() {
    setWin(false);
    blip(300, 0.07);
  }

  function onKey(e: KeyboardEvent) {
    // 的中演出はどのキーでも閉じる（下の結果演出はそのまま残る）
    if (win) {
      e.preventDefault();
      closeWin();
      return;
    }
    // 結果演出を出している間は閉じる操作だけ受け付ける
    if (reveal) {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        closeReveal();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (picking) setPicking(0);
      else back();
      return;
    }
    // 入力欄・ボタンにフォーカスがあるときはそちらの操作を優先する
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "F1") {
      // F1 は競技一覧へ戻る（この画面の BACK と同じ）
      e.preventDefault();
      back();
    } else if (handleSectionKey(e.key, router)) {
      e.preventDefault();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      doRetry();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      enterKey();
    }
  }

  // 最新のハンドラをイベント・タイマーから呼べるようにする
  const keyRef = useRef(onKey);
  const pollRef = useRef(() => {});
  useEffect(() => {
    keyRef.current = onKey;
    pollRef.current = () => {
      if (!processing) void refresh(false);
    };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    const t = setInterval(() => pollRef.current(), POLL_MS);
    return () => {
      window.removeEventListener("keydown", h);
      clearInterval(t);
    };
  }, []);

  // ---- 描画値 ----
  const totalPool = m.kinds.reduce((a, k) => a + poolTotal(view.pools[k]), 0);
  const winnerId = m.resultOrder?.[0] ?? null;
  const myPayout = sumPayouts(view.myBets);
  const myStaked = view.myBets.reduce((a, b) => a + b.amount, 0);
  // 確定着順は最低 1 件しか保証されないため（overall・custom・field）、足りない枠は「―」で埋める
  const finalIds = (m.resultOrder ?? []).slice(0, 3);
  const finalNums = [0, 1, 2].map((i) => (finalIds[i] ? numOf(finalIds[i]) : "―"));
  const finalNames = [0, 1, 2].map((i) => (finalIds[i] ? nameOf(finalIds[i]) : "―"));

  const oddsRows = m.options.map((o, i) => {
    const odds = estimateOdds(pool, kind, o.id);
    const mine = sumStakes(view.myBets, kind, o.id);
    return {
      id: o.id,
      num: o.num,
      name: o.name,
      tag: winnerId === o.id ? "◎ WINNER" : mine > 0 ? `BET ${formatPoints(mine)}` : "",
      odds: formatOdds(odds),
      hasOdds: odds !== null,
      pool: formatPoints(pool[o.id] ?? 0),
      selected: target === o.id,
      cursor: cursor === i,
      flash: flash.includes(`${kind}:${o.id}`),
    };
  });

  const triSlots = [0, 1, 2].map((i) => {
    const id = tri[i];
    return {
      rank: RANKS[i],
      val: id ? numOf(id) : "－",
      name: id ? nameOf(id) : "TAP TO SELECT",
      active: picking === i + 1,
      filled: id !== null,
    };
  });
  const pickCells =
    isTri && picking > 0
      ? m.options.map((o) => {
          const used = tri.indexOf(o.id);
          const here = used === picking - 1;
          const blocked = used >= 0 && !here;
          const winOdds = estimateOdds(view.pools.win, "win", o.id);
          return {
            id: o.id,
            num: o.num,
            sub: blocked ? `AS ${RANKS[used]}` : winOdds === null ? "―" : `WIN ${formatOdds(winOdds)}`,
            blocked,
            here,
          };
        })
      : [];

  const customOptions = m.options.map((o) => ({
    id: o.id,
    num: o.num,
    name: o.name,
    odds: formatOdds(estimateOdds(view.pools.win, "win", o.id)),
    pool: formatPoints(view.pools.win[o.id] ?? 0),
    selected: target === o.id,
    flash: flash.includes(`win:${o.id}`),
  }));

  const errorView: BetErrorView | null =
    error === "balance"
      ? {
          title: "INSUFFICIENT BALANCE",
          pairs: {
            l1: "BALANCE",
            v1: `${formatPoints(balance)} C`,
            l2: "BET",
            v2: `${amount === null ? "―" : formatPoints(amount)} C`,
          },
          body: "所持クレジットが足りない。借入（ADVANCE CREDIT）で補充できる。入力内容はそのまま残る。",
        }
      : error === "stake"
        ? { title: "INVALID STAKE", body: "1以上の整数のみ。0・マイナス・小数は受け付けない。" }
        : error === "closed"
          ? { title: "BETTING CLOSED", body: "締切後は新規ベット・追加・取消ができない。" }
          : error === "conn"
            ? { title: "CONNECTION ERROR", body: "NODE 79 との接続が切れた。入力内容は保持している。", retry: true }
            : null;

  const estReturn = stakeOk ? estimateReturn(curOdds, amount) : null;
  const led: LedTone = !open ? "off" : remaining < 60_000 ? "alert" : selection ? "armed" : "ready";
  const statusLine =
    link === "lost"
      ? "> LINK LOST ・ PRESS [R] TO RETRY"
      : toast
        ? `> ${toast}`
        : open
          ? selection
            ? "> READY ・ PRESS [ENTER] TO BET"
            : isTri
              ? "> SELECT 1ST・2ND・3RD"
              : "> SELECT TARGET ・ TAP A ROW"
          : status === "settled"
            ? "> SETTLED ・ RESULT CONFIRMED"
            : "> BETTING CLOSED ・ TALLYING";
  const raceLabel = m.type === "overall" ? "FINAL" : m.type === "custom" ? "SPECIAL" : `RACE ${m.no}`;
  // 的中演出に出す値（払戻が 1 以上のベットだけを集計する。計算は lib 側）
  const hits = summarizeHits(view.myBets);
  const hitPicks = view.myBets
    .filter((b) => (b.payoutAmount ?? 0) > 0)
    .map((b) => `${isCustom ? "二択" : KIND_JP[b.kind]} ${pickLabel(b.kind, b.selection)}`);
  // 自動・手動の更新直後だけ LIVE を UPDATE に変える（初回表示では点さない）
  const pulse = link !== "lost" && lastSync !== initial.serverNow && now - Date.parse(lastSync) < PULSE_MS;

  return (
    <Cabinet
      credit={balance}
      link={link === "lost" ? "lost" : processing ? "busy" : "online"}
      controls={
        <HardwareControls
          fkeys={casinoFKeys("market", router)}
          onBack={win ? closeWin : back}
          onEnter={win ? closeWin : reveal ? closeReveal : enterKey}
          enterHint={selection && open ? "PLACE BET" : "SELECT"}
          enterReady={open}
          led={led}
        />
      }
    >
      <Lcd
        tabs={LCD_TABS("market")}
        clock={formatClock(now)}
        sync={{
          label: link === "lost" ? "LAST DATA" : "LAST SYNC",
          time: formatClock(Date.parse(lastSync)),
          live: link === "lost" ? "LINK LOST" : pulse ? "UPDATE" : "LIVE",
          lost: link === "lost",
          pulse,
          keyLabel: link === "lost" ? "[R] RETRY" : "[R] SYNC",
          onSync: doRetry,
        }}
        subTitle={`MARKET / ${raceLabel}`}
        status={win ? `> HIT ・ PAYOUT +${formatPoints(hits.payout)} C` : reveal ? "> RESULT ・ [ENTER] CLOSE" : statusLine}
        statusAlert={link === "lost"}
        statusRight={open ? "MARKET OPEN" : status === "settled" ? "SETTLED" : "MARKET CLOSED"}
        overlay={
          <>
            {reveal && (
              <ResultReveal
                numbers={m.options.map((o) => o.num)}
                finalNums={finalNums}
                finalNames={finalNames}
                hit={myPayout > 0}
                payout={myPayout}
                staked={myStaked}
                onClose={closeReveal}
                onDone={() => setWin(hits.count > 0)}
              />
            )}
            {win && (
              <WinFx
                amount={formatPoints(hits.payout)}
                rate={formatOdds(hits.rate)}
                race={`${raceLabel} ・ ${m.en}`}
                pick={hitPicks.join(" / ")}
                stake={formatPoints(hits.stake)}
                onClose={closeWin}
              />
            )}
          </>
        }
      >
        <StatusBar
          balance={formatPoints(balance)}
          debt={formatPoints(view.account.debtAmount)}
          hasDebt={view.account.debtAmount > 0}
          onBack={back}
        />
        <div className="mb-[11px] mt-[9px] h-px bg-lcd-text/20" />
        <EventHeader
          no={m.no}
          title={m.title}
          sub={`${m.en} ・ POOL ${formatPoints(totalPool)} C ・ PLAYERS ${view.players} ・ HOUSE CUT 0%`}
          status={status}
          clock={open ? formatCountdown(remaining) : "--:--:--"}
          urgent={open && remaining < URGENT_MS}
        />
        {m.kinds.length > 1 && <BetTypeTabs kinds={m.kinds} current={kind} onSelect={selectKind} />}

        {status === "settled" && winnerId && (
          <SettledPanel
            winner={nameOf(winnerId)}
            payRate={formatOdds(estimateOdds(view.pools.win, "win", winnerId))}
            myResult={myPayout > 0 ? `+${formatPoints(myPayout)} C` : view.myBets.length > 0 ? "NO HIT" : "―"}
            hit={myPayout > 0}
          />
        )}

        {isCustom ? (
          <CustomChoice options={customOptions} onPick={pick} />
        ) : isTri ? (
          <TrifectaPicker
            slots={triSlots}
            onSlot={openSlot}
            combo={selection ? selection.map(numOf).join(" - ") : "— - — - —"}
            odds={formatOdds(curOdds)}
            hasOdds={curOdds !== null}
            pickRank={picking > 0 ? RANKS[picking - 1] : null}
            cells={pickCells}
            onPick={(id) => setTriAt(picking - 1, id)}
            onClose={() => setPicking(0)}
          />
        ) : (
          <OddsBoard rows={oddsRows} poolLabel="POOL" onPick={pick} onHover={setCursor} />
        )}

        {errorView && <BetErrorPanel error={errorView} onRetry={doRetry} />}

        <BetSlip
          ready={selection !== null}
          minHint={open ? (isTri ? "1着・2着・3着を指定する" : "対象をタップして選択する") : status === "settled" ? "結果確定済み" : "締切済み"}
          kindLabel={isCustom ? "二択" : KIND_JP[kind]}
          selLabel={isTri ? tri.map((id) => (id ? numOf(id) : "－")).join(" → ") : target ? `${numOf(target)} ${nameOf(target)}` : ""}
          oddsLabel={isTri ? "EST. ODDS" : "ODDS"}
          oddsText={formatOdds(curOdds)}
          stakeStr={stakeStr}
          stakeOk={stakeOk}
          onStake={editStake}
          onStakeEnter={() => void place()}
          keys={[
            { label: "+10", onPress: () => addStake(10) },
            { label: "+50", onPress: () => addStake(50) },
            { label: "+100", onPress: () => addStake(100) },
            {
              label: "MAX",
              onPress: () => {
                setStakeStr(String(balance));
                clearInputError();
                blip(700, 0.04);
              },
            },
          ]}
          subKeys={[
            { label: "−10", onPress: () => addStake(-10) },
            { label: "−50", onPress: () => addStake(-50) },
            { label: "−100", onPress: () => addStake(-100) },
            {
              label: "CLEAR",
              onPress: () => {
                setStakeStr("0");
                clearInputError();
                blip(420, 0.05);
              },
            },
          ]}
          retText={estReturn === null ? "―" : formatPoints(estReturn)}
          betLabel={
            processing
              ? "PROCESSING..."
              : open
                ? `BET ${amount === null ? "―" : formatPoints(amount)} C`
                : status === "settled"
                  ? "SETTLED"
                  : "BETTING CLOSED"
          }
          betArmed={open && stakeOk && !processing}
          betDisabled={!open || processing}
          onBet={() => void place()}
        />

        <MyBets
          rows={view.myBets.map((b) => ({
            id: b.id,
            kind: isCustom ? "二択" : KIND_JP[b.kind],
            pick: pickLabel(b.kind, b.selection),
            amount: formatPoints(b.amount),
            result:
              b.payoutAmount !== null
                ? b.payoutAmount > 0
                  ? `+${formatPoints(b.payoutAmount)} C`
                  : "NO HIT"
                : open
                  ? ""
                  : "LOCKED",
            tone: b.payoutAmount !== null ? (b.payoutAmount > 0 ? "hit" : "miss") : "lock",
            cancelable: open && b.payoutAmount === null,
          }))}
          open={mineOpen}
          onToggle={() => {
            setMineOpen((v) => !v);
            blip(520, 0.05);
          }}
          onCancel={(id) => void cancel(id)}
          onBack={back}
        />
      </Lcd>

      {accept && (
        <div
          role="status"
          className="ug-accept pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,6,3,.72)] px-4"
        >
          <div className="border border-lcd-ok bg-[#070b05] px-[30px] py-[22px] text-center font-term">
            <div className="text-xs tracking-[.3em] text-lcd-ok">BET ACCEPTED</div>
            <div className="mt-2.5 font-jp text-[clamp(15px,4.4vw,20px)] tracking-[.06em] text-lcd-text">{accept.line1}</div>
            <div className="mt-2 text-[10px] tracking-[.26em] text-lcd-dim">BALANCE</div>
            <div className="text-[clamp(22px,6.4vw,32px)] tabular-nums text-lcd-hi">{accept.line2}</div>
          </div>
        </div>
      )}
    </Cabinet>
  );
}
