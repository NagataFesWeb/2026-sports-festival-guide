// 招集隊形図（モック v2 の CSS のみの図をそのまま移植）。画像は使わず div の並びで描く。
// 図の中の並び（学年・コース・部活の順など）は会場のレイアウトそのものなので、ここに定数として持つ
import type { FormationType } from "@/lib/festival/types";

/** 図の英字ラベル（モックの diaName） */
const DIAGRAM_LABEL: Record<Exclude<FormationType, "none">, string> = {
  grid: "CLASS FORMATION",
  track: "TRACK / LANE",
  ball: "CIRCLE COURT",
  parade: "PARADE ORDER",
  lane: "LANE TABLE",
  rope: "ROPE LINE",
  pole: "POLE LINE",
  horse: "CIRCLE COURT",
};

/** 整列は本部に向かって右から 1 年 → 2 年 → 3 年、右から 1 組 → 8 組 */
const GRADES: string[] = ["3年", "2年", "1年"];
const CLASS_ORDER: number[] = [8, 7, 6, 5, 4, 3, 2, 1];
const LANES: number[] = [1, 2, 3, 4, 5, 6, 7, 8];

/** 部行進の並び（1〜21） */
const CLUBS: string[] = [
  "野球",
  "男子バレーボール",
  "女子バレーボール",
  "サッカー",
  "男子テニス",
  "女子テニス",
  "男子ソフトテニス",
  "女子ソフトテニス",
  "男子バスケットボール",
  "女子バスケットボール",
  "卓球",
  "水泳",
  "陸上競技",
  "剣道",
  "器械体操",
  "山岳",
  "男子バドミントン",
  "女子バドミントン",
  "ハンドボール",
  "空手道",
  "ダンス",
];

/** 部対抗リレーのレーン割り（レーン / パフォ / 女子 / 男子① / 男子②） */
const CLUB_LANES: string[][] = [
  ["1", "卓球", "バレー", "サッカー", "バスケ"],
  ["2", "山岳男", "ソフテニ", "バレー", "空手"],
  ["3", "水泳", "テニス", "野球", "バド"],
  ["4", "山岳女", "ダンス", "テニス", "ハンド"],
  ["5", "体操", "バド", "ソフテニ", "—"],
  ["6", "剣道", "バスケ", "—", "—"],
  ["7", "空手", "ハンド", "陸上", "陸上"],
];

/** 玉入れの組み合わせ */
const BALL_MATCHES: string[] = [
  "第1試合 1組 vs 2組",
  "第2試合 3組 vs 4組",
  "第3試合 5組 vs 6組",
  "第4試合 7組 vs 8組",
];

/** 騎馬戦のコート割り（紅組は時計まわりに移動する） */
const HORSE_COURTS: { label: string; red: string; white: string }[] = [
  { label: "第1コート", red: "1c", white: "2c" },
  { label: "第2コート", red: "3c", white: "4c" },
  { label: "第3コート", red: "5c", white: "6c" },
  { label: "第4コート", red: "8c", white: "7c" },
];

const FAINT = "text-[rgba(245,242,233,.5)]";
const CAPTION = `text-[9.5px] ${FAINT}`;

/** 開会式・準備体操・閉会式のクラス隊形 */
function GridDiagram({ base }: { base: boolean }) {
  return (
    <div className="grid min-w-[540px] gap-[10px]">
      <div className="flex justify-center gap-[18px]">
        {GRADES.map((grade) => (
          <div key={grade} className="grid justify-items-center gap-[6px]">
            <div className="text-[10px] font-black tracking-[0.2em] text-om-yellow">{grade}</div>
            <div className="flex gap-[5px]">
              {CLASS_ORDER.map((classNo) => {
                // 基準列（2年5組の右列）だけ赤で示す
                const isBase = base && grade === "2年" && classNo === 5;
                return (
                  <div key={classNo} className="grid justify-items-center gap-[3px]">
                    <div className="flex gap-[2px]">
                      <span className="h-10 w-[7px] bg-[rgba(245,242,233,.24)]" />
                      <span
                        className={`h-10 w-[7px] ${isBase ? "bg-om-pink" : "bg-[rgba(245,242,233,.24)]"}`}
                      />
                    </div>
                    <div className="text-[8.5px] text-[rgba(245,242,233,.5)]">
                      {grade.charAt(0)}-{classNo}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-om-yellow py-[5px] text-center text-[9.5px] font-black tracking-[0.3em] text-om-ink">
        本 部
      </div>
      <div className={`${CAPTION} text-center`}>
        出席番号順に2列 ／ {base ? "赤＝基準列（2年5組 右列）・コーン2本" : "先頭＝体育祭委員"}
      </div>
    </div>
  );
}

/** リレーのトラック・コース */
function TrackDiagram() {
  const laneRow = (
    <div className="flex gap-[3px]">
      {LANES.map((lane) => (
        <div
          key={lane}
          className="flex h-[26px] flex-1 items-center justify-center border border-[rgba(245,242,233,.28)] bg-[rgba(245,242,233,.06)] text-[9.5px] text-[rgba(245,242,233,.75)]"
        >
          {lane}
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid min-w-[520px] gap-[8px]">
      <div className="flex justify-between gap-[10px] text-[9.5px] tracking-[0.18em] text-om-yellow">
        <span>バックストレート側</span>
        <span className="text-om-paper">走順は下の補足のとおり</span>
      </div>
      {laneRow}
      <div className="flex h-[58px] items-center justify-between rounded-[80px] border-2 border-dashed border-[rgba(245,242,233,.28)] px-[18px] text-[9.5px] tracking-[0.16em] text-[rgba(245,242,233,.5)]">
        <span className="text-om-pink">START</span>
        <span>オープン制 ・ コーナートップ制</span>
        <span className="text-om-yellow">GOAL</span>
      </div>
      {laneRow}
      <div className="flex justify-between gap-[10px] text-[9.5px] tracking-[0.18em] text-om-yellow">
        <span>本部側</span>
        <span className="text-om-paper">各学年8コース</span>
      </div>
      <div className={CAPTION}>レース順：1年 → 2年 → 3年 ／ 走前・走後で待機場所が分かれる</div>
    </div>
  );
}

/** 玉入れの円コート */
function BallDiagram() {
  return (
    <div className="grid min-w-[420px] justify-items-center gap-[14px]">
      <div className="flex flex-wrap justify-center gap-[30px]">
        {["第1コート", "第2コート"].map((label) => (
          <div
            key={label}
            className="relative flex size-[152px] flex-col items-center justify-center gap-[3px] rounded-full border-2 border-dashed border-[rgba(245,242,233,.35)]"
          >
            <div className="text-[10px] font-black tracking-[0.14em] text-om-yellow">{label}</div>
            <div className="text-[9.5px] text-[rgba(245,242,233,.6)]">円内 玉出し 6名</div>
            <div className="text-[9.5px] text-[rgba(245,242,233,.4)]">半径 3m</div>
            <span className="absolute -top-[10px] left-[20%] size-[18px] rounded-full bg-om-pink" />
            <span className="absolute right-[20%] -bottom-[10px] size-[18px] rounded-full bg-om-blue" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-[6px]">
        {BALL_MATCHES.map((match) => (
          <span
            key={match}
            className="border border-[rgba(245,242,233,.28)] px-[10px] py-[5px] text-[10px] font-black text-om-paper"
          >
            {match}
          </span>
        ))}
      </div>
      <div className={`${CAPTION} text-center`}>
        ● カゴ（1つの円に2つ・スタッフが支える）／ 円外18名が円を囲んで着席
      </div>
    </div>
  );
}

/** 部行進の並び順 */
function ParadeDiagram() {
  return (
    <div className="grid min-w-[520px] gap-[9px]">
      <div className="flex flex-wrap gap-[4px]">
        {CLUBS.map((name, index) => (
          <span
            key={name}
            className="inline-flex items-center gap-[6px] border border-[rgba(245,242,233,.22)] px-2 py-[5px] text-[10px] text-om-paper"
          >
            <span className="font-display text-om-yellow">{index + 1}</span>
            {name}
          </span>
        ))}
      </div>
      <div className="border-t border-dashed border-[rgba(245,242,233,.25)] pt-[9px] text-center text-[9.5px] tracking-[0.16em] text-om-yellow">
        ↓ バックストレート側から垂直に進み、停止線に着いた部活から停止
      </div>
    </div>
  );
}

/** 部対抗リレーのレーン表 */
function LaneDiagram() {
  const columns = "grid-cols-[56px_repeat(4,1fr)]";
  return (
    <div className="grid min-w-[460px] gap-[4px]">
      <div className={`grid ${columns} gap-[4px] text-[9.5px] tracking-[0.14em] text-om-yellow`}>
        <span>レーン</span>
        <span>パフォ</span>
        <span>女子</span>
        <span>男子①</span>
        <span>男子②</span>
      </div>
      {CLUB_LANES.map((row) => (
        <div key={row[0]} className={`grid ${columns} items-center gap-[4px] text-[11px] text-om-paper`}>
          <span className="font-display text-om-yellow">{row[0]}</span>
          {row.slice(1).map((cell, index) => (
            <span key={index} className="bg-[rgba(245,242,233,.06)] px-[7px] py-[5px]">
              {cell}
            </span>
          ))}
        </div>
      ))}
      <div className={`${CAPTION} mt-[5px]`}>
        フィールド本部側で整列 ／ パフォーマンス1周 → 女子200m → 男子①200m → 男子②200m
      </div>
    </div>
  );
}

/** 大縄跳びのロープ位置 */
function RopeDiagram() {
  return (
    <div className="grid min-w-[420px] gap-[9px]">
      {LANES.map((n) => (
        <div key={n} className="grid grid-cols-[44px_1fr_auto] items-center gap-[10px]">
          <span className="text-[10px] text-om-yellow">1-{n}</span>
          <span className="om-rope-line h-[3px]" />
          <span className="flex gap-[3px]">
            <span className="size-[9px] bg-om-blue" />
            <span className="size-[9px] bg-om-blue" />
          </span>
        </div>
      ))}
      <div className={`${CAPTION} text-right`}>
        ロープ東側（右）に本部を向いて2列で着席 ／ 1チーム20人（回し手2名込み）
      </div>
    </div>
  );
}

/** 棒引きの棒 12 本 */
function PoleDiagram() {
  return (
    <div className="grid min-w-[480px] gap-[9px]">
      <div className="flex justify-between text-[9.5px] tracking-[0.14em] text-om-yellow">
        <span>◀ 6m ライン</span>
        <span className="text-[rgba(245,242,233,.55)]">棒 12本</span>
        <span>6m ライン ▶</span>
      </div>
      <div className="grid gap-[5px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => {
          // 上下 2 本ずつ（1・2・11・12）は 5・6 回戦では使わないので薄く描く
          const outer = n <= 2 || n >= 11;
          return (
            <div key={n} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="h-[2px] bg-[rgba(245,242,233,.18)]" />
              <span className="flex items-center gap-[6px]">
                <span
                  className={`size-[12px] rounded-full ${outer ? "bg-[rgba(255,45,85,.35)]" : "bg-om-pink"}`}
                />
                <span
                  className={`h-[6px] w-[60px] ${outer ? "bg-[rgba(245,242,233,.25)]" : "bg-om-paper"}`}
                />
                <span
                  className={`size-[12px] rounded-full ${outer ? "bg-[rgba(36,91,255,.35)]" : "bg-om-blue"}`}
                />
              </span>
              <span className="h-[2px] bg-[rgba(245,242,233,.18)]" />
            </div>
          );
        })}
      </div>
      <div className={`${CAPTION} text-center`}>
        薄い上下2本ずつは5・6回戦では使わない ／ 棒の後ろに縦1列で並ぶ
      </div>
    </div>
  );
}

/** 騎馬戦のコート */
function HorseDiagram() {
  return (
    <div className="grid min-w-[420px] justify-items-center gap-[12px]">
      <div className="flex flex-wrap justify-center gap-4">
        {HORSE_COURTS.map((court) => (
          <div
            key={court.label}
            className="grid size-[122px] place-items-center gap-[3px] rounded-full border-2 border-[rgba(245,242,233,.3)]"
          >
            <div className="text-[9.5px] tracking-[0.14em] text-[rgba(245,242,233,.6)]">{court.label}</div>
            <div className="flex gap-[9px] text-[11.5px] font-black">
              <span className="text-[#FF4A3D]">紅 {court.red}</span>
              <span className="text-om-paper">白 {court.white}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={`${CAPTION} text-center`}>
        紅組は時計まわりに次のコートへ移動（第4試合まで）／ 2回戦は紅白に分かれての大将戦
      </div>
    </div>
  );
}

interface FormationDiagramProps {
  formation: FormationType;
  /** 招集隊形の補足。図の下に出す */
  formationNote: string;
}

/** 8 種類の招集隊形図。formation が "none" のときは何も描かない */
export function FormationDiagram({ formation, formationNote }: FormationDiagramProps) {
  if (formation === "none") return null;

  // 準備体操のように「基準列」から広がる隊形だけ、基準列を赤で示す
  const base = formationNote.includes("基準");

  return (
    // min-w-0: 中の図（min-width 420〜540px）に引っ張られて外側が広がらないようにする
    <div className="min-w-0 border border-om-ink">
      <div className="flex min-w-0 items-center justify-between gap-[10px] bg-om-ink px-3 py-2 font-display text-[10px] tracking-[0.24em] text-om-paper">
        <span>招集隊形</span>
        <span className="text-om-yellow">{DIAGRAM_LABEL[formation]}</span>
      </div>
      <div className="om-noscroll min-w-0 overflow-x-auto bg-[#141210] px-[14px] py-4">
        {formation === "grid" ? <GridDiagram base={base} /> : null}
        {formation === "track" ? <TrackDiagram /> : null}
        {formation === "ball" ? <BallDiagram /> : null}
        {formation === "parade" ? <ParadeDiagram /> : null}
        {formation === "lane" ? <LaneDiagram /> : null}
        {formation === "rope" ? <RopeDiagram /> : null}
        {formation === "pole" ? <PoleDiagram /> : null}
        {formation === "horse" ? <HorseDiagram /> : null}
      </div>
    </div>
  );
}
