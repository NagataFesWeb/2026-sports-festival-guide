// 表画面（体育祭本体）のドメイン型。データ構造は docs/data-model.md に従う

/** 生徒名簿の 1 行。学籍番号が ID。学年・組は名簿 CSV にあれば入る（マイページの「2年1組」表示用） */
export interface Student {
  studentId: string;
  name: string;
  /** 1〜3。不明なら null */
  grade: number | null;
  /** 1〜8（チーム＝組）。不明なら null */
  classNo: number | null;
}

/** 色別対抗チーム（全 8 チーム＝組） */
export interface Team {
  id: string;
  /** 表示番号 "01"〜"08" */
  num: string;
  name: string;
  /** CSS で使える色（#RRGGBB） */
  color: string;
  sortOrder: number;
}

/** 賭式の区分。race=着順が付く（単勝・複勝・三連単）/ field=勝者（順位）だけが決まる（単勝のみ） */
export type EventCategory = "race" | "field";

/** 表示上の区分（マイページの絞り込みチップ）。式典 / トラック / フィールド / 部活動 */
export type EventKind = "ceremony" | "track" | "field" | "club";

/** 招集隊形図の種類（モック v2 の 8 種＋なし）。描画は CSS のみで行う */
export type FormationType = "grid" | "track" | "ball" | "parade" | "lane" | "rope" | "pole" | "horse" | "none";

/** 組み合わせ（レーン・組など）1 枠 */
export interface EventEntry {
  /** 枠の表示名（"1レーン"・"A組" など） */
  slot: string;
  teamId: string;
}

/**
 * ヒート（学年別レースなど、1 種目の中で独立に着順が決まる単位）。
 * リレーは「1年」「2年」「3年」の 3 ヒート、玉入れなどは「総合」1 ヒート
 */
export interface Heat {
  /** 種目内で一意（"g1"・"all" など） */
  id: string;
  /** 表示名（"1年"・"総合"） */
  label: string;
}

/** 種目（プログラム） */
export interface Event {
  id: string;
  /** プログラム番号 "05" */
  no: string;
  name: string;
  /** 裏画面で使う英語名（"MIXED RELAY"）。空なら name を使う */
  en: string;
  kind: EventKind;
  category: EventCategory;
  /** 定刻（ISO 8601）。未定なら null。実際の開始見込みは startTime + delayMin 分 */
  startTime: string | null;
  /** 進行の遅延（＋）・前倒し（−）。分。実行委員が管理画面で動かす */
  delayMin: number;
  location: string;
  /** 組み合わせ。未登録なら空配列 */
  entries: EventEntry[];
  /** 順位点。index 0 が 1 位の点数。長さが足りない順位は 0 点 */
  rankPoints: number[];
  /** ヒート。最低 1 つ。着順・得点・Market はヒート単位 */
  heats: Heat[];
  sortOrder: number;
  /** 対象タグ（"全員参加"・"クラス対抗"・"部活動" など） */
  participants: string;
  /** 招集開始の目安（"準備体操退場後" など、表示用文字列） */
  gatherStart: string;
  /** 集合場所（"フィールド（本部側）"） */
  gatherPlace: string;
  /** 持ち物・服装 */
  belongings: string;
  /** 招集隊形図の種類 */
  formation: FormationType;
  /** 招集隊形の補足（"本部に向かって右から1年→2年→3年" など） */
  formationNote: string;
  /** ルール・内容の要約（プログラム詳細モーダル用） */
  description: string;
}

/** 種目のヒートごとの確定結果。order の先頭が 1 位 */
export interface EventResult {
  eventId: string;
  heatId: string;
  /** 着順（teamId）。玉入れ・棒引きのように点数で決まる種目は points を直接入力し、order は点数順に並べる */
  order: string[];
  /** チームごとの獲得点。通常は rankPoints から自動計算するが、実行委員が手で上書きできる */
  points: Record<string, number>;
  confirmedAt: string;
}

/** 招集案内 1 件（実行委員が CSV でアップロード） */
export interface InviteEntry {
  id: string;
  studentId: string;
  eventName: string;
  /** 表示用の文字列（"10:30" など）。CSV の値をそのまま持つ */
  gatherTime: string;
  location: string;
  /** 補足タグ（"ゼッケン着用"・"軍手持参" など）。無ければ空文字 */
  tag: string;
}

/** サイト全体の設定（1 行だけ） */
export interface Settings {
  /** 最終精算の実行時刻。null なら未実施 */
  finalSettledAt: string | null;
  /** 得点・順位を表側に公開した時刻。null なら非公開（閉会式で実行委員が公開する） */
  scoresPublishedAt: string | null;
}
