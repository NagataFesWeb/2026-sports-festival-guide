// 口座作成時のニックネーム（順位表の NAME 列に表示する）の検証・表示ロジック
/** ニックネームの最大文字数（コードポイント単位） */
export const NICKNAME_MAX = 12;

/** 制御文字（改行・タブなど）を検出する */
const CONTROL_CHAR = /[\p{Cc}]/u;

/**
 * ニックネームとして妥当かを判定する。
 * 前後に空白が無く、コードポイント数が 1〜NICKNAME_MAX、制御文字を含まないこと
 */
export function isValidNickname(nickname: string): boolean {
  if (nickname.trim() !== nickname) return false;
  const length = [...nickname].length;
  if (length < 1 || length > NICKNAME_MAX) return false;
  if (CONTROL_CHAR.test(nickname)) return false;
  return true;
}

/** ニックネームが登録されていればそれを、無ければ fallback（氏名や学籍番号）を表示名にする */
export function displayNameOf(nickname: string, fallback: string): string {
  return nickname !== "" ? nickname : fallback;
}
