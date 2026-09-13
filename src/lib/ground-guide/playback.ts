import { classSeat, guidePlan, type EventKey, type Point } from "./navigation";

/** 個人情報を持たない競技区分。位置は進行理解用の模式座標。 */
export interface Actor { id: string; label: string; short: string; home: Point; assembly: Point; grade: number; classNo: number; runner: number; heat: number }
export interface Motion { id: string; path: Point[]; active: boolean; status: string }
export interface Phase { label: string; note: string; duration: number; motions: Motion[] }
export interface Playback { actors: Actor[]; phases: Phase[]; duration: number }
export interface ActorFrame extends Actor { position: Point; path: Point[]; active: boolean; status: string }
export const RELAY_DISTANCES = { girls: [100,100,100,100,100,100], swedish: [100,100,200,200,300,400], mixed: [100,100,100,100,100,100,200,200] };
export const PARADE_CLUBS = ["野球","男子バレーボール","女子バレーボール","サッカー","男子テニス","女子テニス","男子ソフトテニス","女子ソフトテニス","男子バスケットボール","女子バスケットボール","卓球","水泳","陸上競技","剣道","器械体操","山岳","男子バドミントン","女子バドミントン","ハンドボール","空手道","ダンス"];
export const CLUB_HEATS = [
  { label: "パフォーマンス", clubs: ["剣道","水泳","体操"] },
  { label: "女子", clubs: ["ソフトテニス","卓球","ダンス","バスケ","バレーボール","テニス","バドミントン","陸上（ハンデ）"] },
  { label: "男子①", clubs: ["サッカー","バスケ","野球","バドミントン","サッカー（資料重複・要確認）","陸上（ハンデ）"] },
  { label: "男子②", clubs: ["ソフトテニス","ハンドボール","硬式テニス","卓球","空手道","山岳"] },
];

/** 200mトラックの模式線。半周ごとに本部側／反対側を結ぶ。 */
export function trackPoint(turn: number, lane = 1): Point {
  const r = 28.55 + (lane-1)*1.25, perimeter = 120+2*Math.PI*r;
  let d = ((turn%1+1)%1)*perimeter;
  if(d<30)return {x:-d,z:r}; d-=30;
  if(d<Math.PI*r){const a=Math.PI/2+d/r;return {x:-30+r*Math.cos(a),z:r*Math.sin(a)};} d-=Math.PI*r;
  if(d<60)return {x:-30+d,z:-r}; d-=60;
  if(d<Math.PI*r){const a=-Math.PI/2+d/r;return {x:30+r*Math.cos(a),z:r*Math.sin(a)};} d-=Math.PI*r;
  return {x:30-d,z:r};
}
export function samplePath(path: Point[], progress: number): Point {
  if(path.length<2)return path[0]??{x:0,z:0};
  const lengths=path.slice(1).map((p,i)=>Math.hypot(p.x-path[i].x,p.z-path[i].z));
  let remaining=Math.max(0,Math.min(1,progress))*lengths.reduce((a,b)=>a+b,0);
  for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]&&lengths[i]>0){const t=remaining/lengths[i];return {x:path[i].x+(path[i+1].x-path[i].x)*t,z:path[i].z+(path[i+1].z-path[i].z)*t};}remaining-=lengths[i];}
  return path[path.length-1];
}

export function createPlayback(event: EventKey): Playback {
  const actors: Actor[]=[]; const phases: Phase[]=[]; const positions=new Map<string,Point>();
  const add=(a: Actor)=>{actors.push(a);positions.set(a.id,a.home);};
  const step=(label: string, note: string, target: (a: Actor)=>Point|Point[], active: (a: Actor)=>boolean=()=>true, duration=3)=>{
    const motions=actors.map(a=>{const value=target(a), from=positions.get(a.id)!;const path=Array.isArray(value)?[from,...value]:[from,value];positions.set(a.id,path[path.length-1]);return {id:a.id,path,active:active(a),status:active(a)?label:"待機"};});
    phases.push({label,note,duration,motions});
  };
  const stay=(a: Actor)=>positions.get(a.id)!;
  const relay = event==="girls"||event==="swedish"||event==="mixed";
  if(relay||event==="club") {
    const heats=relay?[1,2,3].map(g=>({label:`${g}年`,clubs:Array.from({length:8},(_,i)=>`${i+1}組`)})):CLUB_HEATS;
    for(const [h,heat] of heats.entries())for(const [c,club] of heat.clubs.entries()) {
      const distances=relay?RELAY_DISTANCES[event]:h===0?[200]:[200,200,200,200];
      for(let r=1;r<=distances.length;r++){
        const plan=guidePlan(event,h+1,c+1,r);
        const assembly=relay?{x:-27+c*7.5,z:plan.assembly.z+(h-1)*3+(r-1)*.5}:{x:-30+c*8,z:14+h*4+r*.7};
        add({id:`h${h}-c${c}-r${r}`,label:`${heat.label} ${club} ${h===0&&!relay?"1周":`第${r}走者`}`,short:`${c+1}·${r}`,grade:relay?h+1:0,classNo:c+1,runner:r,heat:h,home:relay?classSeat(h+1,c+1):assembly,assembly});
      }
    }
    step("集合・走前待機",event==="club"?"部行進から出場者が残り、文化部が合流。部名は原表の表記。男子①サッカーの重複とハンデ位置は要確認。":"全3学年・全8組・全走順を同時表示。数字は組·走順。",a=>a.assembly);
    for(const [h,heat] of heats.entries()){
      const distances=relay?RELAY_DISTANCES[event]:h===0?[200]:[200,200,200,200];
      const offset=event==="swedish"?.5:0;
      const lane=(a:Actor)=>relay?[[2,7,6,4,1,3,5,8],[6,4,3,5,2,7,8,1],[6,7,2,5,3,8,4,1]][h].indexOf(a.classNo)+1:Math.min(a.classNo,8);
      step(`${heat.label}・競技位置へ`,"次走者も各バトン位置へ。外側の線・走者間隔は模式表現。",a=>a.heat===h?trackPoint(offset+distances.slice(0,a.runner-1).reduce((s,d)=>s+d,0)/200,lane(a)):stay(a),a=>a.heat===h);
      for(const [r,distance] of distances.entries()){
        const start=offset+distances.slice(0,r).reduce((s,d)=>s+d,0)/200;
        step(`${heat.label}・第${r+1}走者 ${distance}m`,event==="club"?"オープン制。見やすく離して描画し、実際のレーン維持や順位は表しません。":"走行→バトン受け渡し。全組を同速で描く説明用の動きで、実際の順位・所要時間ではありません。",a=>a.heat===h&&a.runner===r+1?Array.from({length:Math.ceil(distance/3)},(_,i)=>trackPoint(start+distance/200*(i+1)/Math.ceil(distance/3),lane(a))):stay(a),a=>a.heat===h&&a.runner===r+1,Math.max(3,distance/35));
        step(r===distances.length-1?`${heat.label}・最終走者ゴール`:`${heat.label}・第${r+1}→第${r+2}走者へバトン`,"走り終えた区分は内側の走後待機へ移り、残りの走者も表示し続けます。",a=>a.heat===h&&a.runner===r+1?{x:a.assembly.x,z:stay(a).z>0?12:-12}:stay(a),a=>a.heat===h&&a.runner===r+1,1.5);
      }
      step(`${heat.label}・退場`,relay?"退場指示で各クラステントへ。次の学年は待機を続けます。":"退場先は各自のクラステント。部員の所属学年・組は未入力のため、生徒席方向までを示します。",a=>a.heat===h?(relay?a.home:{x:-30+(a.classNo-1)*9,z:-47}):stay(a),a=>a.heat===h);
    }
  } else {
    if(event==="parade") {
      for(const [i,name] of PARADE_CLUBS.entries())for(const [part,suffix] of ["一般部員","リレー出場者"].entries()){
        const p={x:-60+i*6,z:-42+part*2};add({id:`club-${i}-${part}`,label:`${i+1} ${name}・${suffix}`,short:`${i+1}`,grade:0,classNo:i+1,runner:part,heat:0,home:p,assembly:p});
      }
    } else {
      const grades=event==="rope"?[1]:event==="pole"?[2]:event==="horse"?[3]:[1,2,3];
      for(const grade of grades)for(let c=1;c<=8;c++){
        const parts=event==="rope"?["8の字","全員跳び"]:event==="horse"||event==="pole"?["女子","男子"]:event==="ball"?["円外","円内","交代要員"]:[""];
        for(const [part,name] of parts.entries()) {
          const p=guidePlan(event,grade,c,1).assembly;
          const assembly={x:p.x+part*1.5,z:p.z+(event==="ball"?(grade-2)*2:part*2)};
          add({id:`g${grade}-c${c}-p${part}`,label:`${grade}年${c}組 ${name}`,short:`${c}${name?"·"+(part+1):""}`,grade,classNo:c,runner:part,heat:0,home:event==="warmup"?assembly:classSeat(grade,c),assembly});
        }
      }
    }
    step("集合・整列",event==="warmup"?"開会式の隊形から開始。":"全区分の移動を表示。記号は組（部行進は行進順）。細かな間隔は概略。",a=>a.assembly);
    if(event==="opening"||event==="closing") {
      step(event==="opening"?"点呼・開会宣言":"成績発表・表彰", "本部を向いて整列。",stay);
      step(event==="opening"?"校歌・挨拶・選手宣誓":"校歌・閉会宣言","整列したまま式次第に従います。",stay);
    }
    if(event==="warmup") {
      step("体操隊形へ広がる","2年5組右列と各列先頭を基準に広がる。間隔は模式表現。",a=>({x:a.assembly.x*1.08,z:a.assembly.z+3}));
      step("準備体操","号令に合わせて体操。区分の小さな往復で動作を表現。",a=>[stay(a),{x:stay(a).x,z:stay(a).z-2},stay(a)],()=>true,5);
    }
    if(event==="rope")for(let p=0;p<2;p++) {
      const name=p===0?"8の字跳び":"全員跳び";
      step(`${name}・入場と30秒練習`,"8組が同時に競技。もう半分はロープ東側で待機。",a=>a.runner===p?guidePlan(event,1,a.classNo,1).destination:a.assembly,a=>a.runner===p);
      step(`${name}・本番1分30秒`,"再生時間は短縮。回数・順位を予測しません。",a=>a.runner!==p?stay(a):Array.from({length:25},(_,i)=>({x:stay(a).x+(p===0?Math.sin(i/24*Math.PI*4)*3:0),z:stay(a).z+Math.sin(i/24*Math.PI*8)*2})),a=>a.runner===p,6);
      step(`${name}・終了と交代`,"記録確認後、次の区分へ交代。",a=>a.assembly);
    }
    if(event==="ball")for(let match=0;match<4;match++) {
      const selected=(a:Actor)=>Math.floor((a.classNo-1)/2)===match;
      const court=(a:Actor,inside:boolean)=>({x:(a.classNo%2?1:-1)*(inside?18:29),z:(a.grade-2)*3});
      step(`第${match+1}試合・${match*2+1}組 対 ${match*2+2}組 入場`,"1チーム3学年24名の本文を採用。原文の『各学年終了後』と矛盾があり要確認。円①②の割当は未確定の模式配置。",a=>selected(a)?court(a,a.runner===1):stay(a),selected);
      step(`第${match+1}試合・前半1分`,"円外18名が投げ、円内6名が玉を外へ。円の割当を示す確定案内ではありません。",a=>selected(a)?[stay(a),{x:stay(a).x,z:stay(a).z+2},stay(a)]:stay(a),selected,4);
      step(`第${match+1}試合・帽子を渡して交代`,"円内要員と交代要員が入れ替わります。",a=>selected(a)?court(a,a.runner===2):stay(a),a=>selected(a)&&a.runner>0);
      step(`第${match+1}試合・後半1分`,"後半は投げ方自由。",a=>selected(a)?[stay(a),{x:stay(a).x,z:stay(a).z+2},stay(a)]:stay(a),selected,4);
      step(`第${match+1}試合・集計と退場`,"その場で玉数を集計後、係員の指示で退場。",a=>selected(a)?a.home:stay(a),selected);
    }
    if(event==="pole")for(let round=1;round<=6;round++) {
      const selected=(a:Actor)=>a.runner===(round%2?0:1);
      const start=(a:Actor)=>({x:Math.sign(a.assembly.x)*(round<=2?4:9),z:a.assembly.z});
      step(`第${round}回戦・${round%2?"女子":"男子"} 入場`,"全8組を表示。棒番号・対戦対応は模式化し、個人へ割り当てません。前の選手の後ろを通って交代。",a=>selected(a)?[{x:a.assembly.x,z:a.assembly.z+5},{x:start(a).x,z:a.assembly.z+5},start(a)]:a.assembly,selected);
      step(`第${round}回戦・${round<=2?"棒を持って開始":"開始線から走って棒へ"}`,round>=5?"選抜2人組。外側各2本は使いません。位置は説明用です。":"3人組。勝負がついたら開始位置へ戻ってしゃがむ。",a=>selected(a)?[start(a),{x:Math.sign(a.assembly.x)*3,z:stay(a).z},start(a)]:stay(a),selected,4);
      step(`第${round}回戦・待機列へ`,"勝敗は再現せず、両側の引く動きと戻りを示します。",a=>a.assembly);
    }
    if(event==="horse") {
      step("応援合戦","紅白大将が中央で応援。全区分は待機。",stay);
      for(let round=1;round<=4;round++) {
        step(`総当たり・第${round}試合の待機位置`,"白2・4・6・7組は固定、紅1・3・5・8組は時計回り。",a=>{const p=guidePlan(event,3,a.classNo,1,round).assembly;return {...p,z:p.z+a.runner*2};});
        for(let sex=0;sex<2;sex++) {
          step(`総当たり第${round}試合・${sex===0?"女子":"男子"}`,"サークルへ入る→騎馬を組む→開始→終了。各試合で女子から男子へ交代。",a=>a.runner===sex?guidePlan(event,3,a.classNo,1,round).destination:stay(a),a=>a.runner===sex,4);
          step(`第${round}試合・${sex===0?"女子":"男子"} 待機へ`,"終了後はサークルの待機位置へ戻る。",a=>{const p=guidePlan(event,3,a.classNo,1,round).assembly;return {...p,z:p.z+a.runner*2};});
        }
      }
      step("大将戦の隊形へ","大将は列の後ろ。精密な列位置は未確定のため紅白の区分を模式表示。",a=>({x:[1,3,5,8].includes(a.classNo)?-30:30,z:-18+a.classNo*4+a.runner*2}));
      for(let sex=0;sex<2;sex++) {
        step(`大将戦・${sex===0?"女子":"男子"}`,"開始→終了（最長4分）。勝敗・失格者は予測しません。敗退時は元の待機列へ戻ります。",a=>a.runner===sex?{x:Math.sign(stay(a).x)*12,z:stay(a).z}:stay(a),a=>a.runner===sex,5);
        step(`大将戦・${sex===0?"女子は男子の後ろへ":"男子は待機列へ"}`,"クラス順に一列で待機。正確な位置は現地確認。",a=>({x:[1,3,5,8].includes(a.classNo)?-30:30,z:-18+a.classNo*4+a.runner*2}));
      }
    }
    if(event==="parade") {
      step("観覧隊形・ダンス演技","21部の行進順を表示。精密な列間隔は模式表現。",stay);
      step("全部の入場・停止線へ行進","バックストレート側から垂直に進み、着いた部から停止。",a=>({x:a.assembly.x,z:4+a.runner*2}),()=>true,8);
      step("運動部代表挨拶・激励","全ての部が観覧隊形で停止。",stay);
    }
    step(event==="opening"?"開会式終了・準備体操へ":event==="parade"?"一般部員は退場・リレー出場者は残留":"解散・生徒席へ",event==="opening"?"開会式後は解散せず、そのまま準備体操に続きます。":event==="parade"?"リレー出場者はフィールド本部側へ。その他は各クラステントへ（所属不明のため方向を表示）。":"終了の放送・係員の指示で移動。閉会式後の出口・移動先は資料未記載のため、生徒席方向までの概略です。",a=>event==="opening"?stay(a):event==="parade"?{x:a.assembly.x,z:a.runner===1?19:-47}:a.home);
  }
  step("終了",event==="opening"?"引き続き準備体操。":event==="parade"?"部対抗リレー出場者は残留。":"全区分の進行が終了しました。",stay,()=>false,1);
  return {actors,phases,duration:phases.reduce((s,p)=>s+p.duration,0)};
}

export function playbackFrame(playback: Playback, seconds: number) {
  let elapsed=Math.max(0,Math.min(seconds,playback.duration)), index=0;
  while(index<playback.phases.length-1&&elapsed+1e-9>=playback.phases[index].duration){elapsed-=playback.phases[index].duration;index++;}
  const phase=playback.phases[index], progress=Math.max(0,Math.min(1,elapsed/phase.duration));
  return {index,phase,actors:playback.actors.map((a,i):ActorFrame=>({...a,...phase.motions[i],position:samplePath(phase.motions[i].path,progress)}))};
}
