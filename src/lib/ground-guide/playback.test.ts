import { describe, it, expect } from "vitest";
import { EVENTS } from "./navigation";
import { createPlayback, playbackFrame, RELAY_DISTANCES, samplePath, trackPoint } from "./playback";

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
  it("必要な交代と残留を省略しない",()=>{
    expect(createPlayback("pole").phases.filter(p=>p.label.includes("入場"))).toHaveLength(6);
    expect(createPlayback("horse").phases.filter(p=>/^総当たり第/.test(p.label))).toHaveLength(8);
    expect(createPlayback("horse").phases.filter(p=>/^大将戦・[女男]子$/.test(p.label))).toHaveLength(2);
    const p=createPlayback("parade"),last=playbackFrame(p,p.duration);
    expect(p.actors).toHaveLength(42);
    expect(last.actors.filter(a=>a.runner===1).every(a=>a.position.z===19)).toBe(true);
    expect(last.actors.filter(a=>a.runner===0).every(a=>a.position.z===-47)).toBe(true);
    expect(createPlayback("club").phases.filter(p=>/第4走者 200m/.test(p.label))).toHaveLength(3);
  });
  it("トラックの半周・周回と経路補間",()=>{
    expect(trackPoint(0).z).toBeGreaterThan(0);
    expect(trackPoint(.5).z).toBeLessThan(0);
    expect(trackPoint(1)).toEqual(trackPoint(0));
    expect(samplePath([{x:0,z:0},{x:10,z:0},{x:10,z:10}],.75)).toEqual({x:10,z:5});
  });
});
