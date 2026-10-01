import { describe, it, expect } from "vitest";
import { EVENTS } from "./navigation";
import { createPlayback, playbackFrame, RELAY_DISTANCES, samplePath, trackPoint, CLUB_HEATS } from "./playback";

describe("全区分の通し再生",()=>{
  for(const event of EVENTS)it(`${event.label}は集合から終了まで全区分が連続する`,()=>{
    const p=createPlayback(event.key);
    expect(p.phases[0].label).toContain("集合");
    expect(p.phases.at(-1)?.label).toBe("終了");
    expect(new Set(p.actors.map(a=>a.id)).size).toBe(p.actors.length);
    let t=0;
    for(const [i,phase] of p.phases.entries()){
      expect(phase.motions).toHaveLength(p.actors.length);
      for(const [j,motion] of phase.motions.entries()){
        if(i)expect(motion.path[0]).toEqual(p.phases[i-1].motions[j].path.at(-1));
        for(const point of motion.path){expect(Number.isFinite(point.x)&&Number.isFinite(point.z)).toBe(true);expect(Math.abs(point.x)).toBeLessThan(86);expect(Math.abs(point.z)).toBeLessThan(58);}
      }
      expect(playbackFrame(p,t).index).toBe(i);t+=phase.duration;
    }
    expect(playbackFrame(p,p.duration).phase.label).toBe("終了");
  });
  for(const event of ["girls","swedish","mixed"] as const)it(`${event}は全学年8組の最終走者まで走る`,()=>{
    const p=createPlayback(event);
    expect(p.actors).toHaveLength(3*8*RELAY_DISTANCES[event].length);
    for(let g=1;g<=3;g++)for(const [i,d] of RELAY_DISTANCES[event].entries()){
      const phase=p.phases.find(s=>s.label===`${g}年・第${i+1}走者 ${d}m`)!;
      expect(phase.motions.filter(m=>m.active)).toHaveLength(8);
      for(const m of phase.motions.filter(m=>m.active))expect(m.path.length).toBeGreaterThan(30);
    }
    for(const [i,a] of p.actors.entries())expect(p.phases.at(-1)?.motions[i].path.at(-1)).toEqual(a.home);
  });
  it.each(["girls", "swedish", "mixed", "club"] as const)("%sの全走者が真上から見て反時計回りに走る", event => {
    const races = createPlayback(event).phases.filter(p => /・第\d走者 \d+m$/.test(p.label));
    expect(races.length).toBeGreaterThan(0);
    for (const race of races) for (const motion of race.motions.filter(m => m.active)) {
      let rotation = 0;
      for (let i = 1; i < motion.path.length; i++) {
        const from = motion.path[i - 1], to = motion.path[i];
        // 図の縦軸は下向きなので、反時計回りの外積は負になる。
        const cross = from.x * to.z - from.z * to.x;
        expect(cross).toBeLessThanOrEqual(1e-8);
        rotation += cross;
      }
      expect(rotation).toBeLessThan(0);
    }
  });
  it.each(["girls", "swedish", "mixed", "club"] as const)("%sは走前に集合し、走り終えた側の走後で退場まで待機する", event => {
    const p = createPlayback(event);
    for (const [i, actor] of p.actors.entries()) {
      expect(p.phases[0].motions[i].path.at(-1)).toEqual(actor.assembly);
      expect(actor.assembly.x * actor.assembly.z).toBeLessThan(0);
      expect(p.phases[0].motions[i].status).toBe("走前待機");
      const raceIndex = p.phases.findIndex(phase => /・第\d走者 \d+m$/.test(phase.label) && phase.motions[i].active);
      expect(raceIndex).toBeGreaterThan(0);
      const finish = p.phases[raceIndex].motions[i].path.at(-1)!;
      const after = p.phases[raceIndex + 1].motions[i].path.at(-1)!;
      expect(Math.sign(after.z)).toBe(Math.sign(finish.z));
      expect(after.x * after.z).toBeGreaterThan(0);
      const retirement = p.phases.findIndex((phase, index) => index > raceIndex && phase.label.endsWith("・退場"));
      for (const phase of p.phases.slice(raceIndex + 1, retirement)) {
        expect(phase.motions[i].status).toBe("走後待機");
        expect(phase.motions[i].path.at(-1)).toEqual(after);
      }
    }
    const firstReady = p.phases[1];
    for (const [i, actor] of p.actors.entries()) if (actor.heat !== 0 || actor.runner > 2) {
      expect(firstReady.motions[i].path.at(-1)).toEqual(actor.assembly);
      expect(firstReady.motions[i].status).toBe("走前待機");
    }
  });
  it("必要な交代と残留を省略しない",()=>{
    expect(createPlayback("pole").phases.filter(p=>p.label.includes("入場"))).toHaveLength(6);
    expect(createPlayback("horse").phases.filter(p=>/^総当たり第/.test(p.label))).toHaveLength(8);
    expect(createPlayback("horse").phases.filter(p=>/^大将戦・[女男]子$/.test(p.label))).toHaveLength(2);
    const p=createPlayback("parade"),last=playbackFrame(p,p.duration);
    expect(p.actors).toHaveLength(42);
    expect(last.actors.filter(a=>a.runner===1).every(a=>a.position.z===19)).toBe(true);
    expect(last.actors.filter(a=>a.runner===0).every(a=>a.position.z===-47)).toBe(true);
    expect(createPlayback("club").phases.filter(p=>/第4走者 200m/.test(p.label))).toHaveLength(4);
  });
  it("最新台帳の部対抗5レースと部別の割当を保つ",()=>{
    expect(CLUB_HEATS.map(h=>h.label)).toEqual(["パフォーマンス","女子①","女子②","男子①","男子②"]);
    expect(CLUB_HEATS[0].clubs).toContain("空手道");
    expect(CLUB_HEATS[2].clubs).toEqual(["卓球","ダンス","バドミントン","空手道"]);
    expect(CLUB_HEATS[3].clubs.filter(c=>c==="サッカー")).toHaveLength(1);
    const labels=createPlayback("club").phases.filter(p=>p.label.includes("競技位置へ")).map(p=>p.label);
    expect(labels).toEqual(CLUB_HEATS.map(h=>`${h.label}・競技位置へ`));
  });
  it("騎馬戦は女子4試合から男子4試合へ進み、応援と周回は大将戦に入る",()=>{
    const p=createPlayback("horse");
    expect(p.phases.filter(p=>/^総当たり第/.test(p.label)).map(p=>p.label)).toEqual([
      "総当たり第1試合・女子","総当たり第2試合・女子","総当たり第3試合・女子","総当たり第4試合・女子",
      "総当たり第1試合・男子","総当たり第2試合・男子","総当たり第3試合・男子","総当たり第4試合・男子",
    ]);
    const first=p.phases.findIndex(p=>p.label==="総当たり第1試合・女子");
    const cheering=p.phases.findIndex(p=>p.label.includes("応援合戦"));
    expect(cheering).toBeGreaterThan(first);
    expect(p.phases.filter(p=>p.label.includes("コート内側を一周"))).toHaveLength(2);
  });
  it("トラックの半周・周回と経路補間",()=>{
    expect(trackPoint(0).z).toBeGreaterThan(0);
    expect(trackPoint(.01).x).toBeGreaterThan(0);
    expect(trackPoint(.5).z).toBeLessThan(0);
    expect(trackPoint(.51).x).toBeLessThan(0);
    expect(trackPoint(1)).toEqual(trackPoint(0));
    expect(samplePath([{x:0,z:0},{x:10,z:0},{x:10,z:10}],.75)).toEqual({x:10,z:5});
  });
});
