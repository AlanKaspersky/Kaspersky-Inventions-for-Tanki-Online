import type { MapTheme } from './environment';
export function skyboxDarkness(weather:{clouds:number;rain:number;storm:number},fade:number,theme?:MapTheme):number{
 const safe=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0;
 const night=theme==='SUMMER_NIGHT'||theme==='WINTER_NIGHT';
 return Math.min(.82,safe(weather.clouds)*.26+safe(weather.rain)*.16+safe(weather.storm)*.40)*safe(fade)*(night?.65:1);
}
/** Zero is the native appearance, including before the first uniform callback. */
export function skyboxShader(source:string):string{
 const anchor='outColor0 = color;';
 if(source.includes('kiWeatherSky')||!source.includes('uniform samplerCube skyboxTexture;')||!source.includes(anchor))return source;
 return 'uniform float kiWeatherSky;\n'+source.replace(anchor,'color.rgb *= 1.-clamp(kiWeatherSky,0.,.85);\n'+anchor);
}
export function createSkyboxUniforms(){
 const contexts=new WeakMap<WebGL2RenderingContext,WeakMap<WebGLProgram,WebGLUniformLocation|null>>();
 return(gl:WebGL2RenderingContext,darkness:number)=>{
  if(!gl||typeof gl.getUniformLocation!=='function'||gl.isContextLost())return;
  const program=gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram|null;if(!program)return;
  let cache=contexts.get(gl);if(!cache){cache=new WeakMap();contexts.set(gl,cache);}
  if(!cache.has(program))cache.set(program,gl.getUniformLocation(program,'kiWeatherSky'));
  const location=cache.get(program);if(location)gl.uniform1f(location,Math.max(0,Math.min(.85,darkness)));
 };
}
