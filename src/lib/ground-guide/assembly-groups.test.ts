import { describe, expect, it } from "vitest";
import { assemblyGroups, EVENTS, guidePlan, personalGroupId, classSeat } from "./navigation";

describe("競技全体の集合区分", () => {
  it("12種目すべてに重複のない集合区分がある", () => {
    for(const {key} of EVENTS) {
      const groups=assemblyGroups(key);
      expect(groups.length).toBeGreaterThan(0);
      expect(new Set(groups.map(g=>g.id)).size).toBe(groups.length);
      expect(groups.every(g=>g.width>0 && g.depth>0 && g.description.length>0)).toBe(true);
    }
  });
  it("全学年・組・走順の個人集合位置を、対応する全体区分が含む", () => {
    for(const {key} of EVENTS) for(let grade=1;grade<=3;grade++) for(let classNo=1;classNo<=8;classNo++) for(let runner=1;runner<=(key==="mixed"?8:6);runner++) {
      const group=assemblyGroups(key).find(g=>g.id===personalGroupId(key,grade,classNo,runner));
      expect(group).toBeDefined();
      if(!group)throw new Error("区分なし");
      const p=guidePlan(key,grade,classNo,runner).assembly;
      expect(Math.abs(p.x-group.x)).toBeLessThanOrEqual(group.width/2);
      expect(Math.abs(p.z-group.z)).toBeLessThanOrEqual(group.depth/2);
    }
  });
  it("騎馬戦の試合切替後も各組の待機区分が追従する", () => {
    for(let round=1;round<=4;round++)for(let c=1;c<=8;c++) {
      const p=guidePlan("horse",3,c,1,round).assembly;
      const g=assemblyGroups("horse",round).find(g=>g.id===`class-${c}`);
      expect(g?.x).toBe(p.x);expect(g?.z).toBe(p.z);
    }
  });
  it("曲線側の生徒席がトラックと同心の半径47の円弧に沿う",()=>{
    for(const grade of [1,3])for(let c=1;c<=8;c++) {
      const p=classSeat(grade,c),center=grade===1?-30:30;
      expect(Math.hypot(p.x-center,p.z)).toBeCloseTo(47);
      expect(Math.sign(p.x)).toBe(grade===1?-1:1);
    }
  });
});
