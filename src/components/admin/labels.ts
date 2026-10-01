// 管理画面の表示ラベルと、フォーム値 → ドメイン型の変換。
// 表画面のコンポーネントには依存させない（移植中のファイルに巻き込まれないため）
import type { EventCategory, EventKind, FormationType } from "@/lib/festival/types";

/** 表示区分（マイページの絞り込みチップと同じ区分） */
export const KIND_LABELS: Record<EventKind, string> = {
  ceremony: "式典",
  track: "トラック",
  field: "フィールド",
  club: "部活動",
};

/** 賭式の区分 */
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  race: "race（リレーは三連単まで・他は単勝）",
  field: "field（勝者のみ）",
};

/** 招集隊形図の 9 種類 */
export const FORMATION_LABELS: Record<FormationType, string> = {
  grid: "方陣（クラスごとに整列）",
  track: "トラック（レーンに整列）",
  ball: "玉入れ（円陣）",
  parade: "行進（プラカード先頭の縦列）",
  lane: "レーン（一列）",
  rope: "大縄（2 チームに分かれる）",
  pole: "棒引き（両側に分かれる）",
  horse: "騎馬戦（騎馬ごと）",
  none: "なし",
};

/** Market の状態 */
export const MARKET_STATUS_LABELS: Record<string, string> = {
  open: "受付中",
  closed: "締切",
  settled: "確定済み",
};

/** Market の種別 */
export const MARKET_TYPE_LABELS: Record<string, string> = {
  event: "種目",
  overall: "全体優勝",
  custom: "二択",
};

/** 学年別ヒートのプリセット（種目フォームのボタン） */
export const GRADE_HEAT_PRESET: readonly { id: string; label: string }[] = [
  { id: "g1", label: "1年" },
  { id: "g2", label: "2年" },
  { id: "g3", label: "3年" },
];

export function toEventKind(value: string): EventKind | null {
  return value === "ceremony" || value === "track" || value === "field" || value === "club" ? value : null;
}

export function toEventCategory(value: string): EventCategory | null {
  return value === "race" || value === "field" ? value : null;
}

export function toFormationType(value: string): FormationType | null {
  return value in FORMATION_LABELS ? (value as FormationType) : null;
}
