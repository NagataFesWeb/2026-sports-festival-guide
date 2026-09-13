// 数値・時刻の表示フォーマット（表示専用。計算はしない）

/** 1,240 形式（端数切り捨て） */
export function formatPoints(n: number): string {
  return Math.floor(n).toLocaleString("en-US");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 残り時間 HH:MM:SS（マイナスは 00:00:00） */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
}

/** 現在時刻 HH:MM:SS */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
