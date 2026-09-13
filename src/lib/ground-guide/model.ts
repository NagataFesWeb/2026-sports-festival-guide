import type { EventKey, Point } from "./navigation";

export type Vec3 = [number, number, number];
export interface Face { vertices: Vec3[]; color: string }
// 表画面トークンに由来するモデル素材。地形の陰影だけ同じ色を減光する。
export const MATERIAL = { paper: "#f5f2e9", ink: "#111111", pink: "#ff2d55", yellow: "#ffe600", blue: "#245bff", line: "#e6e2d7", gray: "#8a857e" };
export function groundModel(event: EventKey): Face[] {
  const faces: Face[] = [];
  const face = (vertices: Vec3[], color: string) => faces.push({ vertices, color });
  const box = (x: number, z: number, w: number, d: number, h: number, color: string) => {
    const a: Vec3 = [x-w/2, 0, z-d/2], b: Vec3 = [x+w/2, 0, z-d/2], c: Vec3 = [x+w/2, 0, z+d/2], e: Vec3 = [x-w/2, 0, z+d/2];
    const up = (v: Vec3): Vec3 => [v[0], h, v[2]];
    face([up(a), up(b), up(c), up(e)], color);
    for (const [p, q] of [[a,b],[b,c],[c,e],[e,a]]) face([p,q,up(q),up(p)], color);
  };
  const pad = (x: number, z: number, w: number, d: number, color: string, y = .15) => face([[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y,z+d/2],[x-w/2,y,z+d/2]], color);
  const oval = (r: number, t: number): Point => ({ x: Math.cos(t) * r + (Math.cos(t) >= 0 ? 30 : -30), z: Math.sin(t) * r });
  // 陸上トラックは200mの模式形状。外周の輪郭は航空写真を参考に単純化する。
  face([[-85,-1,-40],[-70,-1,-56],[64,-1,-56],[85,-1,-34],[82,-1,44],[62,-1,57],[-63,-1,57],[-84,-1,36]], MATERIAL.line);
  for (let lane = 0; lane < 8; lane++) {
    for (let i = 0; i < 64; i++) {
      const a = oval(28 + lane * 1.25, i / 64 * Math.PI * 2), b = oval(28 + lane * 1.25, (i+1) / 64 * Math.PI * 2);
      const c = oval(29.1 + lane * 1.25, (i+1) / 64 * Math.PI * 2), d = oval(29.1 + lane * 1.25, i / 64 * Math.PI * 2);
      face([[a.x,.08,a.z],[b.x,.08,b.z],[c.x,.08,c.z],[d.x,.08,d.z]], MATERIAL.gray);
    }
  }
  const tent = (x: number, z: number, width: number, color: string) => {
    for (const dx of [-width/2,width/2]) for (const dz of [-3.5,3.5]) box(x+dx,z+dz,.4,.4,4,MATERIAL.ink);
    face([[x-width/2,4,z-4],[x+width/2,4,z-4],[x+width/2,7,z],[x-width/2,7,z]], color);
    face([[x-width/2,7,z],[x+width/2,7,z],[x+width/2,4,z+4],[x-width/2,4,z+4]], color);
    face([[x-width/2,4,z-4],[x-width/2,7,z],[x-width/2,4,z+4]], color);
    face([[x+width/2,4,z-4],[x+width/2,7,z],[x+width/2,4,z+4]], color);
  };
  // 曲線部分はトラックと同心の円弧上に置き、テントの長辺を接線方向に向ける。
  for (const side of [-1, 1]) for (const degrees of [22.5,67.5,112.5,157.5]) {
    const t=degrees*Math.PI/180;
    const cx=side*(30+47*Math.sin(t)),cz=47*Math.cos(t);
    const rotation=Math.atan2(-Math.sin(t),side*Math.cos(t));
    const from=faces.length;
    tent(0,0,28,MATERIAL.paper);
    for(const f of faces.slice(from)) f.vertices=f.vertices.map(([x,y,z])=>[
      cx+x*Math.cos(rotation)-z*Math.sin(rotation),y,cz+x*Math.sin(rotation)+z*Math.cos(rotation),
    ]);
  }
  for(const x of [-16,16])tent(x,-47,28,MATERIAL.paper);
  tent(0, 50, 24, MATERIAL.yellow); tent(30,50,19,MATERIAL.paper); tent(-30,50,19,MATERIAL.paper);
  box(0,40,7,3,1.7,MATERIAL.ink);
  const circle = (x: number, z: number, r: number, color: string) => {
    for (let i=0;i<48;i++) {
      const t=i/48*Math.PI*2,u=(i+1)/48*Math.PI*2;
      face([[x+Math.cos(t)*r,.2,z+Math.sin(t)*r],[x+Math.cos(u)*r,.2,z+Math.sin(u)*r],[x+Math.cos(u)*(r-.45),.2,z+Math.sin(u)*(r-.45)],[x+Math.cos(t)*(r-.45),.2,z+Math.sin(t)*(r-.45)]],color);
    }
  };
  if (event === "rope") for(let i=0;i<8;i++) pad(-42+Math.floor(i/2)*28, i%2?-13:13, 1, 21, MATERIAL.ink);
  if (event === "pole") for(let i=0;i<12;i++) { pad(0,-22+i*4,7,.65,MATERIAL.pink); };
  if (event === "horse") for(const x of [-20,20]) for(const z of [-14,14]) circle(x,z,7,MATERIAL.ink);
  if (event === "ball") for(const x of [-18,18]) { circle(x,0,9,MATERIAL.ink); box(x-3,0,.65,.65,5,MATERIAL.pink); box(x+3,0,.65,.65,5,MATERIAL.blue); }
  if (["opening","warmup","closing"].includes(event)) for(let grade=1;grade<=3;grade++) for(let c=1;c<=8;c++) {
    const x=(2-grade)*36+(4.5-c)*4;
    pad(x,5,1,20,MATERIAL.ink); pad(x+1.5,5,1,20,MATERIAL.gray);
  }
  return faces;
}

/** 一般的な3Dソフトでも開ける、バッファ内蔵のglTF 2.0。単位は模式座標。 */
export function modelGltf(faces: Face[]): string {
  const colors = [...new Set(faces.map(f => f.color))];
  const parts = colors.map(color => {
    const positions: number[] = [];
    for(const f of faces.filter(f=>f.color===color)) for(let i=1;i<f.vertices.length-1;i++) positions.push(...f.vertices[0],...f.vertices[i],...f.vertices[i+1]);
    return new Float32Array(positions);
  });
  const bytes = new Uint8Array(parts.reduce((n,p)=>n+p.byteLength,0)); let offset=0;
  const bufferViews=parts.map(p=>{const view={buffer:0,byteOffset:offset,byteLength:p.byteLength,target:34962}; bytes.set(new Uint8Array(p.buffer),offset);offset+=p.byteLength;return view;});
  let binary=""; for(const value of bytes) binary+=String.fromCharCode(value);
  return JSON.stringify({asset:{version:"2.0",generator:"Nagata ground guide",extras:{units:"schematic; not surveyed metres"}},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:"長田高校 体育祭グラウンド（概略）"}],meshes:[{primitives:parts.map((_,i)=>({attributes:{POSITION:i},material:i,mode:4}))}],materials:colors.map(color=>({name:color,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[...([1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)),1],metallicFactor:0,roughnessFactor:1}})),buffers:[{byteLength:bytes.length,uri:`data:application/octet-stream;base64,${btoa(binary)}`}],bufferViews,accessors:parts.map((p,i)=>({bufferView:i,componentType:5126,count:p.length/3,type:"VEC3",min:[0,1,2].map(axis=>{let v=Infinity;for(let j=axis;j<p.length;j+=3)v=Math.min(v,p[j]);return v;}),max:[0,1,2].map(axis=>{let v=-Infinity;for(let j=axis;j<p.length;j+=3)v=Math.max(v,p[j]);return v;})}))});
}
