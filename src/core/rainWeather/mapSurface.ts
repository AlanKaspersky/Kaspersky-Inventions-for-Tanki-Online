export type V3=[number,number,number];
export type MapSchema=Record<string,string>;
export const MAP_SURFACE=Object.freeze({minUp:Math.cos(Math.PI/180),tolerance:14,maxTriangles:120000,cell:600,maxCells:500000});
export interface CollisionSurface {vertices:Float32Array;supportVertices?:Float32Array;triangles:number;ground(x:number,y:number,z:number,gap?:number,flatOnly?:boolean):V3|null;}
const own=(v:unknown,key:string):unknown=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,key)?.value:undefined;
export function collisionList(v:unknown,s:MapSchema):unknown[]{
 if(Array.isArray(v)){if(v.length>40000)throw Error('Map collision list exceeds limit');return v;}
 if(!v||typeof v!=='object')throw Error('Unknown map collision list');
 const native=v as Record<string,unknown>,countMethod=native[s.count],getMethod=native[s.get];
 if(typeof countMethod!=='function'||typeof getMethod!=='function')throw Error('Unknown map collision list');
 const count:unknown=countMethod.call(v);if(typeof count!=='number'||!Number.isInteger(count)||count<0||count>40000)throw Error('Map collision list exceeds limit');
 return Array.from({length:count},(_,i)=>getMethod.call(v,i) as unknown);
}
/** Native map collision DTOs only; no physics-world or moving-body traversal. */
export function buildMapSurface(raw:unknown,s:MapSchema):CollisionSurface{
 const vector=(v:unknown):V3=>{const result=[own(v,s.x),own(v,s.y),own(v,s.z)] as V3;if(!result.every(Number.isFinite))throw Error('Invalid map collision vector');return result;};
 const number=(n:unknown)=>{if(typeof n!=='number'||!Number.isFinite(n))throw Error('Invalid collision dimension');return n;};
 const points:number[]=[],support:number[]=[],faces:number[][]=[],grid=new Map<string,number[]>();let cells=0;
 const add=(a:V3,b:V3,c:V3)=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
  if(length<.01)return;
  if(support.length/9>=MAP_SURFACE.maxTriangles*6)throw Error('Map support exceeds triangle budget');
  support.push(...a,...b,...c);
  if(n[2]/length<.35)return;
  if(faces.length>=MAP_SURFACE.maxTriangles)throw Error('Map surface exceeds triangle budget');
  const flat=n[2]/length>=MAP_SURFACE.minUp,id=faces.length,f=[...a,...b,...c,Number(flat)];faces.push(f);if(flat)points.push(...f.slice(0,9));
  const minX=Math.floor(Math.min(a[0],b[0],c[0])/MAP_SURFACE.cell),maxX=Math.floor(Math.max(a[0],b[0],c[0])/MAP_SURFACE.cell);
  const minY=Math.floor(Math.min(a[1],b[1],c[1])/MAP_SURFACE.cell),maxY=Math.floor(Math.max(a[1],b[1],c[1])/MAP_SURFACE.cell);
  if((maxX-minX+1)*(maxY-minY+1)>MAP_SURFACE.maxCells)throw Error('Map collision extent exceeds budget');
  for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
   if(++cells>MAP_SURFACE.maxCells)throw Error('Map collision lookup exceeds budget');const key=x+':'+y,items=grid.get(key);if(items)items.push(id);else grid.set(key,[id]);
  }
 };
 // Same Rz * Ry * Rx convention as the native Matrix3/Matrix4 a23/f24 methods.
 const pose=(position:unknown,rotation:unknown)=>{
  const t=vector(position),r=vector(rotation),cx=Math.cos(r[0]),sx=Math.sin(r[0]),cy=Math.cos(r[1]),sy=Math.sin(r[1]),cz=Math.cos(r[2]),sz=Math.sin(r[2]);
  return (p:V3):V3=>[t[0]+cz*cy*p[0]+(cz*sy*sx-sz*cx)*p[1]+(cz*sy*cx+sz*sx)*p[2],
   t[1]+sz*cy*p[0]+(sz*sy*sx+cz*cx)*p[1]+(sz*sy*cx-cz*sx)*p[2],t[2]-sy*p[0]+cy*sx*p[1]+cy*cx*p[2]];
 };
 const quad=(p:V3[])=>{add(p[0],p[1],p[2]);add(p[0],p[2],p[3]);};
 for(const box of collisionList(own(raw,s.boxes),s)){
  const size=vector(own(box,s.size)).map(v=>v*.5),transform=pose(own(box,s.boxPosition),own(box,s.boxRotation));
  if(size.some(n=>n<0||n>200000))throw Error('Invalid collision box dimensions');
  const corner=(x:number,y:number,z:number)=>transform([x*size[0],y*size[1],z*size[2]]);
  for(const corners of [[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,1,-1],[-1,-1,-1],[-1,-1,1],[-1,1,1]],
   [[1,1,-1],[-1,1,-1],[-1,1,1],[1,1,1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
   [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]])quad(corners.map(c=>corner(c[0],c[1],c[2])));
 }
 for(const plane of collisionList(own(raw,s.planes),s)){
  const transform=pose(own(plane,s.planePosition),own(plane,s.planeRotation)),w=number(own(plane,s.width))*.5,h=number(own(plane,s.length))*.5;
  if(!Number.isFinite(w+h)||w<0||h<0||w+h>200000)throw Error('Invalid collision plane dimensions');
  quad([[-w,-h,0],[w,-h,0],[w,h,0],[-w,h,0]].map(p=>transform(p as V3)));
 }
 for(const triangle of collisionList(own(raw,s.triangles),s)){
  const transform=pose(own(triangle,s.trianglePosition),own(triangle,s.triangleRotation));
  add(transform(vector(own(triangle,s.v0))),transform(vector(own(triangle,s.v1))),transform(vector(own(triangle,s.v2))));
 }
 return {vertices:new Float32Array(points),supportVertices:new Float32Array(support),triangles:points.length/9,ground(x,y,z,gap=80,flatOnly=true){
  if(![x,y,z].every(Number.isFinite))return null;let closest:V3|null=null,distance=gap;
  for(const id of grid.get(Math.floor(x/MAP_SURFACE.cell)+':'+Math.floor(y/MAP_SURFACE.cell))||[]){
   const f=faces[id];if(flatOnly&&!f[9])continue;const den=(f[4]-f[7])*(f[0]-f[6])+(f[6]-f[3])*(f[1]-f[7]);if(Math.abs(den)<.001)continue;
   const a=((f[4]-f[7])*(x-f[6])+(f[6]-f[3])*(y-f[7]))/den,b=((f[7]-f[1])*(x-f[6])+(f[0]-f[6])*(y-f[7]))/den;
   if(a<0||b<0||a+b>1)continue;const height=a*f[2]+b*f[5]+(1-a-b)*f[8],d=Math.abs(z-height);
   if(d<=distance){distance=d;closest=[x,y,height];}
  }return closest;
 }};
}
