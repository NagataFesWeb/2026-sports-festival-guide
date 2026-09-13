// 管理画面の日時表示（表示専用。計算はしない）
// サーバーの場所に関わらず日本時間で整形する（Vercel は UTC で動くため）

const TZ = "Asia/Tokyo";

/** ISO → 日本時間の各部品（"2026", "10", "01", "14", "00"）。不正なら null */
function partsInTokyo(iso: string | null): Record<string, string> | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  // 24 時が "24" になる実装があるため 0 に寄せる
  if (out.hour === "24") out.hour = "00";
  return out;
}

/** ISO → "10/01 14:00"。null・不正な値は "―" */
export function formatDateTime(iso: string | null): string {
  const p = partsInTokyo(iso);
  if (!p) return "―";
  return `${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

/** ISO → "8:45"（日本時間の時刻だけ。進行タブのように時刻を並べる場所で使う）。null・不正な値は "―" */
export function formatTime(iso: string | null): string {
  const p = partsInTokyo(iso);
  if (!p) return "―";
  // モックと同じく時は 0 埋めしない（"8:45"）
  return `${Number(p.hour)}:${p.minute}`;
}

/** ISO → "2026-10-01T14:00"（input[type=datetime-local] の value、日本時間）。null・不正な値は "" */
export function toDateTimeLocal(iso: string | null): string {
  const p = partsInTokyo(iso);
  if (!p) return "";
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
