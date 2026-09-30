// 表画面の表示整形。サーバー・クライアントのどちらから読んでも同じ結果になるよう時間帯を固定する

// 会場は日本なので、サーバーの時間帯（Vercel は UTC）に左右されないよう Asia/Tokyo で固定する
const HOUR_MINUTE = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

const FESTIVAL_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  timeZone: "Asia/Tokyo",
});

/** ISO 8601 → "HH:MM"。未定・解析不能なら null */
export function formatHourMinute(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : HOUR_MINUTE.format(time);
}

/** ISO 8601 → "YYYY. MM. DD SAT"。未定・解析不能なら null */
export function formatFestivalDate(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  const parts = Object.fromEntries(FESTIVAL_DATE.formatToParts(time).map(({ type, value }) => [type, value]));
  return `${parts.year}. ${parts.month}. ${parts.day} ${parts.weekday.toUpperCase()}`;
}
