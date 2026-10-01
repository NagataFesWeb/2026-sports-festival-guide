// カジノ専用のユーザーID。学籍番号や生徒名簿とは照合しない。
/** 半角英数字・ハイフン・アンダースコアの4〜32文字。大文字と小文字は区別する。 */
export function isValidUserId(userId: string): boolean {
  return /^[A-Za-z0-9_-]{4,32}$/.test(userId);
}
