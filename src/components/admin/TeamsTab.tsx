// チーム編集タブ。1 チーム 1 フォーム（行ごとに保存する）
import { saveTeamAction } from "@/app/admin/actions";
import type { Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";

export function TeamsTab({ teams }: { teams: Team[] }) {
  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <h2 className="adm-title">チーム</h2>
        <p className="adm-note mb-3">
          チーム名とチームカラーを行ごとに保存します。カラーは順位表と組み合わせのスウォッチに使われます（{teams.length} チーム）。
        </p>

        <div className="grid gap-2">
          {teams.map((team) => (
            <div key={team.id} className="adm-row">
              <ActionForm action={saveTeamAction} submitLabel="保存" tone="ghost" inline>
                <input type="hidden" name="id" value={team.id} />
                <input type="hidden" name="num" value={team.num} />
                <span className="adm-num text-xl" aria-label={`チーム番号 ${team.num}`}>
                  {team.num}
                </span>
                <span className="adm-swatch" style={{ background: team.color }} aria-hidden="true" />
                <label className="adm-field min-w-0 flex-1 basis-48">
                  <span>チーム名</span>
                  <input className="adm-input" type="text" name="name" defaultValue={team.name} required />
                </label>
                <label className="adm-field basis-24">
                  <span>カラー</span>
                  <input className="adm-input" type="color" name="color" defaultValue={team.color} />
                </label>
              </ActionForm>
            </div>
          ))}
          {teams.length === 0 && <p className="adm-note">チームが登録されていません</p>}
        </div>
      </div>
    </section>
  );
}
