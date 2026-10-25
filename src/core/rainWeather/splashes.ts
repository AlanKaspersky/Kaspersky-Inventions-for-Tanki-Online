import type { CollisionSurface,V3 } from './mapSurface';
import type { SurfaceTuning } from './tuning';
import { transformHull,worldRainHit } from './tankSurface';
export interface WetTank {position:V3;size:V3;velocity:V3;at:number;hull?:Float32Array;matrix?:Float32Array;}
export const SPLASHES=Object.freeze({capacity:1024,stride:11,groundRate:220,tankRate:65});
/** Bounded world-space ballistic droplets. Birth positions never follow the camera. */
export function createSplashEmitter(){
 const particles:number[][]=[],buffer=new Float32Array(SPLASHES.capacity*SPLASHES.stride);let previous=0,seed=1,plan=-1,groundCarry=0;
 let carry=new WeakMap<WetTank,number>();
 let hullBuffers=new WeakMap<WetTank,Float32Array>();
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const clear=()=>{particles.length=0;previous=0;groundCarry=0;plan=-1;carry=new WeakMap();hullBuffers=new WeakMap();};
 function update(f:{time:number;seed:number;rain:number;wind?:number;puddles:number;camera:V3;map?:CollisionSurface;tanks:WetTank[];tuning:SurfaceTuning;vp:Float32Array}){
  if(plan!==f.seed){clear();plan=f.seed;seed=f.seed>>>0||1;}
  const dt=previous?Math.min(.08,Math.max(0,f.time-previous)):0;previous=f.time;
  for(let i=particles.length-1;i>=0;i--)if(f.time-particles[i][6]>particles[i][7])particles.splice(i,1);
  const visible=(p:V3)=>{const m=f.vp,w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];if(w<=0)return false;
   return Math.abs(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])<w*1.08&&Math.abs(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])<w*1.08;};
  const spawn=(p:V3,kind:number,drive=1)=>{
   if(particles.length>=SPLASHES.capacity||!visible(p))return;
   const angle=random()*Math.PI*2,lateral=(30+random()*110)*drive,height=(90+random()*180)*drive;
   particles.push([p[0],p[1],p[2]+2,Math.cos(angle)*lateral,Math.sin(angle)*lateral,height,f.time,f.tuning.splashLifetime,.5+random()*.8,6+random()*10,kind]);
  };
  if(f.map&&dt>0&&f.rain>0){
   groundCarry=Math.min(60,groundCarry+dt*SPLASHES.groundRate*f.rain*f.tuning.groundSplashDensity);
   const attempts=Math.min(60,Math.floor(groundCarry));groundCarry-=attempts;
   for(let i=0;i<attempts;i++){
    const x=f.camera[0]+(random()-.5)*9000,y=f.camera[1]+(random()-.5)*9000,p=f.map.ground(x,y,f.camera[2],20000,false);
    if(p&&p[2]<=f.camera[2]+30)spawn(p,0);
   }
  }
  if(dt>0&&f.rain>0)for(const tank of f.tanks.slice(0,12)){
    if(!tank.hull?.length||!tank.matrix||!visible(tank.position))continue;
    const amount=Math.min(30,(carry.get(tank)||0)+dt*SPLASHES.tankRate*f.rain*f.tuning.tankSplashDensity);
    const count=Math.min(30,Math.floor(amount));carry.set(tank,amount-count);
    if(!count)continue;
    let hull=hullBuffers.get(tank);if(hull?.length!==tank.hull.length){hull=new Float32Array(tank.hull.length);hullBuffers.set(tank,hull);}transformHull(tank.hull,tank.matrix,hull);
    for(let i=0;i<count;i++){
     const radius=Math.hypot(tank.size[0],tank.size[1])*.5;
     const x=tank.position[0]+(random()*2-1)*radius,y=tank.position[1]+(random()*2-1)*radius;
     const p=worldRainHit(hull!,x,y,tank.position[2],f.wind??0);if(!p)continue;
     const cover=f.map?.ground(p[0],p[1],p[2]+20000,20000,false);if(cover&&cover[2]>p[2]+20)continue;
     spawn(p,1);
    }
  }
  if(f.rain<=0)particles.length=0;
  particles.forEach((p,i)=>buffer.set(p,i*SPLASHES.stride));
  return buffer.subarray(0,particles.length*SPLASHES.stride);
 }
 return {update,clear,status:()=>({particles:particles.length,capacity:SPLASHES.capacity})};
}
