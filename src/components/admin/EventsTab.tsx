// 種目（プログラム）タブ。一覧（ヒートごとの Market 状態つき）＋新規作成／編集フォーム＋Market 作成
import Link from "next/link";
import { createEventMarketAction, removeEventAction, saveEventAction } from "@/app/admin/actions";
import { formatDateTime, toDateTimeLocal } from "@/lib/admin/datetime";
import type { Market } from "@/lib/casino/types";
import { effectiveStart } from "@/lib/festival/schedule";
import type { Event, Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";
import { HeatsEditor } from "./HeatsEditor";
import { CATEGORY_LABELS, FORMATION_LABELS, KIND_LABELS, MARKET_STATUS_LABELS } from "./labels";

interface Props {
  events: Event[];
  teams: Team[];
  markets: Market[];
  /** ?event= で選ばれた編集対象。null なら新規作成 */
  selected: Event | null;
}

/** 組み合わせの入力行（足りない行は空で埋める） */
function entryRows(event: Event | null, count: number): { slot: string; teamId: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    slot: event?.entries[i]?.slot ?? `${i + 1}レーン`,
    teamId: event?.entries[i]?.teamId ?? "",
  }));
}

export function EventsTab({ events, teams, markets, selected }: Props) {
  const rows = entryRows(selected, teams.length || 8);

  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">種目一覧</h2>
        <p className="adm-note mb-3">
          ヒートごとに Market を 1 つ作れます。開始時刻は定刻で、遅延は「進行」タブで動かします。
        </p>
        <div className="adm-scroll">
          <table className="adm-table" style={{ minWidth: "860px" }}>
            <thead>
              <tr>
                <th>番号</th>
                <th>種目名</th>
                <th>区分</th>
                <th>開始</th>
                <th>場所</th>
                <th>ヒートと Market</th>
                <th>編集</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const firstFreeHeat = event.heats.find(
                  (heat) => !markets.some((m) => m.eventId === event.id && m.heatId === heat.id),
                );
                return (
                  <tr key={event.id}>
                    <td className="adm-num">{event.no}</td>
                    <td>
                      {event.name}
                      <span className="adm-note block">{event.en}</span>
                    </td>
                    <td>
                      {KIND_LABELS[event.kind]}
                      <span className="adm-note block">{event.category}</span>
                    </td>
                    <td className="adm-num">
                      {formatDateTime(event.startTime)}
                      {event.delayMin !== 0 && (
                        <span className="adm-note block">
                          実開始 {formatDateTime(effectiveStart(event))}（{event.delayMin > 0 ? "+" : "−"}
                          {Math.abs(event.delayMin)}分）
                        </span>
                      )}
                    </td>
                    <td>{event.location || "―"}</td>
                    <td>
                      <ul className="grid gap-1">
                        {event.heats.map((heat) => {
                          const market = markets.find((m) => m.eventId === event.id && m.heatId === heat.id);
                          return (
                            <li key={heat.id} className="flex flex-wrap items-center gap-2">
                              <span className="adm-chip" data-tone="mute">
                                {heat.label}
                              </span>
                              {market ? (
                                <span className="adm-note">
                                  Market {MARKET_STATUS_LABELS[market.status]}／締切 {formatDateTime(market.deadline)}
                                </span>
                              ) : (
                                <span className="adm-note">Market なし</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {firstFreeHeat !== undefined && (
                        <ActionForm action={createEventMarketAction} submitLabel="Market を作る" inline className="mt-2">
                          <input type="hidden" name="eventId" value={event.id} />
                          <label className="adm-field basis-24">
                            <span>ヒート</span>
                            <select className="adm-input" name="heatId" defaultValue={firstFreeHeat.id}>
                              {event.heats.map((heat) => (
                                <option key={heat.id} value={heat.id}>
                                  {heat.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="adm-field basis-44">
                            <span>締切</span>
                            <input
                              className="adm-input"
                              type="datetime-local"
                              name="deadline"
                              defaultValue={toDateTimeLocal(event.startTime)}
                              required
                            />
                          </label>
                        </ActionForm>
                      )}
                    </td>
                    <td>
                      <Link className="adm-btn" data-size="sm" href={`/admin?tab=events&event=${event.id}`}>
                        編集
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={8}>種目が登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="adm-title">{selected ? `種目を編集（${selected.no} ${selected.name}）` : "種目を新規作成"}</h2>
          {selected && (
            <Link className="adm-btn" data-size="sm" data-tone="ghost" href="/admin?tab=events">
              新規作成に切り替える
            </Link>
          )}
        </div>
        <p className="adm-note mb-3">
          招集案内（集合・持ち物・隊形図）とルールの説明は、そのままマイページの種目カードに出ます。
        </p>

        <ActionForm
          action={saveEventAction}
          submitLabel={selected ? "更新する" : "作成する"}
          // 編集対象が変わったらフォームの初期値を作り直す
          key={selected?.id ?? "new"}
        >
          {selected && <input type="hidden" name="id" value={selected.id} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="adm-field">
              <span>プログラム番号</span>
              <input className="adm-input" type="text" name="no" defaultValue={selected?.no ?? ""} required />
            </label>
            <label className="adm-field">
              <span>種目名</span>
              <input className="adm-input" type="text" name="name" defaultValue={selected?.name ?? ""} required />
            </label>
            <label className="adm-field">
              <span>英語名（裏画面の表示。空なら種目名）</span>
              <input className="adm-input" type="text" name="en" defaultValue={selected?.en ?? ""} />
            </label>
            <label className="adm-field">
              <span>表示区分（マイページの絞り込み）</span>
              <select className="adm-input" name="kind" defaultValue={selected?.kind ?? "track"}>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>賭式の区分</span>
              <select className="adm-input" name="category" defaultValue={selected?.category ?? "race"}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="adm-field">
              <span>開始時刻（定刻）</span>
              <input
                className="adm-input"
                type="datetime-local"
                name="startTime"
                defaultValue={toDateTimeLocal(selected?.startTime ?? null)}
              />
            </label>
            <label className="adm-field">
              <span>場所</span>
              <input className="adm-input" type="text" name="location" defaultValue={selected?.location ?? ""} />
            </label>
            <label className="adm-field">
              <span>対象（「全員参加」「クラス対抗」など）</span>
              <input className="adm-input" type="text" name="participants" defaultValue={selected?.participants ?? ""} />
            </label>
            <input type="hidden" name="rankPoints" value={(selected?.rankPoints ?? []).join(",")} />
          </div>

          <fieldset className="border-om-line mt-4 border-2 p-3">
            <legend className="px-1 text-[12px] font-black">ヒート</legend>
            <HeatsEditor heats={selected?.heats ?? []} />
          </fieldset>

          <fieldset className="border-om-line mt-4 border-2 p-3">
            <legend className="px-1 text-[12px] font-black">招集案内（マイページに出ます）</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="adm-field">
                <span>招集開始の目安（「準備体操退場後」など）</span>
                <input className="adm-input" type="text" name="gatherStart" defaultValue={selected?.gatherStart ?? ""} />
              </label>
              <label className="adm-field">
                <span>集合場所</span>
                <input className="adm-input" type="text" name="gatherPlace" defaultValue={selected?.gatherPlace ?? ""} />
              </label>
              <label className="adm-field">
                <span>持ち物・服装</span>
                <input className="adm-input" type="text" name="belongings" defaultValue={selected?.belongings ?? ""} />
              </label>
              <label className="adm-field">
                <span>招集隊形図</span>
                <select className="adm-input" name="formation" defaultValue={selected?.formation ?? "none"}>
                  {Object.entries(FORMATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="adm-field sm:col-span-2">
                <span>隊形の補足（「本部に向かって右から1年→2年→3年」など）</span>
                <input className="adm-input" type="text" name="formationNote" defaultValue={selected?.formationNote ?? ""} />
              </label>
              <label className="adm-field sm:col-span-2">
                <span>ルール・内容の説明（種目カードの詳細）</span>
                <textarea className="adm-input" name="description" rows={4} defaultValue={selected?.description ?? ""} />
              </label>
            </div>
          </fieldset>

          <fieldset className="border-om-line mt-4 border-2 p-3">
            <legend className="px-1 text-[12px] font-black">組み合わせ（チーム未選択の行は登録されません）</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="adm-field basis-28">
                    <span>枠 {i + 1}</span>
                    <input className="adm-input" type="text" name="slot" defaultValue={row.slot} />
                  </label>
                  <label className="adm-field min-w-0 flex-1 basis-40">
                    <span>チーム</span>
                    <select className="adm-input" name="entryTeam" defaultValue={row.teamId}>
                      <option value="">―</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.num} {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </ActionForm>
      </div>

      {selected && (
        <div className="adm-card">
          <h2 className="adm-title">この種目を削除する</h2>
          <p className="adm-note mb-2">
            確定した結果と紐づく Market もまとめて削除されます。ベットが入っている Market があるときは削除できません。この操作は取り消せません。
          </p>
          <ActionForm action={removeEventAction} submitLabel="削除する" tone="danger">
            <input type="hidden" name="eventId" value={selected.id} />
            <ConfirmCheck label="確認しました（結果・Market も削除されます）" />
          </ActionForm>
        </div>
      )}
    </section>
  );
}
