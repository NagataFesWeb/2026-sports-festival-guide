// 結果入力タブ。種目 × ヒートごとの結果確定と、全体優勝・二択 Market の勝者確定
import { confirmEventResultAction, removeEventResultAction, settleCustomAction, settleOverallAction } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/admin/datetime";
import type { Market } from "@/lib/casino/types";
import type { StandingRow } from "@/lib/festival/standings";
import type { Event, EventResult, Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";
import { KIND_LABELS, MARKET_STATUS_LABELS } from "./labels";
import { MarketWinnerForm, type WinnerOption } from "./MarketWinnerForm";
import { ResultEntryForm, type OrderOption } from "./ResultEntryForm";
import { ScoreEntryForm } from "./ScoreEntryForm";
import Link from "next/link";

interface Props {
  events: Event[];
  teams: Team[];
  results: EventResult[];
  markets: Market[];
  /** 現在の総合順位（全体優勝の目安として出す） */
  standings: StandingRow[];
  selectedEventId?: string;
}

function toOptions(teams: readonly Team[]): OrderOption[] {
  return teams.map((t) => ({ id: t.id, num: t.num, name: t.name }));
}

/** 確定済みの着順と得点 */
function ConfirmedResult({ result, nameOf }: { result: EventResult; nameOf: (id: string) => string }) {
  return (
    <div className="adm-scroll">
      <table className="adm-table">
        <thead>
          <tr>
            <th>順位</th>
            <th>チーム</th>
            <th>得点</th>
          </tr>
        </thead>
        <tbody>
          {result.order.map((teamId, i) => (
            <tr key={teamId}>
              <td className="adm-num">{i + 1}位</td>
              <td>{nameOf(teamId)}</td>
              <td className="adm-num">{result.points[teamId] ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsTab({ events, teams, results, markets, standings, selectedEventId }: Props) {
  const nameById = new Map(teams.map((t) => [t.id, `${t.num} ${t.name}`]));
  const nameOf = (id: string): string => nameById.get(id) ?? id;
  const options = toOptions(teams);
  const teamWinnerOptions: WinnerOption[] = teams.map((t) => ({ id: t.id, num: t.num, name: t.name, color: t.color }));
  const overall = markets.find((m) => m.type === "overall");
  const customMarkets = markets.filter((m) => m.type === "custom");
  const eligible = events.filter(event =>
    (event.kind !== "ceremony" && event.kind !== "club") || markets.some(m => m.eventId === event.id),
  );
  const completed = (event: Event) => event.heats.filter(heat => results.some(r => r.eventId === event.id && r.heatId === heat.id)).length;
  const selected = eligible.find(event => event.id === selectedEventId)
    ?? eligible.find(event => completed(event) < event.heats.length)
    ?? eligible[0];

  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">結果入力 — 種目を選択</h2>
        <p className="adm-note">
          ヒートごとに確定します。順位点のある種目は着順を、順位点が無い種目（玉入れ・棒引き）は得点を入力してください。確定すると紐づく
          Market が同時に精算されます（配当と利子はサーバー側で計算します）。
        </p>
      </div>

      <nav aria-label="結果入力する種目" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map(event => <Link key={event.id} href={`/admin?tab=results&event=${encodeURIComponent(event.id)}`}
          className="adm-result-link" aria-current={selected?.id === event.id ? "page" : undefined}>
          <strong>{event.no} {event.name}</strong>
          <span>{completed(event)} / {event.heats.length} ヒート確定 ・ {event.rankPoints.length ? "着順を入力" : "得点を入力"} →</span>
        </Link>)}
      </nav>
      {eligible.length === 0 && <div className="adm-card"><p>結果入力できる種目がありません。「種目」から競技とヒートを登録してください。</p><Link href="/admin?tab=events" className="adm-btn">種目を登録 →</Link></div>}

      {(selected ? [selected] : []).map((event) => {
        const scoreMode = event.rankPoints.length === 0;
        // 式典・部活動の種目（開会式・部行進など）はクラス得点が無いので結果入力の対象外。
        // ただし Market が紐づいていれば（例外的に賭けの対象にした場合）表示する
        const hasMarket = markets.some((m) => m.eventId === event.id);
        if ((event.kind === "ceremony" || event.kind === "club") && !hasMarket) return null;
        return (
          <div key={event.id} className="adm-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="adm-num text-lg">{event.no}</span>
              <h3 className="adm-subtitle">{event.name}</h3>
              <span className="adm-chip" data-tone="mute">
                {KIND_LABELS[event.kind]}
              </span>
              <span className="adm-chip" data-tone="mute">
                {scoreMode ? "得点を直接入力" : `順位点 ${event.rankPoints.join(",")}`}
              </span>
            </div>

            <div className="grid gap-3">
              {event.heats.map((heat) => {
                const result = results.find((r) => r.eventId === event.id && r.heatId === heat.id);
                const market = markets.find((m) => m.eventId === event.id && m.heatId === heat.id);
                const settled = market?.status === "settled";
                const confirmLabel = market && !settled
                  ? "確認しました（Market も同時に精算されます）"
                  : "確認しました（この操作は取り消せません）";

                return (
                  <div key={heat.id} className="adm-row">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="adm-chip" data-tone="yellow">
                        {heat.label}
                      </span>
                      <span className="adm-note">
                        {market ? `Market ${MARKET_STATUS_LABELS[market.status]}` : "Market なし"}
                      </span>
                    </div>

                    {result ? (
                      <div className="grid gap-2">
                        <p className="text-om-blue text-[12px] font-black">
                          確定済み（{formatDateTime(result.confirmedAt)}）
                        </p>
                        <ConfirmedResult result={result} nameOf={nameOf} />
                        {settled ? (
                          <p className="adm-note">
                            Market が精算済みのため、この結果は変更できません（配当を払い戻した後の変更は認めない仕様です）。
                          </p>
                        ) : (
                          <ActionForm action={removeEventResultAction} submitLabel="取り消して再入力" tone="ghost">
                            <input type="hidden" name="eventId" value={event.id} />
                            <input type="hidden" name="heatId" value={heat.id} />
                            <ConfirmCheck label="確認しました（確定した着順と得点を取り消します）" />
                          </ActionForm>
                        )}
                      </div>
                    ) : scoreMode ? (
                      <ScoreEntryForm teams={teams} eventId={event.id} heatId={heat.id} confirmLabel={confirmLabel} />
                    ) : (
                      <ResultEntryForm
                        action={confirmEventResultAction}
                        options={options}
                        slots={teams.length || 8}
                        requiredCount={event.category === "race" ? 3 : 1}
                        rankPoints={event.rankPoints}
                        hidden={{ eventId: event.id, heatId: heat.id, mode: "rank" }}
                        submitLabel="確定する"
                        confirmLabel={confirmLabel}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="adm-card">
        <h2 className="adm-title">Market の結果確定</h2>
        <p className="adm-note mb-3">
          勝者を押すと配当が自動計算され、借金が残っている口座に利子が付きます。種目の Market は上の「種目の結果」で確定します。
        </p>

        <div className="grid gap-2">
          <div className="adm-row">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="adm-subtitle">体育祭 全体優勝（FINAL）</span>
              <span className="adm-chip" data-tone={overall === undefined ? "mute" : overall.status === "settled" ? "pink" : "blue"}>
                {overall === undefined ? "Market なし" : MARKET_STATUS_LABELS[overall.status]}
              </span>
            </div>
            {overall === undefined ? (
              <p className="adm-note">全体優勝の Market がありません。「Market」タブから作成してください。</p>
            ) : overall.status === "settled" ? (
              <p className="text-om-pink text-[12px] font-black">
                優勝 {nameOf(overall.resultOrder?.[0] ?? "")}
              </p>
            ) : (
              <>
                <p className="adm-note mb-2">
                  現在の総合順位は {standings.map((s) => s.team.num).join(" → ")} です（参考）。
                </p>
                <MarketWinnerForm
                  action={settleOverallAction}
                  options={teamWinnerOptions}
                  confirmLabel="確認しました（全体優勝の Market を精算します）"
                />
              </>
            )}
          </div>

          {customMarkets.map((market) => (
            <div key={market.id} className="adm-row">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="adm-subtitle">{market.title}</span>
                <span className="adm-chip" data-tone={market.status === "settled" ? "pink" : "blue"}>
                  {MARKET_STATUS_LABELS[market.status]}
                </span>
              </div>
              {market.status === "settled" ? (
                <p className="text-om-pink text-[12px] font-black">
                  勝ち {market.options.find((o) => o.id === market.resultOrder?.[0])?.name ?? "―"}
                </p>
              ) : (
                <MarketWinnerForm
                  action={settleCustomAction}
                  options={market.options.map((o) => ({ id: o.id, num: o.num, name: o.name }))}
                  hidden={{ marketId: market.id }}
                  confirmLabel="確認しました（この Market を精算します）"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
