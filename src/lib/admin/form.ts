// Server Action で FormData を取り出す小さなヘルパー（型を明示して any を使わない）

/** 前後の空白を落とした文字列。未入力・File は "" */
export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** そのままの文字列（パスワードなど trim してはいけない値に使う） */
export function raw(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** チェックボックスが入っているか */
export function checked(formData: FormData, name: string): boolean {
  return formData.get(name) !== null;
}

/** 同名フィールドの値をすべて取り出す（着順の select など） */
export function textList(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => (typeof v === "string" ? v.trim() : ""));
}

/** "10, 8, 6" 形式を整数配列にする。数値でない要素があれば null */
export function intListFromCsv(value: string): number[] | null {
  const parts = value
    .split(/[,、\s]+/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    numbers.push(Number(part));
  }
  return numbers;
}

/** アップロードされた File の中身。ファイルが無い・空なら null */
export async function fileText(formData: FormData, name: string): Promise<string | null> {
  const value = formData.get(name);
  if (typeof value === "string" || value === null) return null;
  if (value.size === 0) return null;
  return value.text();
}
