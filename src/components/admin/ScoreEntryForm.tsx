// 得点を直接入力するフォーム（順位点が無い種目のヒート＝玉入れ・棒引きなど）。
// 着順は「得点の多い順」でサーバー側（service.ts）が導く
import { confirmEventResultAction } from "@/app/admin/actions";
import type { Team } from "@/lib/festival/types";
import { ActionForm } from "./ActionForm";
import { ConfirmCheck } from "./ConfirmCheck";

interface Props {
  teams: Team[];
  eventId: string;
  heatId: string;
  confirmLabel: string;
}

export function ScoreEntryForm({ teams, eventId, heatId, confirmLabel }: Props) {
  return (
    <ActionForm action={confirmEventResultAction} submitLabel="確定する">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="heatId" value={heatId} />
      <input type="hidden" name="mode" value="score" />
      <p className="adm-note mb-2">得点を直接入力（順位は得点順）。空欄のチームは 0 点ではなく「未入力」として扱われます。</p>
      <div className="grid gap-2 sm:grid-cols-4">
        {teams.map((team) => (
          <label key={team.id} className="adm-field">
            <span>
              <span className="adm-swatch mr-1" style={{ background: team.color }} aria-hidden="true" />
              {team.num} {team.name}
            </span>
            <input type="hidden" name="scoreTeam" value={team.id} />
            <input className="adm-input" type="number" name="scorePoints" min={0} step={1} inputMode="numeric" />
          </label>
        ))}
      </div>
      <ConfirmCheck label={confirmLabel} />
    </ActionForm>
  );
}
