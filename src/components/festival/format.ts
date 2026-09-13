// 表画面の表示整形。サーバー・クライアントのどちらから読んでも同じ結果になるよう時間帯を固定する

// 会場は日本なので、サーバーの時間帯（Vercel は UTC）に左右されないよう Asia/Tokyo で固定する
const HOUR_MINUTE = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

/** ISO 8601 → "HH:MM"。未定・解析不能なら null */
export function formatHourMinute(iso: string | null): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isNaN(time) ? null : HOUR_MINUTE.format(time);
}
