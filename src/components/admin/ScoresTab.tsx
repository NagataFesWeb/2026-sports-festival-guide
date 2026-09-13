// 得点タブ。総合順位（実行委員には常に見える）・種目別の内訳・表側への公開切り替え。
// 集計は src/lib/festival/standings.ts に任せ、この画面では計算しない
import { publishScoresAction, unpublishScoresAction } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/admin/datetime";
import { eventPoints, type StandingRow } from "@/lib/festival/standings";
import type { Event, EventResult, Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";

interface Props {
  teams: Team[];
  events: Event[];
  results: EventResult[];
  standings: StandingRow[];
  /** 表側に公開した時刻。null なら非公開 */
  scoresPublishedAt: string | null;
}

export function ScoresTab({ teams, events, results, standings, scoresPublishedAt }: Props) {
  const published = scoresPublishedAt !== null;

  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">総合順位</h2>
        <p className="adm-note mb-3">
          確定したヒートの得点を合計した現在の順位です。同点は優勝回数の多い順。実行委員にはいつでも見えますが、表側（トップ・
          <code className="adm-code">/ranking</code>）には公開するまで出ません。
        </p>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>順位</th>
                <th>チーム</th>
                <th>得点</th>
                <th>優勝ヒート</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => (
                <tr key={row.team.id}>
                  <td className="adm-num">{row.rank}</td>
                  <td>
                    <span className="adm-swatch mr-2" style={{ background: row.team.color }} aria-hidden="true" />
                    {row.team.num} {row.team.name}
                  </td>
                  <td className="adm-num">{row.points}</td>
                  <td className="adm-num">{row.wins}</td>
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td colSpan={4}>チームが登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2 className="adm-title">種目別の内訳</h2>
        <p className="adm-note mb-3">ヒートをまたいで合計した種目ごとの得点です。空欄はまだ結果が確定していないヒートです。</p>
        <div className="adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>種目</th>
                <th>確定ヒート</th>
                {teams.map((team) => (
                  <th key={team.id} className="adm-num">
                    {team.num}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const points = eventPoints(results, event.id);
                const doneHeats = event.heats.filter((h) => results.some((r) => r.eventId === event.id && r.heatId === h.id));
                return (
                  <tr key={event.id}>
                    <td>
                      <span className="adm-num mr-1">{event.no}</span>
                      {event.name}
                    </td>
                    <td className="adm-note">
                      {doneHeats.length === 0
                        ? `未確定（全 ${event.heats.length} ヒート）`
                        : `${doneHeats.map((h) => h.label).join("・")}（${doneHeats.length}/${event.heats.length}）`}
                    </td>
                    {teams.map((team) => (
                      <td key={team.id} className="adm-num">
                        {points[team.id] ?? ""}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {events.length === 0 && (
                <tr>
                  <td colSpan={2 + teams.length}>種目が登録されていません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card">
        <h2 className="adm-title">得点・順位の公開</h2>
        <p className="adm-note mb-3">
          閉会式で公開します。公開するとトップページの 8 クラスに得点が入り、
          <code className="adm-code">/ranking</code> の順位が表側から見えるようになります。
        </p>
        <p className="mb-2 text-[13px] font-black">
          いまの状態:{" "}
          {published ? (
            <span className="text-om-blue">公開中（{formatDateTime(scoresPublishedAt)}）</span>
          ) : (
            <span className="text-om-pink">非公開</span>
          )}
        </p>
        {published ? (
          <ActionForm action={unpublishScoresAction} submitLabel="非公開に戻す" tone="ghost">
            <ConfirmCheck label="確認しました（表側から得点・順位を隠します）" />
          </ActionForm>
        ) : (
          <ActionForm action={publishScoresAction} submitLabel="得点を公開する">
            <ConfirmCheck label="確認しました（全校に得点と順位を公開します）" />
          </ActionForm>
        )}
      </div>
    </section>
  );
}
