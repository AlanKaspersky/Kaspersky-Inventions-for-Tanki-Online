/** Attenuate ambient/sun only; native dynamic/emissive additions stay intact. */
export function lightAttenuation(storm:number,rain:number,fade:number,flash=0){
 const safe=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
 return 1-Math.min(.78,safe(storm)*.70+safe(rain)*.10)*(1-safe(flash)*.85)*safe(fade);
}
export function attenuateLighting(buffer:unknown,factor:number):(()=>void)|undefined{
 if(!(buffer instanceof Float32Array)||buffer.length<12||!Number.isFinite(factor)||factor>=1)return;
 const indices=[0,1,2,4,5,6];if(indices.some(i=>!Number.isFinite(buffer[i])))return;
 const saved=indices.map(i=>buffer[i]);indices.forEach(i=>{buffer[i]*=Math.max(0,factor);});const applied=indices.map(i=>buffer[i]);
 return ()=>indices.forEach((index,i)=>{if(buffer[index]===applied[i])buffer[index]=saved[i];});
}
