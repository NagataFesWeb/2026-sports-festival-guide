// Market タブ。締切の変更・締切／再開、全体優勝・二択 Market の作成
import {
  closeMarketAction,
  createCustomMarketAction,
  createOverallMarketAction,
  reopenMarketAction,
  updateMarketDeadlineAction,
} from "@/app/admin/actions";
import { formatDateTime, toDateTimeLocal } from "@/lib/admin/datetime";
import type { MarketSummaryRow } from "@/lib/admin/service";
import { formatPoints } from "@/lib/casino/format";
import { ActionForm } from "./ActionForm";
import { MARKET_STATUS_LABELS, MARKET_TYPE_LABELS } from "./labels";

export function MarketsTab({ rows }: { rows: MarketSummaryRow[] }) {
  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">Market 一覧</h2>
        <p className="adm-note mb-3">
          「締切（締切時刻経過）」は締切時刻を過ぎて自動的に締め切られた状態です。種目 Market の締切は進行の遅延ぶんずれるため、
          定刻と締切見込みが違うときは両方を出します。結果の確定は「結果入力」タブから行います。
        </p>

        <div className="adm-scroll">
          <table className="adm-table" style={{ minWidth: "820px" }}>
            <thead>
              <tr>
                <th>番号</th>
                <th>名前</th>
                <th>種別</th>
                <th>状態</th>
                <th>締切（定刻）</th>
                <th>プール</th>
                <th>ベット数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ market, status, heatLabel, effectiveDeadline, poolTotal, betCount }) => {
                const settled = market.status === "settled";
                const autoClosed = market.status === "open" && status === "closed";
                const shifted = effectiveDeadline !== market.deadline;
                return (
                  <tr key={market.id}>
                    <td className="adm-num">{market.no}</td>
                    <td>
                      {market.title}
                      {heatLabel !== null && (
                        <span className="adm-chip ml-2" data-tone="yellow">
                          {heatLabel}
                        </span>
                      )}
                      {market.resultOrder && (
                        <span className="adm-note block">
                          勝者 {market.options.find((o) => o.id === market.resultOrder?.[0])?.name ?? "―"}
                        </span>
                      )}
                    </td>
                    <td>{MARKET_TYPE_LABELS[market.type]}</td>
                    <td>
                      {MARKET_STATUS_LABELS[status]}
                      {autoClosed && <span className="adm-note block">（締切時刻経過）</span>}
                    </td>
                    <td>
                      {settled ? (
                        <span className="adm-num">{formatDateTime(market.deadline)}</span>
                      ) : (
                        <ActionForm action={updateMarketDeadlineAction} submitLabel="変更" tone="ghost" inline>
                          <input type="hidden" name="marketId" value={market.id} />
                          <label className="adm-field basis-44">
                            <span>締切（定刻）</span>
                            <input
                              className="adm-input"
                              type="datetime-local"
                              name="deadline"
                              defaultValue={toDateTimeLocal(market.deadline)}
                              required
                            />
                          </label>
                        </ActionForm>
                      )}
                      {shifted && (
                        <span className="adm-note text-om-pink block">
                          締切見込み {formatDateTime(effectiveDeadline)}（進行の遅延を反映）
                        </span>
                      )}
                    </td>
                    <td className="adm-num">{formatPoints(poolTotal)}pt</td>
                    <td className="adm-num">{betCount}</td>
                    <td>
                      {settled ? (
                        <span className="adm-note">―</span>
                      ) : market.status === "open" ? (
                        <ActionForm action={closeMarketAction} submitLabel="今すぐ締め切る" tone="ghost" inline>
                          <input type="hidden" name="marketId" value={market.id} />
                        </ActionForm>
                      ) : (
                        <ActionForm action={reopenMarketAction} submitLabel="再開" tone="ghost" inline>
                          <input type="hidden" name="marketId" value={market.id} />
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8}>Market がありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="adm-card">
          <h2 className="adm-title">全体優勝の Market を作る</h2>
          <p className="adm-note">対象は登録済みの全チームです。</p>
          <ActionForm action={createOverallMarketAction} submitLabel="作成する" className="mt-2">
            <label className="adm-field">
              <span>締切</span>
              <input className="adm-input" type="datetime-local" name="deadline" required />
            </label>
          </ActionForm>
        </div>

        <div className="adm-card">
          <h2 className="adm-title">二択の Market を作る</h2>
          <p className="adm-note">大将戦の紅白など、チーム以外の二択に使います。</p>
          <ActionForm action={createCustomMarketAction} submitLabel="作成する" className="mt-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="adm-field">
                <span>名前</span>
                <input className="adm-input" type="text" name="title" placeholder="大将戦 紅白" required />
              </label>
              <label className="adm-field">
                <span>英語名（空なら名前と同じ）</span>
                <input className="adm-input" type="text" name="en" placeholder="GENERAL BATTLE" />
              </label>
              <label className="adm-field">
                <span>選択肢 A</span>
                <input className="adm-input" type="text" name="optionA" placeholder="紅組" required />
              </label>
              <label className="adm-field">
                <span>選択肢 B</span>
                <input className="adm-input" type="text" name="optionB" placeholder="白組" required />
              </label>
              <label className="adm-field sm:col-span-2">
                <span>締切</span>
                <input className="adm-input" type="datetime-local" name="deadline" required />
              </label>
            </div>
          </ActionForm>
        </div>
      </div>
    </section>
  );
}
