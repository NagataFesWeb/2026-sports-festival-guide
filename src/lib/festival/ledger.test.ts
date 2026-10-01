import { describe, it, expect } from "vitest";
import { personalAgenda, FESTIVAL_DAY } from "./ledger";
import { entryRunner } from "@/lib/ground-guide/navigation";
import { SEED_EVENTS } from "@/lib/casino/fixtures";

describe("台帳からの当日案内",()=>{
  it("番号だけで集合の順番、走前の側、全員参加が分かる",()=>{
    const agenda=personalAgenda("2806",[{event:"男女混合リレー7〜8走",slot:"第2走者"},{event:"棒引き",slot:"10人目"}]);
    expect(agenda.map(a=>a.event)).toEqual(["opening","warmup","mixed","pole","closing"]);
    expect(agenda[0].gather).toContain("8:20");
    expect(agenda[0].start).toBe("8:45");
    expect(agenda[2].place).toContain("本部側");
    expect(agenda[2].belongings).toContain("ゼッケン");
    expect(agenda[3].gather).toBe("大縄跳び後");
    expect(agenda[4].start).toBe("14:20");
  });
  it("最新の個人招集を優先し、同じ競技を重複して増やさない",()=>{
    const event=SEED_EVENTS.find(e=>e.name==="男女混合リレー")!;
    const agenda=personalAgenda("2806",[{event:"男女混合リレー1~6走",slot:"第5走者"}],[event],[{id:"test",studentId:"2806",eventName:event.name,gatherTime:"9:40",location:"本部前の招集列",tag:"係員案内"}],{[event.id]:"2026-10-02T10:00:00+09:00"});
    const mixed=agenda.filter(a=>a.event==="mixed");
    expect(mixed).toHaveLength(1);
    expect(mixed[0]).toMatchObject({gather:"9:40",place:"本部前の招集列",start:"10:00",slot:"第5走者"});
    expect(mixed[0].belongings).not.toContain("ゼッケン");
  });
  it("出場表が未取得でも対象学年の全員競技と式典を案内し、不整合時刻を推定しない",()=>{
    const agenda=personalAgenda("3101",null);
    expect(agenda.map(a=>a.event)).toEqual(["opening","warmup","horse","closing"]);
    expect(agenda.find(a=>a.event==="horse")?.gather).toContain("要確認");
    expect(FESTIVAL_DAY.date).toBe("2026-10-02");
    expect(SEED_EVENTS.every(e=>e.startTime?.startsWith("2026-10-02T"))).toBe(true);
  });
  it("混合の枠内走順を各表記で全体の走順に変換する",()=>{
    for(const separator of ["~","〜","～","-"]) {
      expect(entryRunner(`男女混合リレー7${separator}8走`,"第1走者")).toBe(7);
      expect(entryRunner(`男女混合リレー7${separator}8走`,"第2走者")).toBe(8);
    }
    expect(entryRunner("男女混合リレー1~6走","第5走者")).toBe(5);
  });
});
