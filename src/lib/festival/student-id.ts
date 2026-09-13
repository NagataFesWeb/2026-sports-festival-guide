// 学籍番号の正規化。/login（クライアント）と queries.ts（サーバー）の両方から使うため、
// このファイルは何も import しない（DB 実装 = node:fs がクライアントバンドルに混ざるのを防ぐ）

/** 全角数字 → 半角数字 */
function toHalfWidthDigits(input: string): string {
  return input.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 入力された学籍番号を正規化する。前後の空白を除き、全角数字を半角にしてから
 * 1〜8 桁の数字だけを受け入れる。形式が不正なら null（存在チェックはしない）
 */
export function normalizeStudentId(input: string): string | null {
  const normalized = toHalfWidthDigits(input.trim());
  return /^\d{1,8}$/.test(normalized) ? normalized : null;
}
