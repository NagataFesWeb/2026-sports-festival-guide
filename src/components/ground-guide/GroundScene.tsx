"use client";

import { useMemo, useRef, useState, useId } from "react";
import { groundModel, modelGltf, MATERIAL, type Face, type Vec3 } from "@/lib/ground-guide/model";
import { routeToAssembly, type AssemblyGroup, type EventKey, type Place, type Point } from "@/lib/ground-guide/navigation";
import styles from "./guide.module.css";
import type { ActorFrame } from "@/lib/ground-guide/playback";

/** 光源による面の濃淡。テントの屋根・側面を背景から区別する。 */
function litColor(face: Face): string {
  if(face.vertices.every(v=>v[1]<.3))return face.color;
  const [a,b,c]=face.vertices;
  const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...normal)||1;
  const light=.72+.2*Math.abs(normal[1]/length)+.06*normal[2]/length;
  return `rgb(${[1,3,5].map(i=>Math.round(parseInt(face.color.slice(i,i+2),16)*light)).join(",")})`;
}

export function GroundScene({ event, start, assembly, destination, stage = 1, groups = [], highlightedGroup, actors = [] }: {
  event: EventKey; start?: Place; assembly?: Place; destination?: Place; stage?: 1 | 2;
  groups?: AssemblyGroup[]; highlightedGroup?: string;
  actors?: ActorFrame[];
}) {
  const [angle, setAngle] = useState(-12);
  const [top, setTop] = useState(false);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  const arrowId = useId().replaceAll(":", "");
  const faces = useMemo(() => groundModel(event), [event]);
  const radians = angle * Math.PI / 180;
  const project = ([x,y,z]: Vec3) => {
    const rx=x*Math.cos(radians)-z*Math.sin(radians), rz=x*Math.sin(radians)+z*Math.cos(radians);
    return { x:450+rx*4.5*zoom, y:300+(rz*(top?1:.62)-y*(top?0:1))*4.5*zoom, depth:rz+y*.05 };
  };
  const point = (p: Point) => project([p.x,1,p.z]);
  const activeCount = actors.filter(a=>a.active).length;
  const hasRoute = start !== undefined && assembly !== undefined && destination !== undefined;
  const path = hasRoute ? (stage===1 ? routeToAssembly(start,assembly) : [assembly,destination]) : [];
  const pathData = path.map((p,i)=>{const q=point(p);return `${i?"L":"M"}${q.x},${q.y}`;}).join(" ");
  function download() {
    const url=URL.createObjectURL(new Blob([modelGltf(faces)],{type:"model/gltf+json"}));
    const a=document.createElement("a");a.href=url;a.download=`nagata-ground-${event}.gltf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const labels: Place[]=[{x:0,z:55,label:"本部・保護者テント"},{x:0,z:-56,label:"2年 生徒席・バックストレート側"},{x:-81,z:0,label:"1年"},{x:81,z:0,label:"3年"}];
  return <div className={styles.sceneWrap}>
    <div className={styles.toolbar} aria-label="3Dモデルの表示操作">
      <button type="button" aria-pressed={!top} onClick={()=>setTop(false)}>立体</button>
      <button type="button" aria-pressed={top} onClick={()=>{setTop(true);setAngle(0);}}>真上</button>
      <button type="button" aria-label="左に回転" onClick={()=>setAngle(a=>a-30)}>↶</button>
      <button type="button" aria-label="右に回転" onClick={()=>setAngle(a=>a+30)}>↷</button>
      <button type="button" aria-label="縮小" disabled={zoom<=.7} onClick={()=>setZoom(z=>Math.max(.7,z-.15))}>−</button>
      <button type="button" aria-label="拡大" disabled={zoom>=1.45} onClick={()=>setZoom(z=>Math.min(1.45,z+.15))}>＋</button>
      <button type="button" onClick={()=>{setAngle(-12);setZoom(1);setTop(false);}}>戻す</button>
    </div>
    <svg className={styles.scene} viewBox="0 0 900 600" role="img" aria-label={`${EVENT_LABEL(event)}の立体会場図。集合区分：${groups.map(g=>g.label).join("、")}。${hasRoute ? `${stage===1?start.label:assembly.label}から${stage===1?assembly.label:destination.label}への概略矢印。` : (actors.length ? `全${actors.length}区分の進行を表示。` : "競技全体の集合場所を表示。")}ドラッグで回転。`}
      onPointerDown={e=>{drag.current={x:e.clientX,angle};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(drag.current)setAngle(drag.current.angle+(e.clientX-drag.current.x)*.45);}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>
      <defs><marker id={arrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill={stage===1?MATERIAL.blue:MATERIAL.pink}/></marker></defs>
      {faces.map((f,i)=>({f,i,p:f.vertices.map(project)})).sort((a,b)=>a.i===0?-1:b.i===0?1:a.p.reduce((s,p)=>s+p.depth,0)/a.p.length-b.p.reduce((s,p)=>s+p.depth,0)/b.p.length).map(({f,i,p})=><polygon key={i} points={p.map(q=>`${q.x},${q.y}`).join(" ")} fill={litColor(f)} stroke={litColor(f)} strokeWidth=".4"/>)}
      {labels.map(p=>{const q=point(p);return <text key={p.label} x={q.x} y={q.y} textAnchor="middle" className={styles.mapLabel}>{p.label}</text>;})}
      {actors.filter(a=>a.active).map(a=><polyline key={`route-${a.id}`} points={a.path.map(p=>{const q=point(p);return `${q.x},${q.y}`;}).join(" ")} fill="none" stroke={MATERIAL.blue} strokeOpacity=".3" strokeWidth="2"/>)}
      {[...actors].sort((a,b)=>Number(a.active)-Number(b.active)).map(a=>{const q=point(a.position);return <g key={a.id}><title>{a.label}：{a.status}</title><circle cx={q.x} cy={q.y} r={a.active?6:4} fill={a.active?MATERIAL.pink:MATERIAL.paper} stroke={a.active?MATERIAL.ink:MATERIAL.blue} strokeWidth="1.5"/>{a.active&&(activeCount<=32||a.runner===1)&&<text x={q.x+7} y={q.y-7} className={styles.actorLabel}>{a.short}</text>}</g>;})}
      {groups.map((group,index)=>{
        const own=group.id===highlightedGroup, color=own?MATERIAL.pink:MATERIAL.blue;
        const vertices: Point[]=[{x:group.x-group.width/2,z:group.z-group.depth/2},{x:group.x+group.width/2,z:group.z-group.depth/2},{x:group.x+group.width/2,z:group.z+group.depth/2},{x:group.x-group.width/2,z:group.z+group.depth/2}];
        const q=point(group);
        return <g key={group.id}>
          <polygon points={vertices.map(v=>{const p=point(v);return `${p.x},${p.y}`;}).join(" ")} fill={color} fillOpacity={own ? .3 : .12} stroke={color} strokeWidth={own?4:2} strokeDasharray={own?undefined:"6 3"}/>
          <text x={q.x} y={q.y-14} textAnchor="middle" className={styles.groupLabel} style={{fill:color}}>{String.fromCharCode(65+index)} {group.label.split("：")[0]}</text>
        </g>;
      })}
      <path d={pathData} fill="none" stroke={MATERIAL.paper} strokeWidth="12" strokeLinejoin="round"/>
      <path d={pathData} fill="none" stroke={stage===1?MATERIAL.blue:MATERIAL.pink} strokeWidth="6" strokeLinejoin="round" markerEnd={`url(#${arrowId})`}/>
      {(hasRoute ? (stage===1?[start,assembly]:[assembly,destination]) : []).map((p,i)=>{const q=point(p);return <g key={i}><circle cx={q.x} cy={q.y} r="13" fill={i?MATERIAL.pink:MATERIAL.blue} stroke={MATERIAL.paper} strokeWidth="3"/><text x={q.x} y={q.y+5} textAnchor="middle" fill={MATERIAL.paper} fontWeight="900" fontSize="15">{stage===1?i+1:i+2}</text></g>;})}
    </svg>
    <div className={styles.sceneCaption}><span>ドラッグで回転 ／ 寸法・通路は概略</span><button type="button" onClick={download}>3Dモデル保存 ↓</button></div>
  </div>;
}
function EVENT_LABEL(event: EventKey) { return event === "rope"?"大縄跳び":event === "horse"?"騎馬戦":"体育祭"; }
