/** 図の座標。右が西、下が本部側。実測メートルではない。 */
export interface Point { x: number; z: number }
export interface Place extends Point { label: string }
export type EventKey = "opening" | "warmup" | "girls" | "swedish" | "mixed" | "ball" | "parade" | "club" | "rope" | "pole" | "horse" | "closing";
export const EVENTS: { key: EventKey; label: string }[] = [
  { key: "opening", label: "開会式" }, { key: "warmup", label: "準備体操" },
  { key: "girls", label: "女子6×100mリレー" }, { key: "swedish", label: "男子スウェーデンリレー" },
  { key: "mixed", label: "男女混合リレー" }, { key: "ball", label: "玉入れ" },
  { key: "parade", label: "部行進" }, { key: "club", label: "部対抗リレー" },
  { key: "rope", label: "大縄跳び" }, { key: "pole", label: "棒引き" },
  { key: "horse", label: "騎馬戦" }, { key: "closing", label: "閉会式" },
];
export const ORIGINS: Place[] = [
  { label: "本部前（外周）", x: 0, z: 46 }, { label: "生徒席側（外周）", x: 0, z: -46 },
  { label: "東側（外周）", x: -76, z: 0 }, { label: "西側（外周）", x: 76, z: 0 },
];
/** 追加の配置図：1年は左下から上、2年は奥の左から右、3年は右上から下。 */
export function classSeat(grade: number, classNo: number): Place {
  const angle = (grade === 1 ? 20+(classNo-1)*20 : 160-(classNo-1)*20) * Math.PI/180;
  const p = grade === 2 ? { x: -30+(classNo-1)*60/7, z: -47 }
    : { x: (grade===1?-30:30)+(grade===1?-1:1)*47*Math.sin(angle), z:47*Math.cos(angle) };
  return { ...p, label: `${grade}年${classNo}組の生徒席・テント` };
}

/** 個人を並べず、招集の区分を面で示すための静的データ。 */
export interface AssemblyGroup extends Point {
  id: string;
  label: string;
  description: string;
  width: number;
  depth: number;
}
export function assemblyGroups(event: EventKey, round = 1): AssemblyGroup[] {
  if (["girls", "swedish", "mixed"].includes(event)) {
    const front = event === "girls" ? "1・3・5走" : event === "swedish" ? "2・6走" : "1・3・5・7・8走";
    const back = event === "swedish" ? "1・3・4・5走" : "2・4・6走";
    return [
      { id:"front", x:-5,z:21,width:55,depth:11,label:`本部側：${front}`,description:"走前の待機区分。各学年・コースごとに整列。" },
      { id:"back", x:-5,z:-21,width:55,depth:11,label:`バックストレート側：${back}`,description:"走前の待機区分。各学年・コースごとに整列。" },
    ];
  }
  if (["opening","warmup","closing"].includes(event)) return [1,2,3].map(grade=>({
    id:`grade-${grade}`,x:(2-grade)*36,z:8,width:32,depth:24,label:`${grade}年・1〜8組`,
    description:event==="closing"?"本部を向いて右から1〜8組。男女各1列。":"本部を向いて右から1〜8組。出席番号順2列。",
  }));
  if (["rope","pole","ball","horse"].includes(event)) return Array.from({length:8},(_,i)=>{
    const classNo=i+1, grade=event==="rope"?1:event==="horse"?3:2;
    const p=guidePlan(event,grade,classNo,1,round).assembly;
    return { id:`class-${classNo}`, x:p.x,z:p.z,width:event==="rope"?8:15,depth:event==="rope"?19:event==="horse"?5:8,
      label: event==="horse"?`${classNo}組・${[1,3,5,8].includes(classNo)?"紅":"白"}`:`${classNo}組`,
      description:event==="rope"?"ロープ東側で本部を向いて2列。前半・後半は放送で交代。":event==="pole"?"クラスの待機列。個別の棒番号は係員に確認。":event==="ball"?"1年→2年→3年の順に3列で待機。":"総当たりのサークル待機位置。女子→男子。紅は時計回り、白は固定。",
    };
  });
  if(event==="club")return [{id:"club",x:0,z:19,width:65,depth:16,label:"本部側・部別の走前待機",description:"パフォーマンス→女子→男子①→男子②のレース順。部行進後、出場者はフィールドに残って整列。"}];
  return [{id:"parade",x:0,z:-42,width:64,depth:9,label:"生徒席側・部別の招集場所",description:"野球部からダンス部まで行進順で整列。プラカードを先頭に並ぶ。"}];
}

export function personalGroupId(event: EventKey, grade: number, classNo: number, runner: number): string {
  if(["girls","swedish","mixed"].includes(event))return guidePlan(event,grade,classNo,runner).assembly.z>0?"front":"back";
  if(["opening","warmup","closing"].includes(event))return `grade-${grade}`;
  if(["rope","pole","ball","horse"].includes(event))return `class-${classNo}`;
  return event;
}
export function eventKey(label: string): EventKey | null {
  if (label.includes("女子") && label.includes("リレー")) return "girls";
  return EVENTS.find(e => label.includes(e.label))?.key ?? null;
}
export interface GuidePlan { assembly: Place; destination: Place; note: string; timing: string; layout: EventKey }
export function guidePlan(event: EventKey, grade: number, classNo: number, runner: number, round = 1): GuidePlan {
  const laneClasses = [[2, 7, 6, 4, 1, 3, 5, 8], [6, 4, 3, 5, 2, 7, 8, 1], [6, 7, 2, 5, 3, 8, 4, 1]];
  const lane = (laneClasses[grade - 1] ?? laneClasses[0]).indexOf(classNo) + 1;
  const base = { layout: event, timing: "放送・招集係の指示で移動", note: "図に基づく概略位置です。通行できる場所と入場のタイミングは係員の指示に従ってください。" };
  if (["girls", "swedish", "mixed", "club"].includes(event)) {
    const back = event === "girls" ? runner % 2 === 0 : event === "swedish" ? ![2, 6].includes(runner) : event === "mixed" ? [2, 4, 6].includes(runner) : false;
    const z = back ? -1 : 1;
    const side = back ? "バックストレート側" : "本部側";
    return { ...base, assembly: { x: -18 + (grade - 1) * 13, z: z * 21, label: `${side}・走前待機` }, destination: { x: -22, z: z * (event === "club" ? 32 : 29 + lane * .65), label: `${side}・${event === "club" ? "スタート／バトン位置" : `${lane}コースのスタート／バトン位置`}` }, note: `${event === "club" ? "部行進後はフィールド本部側に残って整列。部別レーンは係員に確認。" : `第${runner}走者。${grade}年${classNo}組は${lane}コース。`} 集合・競技位置への移動はトラックを横断できます。矢印は移動案内で、走るコースではありません。`, timing: event === "girls" ? "準備体操退場後" : event === "swedish" ? "女子リレー退場後" : event === "mixed" ? "男子スウェーデンリレー退場後" : "部行進退場後" };
  }
  if (event === "rope") {
    const x = -42 + Math.floor((classNo - 1) / 2) * 28;
    const z = classNo % 2 ? 13 : -13;
    return { ...base, assembly: { x: x - 5, z, label: `${classNo}組ロープの東側・2列` }, destination: { x, z, label: `${classNo}組の大縄` }, timing: "部対抗リレー終了15分後（更衣休憩後）", note: "1年生。ロープの東側に本部を向いて2列で着席。前半・後半の交代は放送に従ってください。" };
  }
  if (event === "pole") {
    const west = [7, 4, 3, 5].includes(classNo);
    const order = (west ? [7, 4, 3, 5] : [8, 2, 1, 6]).indexOf(classNo);
    return { ...base, assembly: { x: west ? 39 : -39, z: -19 + order * 12, label: `${classNo}組の待機列` }, destination: { x: west ? 7 : -7, z: -19 + order * 12, label: "棒の周辺（個別の棒は係員確認）" }, timing: "大縄跳び後", note: "2年生。各クラス1列で入場。個人と棒番号の対応は資料にないため確定しません。次の試合への移動は人の後ろを通ります。" };
  }
  if (event === "horse") {
    const red = [1, 3, 5, 8].includes(classNo);
    const initial = (red ? [1, 3, 5, 8] : [2, 4, 6, 7]).indexOf(classNo);
    // 図の右上→右下→左下→左上が時計回り。紅だけ次のコートに移動する。
    const courts = [{ x: -20, z: -14 }, { x: 20, z: -14 }, { x: 20, z: 14 }, { x: -20, z: 14 }];
    const court = courts[(initial + (red ? round - 1 : 0) + 4) % 4];
    return { ...base, assembly: { x: court.x, z: court.z + (red ? 6 : -6), label: `第${round}試合・${red ? "紅" : "白"}のサークル待機位置` }, destination: { ...court, label: "対戦サークル" }, timing: "集合時刻は要確認（資料に競技順との不整合あり）", note: "3年生・1回戦の総当たり戦。白組は同じコート、紅組は時計回りに移動。2回戦の大将戦は配置が異なるため、この矢印の対象外です。" };
  }
  if (event === "ball") return { ...base, assembly: { x: classNo % 2 ? 47 : -47, z: 21 - Math.floor((classNo - 1) / 2) * 14, label: `${classNo}組の待機列（学年順）` }, destination: { x: 0, z: 14, label: "円コート手前（①／②は係員確認）" }, timing: "集合時刻は要確認（資料に競技順との不整合あり）", note: "原図は指揮台が上のため、他の図と向きを揃えて180度回転。組ごとの円コート割当が不明のため、矢印は2コートの手前までです。各組1年→2年→3年の順で3列。" };
  if (event === "parade") return { ...base, assembly: { x: 0, z: -42, label: "部行進招集場所（生徒席側）" }, destination: { x: 0, z: 4, label: "行進後の観覧隊形" }, timing: "資料記載：昼休み10分前（当日放送を確認）", note: "プラカードを先頭に、野球部からダンス部まで部別に整列。個人の所属部は学籍番号から推測しません。リレー出場者は行進後フィールドに残ります。" };
  const x = (2 - grade) * 36 + (4.5 - classNo) * 4;
  const place = { x, z: 8, label: `${grade}年${classNo}組の整列位置` };
  return { ...base, assembly: place, destination: { ...place, label: event === "warmup" ? "体操の隊形（号令で広がる）" : place.label }, timing: event === "opening" ? "8:20集合・8:30点呼完了" : event === "closing" ? "騎馬戦退場後、放送で集合" : "開会式の隊形から開始", note: event === "closing" ? "一度生徒席に着席してから放送で移動。開会式と同じ配置、男女各1列。" : "本部を向いて右から1年→2年→3年、右から1組→8組。出席番号順2列。体操は2年5組右列と各列先頭を基準に広がります。" };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
/** ユーザー確認によりトラック横断可。集合場所まで直接案内する。 */
export function routeToAssembly(start: Point, end: Point): Point[] {
  return distance(start, end) < .01 ? [start] : [start, end];
}

export interface GeoPoint { latitude: number; longitude: number }
export interface Calibration { headquarters: GeoPoint; back: GeoPoint }
function metres(p: GeoPoint, origin: GeoPoint): Point { return { x: (p.longitude - origin.longitude) * 111320 * Math.cos(origin.latitude * Math.PI / 180), z: (p.latitude - origin.latitude) * 111320 }; }
export function validCalibration(c: Calibration): boolean {
  const values = [c.headquarters, c.back];
  if (!values.every(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude - 34.668819) < .01 && Math.abs(p.longitude - 135.1432333) < .01)) return false;
  const d = distance(metres(c.back, c.headquarters), { x: 0, z: 0 });
  return d >= 30 && d <= 180;
}
/** 本部前と対向する生徒席側の実測2点で回転・縮尺を決める。GPSや学籍番号は送信しない。 */
export function projectGps(p: GeoPoint, c: Calibration): Point | null {
  if (!validCalibration(c)) return null;
  const axis = metres(c.headquarters, c.back), v = metres(p, c.back);
  const squared = axis.x ** 2 + axis.z ** 2;
  const result = { x: (-axis.z * v.x + axis.x * v.z) * 92 / squared, z: (axis.x * v.x + axis.z * v.z) * 92 / squared - 46 };
  return Math.abs(result.x) <= 85 && Math.abs(result.z) <= 55 ? result : null;
}
