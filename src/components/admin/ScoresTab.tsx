// 既存の ?tab=scores は維持し、入力済みの総合順位の公開だけを扱う。
import Link from "next/link";
import { publishScoresAction, unpublishScoresAction } from "@/app/admin/actions";
import { formatDateTime } from "@/lib/admin/datetime";
import type { Market } from "@/lib/casino/types";
import { overallStandings } from "@/lib/festival/standings";
import type { Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";

interface Props { teams: Team[]; markets: Market[]; scoresPublishedAt: string | null }
export function ScoresTab({ teams, markets, scoresPublishedAt }: Props) {
  const standings = overallStandings(teams, markets);
  const published = scoresPublishedAt !== null;
  return <section className="grid gap-4">
    <div className="adm-card">
      <h2 className="adm-title mb-3">総合順位</h2>
      {standings ? <ol className="adm-order-list">{standings.map(row => <li key={row.team.id} className="adm-order-row">
        <span className="adm-num">{row.rank}位</span><span className="adm-order-name"><span className="adm-swatch" style={{ background: row.team.color }} aria-hidden="true" />{row.team.name}</span>
      </li>)}</ol> : <p className="adm-note">総合順位は未確定です。閉会式で発表する順位を入力してください。</p>}
      <Link href="/admin?tab=results&event=overall" className="adm-btn mt-3">総合順位の入力へ →</Link>
    </div>
    <div className="adm-card">
      <h2 className="adm-title">総合順位の公開</h2>
      <p className="adm-note mb-3">閉会式でトップページの8クラスに順位を公開します。個人のポイントランキングは「最終精算」で公開します。</p>
      <p className="mb-2 font-black">{published ? `公開中（${formatDateTime(scoresPublishedAt)}）` : "非公開"}</p>
      {published ? <ActionForm action={unpublishScoresAction} submitLabel="非公開に戻す" tone="ghost"><ConfirmCheck label="総合順位を非公開に戻します" /></ActionForm> :
        standings ? <ActionForm action={publishScoresAction} submitLabel="総合順位を公開する"><ConfirmCheck label="この総合順位を全校に公開します" /></ActionForm> :
        <p className="adm-note">総合順位を確定すると公開できます。</p>}
    </div>
  </section>;
}
