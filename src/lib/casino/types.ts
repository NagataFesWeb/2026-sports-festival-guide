// カジノ（裏画面）のドメイン型。表画面とは共有しない前提だが、データ構造は docs/data-model.md に従う

/** 賭式。custom Market は二択の単勝として扱う */
export type BetKind = "win" | "place" | "trifecta";

/** overall=全体優勝 / event=種目別 / custom=紅白などの専用二択 */
export type MarketType = "overall" | "event" | "custom";

/** race=リレーでは単勝・複勝・三連単 / field=単勝のみ。非リレーはraceでも単勝のみ */
export type EventCategory = "race" | "field";

export type MarketStatus = "open" | "closed" | "settled";

/** Market の賭け対象（チームまたは custom の選択肢） */
export interface MarketOption {
  id: string;
  /** 表示番号（"01"〜"08"、custom は "RED" など） */
  num: string;
  name: string;
}

export interface Market {
  id: string;
  type: MarketType;
  /** type=event のときは対応する種目 ID。overall・custom は null */
  eventId: string | null;
  /** eventのヒートID、学年別overallはg1〜g3。旧overall・customはnull */
  heatId: string | null;
  /** type=event のときのみ意味を持つ */
  category: EventCategory | null;
  /** 競技番号（"05"）。overall は "*"、custom は "#" */
  no: string;
  /** 表示名（日本語） */
  title: string;
  /** 裏画面の語彙（"MIXED RELAY" など） */
  en: string;
  options: MarketOption[];
  /** ISO 8601。これ以降は新規ベット・取消不可 */
  deadline: string;
  /** 実行委員が結果確定したら settled。締切判定は deadline と合わせて行う */
  status: MarketStatus;
  /** 確定着順（先頭が勝者）。settled のときのみ */
  resultOrder: string[] | null;
  /** 旧DBとの保存・競合照合用。実際の三連単は odds.ts の出場組数から求める最低倍率のプール方式 */
  trifectaOddsDefault?: number;
  /** 旧DBの個別倍率。互換性のため保持するが新しい払戻には使わない */
  trifectaOddsOverrides?: Record<string, number>;
}

export interface Bet {
  id: string;
  marketId: string;
  /** カジノのユーザーID。既存データとの互換性のためフィールド名を維持する */
  studentId: string;
  kind: BetKind;
  /** win/place は [optionId]、trifecta は [1着, 2着, 3着] */
  selection: string[];
  amount: number;
  /** 結果確定後に記録。外れは 0、未確定は null */
  payoutAmount: number | null;
  createdAt: string;
}

/** 残高だけを持つ口座（計算ロジックはこの型で受け渡す） */
export interface CasinoAccount {
  /** カジノのユーザーID。DBの既存 student_id 列に保存し、名簿とは照合しない */
  studentId: string;
  pointsBalance: number;
  debtAmount: number;
}

/** DB に保存する口座レコード（認証情報と最終精算のスナップショットを含む） */
export interface CasinoAccountRecord extends CasinoAccount {
  /** scrypt ハッシュ（src/lib/auth/password.ts の形式） */
  passwordHash: string;
  /** 順位表示に使うニックネーム。旧口座（ニックネーム未登録）は空文字 */
  nickname: string;
  registeredAt: string;
  /** 最終精算直前の所持ポイント。未精算なら null */
  finalBalanceBefore: number | null;
  /** 最終精算直前の借金額。未精算なら null */
  finalDebt: number | null;
}
