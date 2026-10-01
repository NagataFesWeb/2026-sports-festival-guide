// Supabase 接続までの仮データ。種目は令和8年度 第79回体育祭の演技台帳（12 プログラム）をそのまま入れる
// 締切は開発用の相対時刻、プログラムの開催日は2026-10-02に固定する。
import { hashPassword } from "../auth/password";
import { FESTIVAL_DAY } from "../festival/festival-day";
import type { Event, EventEntry, EventResult, Heat, InviteEntry, Student, Team } from "../festival/types";
import { settlePayouts } from "./odds";
import type {
  Bet,
  BetKind,
  CasinoAccount,
  CasinoAccountRecord,
  EventCategory as MarketCategory,
  Market,
  MarketOption,
} from "./types";

/** 認証（/casino/enter）実装までの仮ログインユーザー */
export const FIXTURE_STUDENT_ID = "2117";

const TEAMS: MarketOption[] = [
  { id: "t1", num: "01", name: "1組 黄色" },
  { id: "t2", num: "02", name: "2組 水色" },
  { id: "t3", num: "03", name: "3組 白" },
  { id: "t4", num: "04", name: "4組 赤" },
  { id: "t5", num: "05", name: "5組 橙" },
  { id: "t6", num: "06", name: "6組 桃色" },
  { id: "t7", num: "07", name: "7組 緑" },
  { id: "t8", num: "08", name: "8組 青" },
];

const RED_WHITE: MarketOption[] = [
  { id: "red", num: "RED", name: "紅組" },
  { id: "white", num: "WHITE", name: "白組" },
];

/** 男子スウェーデンリレー 1年（race-04-g1 / ev-04 g1）の確定着順。Market と EventResult で共有する */
const SWEDEN_RESULT_ORDER: string[] = ["t2", "t6", "t1", "t4", "t3", "t5", "t8", "t7"];

/** 女子6×100mリレーの確定着順（学年ごと） */
const GIRLS_RESULT_ORDERS: Record<string, string[]> = {
  g1: ["t3", "t7", "t1", "t5", "t2", "t8", "t4", "t6"],
  g2: ["t5", "t1", "t6", "t2", "t8", "t3", "t7", "t4"],
  g3: ["t2", "t4", "t8", "t6", "t1", "t7", "t3", "t5"],
};

/** 順位点（index 0 が 1 位）。演技台帳の「判定・得点」欄より */
const RELAY_POINTS: number[] = [20, 18, 16, 14, 13, 12, 11, 10];
const MIXED_RELAY_POINTS: number[] = [25, 23, 21, 19, 17, 15, 13, 11];
const FIELD_POINTS: number[] = [25, 21, 18, 16, 13, 12, 11, 10];

export interface CasinoState {
  markets: Market[];
  bets: Bet[];
  /** 実際に入るのは CasinoAccountRecord（型は store.ts の互換のため CasinoAccount のまま） */
  accounts: Map<string, CasinoAccount>;
  seq: number;
}

function minutesFrom(now: Date, min: number): string {
  return new Date(now.getTime() + min * 60_000).toISOString();
}

/** SEED_* の時刻はモジュール読み込み（＝サーバー起動）時刻を基準にする */
const BOOT_TIME = new Date();

/**
 * 確認済みの開催日（2026-10-02）の指定時刻をISO 8601で返す。
 */
function todayAt(clock: string): string {
  const [hour, minute] = clock.split(":");
  return `${FESTIVAL_DAY.date}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00+09:00`;
}

// ---- 表画面（体育祭本体）の仮データ ----

const TEAM_COLORS: Record<string, string> = {
  t1: "#ffe600", // 黄色
  t2: "#87ceeb", // 水色
  t3: "#ffffff", // 白
  t4: "#d92b2b", // 赤
  t5: "#ec7a1c", // 橙
  t6: "#ff6fb5", // 桃色
  t7: "#1f9d55", // 緑
  t8: "#1f6fd0", // 青
};

/** 色別対抗チーム（全 8 チーム）。ID は Market の option ID と一致させる */
export const SEED_TEAMS: Team[] = TEAMS.map((t, i) => ({
  id: t.id,
  num: t.num,
  name: t.name,
  color: TEAM_COLORS[t.id],
  sortOrder: i + 1,
}));

/** コース割りの基準となる固定シャッフル順（乱数を使わず毎回同じ組み合わせにする） */
const SHUFFLED_TEAM_IDS: string[] = ["t5", "t2", "t8", "t1", "t6", "t3", "t7", "t4"];

/** 8 コースの組み合わせ。offset を変えると種目ごとに違う（が固定の）並びになる */
function courseEntries(offset: number): EventEntry[] {
  return SHUFFLED_TEAM_IDS.map((_, i) => ({
    slot: `${i + 1}コース`,
    teamId: SHUFFLED_TEAM_IDS[(i + offset) % SHUFFLED_TEAM_IDS.length],
  }));
}

/** 学年別に着順が決まる種目のヒート（リレー 3 種） */
const GRADE_HEATS: Heat[] = [
  { id: "g1", label: "1年" },
  { id: "g2", label: "2年" },
  { id: "g3", label: "3年" },
];
/** 1 ヒートで総合順位が決まる種目 */
const OVERALL_HEAT: Heat[] = [{ id: "all", label: "総合" }];
/** 1 年生だけの学年競技（大縄跳び） */
const YEAR1_HEAT: Heat[] = [{ id: "g1", label: "1年" }];

/**
 * 種目（プログラム）。第79回体育祭の演技台帳と同じ 12 プログラム。
 * Market があるのは ev-03/04/05/06/10/11（学年別レースはヒートごとに Market を立てる）
 */
export const SEED_EVENTS: Event[] = [
  {
    id: "ev-01",
    no: "01",
    name: "開会式",
    en: "OPENING CEREMONY",
    kind: "ceremony",
    category: "field",
    startTime: todayAt("8:45"),
    delayMin: 0,
    location: "フィールド（本部側）",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 1,
    participants: "全員参加",
    gatherStart: "8:20 グラウンド集合",
    gatherPlace: "フィールド（本部側）",
    belongings: "（なし）",
    formation: "grid",
    formationNote: "本部に向かって右から1年→2年→3年、右から1組→8組。出席番号順に2列",
    description:
      "8:20 にグラウンドへ集合し、各クラス体育祭委員を先頭に出席番号順2列で整列する。8:30 に整列・点呼完了（厳守）、8:40 に選手変更手続き完了、8:45 から開会式。開会宣言・国歌斉唱（諸旗掲揚）・学校長挨拶・選手宣誓・諸注意の順に行う。必要なもの以外（弁当を含む）は教室に置いていく。",
  },
  {
    id: "ev-02",
    no: "02",
    name: "準備体操",
    en: "RADIO EXERCISE",
    kind: "ceremony",
    category: "field",
    startTime: todayAt("9:00"),
    delayMin: 0,
    location: "フィールド（本部側）",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 2,
    participants: "全員参加",
    gatherStart: "開会式に続けて",
    gatherPlace: "フィールド（本部側）",
    belongings: "（なし）",
    formation: "grid",
    formationNote: "縦は2年5組右列、横は各組の体育祭実行委員が基準になり広がる",
    description:
      "指揮台上の体育委員長の号令で「ラジオ体操第一」を行う全校演技。基準列が広がったあと全体が体操の隊形にひらき、体操後に元の隊形へ集まる。笛の合図で退場し、各クラステントへ直接移動する。",
  },
  {
    id: "ev-03",
    no: "03",
    name: "女子6×100mリレー",
    en: "GIRLS 6×100m RELAY",
    kind: "track",
    category: "race",
    startTime: todayAt("9:10"),
    delayMin: 0,
    location: "トラック",
    entries: courseEntries(0),
    rankPoints: [...RELAY_POINTS],
    heats: [...GRADE_HEATS],
    sortOrder: 3,
    participants: "クラス対抗",
    gatherStart: "準備体操退場後",
    gatherPlace: "フィールド",
    belongings: "アンカーはクラス番号のゼッケン",
    formation: "track",
    formationNote: "1,3,5走は本部側、2,4,6走はバックストレート側に整列",
    description:
      "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。1人トラック半周(100m)を6人でリレー。バトンパスはゾーン内で行い、ゾーン外のパスは失格。オープン制・コーナートップ制を用いる。",
  },
  {
    id: "ev-04",
    no: "04",
    name: "男子スウェーデンリレー",
    en: "BOYS SWEDEN RELAY",
    kind: "track",
    category: "race",
    startTime: todayAt("9:25"),
    delayMin: 0,
    location: "トラック",
    entries: courseEntries(1),
    rankPoints: [...RELAY_POINTS],
    heats: [...GRADE_HEATS],
    sortOrder: 4,
    participants: "クラス対抗",
    gatherStart: "女子6×100mリレー退場後",
    gatherPlace: "フィールド",
    belongings: "アンカーはクラス番号のゼッケン",
    formation: "track",
    formationNote: "2,6走は本部側、1,3,4,5走はバックストレート側",
    description:
      "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。1・2走100m、3・4走200m、5走300m、6走400mをリレーする。スタートは生徒席側。バトンパスはゾーン内で行い、ゾーン外のパスは失格。",
  },
  {
    id: "ev-05",
    no: "05",
    name: "男女混合リレー",
    en: "MIXED RELAY",
    kind: "track",
    category: "race",
    startTime: todayAt("9:45"),
    delayMin: 0,
    location: "トラック",
    entries: courseEntries(2),
    rankPoints: [...MIXED_RELAY_POINTS],
    heats: [...GRADE_HEATS],
    sortOrder: 5,
    participants: "クラス対抗",
    gatherStart: "男子スウェーデンリレー退場後",
    gatherPlace: "フィールド",
    belongings: "アンカーはクラス番号のゼッケン",
    formation: "track",
    formationNote: "1,3,5,7,8走は本部側、2,4,6走はバックストレート側",
    description:
      "一発決勝。1年→2年→3年の順でレースを行い、各学年で順位を決定する。各クラス男女各4名の8人で、1〜6走は100m、7〜8走は200mをリレーする。1〜6走に男女各3人、7〜8走に男女各1人を配し、性別による走順は問わない。",
  },
  {
    id: "ev-06",
    no: "06",
    name: "玉入れ",
    en: "TAMA-IRE",
    kind: "field",
    category: "field",
    startTime: todayAt("10:05"),
    delayMin: 0,
    location: "フィールド",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 6,
    participants: "クラス対抗",
    gatherStart: "男子スウェーデンリレー退場後",
    gatherPlace: "フィールド",
    belongings: "クラスカラーのハチマキ。玉出し要員は赤白帽子",
    formation: "ball",
    formationNote: "半径3mの円を2つ設置。円内競技者は円内へ、円外の競技者は円の周りへ",
    description:
      "1チーム24名（各学年8名）。第1試合 1組 vs 2組、第2試合 3組 vs 4組、第3試合 5組 vs 6組、第4試合 7組 vs 8組。前半1分はお題に沿った玉入れ、後半1分はなんでもあり。通常玉1点、レア玉（シャトル）10点。",
  },
  {
    id: "ev-07",
    no: "07",
    name: "部行進",
    en: "CLUB PARADE",
    kind: "club",
    category: "field",
    startTime: todayAt("12:00"),
    delayMin: 0,
    location: "フィールド",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 7,
    participants: "部活動",
    gatherStart: "昼休み10分前",
    gatherPlace: "フィールド（バックストレート側）",
    belongings: "部のユニフォーム・プラカード",
    formation: "parade",
    formationNote: "部活ごとに1〜21の順。10人未満は1列、以降は人数に応じて2〜4列",
    description:
      "全運動部が参加する（3年生は任意）。各部プラカードを先頭に、1〜21の順でバックストレート側に観覧隊形で整列する。校長先生の登壇後、一部活ずつ間隔をあけて入場し、停止線に着いた部から停止する。オープニングはダンス部によるチアダンス。",
  },
  {
    id: "ev-08",
    no: "08",
    name: "部対抗リレー",
    en: "CLUB RELAY",
    kind: "club",
    category: "field",
    startTime: todayAt("12:30"),
    delayMin: 0,
    location: "トラック",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 8,
    participants: "部活動",
    gatherStart: "部行進退場後",
    gatherPlace: "フィールド（本部側）",
    belongings: "ユニフォーム。パフォーマンスリレーのみ部に関連した道具をバトン代わりにできる",
    formation: "lane",
    formationNote: "フィールド本部側でパフォーマンス→女子①→女子②→男子①→男子②の順に並ぶ",
    description:
      "パフォーマンスリレー(1周)→女子レース1(200m×4)→女子レース2(200m×4)→男子レース1(200m×4)→男子レース2(200m×4)の順で行う。ユニフォームで走る。部に関連した道具をバトン代わりにできるのはパフォーマンスリレーのみ。",
  },
  {
    id: "ev-09",
    no: "09",
    name: "大縄跳び",
    en: "LONG ROPE JUMP",
    kind: "field",
    category: "field",
    startTime: todayAt("13:25"),
    delayMin: 0,
    location: "フィールド",
    entries: [],
    rankPoints: [...FIELD_POINTS],
    heats: [...YEAR1_HEAT],
    sortOrder: 9,
    participants: "1年生全員",
    gatherStart: "部対抗リレー終了15分後（更衣休憩後）",
    gatherPlace: "フィールド",
    belongings: "（なし）",
    formation: "rope",
    formationNote: "ロープの東側に本部の方を向いて2列で整列して座る",
    description:
      "1年生全員の学年競技。クラスを半分に分け、1チーム20人（回し手2名込み）で八の字跳びと全員跳びを行う。制限時間は各1分30秒で、競技前に30秒の自由練習がある。八の字跳び・全員跳びそれぞれの回数にポイントを付け、その総合ポイントで順位を決定する。",
  },
  {
    id: "ev-10",
    no: "10",
    name: "棒引き",
    en: "BOU-HIKI",
    kind: "field",
    category: "field",
    startTime: todayAt("13:35"),
    delayMin: 0,
    location: "フィールド",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 10,
    participants: "2年生全員",
    gatherStart: "大縄跳び退場後",
    gatherPlace: "フィールド",
    belongings: "軍手",
    formation: "pole",
    formationNote: "棒の後ろに縦1列。複数試合に出る選手は前試合終了後すぐ次の位置へ",
    description:
      "1,3,5回戦は女子、2,4,6回戦は男子。1・2回戦は棒を持った状態から、3・4回戦は4m地点から走って取りに行く。5・6回戦は各クラスの選抜2人×2チーム。各チーム両端6m地点の線を棒の端が越えた時点で勝負あり。勝ち3点、引き分け1点、負け0点。",
  },
  {
    id: "ev-11",
    no: "11",
    name: "騎馬戦",
    en: "KIBASEN",
    kind: "field",
    category: "field",
    startTime: todayAt("13:55"),
    delayMin: 0,
    location: "フィールド",
    entries: [],
    rankPoints: [...FIELD_POINTS],
    heats: [...OVERALL_HEAT],
    sortOrder: 11,
    participants: "3年生全員",
    gatherStart: "玉入れ退場後",
    gatherPlace: "フィールド",
    belongings: "赤白帽・軍手。上に乗る人は裸足。紅白大将ははっぴ",
    formation: "horse",
    formationNote: "1回戦の出場騎馬は各サークルの待機位置に整列。紅組は時計回りに次のコートへ",
    description:
      "1回戦は紅白に分かれたクラス対抗総当たり戦（女子→男子）で、第1試合から第4試合まで行う。2回戦は紅白の大将戦で、相手の大将騎を先に倒した組の勝ち。帽子を取られるか騎馬が崩れたら負け。4分で決着がつかない場合は残騎数の多い方の勝ち。",
  },
  {
    id: "ev-12",
    no: "12",
    name: "閉会式",
    en: "CLOSING CEREMONY",
    kind: "ceremony",
    category: "field",
    startTime: todayAt("14:20"),
    delayMin: 0,
    location: "フィールド（本部側）",
    entries: [],
    rankPoints: [],
    heats: [...OVERALL_HEAT],
    sortOrder: 12,
    participants: "全員参加",
    gatherStart: "騎馬戦退場後",
    gatherPlace: "フィールド（本部側）",
    belongings: "（なし）",
    formation: "grid",
    formationNote: "騎馬戦退場後いったん生徒席に着席し、放送で開会式と同じ隊形に整列",
    description:
      "騎馬戦退場後、いったん生徒席に着席し、準備完了後に放送で開会式と同じ隊形へ整列・点呼する。成績発表・表彰（得賞歌）・学校長講評・諸旗降納と校歌斉唱・実行委員長挨拶・閉会宣言の順に行う。",
  },
];

/** 生徒名簿。2117 は仮ログインユーザー（2年1組） */
export const SEED_STUDENTS: Student[] = [
  { studentId: "2101", name: "サンプル生徒01", grade: 1, classNo: 1 },
  { studentId: "2105", name: "サンプル生徒02", grade: 1, classNo: 5 },
  { studentId: "2110", name: "サンプル生徒03", grade: 1, classNo: 8 },
  { studentId: FIXTURE_STUDENT_ID, name: "サンプル生徒04", grade: 2, classNo: 1 },
  { studentId: "2118", name: "サンプル生徒05", grade: 2, classNo: 2 },
  { studentId: "2122", name: "サンプル生徒06", grade: 2, classNo: 6 },
  { studentId: "2203", name: "サンプル生徒07", grade: 2, classNo: 3 },
  { studentId: "2211", name: "サンプル生徒08", grade: 3, classNo: 3 },
  { studentId: "2308", name: "サンプル生徒09", grade: 3, classNo: 8 },
  { studentId: "2315", name: "サンプル生徒10", grade: 3, classNo: 7 },
];

/** 招集案内（実行委員が CSV でアップロードする想定のデータ）。2117 の 3 件はモック v2/v3 と同じ */
export const SEED_INVITES: InviteEntry[] = [
  { id: "inv-1", studentId: FIXTURE_STUDENT_ID, eventName: "男女混合リレー", gatherTime: "9:35", location: "フィールド", tag: "ゼッケン着用" },
  { id: "inv-2", studentId: FIXTURE_STUDENT_ID, eventName: "玉入れ", gatherTime: "9:55", location: "フィールド", tag: "ハチマキ着用" },
  { id: "inv-3", studentId: FIXTURE_STUDENT_ID, eventName: "棒引き", gatherTime: "13:25", location: "フィールド", tag: "軍手持参" },
  { id: "inv-4", studentId: "2101", eventName: "女子6×100mリレー", gatherTime: "9:00", location: "フィールド", tag: "" },
  { id: "inv-5", studentId: "2101", eventName: "大縄跳び", gatherTime: "13:15", location: "フィールド", tag: "" },
  { id: "inv-6", studentId: "2105", eventName: "男女混合リレー", gatherTime: "9:35", location: "フィールド", tag: "" },
  { id: "inv-7", studentId: "2110", eventName: "玉入れ", gatherTime: "9:55", location: "フィールド", tag: "" },
  { id: "inv-8", studentId: "2118", eventName: "棒引き", gatherTime: "13:25", location: "フィールド", tag: "" },
  { id: "inv-9", studentId: "2211", eventName: "騎馬戦", gatherTime: "13:45", location: "フィールド", tag: "" },
];

/** 着順から順位点を割り当てる（rankPoints が足りない順位は 0 点） */
function pointsFromOrder(order: readonly string[], rankPoints: readonly number[]): Record<string, number> {
  const points: Record<string, number> = {};
  order.forEach((teamId, i) => {
    points[teamId] = rankPoints[i] ?? 0;
  });
  return points;
}

function seedResult(eventId: string, heatId: string, order: string[], rankPoints: readonly number[], min: number): EventResult {
  return {
    eventId,
    heatId,
    order: [...order],
    points: pointsFromOrder(order, rankPoints),
    confirmedAt: minutesFrom(BOOT_TIME, min),
  };
}

/** 確定済みの種目結果。ev-04 g1 は settled Market（race-04-g1）の着順と一致させる */
export const SEED_EVENT_RESULTS: EventResult[] = [
  seedResult("ev-03", "g1", GIRLS_RESULT_ORDERS.g1, RELAY_POINTS, -120),
  seedResult("ev-03", "g2", GIRLS_RESULT_ORDERS.g2, RELAY_POINTS, -110),
  seedResult("ev-03", "g3", GIRLS_RESULT_ORDERS.g3, RELAY_POINTS, -100),
  seedResult("ev-04", "g1", SWEDEN_RESULT_ORDER, RELAY_POINTS, -85),
];

// scrypt は 1 回 100ms 程度かかるため、再シードのたびに計算しないようキャッシュする
let cachedPasswordHash: string | null = null;
function seedPasswordHash(): string {
  cachedPasswordHash ??= hashPassword(FIXTURE_STUDENT_ID);
  return cachedPasswordHash;
}

/** カジノ口座の仮データ（パスワードは学籍番号と同じ） */
export function createSeedAccounts(now: Date): CasinoAccountRecord[] {
  return [
    {
      studentId: FIXTURE_STUDENT_ID,
      pointsBalance: 1240,
      debtAmount: 500,
      passwordHash: seedPasswordHash(),
      nickname: "NODE79",
      registeredAt: minutesFrom(now, -240),
      finalBalanceBefore: null,
      finalDebt: null,
    },
  ];
}

/** 他の生徒のベットを、指定人数に割り振りながら 100pt 単位で積む */
function seedBets(
  state: CasinoState,
  marketId: string,
  players: number,
  kind: BetKind,
  pool: Record<string, number>,
  createdAt: string,
): void {
  let who = 0;
  for (const [key, total] of Object.entries(pool)) {
    let rest = total;
    while (rest > 0) {
      const amount = Math.min(100, rest);
      rest -= amount;
      state.seq += 1;
      state.bets.push({
        id: `seed-${state.seq}`,
        marketId,
        studentId: `seed-${marketId}-${who % players}`,
        kind,
        selection: key.split(">"),
        amount,
        payoutAmount: null,
        createdAt,
      });
      who += 1;
    }
  }
}

function placeRatio(pool: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(pool).map(([k, v]) => [k, Math.round((v * 0.42) / 10) * 10]));
}

function myBet(state: CasinoState, marketId: string, kind: BetKind, selection: string[], amount: number, at: string): void {
  state.seq += 1;
  state.bets.push({
    id: `bet-${state.seq}`,
    marketId,
    studentId: FIXTURE_STUDENT_ID,
    kind,
    selection,
    amount,
    payoutAmount: null,
    createdAt: at,
  });
}

/**
 * SEED_EVENTS から Market の表示名を作る。
 * 日本語名はヒートが複数ある種目だけヒート名を足し、英語名は学年ヒートを Y1〜Y3 と表記する
 */
function eventMarketLabels(eventId: string, heatId: string): { no: string; title: string; en: string } {
  const event = SEED_EVENTS.find((e) => e.id === eventId);
  if (!event) throw new Error(`種目 ${eventId} が SEED_EVENTS にありません`);
  const heat = event.heats.find((h) => h.id === heatId);
  if (!heat) throw new Error(`種目 ${eventId} にヒート ${heatId} がありません`);
  const gradeMatch = /^g([1-3])$/.exec(heat.id);
  return {
    no: event.no,
    title: event.heats.length > 1 ? `${event.name} ${heat.label}` : event.name,
    en: gradeMatch ? `${event.en} Y${gradeMatch[1]}` : event.en,
  };
}

/** 種目別 Market を 1 つ作る（表示名は SEED_EVENTS から導く） */
function eventMarket(
  id: string,
  eventId: string,
  heatId: string,
  category: MarketCategory,
  deadline: string,
  extra: Partial<Market> = {},
): Market {
  const labels = eventMarketLabels(eventId, heatId);
  return {
    id,
    type: "event",
    eventId,
    heatId,
    category,
    no: labels.no,
    title: labels.title,
    en: labels.en,
    options: TEAMS,
    deadline,
    status: "open",
    resultOrder: null,
    ...extra,
  };
}

export function createFixtureState(now: Date): CasinoState {
  const state: CasinoState = { markets: [], bets: [], accounts: new Map(), seq: 0 };
  const past = minutesFrom(now, -120);

  state.markets = [
    // 締切を過ぎているが status は open。締切判定は effectiveStatus に任せる
    eventMarket("race-03-g3", "ev-03", "g3", "race", minutesFrom(now, -40)),
    eventMarket("race-04-g1", "ev-04", "g1", "race", minutesFrom(now, -90), {
      status: "settled",
      resultOrder: [...SWEDEN_RESULT_ORDER],
    }),
    eventMarket("race-05-g1", "ev-05", "g1", "race", minutesFrom(now, 12.8)),
    eventMarket("race-05-g2", "ev-05", "g2", "race", minutesFrom(now, 25)),
    eventMarket("field-06", "ev-06", "all", "field", minutesFrom(now, 38)),
    eventMarket("field-10", "ev-10", "all", "field", minutesFrom(now, 33)),
    eventMarket("race-11", "ev-11", "all", "field", minutesFrom(now, 50), { options: RED_WHITE }),
    {
      id: "special-general", type: "custom", eventId: null, heatId: null, category: null, no: "#",
      title: "大将戦 紅白", en: "GENERAL BATTLE",
      options: RED_WHITE, deadline: minutesFrom(now, 71), status: "open", resultOrder: null,
    },
    {
      id: "overall", type: "overall", eventId: null, heatId: null, category: null, no: "*",
      title: "体育祭 全体優勝", en: "OVERALL WINNER",
      options: TEAMS, deadline: minutesFrom(now, 160), status: "open", resultOrder: null,
    },
  ];

  const girls = { t1: 1500, t2: 1900, t3: 900, t4: 1300, t5: 2600, t6: 1100, t7: 700, t8: 1200 };
  seedBets(state, "race-03-g3", 74, "win", girls, past);
  seedBets(state, "race-03-g3", 74, "place", placeRatio(girls), past);
  myBet(state, "race-03-g3", "win", ["t5"], 300, past);

  const sweden = { t1: 800, t2: 1400, t3: 600, t4: 900, t5: 700, t6: 1000, t7: 300, t8: 500 };
  seedBets(state, "race-04-g1", 58, "win", sweden, past);
  seedBets(state, "race-04-g1", 58, "place", placeRatio(sweden), past);
  seedBets(state, "race-04-g1", 58, "trifecta", { "t2>t6>t1": 200, "t6>t2>t1": 300, "t2>t1>t6": 100 }, past);
  myBet(state, "race-04-g1", "win", ["t6"], 200, past);
  myBet(state, "race-04-g1", "place", ["t6"], 100, past);

  // 仕様書 §8.1 の例と同じプール（06 は賭けなし → 「―」）
  const mixed = { t1: 420, t2: 190, t3: 731, t4: 301, t5: 589, t7: 261, t8: 156 };
  seedBets(state, "race-05-g1", 41, "win", mixed, past);
  seedBets(state, "race-05-g1", 41, "place", placeRatio(mixed), past);
  seedBets(state, "race-05-g1", 41, "trifecta", {
    "t3>t5>t1": 300, "t5>t3>t1": 200, "t3>t1>t5": 150, "t3>t7>t1": 60, "t1>t3>t5": 100, "t4>t3>t5": 80,
  }, past);

  // 2年のレースは賭けが集まりきっていない小さなプール
  seedBets(state, "race-05-g2", 11, "win", { t2: 300, t4: 220, t6: 180, t7: 90 }, past);

  seedBets(state, "field-06", 68, "win", { t1: 1600, t2: 2400, t3: 800, t4: 1200, t5: 900, t6: 1400, t7: 600, t8: 1000 }, past);
  seedBets(state, "field-10", 41, "win", { t1: 900, t2: 2100, t3: 600, t4: 1500, t5: 1100, t6: 800, t7: 1300, t8: 700 }, past);
  seedBets(state, "race-11", 83, "win", { red: 4800, white: 6700 }, past);
  seedBets(state, "special-general", 57, "win", { red: 2600, white: 1700 }, past);
  seedBets(state, "overall", 132, "win", { t1: 4200, t2: 5100, t3: 1800, t4: 3300, t5: 900, t6: 4600, t7: 700, t8: 2400 }, past);

  // 結果確定済み Market の配当を記録する
  for (const m of state.markets) {
    if (m.status !== "settled" || !m.resultOrder) continue;
    const marketBets = state.bets.filter((b) => b.marketId === m.id);
    const payouts = settlePayouts(marketBets, m.resultOrder);
    for (const b of marketBets) b.payoutAmount = payouts.get(b.id) ?? 0;
  }

  for (const account of createSeedAccounts(now)) state.accounts.set(account.studentId, account);
  return state;
}
