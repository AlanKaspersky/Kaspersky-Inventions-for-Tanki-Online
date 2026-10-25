/** Validated, origin-local surface parameters retained for existing preferences. */
export const WEATHER_TUNING_KEY='k_rain_surface_tuning_v1';
export const SURFACE_CONTROLS = [
 {key:'rainIntensity',min:0,max:1,step:.01,value:1},
 {key:'edgeInset',min:0,max:200,step:5,value:200},
 {key:'rippleSizeReduction',min:1,max:30,step:.5,value:15},
 {key:'rippleDensity',min:0,max:1,step:.01,value:1},
 {key:'rippleSpeed',min:.25,max:8,step:.05,value:8},
 {key:'rippleStrength',min:0,max:2,step:.05,value:0.7},
 {key:'waveSizeReduction',min:1,max:30,step:.5,value:16},
 {key:'waveSpeed',min:.25,max:8,step:.05,value:8},
 {key:'waveStrength',min:0,max:2,step:.05,value:2},
 {key:'reflectionStrength',min:0,max:2,step:.05,value:2},
 {key:'reflectionDistance',min:1000,max:12000,step:100,value:12000},
 {key:'reflectionRoughness',min:0,max:1,step:.01,value:1},
 {key:'refractionStrength',min:0,max:2,step:.05,value:2},
 {key:'groundSplashDensity',min:0,max:4,step:.05,value:4},
 {key:'tankSplashDensity',min:0,max:4,step:.05,value:4},
 {key:'splashSpeed',min:.25,max:4,step:.05,value:4},
 {key:'splashSize',min:.25,max:4,step:.05,value:0.25},
 {key:'splashLifetime',min:.15,max:1.5,step:.05,value:1.5},
 {key:'splashGravity',min:.25,max:3,step:.05,value:3},
] as const;
export type SurfaceTuning = Record<typeof SURFACE_CONTROLS[number]['key'],number>;
export const DEFAULT_SURFACE_TUNING:Readonly<SurfaceTuning>=Object.freeze(Object.fromEntries(SURFACE_CONTROLS.map(c=>[c.key,c.value])) as SurfaceTuning);
export function sanitizeSurfaceTuning(value:unknown):SurfaceTuning{
 const result={...DEFAULT_SURFACE_TUNING};
 if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const control of SURFACE_CONTROLS){
  // Only own data properties; console input cannot run getters in the renderer.
  const n=Object.getOwnPropertyDescriptor(value,control.key)?.value;
  if(typeof n==='number'&&Number.isFinite(n))result[control.key]=Math.max(control.min,Math.min(control.max,n));
 }
 return result;
}
export function readSurfaceTuning(storage:Pick<Storage,'getItem'>):SurfaceTuning{
 try{return sanitizeSurfaceTuning(JSON.parse(storage.getItem(WEATHER_TUNING_KEY)||'null'));}catch{return {...DEFAULT_SURFACE_TUNING};}
}
