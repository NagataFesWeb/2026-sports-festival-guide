import { describe, expect, it } from "vitest";
import { classSeat, eventKey, guidePlan, ORIGINS, projectGps, routeToAssembly, validCalibration, type EventKey } from "./navigation";
import { groundModel, modelGltf } from "./model";

describe("演技台帳の案内",()=>{
  it.each<[EventKey,number[]]>([["girls",[2,4,6]],["swedish",[1,3,4,5]],["mixed",[2,4,6]]])("%sの走順ごとの招集側",(event,back)=>{
    for(let n=1;n<=(event==="mixed"?8:6);n++)expect(guidePlan(event,2,1,n).assembly.z<0).toBe(back.includes(n));
  });
  it("レーンを学年・組から照合する",()=>{
    expect(guidePlan("girls",1,2,1).destination.label).toContain("1コース");
    expect(guidePlan("girls",2,1,1).destination.label).toContain("8コース");
    expect(guidePlan("girls",3,8,1).destination.label).toContain("6コース");
  });
  it("静的CSVの競技名を認識する",()=>{
    expect(eventKey("女子6×100ｍリレー")).toBe("girls");
    expect(eventKey("男女混合リレー7~8走")).toBe("mixed");
    expect(eventKey("大縄跳び 前半")).toBe("rope");
    expect(eventKey("未知の競技")).toBeNull();
  });
  it("大縄の東側と棒引きの待機側を反映する",()=>{
    const rope=guidePlan("rope",1,8,1);expect(rope.assembly.x).toBeLessThan(rope.destination.x);
    for(const c of [7,4,3,5]) expect(guidePlan("pole",2,c,1).assembly.x).toBeGreaterThan(0);
    for(const c of [8,2,1,6]) expect(guidePlan("pole",2,c,1).assembly.x).toBeLessThan(0);
  });
  it("騎馬戦の紅組だけ時計回りに移動する",()=>{
    const p=[1,2,3,4].map(n=>guidePlan("horse",3,1,1,n).destination);
    expect(p.map(v=>[v.x,v.z])).toEqual([[-20,-14],[20,-14],[20,14],[-20,14]]);
    expect(guidePlan("horse",3,2,1,4).destination).toEqual(guidePlan("horse",3,2,1,1).destination);
  });
  it("トラックを横断して出発地点から集合場所に直接案内する",()=>{
    for(const start of ORIGINS){const end={x:10,z:20};const route=routeToAssembly(start,end);expect(route[0]).toEqual(start);expect(route.at(-1)).toEqual(end);expect(route).toEqual([start,end]);}
  });
});
describe("生徒席",()=>{
  it("図の学年別の位置とクラス順に合う",()=>{
    expect(classSeat(1,1).x).toBeLessThan(0);
    expect(classSeat(1,1).z).toBeGreaterThan(classSeat(1,8).z);
    expect(classSeat(2,1).x).toBeLessThan(classSeat(2,8).x);
    expect(classSeat(2,1).z).toBeLessThan(0);
    expect(classSeat(3,1).x).toBeGreaterThan(0);
    expect(classSeat(3,1).z).toBeLessThan(classSeat(3,8).z);
  });
});
describe("GPS位置合わせ",()=>{
  const c={headquarters:{latitude:34.6692,longitude:135.1434},back:{latitude:34.6685,longitude:135.1434}};
  it("較正した両端と東西の向きを保持する",()=>{
    expect(validCalibration(c)).toBe(true);
    expect(projectGps(c.headquarters,c)?.z).toBeCloseTo(46);
    expect(projectGps(c.back,c)?.z).toBeCloseTo(-46);
    expect(projectGps({latitude:34.6688,longitude:135.1435},c)?.x).toBeLessThan(0);
  });
  it("未較正・非有限値・範囲外を拒否する",()=>{
    expect(validCalibration({headquarters:c.back,back:c.back})).toBe(false);
    expect(validCalibration({headquarters:{latitude:NaN,longitude:135},back:c.back})).toBe(false);
    expect(projectGps({latitude:35,longitude:136},c)).toBeNull();
  });
});
describe("3Dモデル",()=>{
  it("glTFの頂点バッファ・境界・素材が整合する",()=>{
    const faces=groundModel("horse");
    expect(faces.length).toBeGreaterThan(500);
    const model=JSON.parse(modelGltf(faces));
    expect(model.asset.version).toBe("2.0");
    const bytes=Buffer.from(model.buffers[0].uri.split(",")[1],"base64");
    expect(bytes.byteLength).toBe(model.buffers[0].byteLength);
    for(let i=0;i<model.accessors.length;i++){
      const a=model.accessors[i],view=model.bufferViews[i];
      expect(a.count*12).toBe(view.byteLength);
      expect(view.byteOffset+view.byteLength).toBeLessThanOrEqual(bytes.byteLength);
      for(let axis=0;axis<3;axis++)expect(a.min[axis]).toBeLessThanOrEqual(a.max[axis]);
    }
  });
});
