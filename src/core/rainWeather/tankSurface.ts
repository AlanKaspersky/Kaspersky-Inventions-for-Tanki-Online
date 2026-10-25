import { collisionList } from './mapSurface';
import type { MapSchema,V3 } from './mapSurface';
const own=(v:unknown,k:string):unknown=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,k)?.value:undefined;
export function nativeMatrix(value:unknown,s:MapSchema):Float32Array|undefined{
 const m=new Float32Array(16);m[15]=1;
 for(const i of [0,1,2,4,5,6,8,9,10,12,13,14]){const v=own(value,s['m'+i]);if(typeof v!=='number'||!Number.isFinite(v))return;m[i]=v;}
 return m;
}
export const transformPoint=(m:Float32Array,p:V3):V3=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]];
/** Actual native hull collision boxes, including their local offsets/rotations.
 * No bounding-box roof is invented when a model contract is unavailable. */
export function hullSurface(main:unknown,boxes:unknown,s:MapSchema):Float32Array{
 const result:number[]=[];
 for(const box of [main,...collisionList(boxes,s)].slice(0,64)){
  const v=own(box,s.halfSize),half=[own(v,s.x),own(v,s.y),own(v,s.z)] as V3,m=nativeMatrix(own(box,s.boxMatrix),s);
  if(!m||!half.every(n=>Number.isFinite(n)&&n>0&&n<4000))continue;
  const p=(x:number,y:number,z:number)=>transformPoint(m,[x*half[0],y*half[1],z*half[2]]);
  for(const face of [[[1,-1,-1],[1,1,-1],[1,1,1],[1,-1,1]],[[-1,1,-1],[-1,-1,-1],[-1,-1,1],[-1,1,1]],
   [[1,1,-1],[-1,1,-1],[-1,1,1],[1,1,1]],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]],
   [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]]){
   const q=face.map(c=>p(c[0],c[1],c[2]));result.push(...q[0],...q[1],...q[2],...q[0],...q[2],...q[3]);
  }
 }
 return new Float32Array(result);
}
/** Highest exposed collision surface under an incoming rain ray. */
export function rainHit(vertices:Float32Array,m:Float32Array,x:number,y:number,z:number,wind:number):V3|null{
 return worldRainHit(transformHull(vertices,m),x,y,z,wind);
}
/** Transform once per tank/update, not once per emitted droplet. */
export function transformHull(vertices:Float32Array,m:Float32Array,out:Float32Array=new Float32Array(vertices.length)):Float32Array{
 for(let i=0;i<vertices.length;i+=3){const x=vertices[i],y=vertices[i+1],z=vertices[i+2];out[i]=m[0]*x+m[4]*y+m[8]*z+m[12];out[i+1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[i+2]=m[2]*x+m[6]*y+m[10]*z+m[14];}return out;
}
export function worldRainHit(vertices:Float32Array,x:number,y:number,z:number,wind:number):V3|null{
 const dx=wind*.4,dy=wind*.12;let highest=-Infinity;
 for(let i=0;i<vertices.length;i+=9){
  const ax=vertices[i],ay=vertices[i+1],az=vertices[i+2],ux=vertices[i+3]-ax,uy=vertices[i+4]-ay,uz=vertices[i+5]-az,vx=vertices[i+6]-ax,vy=vertices[i+7]-ay,vz=vertices[i+8]-az;
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,den=nx*dx+ny*dy+nz;if(den<.001)continue;
  const t=(nx*(ax-x)+ny*(ay-y)+nz*(az-z))/den;if(z+t<=highest)continue;
  const wx=x+dx*t-ax,wy=y+dy*t-ay,wz=z+t-az;
  // Oriented edge tests avoid allocating vectors for every triangle/candidate.
  const s=((wy*vz-wz*vy)*nx+(wz*vx-wx*vz)*ny+(wx*vy-wy*vx)*nz)/(nx*nx+ny*ny+nz*nz);
  const r=((uy*wz-uz*wy)*nx+(uz*wx-ux*wz)*ny+(ux*wy-uy*wx)*nz)/(nx*nx+ny*ny+nz*nz);
  if(s<0||r<0||s+r>1)continue;highest=z+t;
 }return Number.isFinite(highest)?[x+dx*(highest-z),y+dy*(highest-z),highest]:null;
}
