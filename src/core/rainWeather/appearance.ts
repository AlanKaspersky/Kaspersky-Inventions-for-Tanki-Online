import type { RainPreset } from './schedule';
export type RGB=[number,number,number];
export interface WeatherPalette {low:RGB;high:RGB;haze:RGB;fog:RGB;}
/** Authored weather colours, independent of the map's daylight fog colour. */
export const WEATHER_PALETTES:Record<RainPreset,WeatherPalette>={
 storm:{low:[.055,.065,.085],high:[.16,.18,.22],haze:[.085,.10,.13],fog:[.075,.09,.115]},
 drizzle:{low:[.16,.19,.24],high:[.32,.37,.43],haze:[.24,.28,.33],fog:[.22,.25,.29]},
 overcast:{low:[.23,.26,.30],high:[.43,.47,.53],haze:[.33,.37,.42],fog:[.26,.29,.32]},
 sunshower:{low:[.39,.43,.48],high:[.75,.78,.80],haze:[.60,.64,.68],fog:[.50,.54,.59]},
 sunny:{low:[.68,.73,.79],high:[.91,.94,.98],haze:[.77,.81,.86],fog:[.61,.66,.71]},
};
Object.values(WEATHER_PALETTES).forEach(p=>{Object.values(p).forEach(Object.freeze);Object.freeze(p);});Object.freeze(WEATHER_PALETTES);
export const weatherPalette=(preset:RainPreset|null|undefined)=>WEATHER_PALETTES[preset||'storm'];
/** A per-upload numeric override, never a persistent graphics-setting edit. */
export function suppressNativeFog(value:number,amount:number):number{
 if(!Number.isFinite(value)||!Number.isFinite(amount))return value;
 return value*(1-Math.max(0,Math.min(1,amount)));
}
/** Drop-zone decals are transparent overlays. Keep opaque terrain/tank depth. */
export function suppressOverlayDepth(gl:WebGL2RenderingContext):(()=>void)|undefined{
 if(!gl||typeof gl.getParameter!=='function'||typeof gl.depthMask!=='function'||gl.isContextLost())return;
 const previous=gl.getParameter(gl.DEPTH_WRITEMASK) as boolean;if(previous!==true)return;
 gl.depthMask(false);return()=>gl.depthMask(previous);
}
