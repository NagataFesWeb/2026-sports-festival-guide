// 進行タブ。「進行の遅延・前倒し」（押した種目以降の時刻をまとめて動かす）
// 時刻の計算は src/lib/festival/schedule.ts の effectiveStart に任せ、ここでは整形だけ行う
import { resetScheduleAction, shiftScheduleAction } from "@/app/admin/actions";
import { formatTime } from "@/lib/admin/datetime";
import { effectiveStart } from "@/lib/festival/schedule";
import type { Event } from "@/lib/festival/types";

/** 遅延（分）の表示。＋は遅延、−は前倒し（記号は U+2212 でボタンと揃える） */
function delayText(delayMin: number): string {
  return delayMin > 0 ? `+${delayMin}分` : `−${Math.abs(delayMin)}分`;
}

/** 1 分だけ動かす小さなフォーム。eventId が空なら全種目が対象 */
function ShiftButton({
  eventId,
  delta,
  label,
  tone,
}: {
  eventId?: string;
  delta: number;
  label: string;
  tone: "primary" | "plain";
}) {
  return (
    <form action={shiftScheduleAction}>
      {eventId !== undefined && <input type="hidden" name="eventId" value={eventId} />}
      <input type="hidden" name="delta" value={String(delta)} />
      <button type="submit" className="adm-btn" data-size="sm" data-tone={tone === "primary" ? "primary" : undefined}>
        {label}
      </button>
    </form>
  );
}

export function ScheduleTab({ events }: { events: Event[] }) {
  return (
    <section className="grid gap-4">
      <div className="adm-card">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="adm-title">進行の遅延・前倒し</h2>
          <div className="flex flex-wrap gap-1.5">
            <ShiftButton delta={-1} label="全体 −1分" tone="plain" />
            <ShiftButton delta={1} label="全体 +1分" tone="primary" />
            <form action={resetScheduleAction}>
              <button type="submit" className="adm-btn" data-size="sm" data-tone="ghost">
                定刻に戻す
              </button>
            </form>
          </div>
        </div>
        <p className="adm-note mb-3">
          押した種目とそれ以降の時刻をまとめて動きます。開催中Marketの締切カウントダウンにも反映されます。
        </p>

        <div className="grid gap-1.5">
          {events.map((event) => {
            const shifted = event.delayMin !== 0;
            // 遅延はピンク・前倒しは青（色だけでなく「+1分」「−1分」の文字も併記する）
            const toneClass = !shifted ? "text-om-ink" : event.delayMin > 0 ? "text-om-pink" : "text-om-blue";
            const noteClass = shifted ? toneClass : "text-om-gray-2";
            return (
              <div
                key={event.id}
                className="adm-row grid items-center gap-2"
                data-shifted={shifted}
                style={{ gridTemplateColumns: "68px minmax(0,1fr) auto auto" }}
              >
                <div className={`adm-time ${toneClass}`}>{formatTime(effectiveStart(event))}</div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-black">
                    {event.no} {event.name}
                  </div>
                  <div className={`mt-0.5 text-[10.5px] ${noteClass}`}>
                    {shifted && <span className="mr-1 font-black">{delayText(event.delayMin)}</span>}
                    定刻 {formatTime(event.startTime)}
                  </div>
                </div>
                <ShiftButton eventId={event.id} delta={-1} label="−1分" tone="plain" />
                <ShiftButton eventId={event.id} delta={1} label="+1分" tone="primary" />
              </div>
            );
          })}
          {events.length === 0 && <p className="adm-note">種目が登録されていません。「種目」タブから登録してください。</p>}
        </div>
      </div>
    </section>
  );
}
