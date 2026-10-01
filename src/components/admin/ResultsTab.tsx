// 種目・学年を選び、全組の順位だけを並べ替える。
import Link from "next/link";
import { confirmEventResultAction, removeEventResultAction, settleCustomAction, settleOverallAction } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/admin/datetime";
import type { Market } from "@/lib/casino/types";
import { HORSE_OPTIONS, isHorseEvent } from "@/lib/casino/event-rules";
import type { Event, EventResult, Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";
import { MARKET_STATUS_LABELS } from "./labels";
import { MarketWinnerForm } from "./MarketWinnerForm";
import { ResultEntryForm } from "./ResultEntryForm";
import { ResultEventSelect } from "./ResultEventSelect";

interface Props {
  events: Event[]; teams: Team[]; results: EventResult[]; markets: Market[];
  selectedEventId?: string;
  selectedHeatId?: string;
}

function ConfirmedOrder({ order, teams }: { order: readonly string[]; teams: readonly Team[] }) {
  const byId = new Map(teams.map(t => [t.id, t]));
  return <ol className="adm-order-list" aria-label="確定した順位">{order.map((id, index) => <li key={id} className="adm-order-row">
    <span className="adm-num">{index + 1}位</span><span className="adm-order-name">{byId.get(id)?.name ?? id}</span>
  </li>)}</ol>;
}

export function ResultsTab({ events, teams, results, markets, selectedEventId, selectedHeatId }: Props) {
  const options = teams.map(t => ({ id: t.id, num: t.num, name: t.name, color: t.color }));
  const overall = markets.find(m => m.type === "overall");
  const eligible = events.filter(event => (event.kind !== "ceremony" && event.kind !== "club") || markets.some(m => m.eventId === event.id));
  const completed = (event: Event) => event.heats.filter(heat => results.some(r => r.eventId === event.id && r.heatId === heat.id)).length;
  const selected = selectedEventId === "overall" ? undefined : eligible.find(event => event.id === selectedEventId)
    ?? eligible.find(event => completed(event) < event.heats.length) ?? eligible[0];
  const heat = selected?.heats.find(h => h.id === selectedHeatId)
    ?? selected?.heats.find(h => !results.some(r => r.eventId === selected.id && r.heatId === h.id)) ?? selected?.heats[0];
  const result = results.find(r => r.eventId === selected?.id && r.heatId === heat?.id);
  const market = markets.find(m => m.eventId === selected?.id && m.heatId === heat?.id);

  return <section className="grid gap-4">
    <div className="adm-card">
      <h2 className="adm-title">結果入力 — 種目を選択</h2>
      <p className="adm-note">1〜8組を上から順位順に並べて確認するだけです。騎馬戦は紅組・白組の勝った側を上にします。得点の入力は不要です。確定時に配当と利子を自動で処理します。</p>
    </div>
    <ResultEventSelect selected={selected?.id ?? "overall"} options={[
      ...eligible.map(event => ({ id: event.id, label: `${event.no} ${event.name}（${completed(event)}/${event.heats.length}確定）` })),
      { id: "overall", label: `総合順位・優勝（${overall?.status === "settled" ? "確定済み" : "未確定"}）` },
    ]} />
    <nav aria-label="結果入力する種目" className="hidden gap-2 sm:grid sm:grid-cols-2 lg:grid-cols-3">
      {eligible.map(event => <Link key={event.id} href={`/admin?tab=results&event=${encodeURIComponent(event.id)}`}
        className="adm-result-link" aria-current={selected?.id === event.id ? "page" : undefined}>
        <strong>{event.no} {event.name}</strong><span>{completed(event)} / {event.heats.length} 確定 →</span>
      </Link>)}
      <Link href="/admin?tab=results&event=overall" className="adm-result-link" aria-current={selectedEventId === "overall" ? "page" : undefined}>
        <strong>総合順位・優勝</strong><span>{overall?.status === "settled" ? "確定済み" : "閉会式の順位を並べる"} →</span>
      </Link>
    </nav>
    {eligible.length === 0 && selectedEventId !== "overall" && <div className="adm-card"><p>結果入力できる種目がありません。「種目」から競技とヒートを登録してください。</p><Link href="/admin?tab=events" className="adm-btn">種目を登録 →</Link></div>}
    {selected && heat && <div className="adm-card">
      <h3 className="adm-title mb-3">{selected.no} {selected.name}</h3>
      {selected.heats.length > 1 && <nav aria-label="結果入力する学年" className="mb-3 flex flex-wrap gap-2">
        {selected.heats.map(h => <Link key={h.id} className="adm-btn" data-tone={heat.id === h.id ? "primary" : undefined}
          aria-current={heat.id === h.id ? "page" : undefined}
          href={`/admin?tab=results&event=${encodeURIComponent(selected.id)}&heat=${encodeURIComponent(h.id)}`}>
          {h.label}{results.some(r => r.eventId === selected.id && r.heatId === h.id) ? "（確定済み）" : ""}
        </Link>)}
      </nav>}
      <p className="adm-note mb-2">{heat.label} ・ {market ? MARKET_STATUS_LABELS[market.status] : "予想対象なし"}</p>
      {result ? <div className="grid gap-2">
        <p className="text-om-blue font-black">確定済み（{formatDateTime(result.confirmedAt)}）</p>
        {isHorseEvent(selected) ? <p>確定済み：{HORSE_OPTIONS.find(option => option.id === result.order[0])?.name}の勝利</p> : <ConfirmedOrder order={result.order} teams={teams} />}
        {market?.status === "settled" ? <p className="adm-note">配当確定済みのため、この順位は変更できません。</p> :
          <ActionForm action={removeEventResultAction} submitLabel="取り消して並べ直す" tone="ghost">
            <input type="hidden" name="eventId" value={selected.id} /><input type="hidden" name="heatId" value={heat.id} />
            <ConfirmCheck label="確定した順位を取り消します" />
          </ActionForm>}
      </div> : market?.status === "settled" ? <p role="alert">配当確定済みです。結果データの不整合を運営担当に確認してください。</p> :
        <ResultEntryForm key={`${selected.id}:${heat.id}`} action={confirmEventResultAction} options={isHorseEvent(selected) ? HORSE_OPTIONS : options}
          hidden={{ eventId: selected.id, heatId: heat.id }} confirmLabel="確定すると配当と利子が処理されます。配当後の順位変更はできません。" />}
    </div>}
    {selectedEventId === "overall" && <div className="adm-card">
      <h2 className="adm-title mb-3">総合順位・優勝</h2>
      <p className="adm-note mb-2">閉会式で発表する1〜8位を並べてください。競技の得点からの集計は行いません。1位の組を全体優勝として精算します。</p>
      {!overall ? <p className="adm-note">全体優勝の予想対象がありません。<Link href="/admin?tab=markets">「Market」タブで作成してください。</Link></p> :
        overall.status === "settled" ? <>
          <p className="text-om-blue font-black mb-2">確定済み</p><ConfirmedOrder order={overall.resultOrder ?? []} teams={teams} />
          <Link href="/admin?tab=scores" className="adm-btn mt-3">総合順位の公開へ →</Link>
        </> : <ResultEntryForm key="overall" action={settleOverallAction} options={options}
          confirmLabel="1位の組へ賭けた口座に配当を付与します。確定後の順位変更はできません。" />}
    </div>}
    {markets.some(m => m.type === "custom") && <details className="adm-card">
      <summary className="adm-title cursor-pointer">追加の二択予想</summary>
      {markets.filter(m => m.type === "custom").map(m => <div key={m.id} className="adm-row mt-3">
        <h3 className="adm-subtitle">{m.title}</h3>
        {m.status === "settled" ? <p>確定済み：{m.options.find(o => o.id === m.resultOrder?.[0])?.name}</p> :
          <MarketWinnerForm action={settleCustomAction} options={m.options} hidden={{ marketId: m.id }} confirmLabel="この勝者で確定します" />}
      </div>)}
    </details>}
  </section>;
}
