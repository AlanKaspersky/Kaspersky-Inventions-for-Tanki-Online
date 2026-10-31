// Isolated localhost QA. Never uses the user's browser profile or installed extension.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const playwright=require('./runtime.cjs');
process.chdir(playwright.root);
const schema=require("../../src/generated/rain-weather.json").plans.at(-1).schema;
const shaderSources=require('../validation/weather-tree-shaders.cjs'),nativeSource=fs.readFileSync(fs.existsSync('artifacts/native/main.289a5d50.js')?'artifacts/native/main.289a5d50.js':'main.js','utf8');
const nativeTrees=shaderSources.nativeTreeShaders(nativeSource),nativeSkies=shaderSources.nativeSkyboxShaders(nativeSource),nativeMaps=shaderSources.nativeMapShaders(nativeSource),nativeFogCode=shaderSources.nativeFogFragment(nativeSource);
const bundle=buildSync({stdin:{contents:`import {DEFAULT_GRAPHICS_TUNING} from './src/core/graphicsPreferences';import {SNOW,SNOW_PALETTES,SNOW_VERTEX} from './src/core/snowWeather';import {createRainRenderer} from './src/core/rainWeather/renderer';import {installRainWeather} from './src/core/rainWeather';import {createWeatherAudio} from './src/core/rainWeather/audio';import {coreSettings} from './src/core/coreSettings';import {state} from './src/core/state';import {COMMON,FULL_VERTEX,CLOUD_FRAGMENT} from './src/core/rainWeather/shaders';import {HIGH_PUDDLE_SURFACE} from './src/core/rainWeather/puddleSurface';import {DEFAULT_SURFACE_TUNING} from './src/core/rainWeather/tuning';import {treeWindShader} from './src/core/rainWeather/treeWind';import {skyboxShader,skyboxDarkness} from './src/core/rainWeather/skybox';import {weatherPalette,suppressNativeFog,suppressOverlayDepth} from './src/core/rainWeather/appearance';window.__rainQA={DEFAULT_GRAPHICS_TUNING,SNOW,SNOW_PALETTES,SNOW_VERTEX,weatherPalette,suppressNativeFog,suppressOverlayDepth,skyboxShader,skyboxDarkness,treeWindShader,createRainRenderer,installRainWeather,createWeatherAudio,coreSettings,state,COMMON,FULL_VERTEX,CLOUD_FRAGMENT,HIGH_PUDDLE_SURFACE,DEFAULT_SURFACE_TUNING};`,resolveDir:path.resolve('.')},bundle:true,format:'iife',write:false}).outputFiles[0].text;
const output=path.resolve('artifacts/qa/rain-weather');fs.mkdirSync(output,{recursive:true});
const server=http.createServer((req,res)=>{if(req.url==='/qa.js'){res.setHeader('Content-Type','application/javascript');res.end(bundle);}else{res.setHeader('Content-Type','text/html');res.end('<!doctype html><body style="margin:0;background:#10151d"><div class="BattleComponentStyle-canvasContainer"><canvas width="800" height="500"></canvas></div><div class="BattleTimerComponentStyle-battleTimer">10:00</div><script src="/qa.js"></script>');}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await playwright.chromium.launch({...playwright.browserOptions,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--autoplay-policy=no-user-gesture-required']});
 try{
 const page=await browser.newPage({viewport:{width:800,height:500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.addStyleTag({path:'styles/settings.css'});
 const settingsReport=[];
 for(const lang of ['RU','EN']){
  settingsReport.push(await page.evaluate(async lang=>{
   const {coreSettings,state}=window.__rainQA;state.lang=lang;
   window.chrome.runtime={getURL:()=> 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'};
   const root=document.createElement('div');root.className='SettingsComponentStyle-blockContentOptions';root.innerHTML='<ul></ul>';document.body.append(root);
   coreSettings.inject();document.querySelector('#kaspersky-tab').click();
   const content=document.querySelector('#kaspersky-settings-content');content.style.cssText='position:relative;width:760px;height:auto;margin:0;';
   const editor=content.querySelector('.kasp-graphics-editor');if(editor.querySelectorAll('.kasp-gfx-card').length!==4)throw Error('Graphics cards missing');
   const toggle=editor.querySelector('[data-graphics-enabled="weather"]'),puddles=editor.querySelector('[data-graphics-enabled="puddles"]');
   if(toggle.checked)throw Error('Weather should start disabled');toggle.click();if(!toggle.checked||document.querySelector('[role="alertdialog"]'))throw Error('Weather toggle failed');
   if(!puddles.checked)puddles.click();
   editor.querySelectorAll('details').forEach(e=>e.open=true);
   const set=(field,value)=>{const e=editor.querySelector('[data-graphics-field="'+field+'"][type="range"]');e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));return e;};
   for(const value of [0,50,100]){const e=set('generation.duration',value);if(localStorage.getItem('k_rain_duration')!==String(value/100))throw Error('Duration not persisted');if(Math.abs(e.getBoundingClientRect().width-e.closest('.kasp-gfx-control').getBoundingClientRect().width)>.5)throw Error('Slider not full width');}
   set('generation.chance',100);set('volumes.thunder',25);set('volumes.rain',0);
   const preset=editor.querySelector('[data-graphics-preset]');preset.value='storm';preset.dispatchEvent(new Event('change',{bubbles:true}));
   if(localStorage.getItem('k_rain_preset')!=='storm'||localStorage.getItem('k_rain_chance')!=='1')throw Error('Generation not saved');
   if(editor.querySelector('[data-puddle-detail]')||editor.querySelector('[data-weather-precipitation]'))throw Error('Archived controls returned');
   if(!editor.textContent.includes(lang==='RU'?'зимних':'winter maps'))throw Error('Map policy missing');
   toggle.click();if(localStorage.getItem('k_rain_weather')!=='false'||localStorage.getItem('k_rain_puddles')!=='true')throw Error('Disabling weather erased puddle preference');
   coreSettings.onClose();root.remove();document.querySelector('#kaspersky-reload-tooltip')?.remove();
   return{lang,cards:4,sliders:true,persistence:true};
  },lang));
 }
 await page.evaluate(()=>{localStorage.removeItem('k_rain_volume');localStorage.removeItem('k_thunder_volume');localStorage.removeItem('k_rain_puddles');localStorage.removeItem('k_rain_puddle_detail');localStorage.removeItem('k_rain_duration');localStorage.removeItem('k_weather_precipitation');localStorage.removeItem('k_snow_drifts');});
 const defaultBufferCases=await page.evaluate(()=>{
  const results=[];
  for(const alpha of [false,true])for(const antialias of [false,true]){
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;
   const gl=canvas.getContext('webgl2',{alpha,antialias,depth:true,preserveDrawingBuffer:true});if(!gl)throw Error('Default framebuffer context unavailable');
   gl.viewport(0,0,320,200);gl.clearColor(.4,.5,.3,1);gl.clearDepth(.5);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   const samples=gl.getParameter(gl.SAMPLES),renderer=window.__rainQA.createRainRenderer(gl);
   const map={vertices:new Float32Array([-10,-10,0,10,-10,0,10,10,0,-10,-10,0,10,10,0,-10,10,0]),triangles:2};
   renderer.draw({map,vp:new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),camera:[0,0,2],time:60,seed:12,fade:1,rain:1,clouds:1,wind:1,storm:1,flash:0,puddles:1,fog:[0,0,1],fogColor:[.5,.5,.5,1]},'sky');
   const error=gl.getError(),status=renderer.status();if(error||status.reflectionCopies!==1||status.depthCopies!==1)throw Error('Default framebuffer resolve failed: '+JSON.stringify({alpha,antialias,samples,error,status}));
   results.push({alpha,antialias,samples,format:status.sceneCopy?.format,error});renderer.dispose();gl.getExtension('WEBGL_lose_context')?.loseContext();
  }return results;
 });
 const treeReport=await page.evaluate(trees=>{
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl2');if(!gl)throw Error('Tree QA WebGL2 unavailable');
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const fragment=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(1.);}');
  for(const tree of trees){
   const changed=window.__rainQA.treeWindShader(tree.source,tree.instanced);if(changed===tree.source)throw Error('Native tree shader was not modified: '+tree.name);
   const shader=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;precision highp int;\n'+changed),program=gl.createProgram();
   gl.attachShader(program,shader);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(tree.name+': '+gl.getProgramInfoLog(program));if(tree.instanced&&!gl.getUniformLocation(program,'timeAndWindStrength'))throw Error('Native mandatory foliage wind uniform optimized out');if(!tree.instanced&&tree.source.includes('#define USE_WIND 1')&&(!gl.getUniformLocation(program,'time')||!gl.getUniformLocation(program,'noiseTexture')))throw Error('Native sprite wind interface optimized out');gl.deleteProgram(program);gl.deleteShader(shader);
  }
  const source='uniform mat4 uWorldMatrix;uniform float movingTime;out vec3 result;void main(){vec3 position=vec3(0.,0.,float(gl_VertexID)*1000.),positionOffset=vec3(10.+sin(movingTime)*20.,10.,0.);vec3 localPosition = position + positionOffset;result=localPosition;gl_Position=vec4(0.,0.,0.,1.);}';
  const shader=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;\n'+window.__rainQA.treeWindShader(source,false)),program=gl.createProgram();gl.attachShader(program,shader);gl.attachShader(program,fragment);gl.transformFeedbackVaryings(program,['result'],gl.INTERLEAVED_ATTRIBS);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  const buffer=gl.createBuffer(),feedback=gl.createTransformFeedback();gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,feedback);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,buffer);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,24,gl.STREAM_READ);gl.useProgram(program);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,'uWorldMatrix'),false,new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,100,200,50,1]));
  const run=strength=>{gl.uniform1f(gl.getUniformLocation(program,'movingTime'),strength*10.);gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,2);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);const data=new Float32Array(6);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,data);return [...data];};
  const calm=run(0),storm=run(1);if(calm.some((n,i)=>n!==[0,0,0,0,0,1000][i])||storm.some((n,i)=>n!==calm[i]))throw Error('Foliage moved with time: '+JSON.stringify({calm,storm}));
  const error=gl.getError();if(error)throw Error('Tree GL error '+error);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.deleteBuffer(buffer);gl.deleteTransformFeedback(feedback);gl.deleteProgram(program);gl.deleteShader(shader);gl.deleteShader(fragment);gl.getExtension('WEBGL_lose_context')?.loseContext();
  return {nativeShaderVariants:trees.length,calm,storm,error};
 },nativeTrees);
 const skyboxReport=await page.evaluate(skies=>{
  const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;const gl=canvas.getContext('webgl2',{preserveDrawingBuffer:true});
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vs=compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;out vec3 texCoord;void main(){vec2 q=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(q*2.-1.,0.,1.);texCoord=vec3(1.,0.,0.);}');
  const cube=gl.createTexture();gl.bindTexture(gl.TEXTURE_CUBE_MAP,cube);for(let i=0;i<6;i++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+i,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([160,180,200,255]));gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  const result=[];for(const sky of skies){const fs=compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 outColor0;\n'+window.__rainQA.skyboxShader(sky.source)),program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.uniform1i(gl.getUniformLocation(program,'skyboxTexture'),0);gl.uniform4f(gl.getUniformLocation(program,'uFogColor'),.5,.6,.7,.25);
   const sample=dark=>{gl.uniform1f(gl.getUniformLocation(program,'kiWeatherSky'),dark);gl.drawArrays(gl.TRIANGLES,0,3);const p=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];};const clear=sample(0),dark=sample(.72),restored=sample(0);if(clear.some((v,i)=>v!==restored[i])||dark[3]!==255||dark.slice(0,3).some((v,i)=>Math.abs(v-clear[i]*.28)>1))throw Error('Native sky baseline/darkening regression');result.push({name:sky.name,clear,dark,restored});gl.deleteProgram(program);gl.deleteShader(fs);
  }const error=gl.getError();if(error)throw Error('Sky GL '+error);gl.deleteShader(vs);gl.deleteTexture(cube);gl.getExtension('WEBGL_lose_context')?.loseContext();return result;
 },nativeSkies);
 const paletteReport=await page.evaluate(()=>{
  const {CLOUD_FRAGMENT,FULL_VERTEX,weatherPalette}=window.__rainQA,canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const gl=canvas.getContext('webgl2',{alpha:true,preserveDrawingBuffer:true});
  const compile=(type,source)=>{const x=gl.createShader(type);gl.shaderSource(x,source);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x;},p=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,FULL_VERTEX),fs=compile(gl.FRAGMENT_SHADER,CLOUD_FRAGMENT);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);gl.viewport(0,0,256,64);gl.disable(gl.BLEND);
  const f=(name,v)=>gl.uniform1f(gl.getUniformLocation(p,name),v),v3=(name,v)=>gl.uniform3fv(gl.getUniformLocation(p,name),v);f('uCloud',1);f('uRain',1);f('uTime',40);f('uSeed',19027);f('uCloudBase',11000);f('uThickness',4200);v3('uCloudTone',[1,1,1]);v3('uFog',[1,1000,5000]);
  const sample=(preset,fog,forming=false)=>{const palette=weatherPalette(preset);v3('uCloudLow',palette.low);v3('uCloudHigh',palette.high);v3('uCloudHaze',palette.haze);gl.uniform4fv(gl.getUniformLocation(p,'uFogColor'),fog);f('uCloud',forming?.25:1);f('uRain',forming?0:1);gl.drawArrays(gl.TRIANGLES,0,3);const pixels=new Uint8Array(256*64*4);gl.readPixels(0,0,256,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let sum=0,count=0,peak=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>20){const l=(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)/pixels[i+3];sum+=l;count++;peak=Math.max(peak,l);}return{pixels,mean:sum/Math.max(1,count),peak,count};};
  const dark=sample('storm',[0,0,0,1]),white=sample('storm',[1,1,1,1]),pink=sample('storm',[1,0,1,1]),forming=sample('storm',[1,1,1,1],true);if(dark.pixels.some((v,i)=>v!==white.pixels[i]||v!==pink.pixels[i])||white.peak>.25||forming.peak>.25||dark.count<100)throw Error('Map daylight fog or formation whitens storm clouds: '+JSON.stringify({peak:white.peak,forming:forming.peak,count:dark.count}));
  const presets={};for(const preset of ['storm','drizzle','overcast','sunshower','sunny']){const x=sample(preset,[1,1,1,1]);presets[preset]={mean:x.mean,peak:x.peak};}if(!(presets.storm.mean<presets.drizzle.mean&&presets.drizzle.mean<presets.sunshower.mean&&presets.sunshower.mean<presets.sunny.mean))throw Error('Preset cloud palettes are not distinct');const error=gl.getError();if(error)throw Error('Palette GL '+error);gl.deleteProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);gl.getExtension('WEBGL_lose_context')?.loseContext();return {presets,mapFogIndependent:true,formationPeak:forming.peak,error};
 });
 const fogSuppressionGPU=await page.evaluate(fog=>{
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const gl=canvas.getContext('webgl2',{antialias:false,preserveDrawingBuffer:true});if(!gl)throw Error('Fog QA WebGL unavailable');
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'#version 300 es\nprecision highp float;out vec3 v_viewPosition;void main(){v_viewPosition=vec3(50000.,0.,0.);vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}'));
  gl.attachShader(program,compile(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\n#define USE_FOG 1\nin vec3 v_viewPosition;uniform vec3 uFogParams;uniform vec4 uFogColor;out vec4 o;void main(){vec3 color=vec3(.2,.3,.4);'+fog+'o=vec4(color,1.);}'));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.viewport(0,0,32,32);gl.uniform4f(gl.getUniformLocation(program,'uFogColor'),.8,.9,1,1);
  const draw=amount=>{const cap=window.__rainQA.suppressNativeFog(1,amount);gl.uniform3f(gl.getUniformLocation(program,'uFogParams'),1/40000,-7500/40000,cap);gl.drawArrays(gl.TRIANGLES,0,3);const data=new Uint8Array(4);gl.readPixels(16,16,1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);return [...data];};
  const before=draw(0),rain=draw(1),restored=draw(0);if(before.some((v,i)=>v!==restored[i])||Math.abs(rain[0]-51)>1||Math.abs(rain[1]-77)>1||Math.abs(rain[2]-102)>1||rain[0]>=before[0])throw Error('Native fog was not disabled/restored correctly');const error=gl.getError();if(error)throw Error('Native fog GL error '+error);gl.getExtension('WEBGL_lose_context')?.loseContext();return{before,rain,restored,error};
 },nativeFogCode);
 const report=await page.evaluate(async schema=>{
  const {createRainRenderer,installRainWeather}=window.__rainQA,canvas=document.querySelector('canvas'),g=canvas.getContext('webgl2',{depth:true,antialias:true,preserveDrawingBuffer:true});
  if(!g)throw Error('WebGL2 unavailable');
  const drawCounts=[],particleGeometry=[];for(const name of ['drawArrays','drawArraysInstanced','blitFramebuffer','texImage2D']){
   const original=g[name].bind(g);g[name]=function(...args){const result=original(...args);if(name==='drawArraysInstanced'){drawCounts.push(args[3]);particleGeometry.push({vertices:args[2],instances:args[3]});}const e=g.getError();if(e)throw Error(name+' WebGL error '+e);return result;};
  }
  const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const eye=[2400,-4200,2200],target=[0,0,300],z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,0,1],z)),y=cross(z,x);
  const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(Math.PI/6),near=50,far=100000,proj=[f/1.6,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],vp=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)vp[c*4+r]+=proj[k*4+r]*view[c*4+k];
  function program(vs,fs){const p=g.createProgram();for(const[type,src]of[[g.VERTEX_SHADER,vs],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
  const native=program(`#version 300 es
precision highp float;uniform mat4 vp;uniform float extent;out vec2 xy;void main(){vec2 p=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.:-1.);xy=p*extent;gl_Position=vp*vec4(xy,0.,1.);}`,`#version 300 es
precision highp float;in vec2 xy;out vec4 o;void main(){float line=max(step(.98,fract(xy.x/700.)),step(.98,fract(xy.y/700.)));o=vec4(vec3(.38,.40,.42)-line*.055,1.);}`);
  const vao=g.createVertexArray();
  function ground(target=null,extent=16000){g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(0,0,800,500);g.depthRange(0,1);g.disable(g.RASTERIZER_DISCARD);g.disable(g.SAMPLE_ALPHA_TO_COVERAGE);g.disable(g.SCISSOR_TEST);g.disable(g.CULL_FACE);g.disable(g.BLEND);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.depthMask(true);g.colorMask(true,true,true,true);g.clearColor(.54,.67,.82,1);g.clearDepth(1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(native);g.bindVertexArray(vao);g.uniformMatrix4fv(g.getUniformLocation(native,'vp'),false,vp);g.uniform1f(g.getUniformLocation(native,'extent'),extent);g.drawArrays(g.TRIANGLES,0,6);}
  function pixels(){const p=new Uint8Array(800*500*4);g.readPixels(0,0,800,500,g.RGBA,g.UNSIGNED_BYTE,p);return p;}
  function state(){const keys=['CURRENT_PROGRAM','VERTEX_ARRAY_BINDING','ACTIVE_TEXTURE','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA','DEPTH_WRITEMASK','DEPTH_FUNC','DRAW_FRAMEBUFFER_BINDING','READ_FRAMEBUFFER_BINDING','VIEWPORT','COLOR_WRITEMASK','PIXEL_UNPACK_BUFFER_BINDING','UNPACK_ALIGNMENT','UNPACK_ROW_LENGTH','UNPACK_SKIP_PIXELS','UNPACK_SKIP_ROWS'];const s={};for(const k of keys){const v=g.getParameter(g[k]);s[k]=ArrayBuffer.isView(v)?[...v]:v;}for(const k of ['BLEND','DEPTH_TEST','CULL_FACE','STENCIL_TEST','SCISSOR_TEST','RASTERIZER_DISCARD','SAMPLE_ALPHA_TO_COVERAGE'])s[k]=g.isEnabled(g[k]);const unit=g.getParameter(g.ACTIVE_TEXTURE);for(let i=11;i<=15;i++){g.activeTexture(g.TEXTURE0+i);s['texture'+i]=g.getParameter(g.TEXTURE_BINDING_2D);s['texture3D'+i]=g.getParameter(g.TEXTURE_BINDING_3D);s['sampler'+i]=g.getParameter(g.SAMPLER_BINDING);}g.activeTexture(unit);return s;}
  const map={vertices:new Float32Array([-16000,-16000,0,16000,-16000,0,16000,16000,0,-16000,-16000,0,16000,16000,0,-16000,16000,0]),triangles:2,ground:(x,y)=>[x,y,0]};
  const frame={map,vp,camera:eye,time:5,seed:19027,fade:1,rain:1,clouds:1,wind:1,flash:0,storm:1,fog:[1,1000,5000],fogColor:[.65,.72,.82,1]};
  ground();const clear=pixels(),gpu=createRainRenderer(g);
  const pbo=g.createBuffer();g.bindBuffer(g.PIXEL_UNPACK_BUFFER,pbo);g.bufferData(g.PIXEL_UNPACK_BUFFER,32,g.STATIC_DRAW);g.pixelStorei(g.UNPACK_ALIGNMENT,8);g.pixelStorei(g.UNPACK_ROW_LENGTH,7);g.pixelStorei(g.UNPACK_SKIP_ROWS,2);g.pixelStorei(g.UNPACK_SKIP_PIXELS,1);
  const sampler=g.createSampler();for(let i=11;i<=15;i++)g.bindSampler(i,sampler);const read=g.createFramebuffer();g.bindFramebuffer(g.READ_FRAMEBUFFER,read);g.enable(g.RASTERIZER_DISCARD);g.enable(g.SAMPLE_ALPHA_TO_COVERAGE);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE,g.ONE,g.ZERO);g.activeTexture(g.TEXTURE3);
  g.depthRange(.15,.85);const rangeBefore=[...g.getParameter(g.DEPTH_RANGE)];
  const before=state();gpu.warm();gpu.draw(frame);const after=state();
  if(gpu.status().reflectionCopies!==0||gpu.status().reflectionSize!==null)throw Error('Disabled puddles allocate or copy scene colour');
  if(JSON.stringify([...g.getParameter(g.DEPTH_RANGE)])!==JSON.stringify(rangeBefore))throw Error('Changed native depth range');
  for(const k of Object.keys(before)){if(Array.isArray(before[k])){if(JSON.stringify(before[k])!==JSON.stringify(after[k]))throw Error('State array changed '+k);}else if(before[k]!==after[k])throw Error('State changed '+k);}
  g.bindBuffer(g.PIXEL_UNPACK_BUFFER,null);g.pixelStorei(g.UNPACK_ALIGNMENT,4);g.pixelStorei(g.UNPACK_ROW_LENGTH,0);g.pixelStorei(g.UNPACK_SKIP_ROWS,0);g.pixelStorei(g.UNPACK_SKIP_PIXELS,0);for(let i=11;i<=15;i++)g.bindSampler(i,null);g.bindFramebuffer(g.READ_FRAMEBUFFER,null);
  ground();gpu.draw({...frame,rain:0,clouds:0,storm:0});const unchanged=pixels();if(unchanged.some((v,i)=>v!==clear[i]))throw Error('Clear battle is modified');
  ground();gpu.draw({...frame,time:6});const storm=pixels();let base=0,dark=0;for(let y=0;y<200;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;base+=clear[i]+clear[i+1]+clear[i+2];dark+=storm[i]+storm[i+1]+storm[i+2];}
  if(dark/base>.70)throw Error('Storm is not gloomy enough '+dark/base);
  ground();const nativeLit=pixels();gpu.draw({...frame,rain:0,nativeLighting:true},'weather');const litAfter=pixels();
  if(nativeLit.some((v,i)=>v!==litAfter[i]))throw Error('Late weather grading still darkens native dynamic/emissive colour');
  const snowMotion=(()=>{
   const previous={program:g.getParameter(g.CURRENT_PROGRAM),vao:g.getParameter(g.VERTEX_ARRAY_BINDING),feedback:g.getParameter(g.TRANSFORM_FEEDBACK_BINDING),buffer:g.getParameter(g.TRANSFORM_FEEDBACK_BUFFER_BINDING),discard:g.isEnabled(g.RASTERIZER_DISCARD)};
   const p=g.createProgram(),buffer=g.createBuffer(),feedback=g.createTransformFeedback(),vao=g.createVertexArray(),n=512;
   const vertex=window.__rainQA.SNOW_VERTEX.replace('out vec2 q;','out vec3 qaCenter;out vec2 q;').replace('vec3 center=relative+uCam;','vec3 center=relative+uCam;qaCenter=center;');
   try{
    for(const [type,source]of [[g.VERTEX_SHADER,vertex],[g.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(1.);}']]){
     const shader=g.createShader(type);g.shaderSource(shader,source);g.compileShader(shader);if(!g.getShaderParameter(shader,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(shader));g.attachShader(p,shader);g.deleteShader(shader);
    }
    g.transformFeedbackVaryings(p,['qaCenter'],g.INTERLEAVED_ATTRIBS);g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));
    g.useProgram(p);g.bindVertexArray(vao);g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,feedback);g.bindBuffer(g.TRANSFORM_FEEDBACK_BUFFER,buffer);g.bufferData(g.TRANSFORM_FEEDBACK_BUFFER,n*3*4,g.DYNAMIC_READ);g.bindBufferBase(g.TRANSFORM_FEEDBACK_BUFFER,0,buffer);g.enable(g.RASTERIZER_DISCARD);
    g.uniform3f(g.getUniformLocation(p,'uCam'),0,0,1500);g.uniform1f(g.getUniformLocation(p,'uSeed'),19027);
    const sample=(time,wind)=>{g.uniform1f(g.getUniformLocation(p,'uTime'),time);g.uniform1f(g.getUniformLocation(p,'uWind'),wind);g.beginTransformFeedback(g.POINTS);g.drawArraysInstanced(g.POINTS,0,1,n);g.endTransformFeedback();const out=new Float32Array(n*3);g.getBufferSubData(g.TRANSFORM_FEEDBACK_BUFFER,0,out);return out;};
    const velocity=wind=>{const a=sample(60,wind),b=sample(60.02,wind);let horizontal=0,fall=0,count=0;for(let i=0;i<a.length;i+=3){if(Math.abs(a[i]-b[i])>1000||Math.abs(a[i+1]-b[i+1])>1000||Math.abs(a[i+2]-b[i+2])>1000)continue;horizontal+=Math.abs(b[i]-a[i])/.02;fall+=(a[i+2]-b[i+2])/.02;count++;}if(count<480)throw Error('Too many wrapped snow probes');return{horizontal:horizontal/count,fall:fall/count,samples:count};};
    const calm=velocity(.2),blizzard=velocity(1);if(blizzard.horizontal<3500||blizzard.horizontal>10000||blizzard.fall<calm.fall*2)throw Error('Blizzard is still gentle: '+JSON.stringify({calm,blizzard}));return{calm,blizzard};
   }finally{
    g.bindTransformFeedback(g.TRANSFORM_FEEDBACK,previous.feedback);g.bindBuffer(g.TRANSFORM_FEEDBACK_BUFFER,previous.buffer);g.bindVertexArray(previous.vao);g.useProgram(previous.program);if(previous.discard)g.enable(g.RASTERIZER_DISCARD);else g.disable(g.RASTERIZER_DISCARD);g.deleteTransformFeedback(feedback);g.deleteBuffer(buffer);g.deleteVertexArray(vao);g.deleteProgram(p);
   }
  })();
  const snowfall=createRainRenderer(g),snowFrame={...frame,precipitation:'snow',nativeLighting:true,rain:1,clouds:0,storm:0,fog:[0,1000,5000],puddles:1};
  const snowPixels=(time,fade=1,rain=1)=>{ground();snowfall.draw({...snowFrame,time,fade,rain},'weather');return pixels();};
  const snowCalls=particleGeometry.length;const snowy=snowPixels(60);const snowDraws=particleGeometry.slice(snowCalls);let snowChanged=0;for(let i=0;i<snowy.length;i+=4)if(snowy[i]>nativeLit[i]+4||snowy[i+1]>nativeLit[i+1]+4||snowy[i+2]>nativeLit[i+2]+4)snowChanged++;
  if(snowChanged<30||snowfall.status().snowError||snowfall.status().snowFlakes!==window.__rainQA.SNOW.maxFlakes)throw Error('Snowflakes failed to render: '+JSON.stringify({snowChanged,status:snowfall.status()}));
  const mixed=snowfall.status();
  if(mixed.snowCrystals!==4000||mixed.snowStreaks!==16000||mixed.snowStreakError)throw Error('Blizzard ribbon mixture missing: '+JSON.stringify(mixed));
  const snowVertices=snowDraws.reduce((n,draw)=>n+draw.vertices*draw.instances,0);
  if(snowVertices!==144000)throw Error('Blizzard did not reduce particle geometry: '+JSON.stringify(snowDraws));
  const faded=snowPixels(60,0);if(faded.some((v,i)=>v!==nativeLit[i]))throw Error('Snow fade=0 changes the scene');
  const movedSnow=snowPixels(61);let snowAnimated=0;for(let i=0;i<snowy.length;i+=4)if(snowy[i]!==movedSnow[i]||snowy[i+1]!==movedSnow[i+1])snowAnimated++;
  if(snowAnimated<30)throw Error('Snow is static');
  snowPixels(60,1,.25);if(snowfall.status().snowFlakes!==5000)throw Error('Snow density does not follow intensity');
  ground();g.clearDepth(0);g.clear(g.DEPTH_BUFFER_BIT);const covered=pixels();snowfall.draw({...snowFrame,time:60},'weather');
  if(pixels().some((v,i)=>v!==covered[i]))throw Error('Snow leaked through occluding geometry');
  if(snowfall.status().reflectionCopies||snowfall.status().splashParticles)throw Error('Snow generated liquid water');
  snowPixels(60);window.__rainCaptureSnow=canvas.toDataURL();
  const customized=createRainRenderer(g),graphics={...window.__rainQA.DEFAULT_GRAPHICS_TUNING,rainDrops:1000,rainOpacity:0,darkness:0,snowFlakes:1200,snowStreaks:0,snowFaces:1};
  ground();const customBaseline=pixels(),beginCalls=particleGeometry.length;
  customized.draw({...frame,rain:1,clouds:0,storm:0,nativeLighting:true,graphics},'weather');
  if(pixels().some((v,i)=>v!==customBaseline[i])||!particleGeometry.slice(beginCalls).some(d=>d.instances===1000&&d.vertices===4))throw Error('Rain tuning did not reach draw count/opacity');
  ground();const snowBegin=particleGeometry.length;customized.draw({...snowFrame,graphics},'weather');
  if(customized.status().snowFlakes!==1200||!particleGeometry.slice(snowBegin).some(d=>d.instances===1200&&d.vertices===6))throw Error('Snow tuning did not reach polygon/particle budgets');
  ground();customized.draw({...frame,graphics:{...graphics,cloudResolution:256},clouds:1},'sky');
  if(JSON.stringify(customized.status().cloudSize)!==JSON.stringify([256,64]))throw Error('Cloud resolution setting ignored');customized.dispose();
  const snowReport={motion:snowMotion,crystals:mixed.snowCrystals,streaks:mixed.snowStreaks,vertices:snowVertices,visiblePixels:snowChanged,animatedPixels:snowAnimated,maxFlakes:window.__rainQA.SNOW.maxFlakes,occlusion:true,fade:true,noLiquidWater:true};snowfall.dispose();
  const noFog=createRainRenderer(g),withFog=createRainRenderer(g);
  ground();noFog.draw({...frame,rain:0,storm:0,fog:[0,1000,5000]});const low=pixels();
  ground();withFog.draw({...frame,rain:0,storm:0,fog:[1,1000,5000]});const high=pixels();let difference=0;for(let y=400;y<500;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;difference+=high[i]+high[i+1]+high[i+2]-low[i]-low[i+1]-low[i+2];}
  if(Math.abs(difference/(800*100*3))<.01)throw Error('Cloud haze ignored the native fog switch');noFog.dispose();withFog.dispose();
  ground();gpu.draw({...frame,time:7});window.__rainCaptureStorm=canvas.toDataURL();
  // Startup/clearing have clouds and storm darkening before/after any rain.
  // They must stay shaded between the 15 Hz cloud-cache updates.
  const ramp=createRainRenderer(g),brightness=[];
  for(let i=0;i<8;i++){ground();ramp.draw({...frame,time:10+i/60,rain:0,clouds:.5,storm:.5});const p=pixels();let sum=0;for(let y=40;y<140;y++)for(let x=100;x<700;x++){const k=(y*800+x)*4;sum+=p[k]+p[k+1]+p[k+2];}brightness.push(sum/(100*600*3));}
  const transitionFlicker=Math.max(...brightness)-Math.min(...brightness);ramp.dispose();
  if(transitionFlicker>1)throw Error('Storm transition flickers between cloud updates: '+transitionFlicker);
  function lookAt(target,origin=eye){const z=norm(origin.map((v,i)=>v-target[i])),x=norm(cross([0,0,1],z)),y=cross(z,x),v=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,origin),-dot(y,origin),-dot(z,origin),1],out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=proj[k*4+r]*v[c*4+k];return out;}
  const originalVP=vp.slice(),cachedSky=createRainRenderer(g),freshSky=createRainRenderer(g),sky={...frame,time:40,rain:0,storm:0,clouds:1,fog:[0,1000,5000]};
  vp.set(lookAt([12000,12000,20000]));ground();cachedSky.draw(sky);
  vp.set(lookAt([-12000,12000,10000]));ground();cachedSky.draw(sky);const cachedPixels=pixels();
  ground();freshSky.draw(sky);const freshPixels=pixels();let skyDifference=0;for(let i=0;i<freshPixels.length;i+=4)for(let c=0;c<3;c++)skyDifference+=Math.abs(freshPixels[i+c]-cachedPixels[i+c]);skyDifference/=800*500*3;
  if(skyDifference>.2)throw Error('Turning the camera reuses the previous cloud view: '+skyDifference);
  // A real branched world mesh must be visible in the strike direction.
  vp.set(lookAt([100000,0,8000]));const discharge=createRainRenderer(g),strike={id:0,at:0,seed:98432,azimuth:0,radius:100000,delay:3};
  ground();const arrayBefore=g.getParameter(g.ARRAY_BUFFER_BINDING);discharge.draw({...frame,time:50,lightning:{strike,origin:[0,0,0],age:.03,power:1,flash:1}});if(g.getParameter(g.ARRAY_BUFFER_BINDING)!==arrayBefore)throw Error('Lightning changed native array buffer');const boltPixels=pixels();let brightBoltPixels=0;
  for(let i=0;i<boltPixels.length;i+=4)if(boltPixels[i]>190&&boltPixels[i+1]>190&&boltPixels[i+2]>190)brightBoltPixels++;
  if(brightBoltPixels<25||discharge.status().boltSegments<100)throw Error('Lightning mesh not visible: '+brightBoltPixels);
  window.__rainCaptureLightning=canvas.toDataURL();discharge.dispose();vp.set(lookAt([-12000,12000,10000]));
  const raised=[eye[0],eye[1],eye[2]+5000];vp.set(lookAt([-12000,12000,15000],raised));ground();cachedSky.draw({...sky,camera:raised});const raisedPixels=pixels();let heightDifference=0;for(let y=300;y<500;y++)for(let x=0;x<800;x++)for(let c=0;c<3;c++){const i=(y*800+x)*4+c;heightDifference+=Math.abs(freshPixels[i]-raisedPixels[i]);}heightDifference/=800*200*3;
  if(heightDifference>.2)throw Error('Cloud layer follows camera height: '+heightDifference);
  const pinkSky=createRainRenderer(g);ground();pinkSky.draw({...sky,camera:raised,fog:[1,1000,5000],fogColor:[1,0,1,1]},'sky');const pinkPixels=pixels();let pinkExcess=0;
  for(let i=0;i<pinkPixels.length;i+=4)pinkExcess=Math.max(pinkExcess,pinkPixels[i]-pinkPixels[i+1]);
  if(pinkExcess>3)throw Error('Map fog makes cloud colour pink: '+pinkExcess);pinkSky.dispose();
  const sprite=program(`#version 300 es\nprecision highp float;void main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0.,1.);}`,`#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(.05,.85,.1,.65);}`);
  ground();cachedSky.draw(sky,'sky');g.useProgram(sprite);g.disable(g.DEPTH_TEST);g.depthMask(false);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.drawArrays(g.TRIANGLES,0,3);const spriteBefore=pixels();
  cachedSky.draw(sky,'weather');const spriteAfter=pixels();if(spriteBefore.some((v,i)=>v!==spriteAfter[i]))throw Error('Late cloud pass overpaints a transparent sprite');g.deleteProgram(sprite);
  cachedSky.dispose();freshSky.dispose();vp.set(originalVP);
  const wall=program(`#version 300 es\nprecision highp float;uniform mat4 vp;void main(){vec2 p=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.:0.);gl_Position=vp*vec4(p.x*3500.,1600.,p.y*2200.,1.);}`,`#version 300 es\nprecision highp float;uniform vec3 color;out vec4 o;void main(){o=vec4(color,1.);}`);
  const reflective=createRainRenderer(g),wetFrame={...frame,time:60,puddles:1};
  function reflectionScene(color,wet,detail='low',time=60,surfaceTuning){ground();g.useProgram(wall);g.uniformMatrix4fv(g.getUniformLocation(wall,'vp'),false,vp);g.uniform3fv(g.getUniformLocation(wall,'color'),color);g.drawArrays(g.TRIANGLES,0,6);reflective.draw({...wetFrame,puddles:wet,puddleDetail:detail,time,surfaceTuning},'sky');return pixels();}
  const redDry=reflectionScene([.95,.1,.1],0),blueDry=reflectionScene([.1,.1,.95],0),redWet=reflectionScene([.95,.1,.1],1),blueWet=reflectionScene([.1,.1,.95],1);
  let reflectedObjectPixels=0,wetWallPixels=0;for(let i=0;i<redWet.length;i+=4){if(Math.abs(redDry[i]-blueDry[i])<2&&redWet[i]-blueWet[i]>3&&blueWet[i+2]-redWet[i+2]>3)reflectedObjectPixels++;if(redDry[i]-blueDry[i]>100&&Math.abs(redWet[i]-redDry[i])>1)wetWallPixels++;}
  if(reflectedObjectPixels<40)throw Error('Puddles do not reflect the visible coloured object: '+reflectedObjectPixels);
  const disabledReflections={...window.__rainQA.DEFAULT_SURFACE_TUNING,reflectionStrength:0};
  for(const detail of ['low','high']){
   const red=reflectionScene([.95,.1,.1],1,detail,60,disabledReflections),blue=reflectionScene([.1,.1,.95],1,detail,60,disabledReflections);let reflected=0;
   for(let i=0;i<red.length;i+=4)if(Math.abs(redDry[i]-blueDry[i])<2&&red[i]-blue[i]>3&&blue[i+2]-red[i+2]>3)reflected++;
   if(reflected)throw Error('Reflection strength zero still reflects objects: '+JSON.stringify({detail,reflected}));
  }
  if(wetWallPixels)throw Error('Puddles spill onto vertical object geometry: '+wetWallPixels);
  reflectionScene([.95,.1,.1],1);window.__rainCapturePuddles=canvas.toDataURL();
  const highRed=reflectionScene([.95,.1,.1],1,'high'),highBlue=reflectionScene([.1,.1,.95],1,'high');
  let highReflectedPixels=0,highWetWallPixels=0,qualityDifference=0;
  for(let i=0;i<highRed.length;i+=4){if(Math.abs(redDry[i]-blueDry[i])<2&&highRed[i]-highBlue[i]>3&&highBlue[i+2]-highRed[i+2]>3)highReflectedPixels++;if(redDry[i]-blueDry[i]>100&&Math.abs(highRed[i]-redDry[i])>1)highWetWallPixels++;qualityDifference+=Math.abs(highRed[i]-redWet[i]);}
  if(highReflectedPixels<40||highWetWallPixels||qualityDifference<10000||reflective.status().puddleDetail!=='high')throw Error('High water detail/reflection/mask failed: '+JSON.stringify({highReflectedPixels,highWetWallPixels,qualityDifference,status:reflective.status()}));
  const highAnimated=reflectionScene([.95,.1,.1],1,'high',60.04);let animatedPixels=0;
  for(let i=0;i<highRed.length;i+=4)if(Math.abs(redDry[i]-blueDry[i])<2&&Math.abs(highAnimated[i]-highRed[i])>1)animatedPixels++;
  if(animatedPixels<50)throw Error('High water surface is not animated: '+animatedPixels);
  window.__rainCapturePuddlesHigh=canvas.toDataURL();
  // Render the real ripple field separately: count spatial transitions, verify
  // density and exact time/speed equivalence without cloud/SSR differences.
  const qa=window.__rainQA,rippleProgram=program(qa.FULL_VERTEX,`#version 300 es\n${qa.COMMON}\n${qa.HIGH_PUDDLE_SURFACE}\nin vec2 uv;void main(){o=vec4(vec3(clamp(rippleField((uv-.5)*8.).z,0.,1.)),1.);}`);
  function rippleImage(size,speed,density,time){ground();g.disable(g.DEPTH_TEST);g.depthMask(false);g.useProgram(rippleProgram);g.uniform1f(g.getUniformLocation(rippleProgram,'uTime'),time);g.uniform1f(g.getUniformLocation(rippleProgram,'uRain'),1);g.uniform4f(g.getUniformLocation(rippleProgram,'uRippleTuning'),size,speed,density,1);g.drawArrays(g.TRIANGLES,0,3);return pixels();}
  const largeRings=rippleImage(1,1,1,1),smallRings=rippleImage(12,3,.75,1),sparseRings=rippleImage(12,3,.2,1),equivalentTime=rippleImage(12,1,.75,3),noRings=rippleImage(12,3,0,1);
  const edges=image=>{let count=0;for(let y=20;y<480;y+=10)for(let x=21;x<780;x++)if((image[(y*800+x)*4]>30)!==(image[(y*800+x-1)*4]>30))count++;return count;};
  const lit=image=>{let count=0;for(let i=0;i<image.length;i+=4)if(image[i]>30)count++;return count;};
  const rippleReport={largeEdges:edges(largeRings),smallEdges:edges(smallRings),densePixels:lit(smallRings),sparsePixels:lit(sparseRings)};
  if(rippleReport.smallEdges<rippleReport.largeEdges*5||rippleReport.densePixels<rippleReport.sparsePixels*2||lit(noRings)!==0||smallRings.some((v,i)=>v!==equivalentTime[i]))throw Error('Ring size/count/speed controls failed: '+JSON.stringify(rippleReport));
  ground();g.deleteProgram(rippleProgram);
  const wetState=state();reflective.draw(wetFrame,'sky');const restoredWetState=state();
  for(const k of Object.keys(wetState)){if(Array.isArray(wetState[k])){if(JSON.stringify(wetState[k])!==JSON.stringify(restoredWetState[k]))throw Error('Puddles changed GL state '+k);}else if(wetState[k]!==restoredWetState[k])throw Error('Puddles changed GL binding '+k);}
  reflective.draw({...wetFrame,puddles:0},'sky');if(reflective.status().reflectionSize!==null)throw Error('Disabled puddles retain colour-copy allocation');
  reflective.dispose();
  // Dark reflections must not turn shallow water into opaque black patches.
  // Exercise both optics on bright/dark textured ground and an RGBA8 cloud atlas.
  const opticsMesh=program(`#version 300 es\nprecision highp float;uniform mat4 vp;out vec2 xy;void main(){vec2 c=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.:-1.);xy=c*16000.;gl_Position=vp*vec4(xy,0.,1.);}`,`#version 300 es\nprecision highp float;uniform float brightness;in vec2 xy;out vec4 o;void main(){float pattern=step(.5,fract(xy.x/180.));o=vec4(vec3(.34,.40,.28)*brightness*mix(.65,1.,pattern),1.);}`);
  const opticsReport=[],realExtension=g.getExtension.bind(g);
  for(const rgba8 of [false,true]){
   if(rgba8)g.getExtension=name=>name==='EXT_color_buffer_float'?null:realExtension(name);
   const optics=createRainRenderer(g);g.getExtension=realExtension;
   for(const detail of ['low','high'])for(const brightness of [.3,1.8]){
    const scene=wet=>{ground();g.useProgram(opticsMesh);g.uniformMatrix4fv(g.getUniformLocation(opticsMesh,'vp'),false,vp);g.uniform1f(g.getUniformLocation(opticsMesh,'brightness'),brightness);g.drawArrays(g.TRIANGLES,0,6);optics.draw({...wetFrame,puddles:wet,puddleDetail:detail},'sky');return pixels();};
    const dry=scene(0),wet=scene(1);let changed=0,crushed=0,minRatio=1;
    for(let y=20;y<280;y++)for(let x=20;x<780;x++){
     const i=(y*800+x)*4,base=(dry[i]+dry[i+1]+dry[i+2])/3,next=(wet[i]+wet[i+1]+wet[i+2])/3;
     if(dry[i+2]>dry[i+1]||Math.abs(next-base)<2)continue;
     changed++;minRatio=Math.min(minRatio,next/base);if(next<base*.70-1)crushed++;
    }
    if(changed<100||crushed)throw Error('Shallow puddles crush the ground texture: '+JSON.stringify({detail,brightness,rgba8,changed,crushed,minRatio}));
    opticsReport.push({detail,brightness,rgba8,changed,crushed,minRatio});
   }optics.dispose();
  }
  const shadowWater=createRainRenderer(g),shadowReport=[];
  for(const detail of ['low','high']){
   const render=wet=>{ground();g.useProgram(opticsMesh);g.uniformMatrix4fv(g.getUniformLocation(opticsMesh,'vp'),false,vp);g.uniform1f(g.getUniformLocation(opticsMesh,'brightness'),.18);g.drawArrays(g.TRIANGLES,0,6);g.useProgram(wall);g.uniformMatrix4fv(g.getUniformLocation(wall,'vp'),false,vp);g.uniform3f(g.getUniformLocation(wall,'color'),.025,.03,.035);g.drawArrays(g.TRIANGLES,0,6);shadowWater.draw({...wetFrame,puddles:wet,puddleDetail:detail,sunDirection:[0,1,1]},'sky');return pixels();};
   const dry=render(0),wet=render(1);let maxLift=0,changed=0;
   for(let y=1000;y<1550;y+=25)for(let x=-3000;x<3000;x+=30){const i=screenIndex([x,y,0]);if(i<0)continue;const a=(wet[i]+wet[i+1]+wet[i+2])/3,b=(dry[i]+dry[i+1]+dry[i+2])/3;maxLift=Math.max(maxLift,a-b);if(Math.abs(a-b)>1)changed++;}
   if(changed<5||maxLift>7)throw Error('Shadowed puddle has a luminous near-wall band: '+JSON.stringify({detail,changed,maxLift}));shadowReport.push({detail,changed,maxLift});
  }shadowWater.dispose();g.deleteProgram(wall);g.deleteProgram(opticsMesh);
  const cloudToneReport=[];
  for(const tone of [[1,1,1],[.19,.23,.32]]){
   const renderer=createRainRenderer(g);ground();renderer.draw({...frame,time:60,rain:0,storm:0,cloudTone:tone},'sky');const image=pixels();let sum=0;
   for(let y=420;y<500;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;sum+=image[i]+image[i+1]+image[i+2];}cloudToneReport.push(sum);renderer.dispose();
  }if(cloudToneReport[1]>=cloudToneReport[0]*.99)throw Error('Night map cloud tone was ignored: '+JSON.stringify(cloudToneReport));
  const slopeMesh=program(`#version 300 es\nprecision highp float;uniform mat4 vp;uniform float grade;out vec2 xy;void main(){int id=gl_VertexID%6;bool upper=gl_VertexID>=6;vec2 c=vec2((id==1||id==2||id==4)?1.:-1.,(id==2||id==4||id==5)?1.:0.);xy=vec2(c.x*3500.,upper?mix(1800.,16000.,c.y):mix(-1800.,1800.,c.y));float z=upper?3600.*grade:(xy.y+1800.)*grade;gl_Position=vp*vec4(xy,z,1.);}`,`#version 300 es\nprecision highp float;in vec2 xy;out vec4 o;void main(){float line=max(step(.98,fract(xy.x/700.)),step(.98,fract(xy.y/700.)));o=vec4(vec3(.38,.40,.42)-line*.055,1.);}`);
  const slopeWater=createRainRenderer(g),rampReport=[];
  function slopeScene(wet,detail,grade=.45){ground();g.useProgram(slopeMesh);g.uniformMatrix4fv(g.getUniformLocation(slopeMesh,'vp'),false,vp);g.uniform1f(g.getUniformLocation(slopeMesh,'grade'),grade);g.drawArrays(g.TRIANGLES,0,12);slopeWater.draw({...wetFrame,puddles:wet,puddleDetail:detail},'sky');return pixels();}
  const slopeDry=slopeScene(0,'low');window.__rainCaptureRampDry=canvas.toDataURL();
  function screenIndex(p){const q=[0,0,0,0];for(let row=0;row<4;row++)for(let k=0;k<4;k++)q[row]+=vp[k*4+row]*(k===3?1:p[k]);const x=Math.floor((q[0]/q[3]*.5+.5)*800),y=Math.floor((q[1]/q[3]*.5+.5)*500);return x<0||x>=800||y<0||y>=500?-1:(y*800+x)*4;}
  for(const grade of [.45,.75])for(const detail of ['low','high']){
   const slopeDry=slopeScene(0,detail,grade);ground();const flatDry=pixels();slopeWater.draw({...wetFrame,puddleDetail:detail},'sky');const flatWet=pixels();
   const wet=slopeScene(1,detail,grade);let expectedWet=0,continuedWet=0,drySamples=0,keptDry=0,contrast=0,contrastBase=0;
   for(let y=-1500;y<=1500;y+=150)for(let x=-2400;x<=2400;x+=150){
     const i=screenIndex([x,y,(y+1800)*grade]),j=screenIndex([x,y,0]);if(i<0||j<0)continue;
     const reference=Math.abs(flatWet[j]-flatDry[j])+Math.abs(flatWet[j+1]-flatDry[j+1])+Math.abs(flatWet[j+2]-flatDry[j+2]);
     const rampDelta=Math.abs(wet[i]-slopeDry[i])+Math.abs(wet[i+1]-slopeDry[i+1])+Math.abs(wet[i+2]-slopeDry[i+2]);
     if(reference>6){expectedWet++;if(rampDelta>12)continuedWet++;contrast+=rampDelta;contrastBase+=slopeDry[i]+slopeDry[i+1]+slopeDry[i+2];}
     if(reference<=2){drySamples++;if(rampDelta<=6)keptDry++;}
   }
   // Rainwater must no longer pool on inclines, even where a flat world-XY
   // reference would contain a strong wet island.
   if(expectedWet<15||continuedWet>0||keptDry/Math.max(1,drySamples)<.98)throw Error('Puddles leaked onto a ramp: '+JSON.stringify({detail,expectedWet,continuedWet,drySamples,keptDry}));
   rampReport.push({detail,grade,expectedWet,continuedWet,drySamples,keptDry,contrast:contrast/contrastBase});
  }
  window.__rainCaptureRampWet=canvas.toDataURL();slopeWater.dispose();g.deleteProgram(slopeMesh);
  const farWater=createRainRenderer(g),farReport=[];ground();const farDry=pixels();
  for(const detail of ['low','high']){
   ground();farWater.draw({...wetFrame,puddleDetail:detail},'sky');const wet=pixels();
   ground();farWater.draw({...wetFrame,puddleDetail:detail,surfaceTuning:{...window.__rainQA.DEFAULT_SURFACE_TUNING,edgeInset:0}},'sky');const untrimmed=pixels();let wetSamples=0,untrimmedSamples=0,count=0;
   for(let y=10500;y<=14500;y+=400)for(let x=-12000;x<=12000;x+=500){const i=screenIndex([x,y,0]);if(i<0)continue;count++;if(Math.abs(wet[i]-farDry[i])+Math.abs(wet[i+1]-farDry[i+1])+Math.abs(wet[i+2]-farDry[i+2])>3)wetSamples++;if(Math.abs(untrimmed[i]-farDry[i])+Math.abs(untrimmed[i+1]-farDry[i+1])+Math.abs(untrimmed[i+2]-farDry[i+2])>3)untrimmedSamples++;}
   if(wetSamples<20)throw Error('Distant puddles still disappear at the old 90m limit: '+JSON.stringify({detail,wetSamples,untrimmedSamples,count}));farReport.push({detail,wetSamples,untrimmedSamples,count});
  }farWater.dispose();
  const hoverTop=program(`#version 300 es\nprecision highp float;uniform mat4 vp;void main(){int id=gl_VertexID;vec2 c=vec2((id==1||id==2||id==4)?1.:-1.,(id==2||id==4||id==5)?1.:-1.);gl_Position=vp*vec4(c.x*750.,1600.+c.y*750.,1200.,1.);}`,`#version 300 es\nprecision highp float;uniform vec3 color;out vec4 o;void main(){o=vec4(color,1.);}`);
  const hoverWater=createRainRenderer(g),hoverReport=[];
  function hoverScene(color,wet,detail,tuning){ground();g.useProgram(hoverTop);g.uniformMatrix4fv(g.getUniformLocation(hoverTop,'vp'),false,vp);g.uniform3fv(g.getUniformLocation(hoverTop,'color'),color);g.drawArrays(g.TRIANGLES,0,6);hoverWater.draw({...wetFrame,puddles:wet,puddleDetail:detail,surfaceTuning:tuning},'sky');return pixels();}
  const hoverRedDry=hoverScene([.95,.1,.1],0,'low'),hoverBlueDry=hoverScene([.1,.1,.95],0,'low');
  for(const detail of ['low','high']){
   const red=hoverScene([.95,.1,.1],1,detail),blue=hoverScene([.1,.1,.95],1,detail);let backfacePixels=0,wetTopPixels=0;
   for(let i=0;i<red.length;i+=4){if(Math.abs(hoverRedDry[i]-hoverBlueDry[i])<2&&red[i]-blue[i]>3&&blue[i+2]-red[i+2]>3)backfacePixels++;
    if(hoverRedDry[i]-hoverBlueDry[i]>100&&Math.abs(red[i]-hoverRedDry[i])>1)wetTopPixels++;}
   if(backfacePixels>8)throw Error('Floating top texture leaks into a reflection from below: '+JSON.stringify({detail,backfacePixels}));
   if(wetTopPixels)throw Error('Puddles painted the top of a non-map object: '+wetTopPixels);hoverReport.push({detail,backfacePixels,wetTopPixels});
  }
  const ghostTuning={...window.__rainQA.DEFAULT_SURFACE_TUNING,reflectionStrength:0,refractionStrength:2,reflectionRoughness:1};
  const refractRed=hoverScene([.95,.1,.1],1,'high',ghostTuning),refractBlue=hoverScene([.1,.1,.95],1,'high',ghostTuning);let refractionGhostPixels=0,foregroundChanged=0;
  for(let i=0;i<refractRed.length;i+=4){const nativeObject=Math.abs(hoverRedDry[i]-hoverBlueDry[i])>100;if(Math.abs(hoverRedDry[i]-hoverBlueDry[i])<2&&(Math.abs(refractRed[i]-refractBlue[i])>2||Math.abs(refractRed[i+2]-refractBlue[i+2])>2))refractionGhostPixels++;if(nativeObject&&Math.abs(refractRed[i]-hoverRedDry[i])>1)foregroundChanged++;}
  if(refractionGhostPixels||foregroundChanged)throw Error('Foreground silhouette bled into refraction: '+JSON.stringify({refractionGhostPixels,foregroundChanged}));
  hoverWater.dispose();g.deleteProgram(hoverTop);
  const dropWater=createRainRenderer(g),dropReport=[];
  const dropMesh=program(`#version 300 es\nprecision highp float;uniform mat4 vp;uniform float raised;out vec2 q;void main(){q=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.:-1.);gl_Position=vp*vec4(q*500.,raised,1.);}`,`#version 300 es\nprecision highp float;in vec2 q;out vec4 o;void main(){float a=(1.-smoothstep(.1,.16,abs(length(q)-.35)))*.8;o=vec4(vec3(1.,.8,.1),a);}`);
  const dropVP=vp.slice();
  for(const height of [2200,650])for(const detail of ['low','high'])for(const raised of [5,30]){
   const camera=[eye[0],eye[1],height];vp.set(lookAt([0,0,0],camera));
   const draw=overlay=>{ground();if(overlay){const restore=window.__rainQA.suppressOverlayDepth(g);try{g.useProgram(dropMesh);g.uniformMatrix4fv(g.getUniformLocation(dropMesh,'vp'),false,vp);g.uniform1f(g.getUniformLocation(dropMesh,'raised'),raised);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA);g.drawArrays(g.TRIANGLES,0,6);}finally{restore?.();}if(!g.getParameter(g.DEPTH_WRITEMASK)||!g.isEnabled(g.DEPTH_TEST))throw Error('Drop zone changed native depth state');}dropWater.draw({...wetFrame,camera,puddleDetail:detail,surfaceTuning:{...window.__rainQA.DEFAULT_SURFACE_TUNING,reflectionStrength:0,refractionStrength:0}},'sky');return pixels();};
   const absent=draw(false),present=draw(true);let gaps=0,markerPixels=0;for(let y=-420;y<=420;y+=15)for(let x=-420;x<=420;x+=15){const i=screenIndex([x,y,raised]);if(i<0)continue;const d=Math.abs(absent[i]-present[i])+Math.abs(absent[i+1]-present[i+1])+Math.abs(absent[i+2]-present[i+2]);const radius=Math.hypot(x,y)/500;if(radius>.7&&d>2)gaps++;else if(radius>.23&&radius<.45&&d>2)markerPixels++;}if(gaps||markerPixels<5)throw Error('Drop-zone square/seam regression '+JSON.stringify({detail,raised,gaps,markerPixels}));dropReport.push({detail,raised,height,gaps,markerPixels});
  }vp.set(dropVP);dropWater.dispose();g.deleteProgram(dropMesh);
  const collisionWater=createRainRenderer(g),collisionReport=[];
  const halfMap={...map,vertices:new Float32Array([-16000,-16000,0,0,-16000,0,0,16000,0,-16000,-16000,0,0,16000,0,-16000,16000,0])};
  for(const detail of ['low','high']){
   ground();const dry=pixels();collisionWater.draw({...wetFrame,puddleDetail:detail,map:halfMap},'sky');const wet=pixels();let collidingWet=0,noncollidingWet=0;
   for(let y=-1500;y<=3000;y+=150)for(let x=-3000;x<=3000;x+=150){if(Math.abs(x)<500)continue;const i=screenIndex([x,y,0]);if(i<0)continue;const change=Math.abs(wet[i]-dry[i])+Math.abs(wet[i+1]-dry[i+1])+Math.abs(wet[i+2]-dry[i+2]);if(change>3){if(x<0)collidingWet++;else noncollidingWet++;}}
   if(collidingWet<10||noncollidingWet)throw Error('Water ignored map collision membership: '+JSON.stringify({detail,collidingWet,noncollidingWet}));collisionReport.push({detail,collidingWet,noncollidingWet});
  }
  const edgeReport=[],edgeWater=createRainRenderer(g);
  // Isolate boundary erosion from the independent organic puddle island mask.
  const edgeShaderSource=g.shaderSource.bind(g);g.shaderSource=(shader,source)=>edgeShaderSource(shader,source.replace('float coverage=field.x*upward*contact;','float coverage=upward*contact;').replace('float coverage=smoothstep(.56,.64,shape)*upward*contact;','float coverage=upward*contact;'));
  try{edgeWater.warm(true,'low');edgeWater.warm(true,'high');}finally{g.shaderSource=edgeShaderSource;}
  for(const detail of ['low','high']){
   const sample=(inset,mesh=halfMap)=>{ground();edgeWater.draw({...wetFrame,puddleDetail:detail,map:mesh,surfaceTuning:{...window.__rainQA.DEFAULT_SURFACE_TUNING,edgeInset:inset}},'sky');return pixels();};
   ground();const dry=pixels(),untrimmed=sample(0),trimmed=sample(200);let removed=0,leaked=0,seamDifference=0;
   // A 2m authoring inset must leave at least the inner 2m entirely dry.
   for(let y=-1500;y<=3000;y+=75)for(let x=-185;x<=-15;x+=15){const i=screenIndex([x,y,0]);if(i<0)continue;const delta=a=>Math.abs(a[i]-dry[i])+Math.abs(a[i+1]-dry[i+1])+Math.abs(a[i+2]-dry[i+2]);if(delta(untrimmed)>4){removed++;if(delta(trimmed)>2)leaked++;}}
   const joined={...map,vertices:new Float32Array([...halfMap.vertices,0,-16000,0,16000,-16000,0,16000,16000,0,0,-16000,0,16000,16000,0,0,16000,0])};
   const whole=sample(200,map),neighbours=sample(200,joined);
   for(let y=-1500;y<=3000;y+=50)for(let x=-300;x<=300;x+=25){const i=screenIndex([x,y,0]);if(i<0)continue;for(let c=0;c<3;c++)seamDifference=Math.max(seamDifference,Math.abs(whole[i+c]-neighbours[i+c]));}
   let eroded=0,retained=0;
   for(let y=-1500;y<=3000;y+=30)for(const x of [-350,-400,-450,-500]){const i=screenIndex([x,y,0]);if(i<0)continue;const delta=a=>Math.abs(a[i]-dry[i])+Math.abs(a[i+1]-dry[i+1])+Math.abs(a[i+2]-dry[i+2]);if(delta(untrimmed)<5)continue;if(delta(trimmed)>3)retained++;else eroded++;}
   if(removed<3||leaked||seamDifference>1||eroded<3||retained<3)throw Error('Organic open edge/continuous neighbour regression: '+JSON.stringify({detail,removed,leaked,seamDifference,eroded,retained}));edgeReport.push({detail,removed,leaked,seamDifference,eroded,retained});
  }
  edgeWater.dispose();
  const stepReport=[],stepWater=createRainRenderer(g);
  const stepVp=new Float32Array(vp);for(let i=0;i<4;i++)stepVp[i]*=-1;
  const stepIndex=p=>{const h=[0,0,0,0];for(let r=0;r<4;r++)for(let c=0;c<4;c++)h[r]+=stepVp[c*4+r]*[...p,1][c];const x=Math.floor((h[0]/h[3]*.5+.5)*800),y=Math.floor((h[1]/h[3]*.5+.5)*500);return x>=0&&x<800&&y>=0&&y<500?(y*800+x)*4:-1;};
  const quad=(x0,x1,z)=>[x0,-16000,z,x1,-16000,z,x1,16000,z,x0,-16000,z,x1,16000,z,x0,16000,z];
  const stepVertices=new Float32Array([...quad(-16000,0,0),...quad(0,16000,800)]),stepMap={...map,vertices:stepVertices,supportVertices:new Float32Array([...stepVertices,0,-16000,0,0,16000,0,0,16000,800,0,-16000,0,0,16000,800,0,-16000,800])};
  const stepMesh=program(`#version 300 es\nprecision highp float;layout(location=0)in vec3 position;uniform mat4 vp;void main(){gl_Position=vp*vec4(position,1.);}`,`#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(.38,.40,.42,1.);}`),stepVao=g.createVertexArray(),stepBuffer=g.createBuffer();
  g.bindVertexArray(stepVao);g.bindBuffer(g.ARRAY_BUFFER,stepBuffer);g.bufferData(g.ARRAY_BUFFER,stepMap.supportVertices,g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,3,g.FLOAT,false,12,0);
  for(const detail of ['low','high']){
   const render=(inset,wet)=>{ground();g.bindVertexArray(stepVao);g.useProgram(stepMesh);g.uniformMatrix4fv(g.getUniformLocation(stepMesh,'vp'),false,stepVp);g.drawArrays(g.TRIANGLES,0,18);stepWater.draw({...wetFrame,vp:stepVp,camera:[-eye[0],eye[1],eye[2]],map:stepMap,puddles:wet,puddleDetail:detail,surfaceTuning:{...window.__rainQA.DEFAULT_SURFACE_TUNING,edgeInset:inset}},'sky');return pixels();};
   const dry=render(0,0),raw=render(0,1),inset=render(200,1);let lowCandidates=0,lowKept=0,upperCandidates=0,upperWet=0;
   for(let y=-1500;y<=3000;y+=50)for(let x=35;x<180;x+=25){
    for(const [z,side]of [[0,-1],[800,1]]){const i=stepIndex([x*side,y,z]);if(i<0)continue;const change=a=>Math.abs(a[i]-dry[i])+Math.abs(a[i+1]-dry[i+1])+Math.abs(a[i+2]-dry[i+2]);if(change(raw)<5)continue;if(side<0){lowCandidates++;if(change(inset)>3)lowKept++;}else{upperCandidates++;if(change(inset)>3)upperWet++;}}
   }
   if(lowCandidates<5||lowKept<lowCandidates*.8||upperCandidates<5||upperWet)throw Error('Higher bank/lower level edge rule failed: '+JSON.stringify({detail,lowCandidates,lowKept,upperCandidates,upperWet}));stepReport.push({detail,lowCandidates,lowKept,upperCandidates,upperWet});
  }
  stepWater.dispose();g.deleteProgram(stepMesh);g.deleteVertexArray(stepVao);g.deleteBuffer(stepBuffer);g.bindVertexArray(vao);
  ground();const copyCount=collisionWater.status().reflectionCopies;collisionWater.draw({...wetFrame,map:undefined},'sky');if(collisionWater.status().reflectionCopies!==copyCount)throw Error('Missing map contract fell back to unclassified scene water');collisionWater.dispose();
  ground(); // Bind the live native program before the fault-injection warm-up.
  const shaderSource=g.shaderSource.bind(g);g.shaderSource=(shader,source)=>shaderSource(shader,source.includes('vec3 rippleField')?'#version 300 es\nintentional driver rejection':source);
  const rejectedHigh=createRainRenderer(g);try{rejectedHigh.warm(true,'high');}finally{g.shaderSource=shaderSource;}
  ground();rejectedHigh.draw({...frame,puddles:1,puddleDetail:'high'});
  if(!rejectedHigh.status().puddleErrors.high||rejectedHigh.status().puddleDetail!=='low'||rejectedHigh.status().disposed||rejectedHigh.status().frames!==1)throw Error('High shader failure disabled rain instead of falling back: '+JSON.stringify(rejectedHigh.status()));rejectedHigh.dispose();
  const status=gpu.status();gpu.dispose();if(!g.isProgram(native))throw Error('Disposed native game program');
  const extension=g.getExtension.bind(g);g.getExtension=name=>name==='EXT_color_buffer_float'?null:extension(name);const fallback=createRainRenderer(g);g.getExtension=extension;ground();fallback.draw(frame);if(fallback.status().cloudFloat)throw Error('Cloud RGBA8 fallback was not selected');fallback.dispose();
  const framebufferCases=[];
  for(const [format,texture,multisample,colorFormat=g.RGBA8,offset=0]of [[g.DEPTH_COMPONENT16,false,false],[g.DEPTH_COMPONENT24,false,false],[g.DEPTH_COMPONENT32F,false,false],[g.DEPTH24_STENCIL8,false,false],[g.DEPTH32F_STENCIL8,false,false],[g.DEPTH24_STENCIL8,false,true],[g.DEPTH_COMPONENT24,true,false],[g.DEPTH24_STENCIL8,true,false],
   [g.DEPTH24_STENCIL8,false,true,g.RGB8],[g.DEPTH24_STENCIL8,false,true,g.RGB565],[g.DEPTH24_STENCIL8,false,true,g.RGBA4],[g.DEPTH24_STENCIL8,false,true,g.RGB5_A1],[g.DEPTH24_STENCIL8,false,true,g.RGB10_A2],
   [g.DEPTH24_STENCIL8,false,true,g.RGBA8,16],[g.DEPTH24_STENCIL8,false,false,g.RGBA8,16]]){
   const fbo=g.createFramebuffer(),colour=g.createRenderbuffer(),depth=texture?g.createTexture():g.createRenderbuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);
   const samples=multisample?Math.min(4,g.getParameter(g.MAX_SAMPLES)):0;
   g.bindRenderbuffer(g.RENDERBUFFER,colour);g.renderbufferStorageMultisample(g.RENDERBUFFER,samples,colorFormat,800,500);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,colour);
   const attachment=format===g.DEPTH24_STENCIL8||format===g.DEPTH32F_STENCIL8?g.DEPTH_STENCIL_ATTACHMENT:g.DEPTH_ATTACHMENT;
   if(texture){g.bindTexture(g.TEXTURE_2D,depth);g.texStorage2D(g.TEXTURE_2D,1,format,800,500);g.framebufferTexture2D(g.FRAMEBUFFER,attachment,g.TEXTURE_2D,depth,0);}
   else{g.bindRenderbuffer(g.RENDERBUFFER,depth);g.renderbufferStorageMultisample(g.RENDERBUFFER,samples,format,800,500);g.framebufferRenderbuffer(g.FRAMEBUFFER,attachment,g.RENDERBUFFER,depth);}
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('QA FBO incomplete '+format);
   ground(fbo);if(offset)g.viewport(offset,8,768,480);const nativeViewport=[...g.getParameter(g.VIEWPORT)],nativeRenderbuffer=g.getParameter(g.RENDERBUFFER_BINDING);
   const own=createRainRenderer(g);own.draw({...frame,puddles:1,puddleDetail:texture?'high':'low'});
   if(g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==fbo||g.getParameter(g.RENDERBUFFER_BINDING)!==nativeRenderbuffer||JSON.stringify([...g.getParameter(g.VIEWPORT)])!==JSON.stringify(nativeViewport))throw Error('Weather changed native FBO/renderbuffer/viewport');
   if(offset&&samples){if(own.status().reflectionCopies||own.status().depthCopies||own.status().depthCopy.reason!=='msaa-viewport-offset')throw Error('Unsafe MSAA offset was not skipped');}
   else if(own.status().reflectionCopies!==1||own.status().depthCopies!==1||own.status().sceneCopy.format!==(samples?colorFormat:g.RGBA8))throw Error('Puddle resolve failed '+JSON.stringify({format,colorFormat,samples,status:own.status()}));
   const error=g.getError();if(error)throw Error('Framebuffer case GL error: '+JSON.stringify({format,colorFormat,samples,offset,error}));own.dispose();
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.deleteFramebuffer(fbo);g.deleteRenderbuffer(colour);if(texture)g.deleteTexture(depth);else g.deleteRenderbuffer(depth);
   framebufferCases.push({format,texture,samples,colorFormat,offset,error});
  }
  if(g.getExtension('EXT_color_buffer_float')){
   const target=g.createFramebuffer(),colour=g.createTexture(),depth=g.createRenderbuffer();g.bindFramebuffer(g.FRAMEBUFFER,target);
   g.bindTexture(g.TEXTURE_2D,colour);g.texStorage2D(g.TEXTURE_2D,1,g.RGBA16F,800,500);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,colour,0);
   g.bindRenderbuffer(g.RENDERBUFFER,depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT24,800,500);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,depth);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('QA HDR target incomplete');
   ground(target);const hdr=createRainRenderer(g);hdr.draw({...frame,puddles:1});if(hdr.status().reflectionCopies!==0||g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==target)throw Error('Unsupported HDR reflection pass did not skip safely');hdr.dispose();
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.deleteFramebuffer(target);g.deleteTexture(colour);g.deleteRenderbuffer(depth);
  }
  localStorage.setItem('k_rain_weather','true');const episode={version:1,preset:'storm',start:Date.now()-60000,hold:100,seed:19027,fadeIn:24,fadeOut:30};sessionStorage.setItem('ki.rain-episodes.v1',JSON.stringify([['qa-match',episode]]));
  const contexts=[],AC=window.AudioContext;window.AudioContext=class extends AC{constructor(){super();contexts.push(this);}};
  const api=installRainWeather(window);api.battle({loaded:true,id:'qa-match',map:'Year 2042 RGB'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});
  const rawMap={boxes:[],planes:[{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},width:32000,length:32000}],triangles:[]};
  const mapSchema=Object.fromEntries(['boxes','planes','triangles','size','width','length','v0','v1','v2','x','y','z'].map(k=>[k,k]));
  Object.assign(mapSchema,{planePosition:'position',planeRotation:'rotation',boxPosition:'position',boxRotation:'rotation',trianglePosition:'position',triangleRotation:'rotation'});api.map(rawMap,mapSchema);
  const renderer={[schema.gl]:{[schema.context]:g},[schema.settings]:{[schema.fogEnabled]:true,[schema.mapFog]:true},[schema.fogStart]:7500,[schema.fogEnd]:46000,[schema.fogColor]:{[schema.red]:.65,[schema.green]:.72,[schema.blue]:.82,[schema.alpha]:1}};
  const camera={[schema.vp]:vp,[schema.camera]:{[schema.x]:eye[0],[schema.y]:eye[1],[schema.z]:eye[2]}},scene={};
  ground();api.frame(renderer,scene,camera,schema);await new Promise(r=>setTimeout(r,300));ground();api.frame(renderer,scene,camera,schema);
  if(!contexts.length)throw Error('Scheduled rain audio did not start');
  if(api.status().environment.theme!==null||api.status().precipitation!=='rain'||api.status().draws<1)throw Error('Missing lobby theme still blocks Year 2042 rain');
  localStorage.setItem('k_rain_volume','0');localStorage.setItem('k_thunder_volume','0.2');window.dispatchEvent(new Event('kasp:settings-changed'));
  if(api.status().sound.volumes.rain!==0||api.status().sound.volumes.thunder!==.2)throw Error('Live volume event did not reach active weather audio');
  localStorage.setItem('k_rain_puddles','true');localStorage.setItem('k_rain_puddle_detail','high');window.dispatchEvent(new Event('kasp:settings-changed'));
  await new Promise(r=>setTimeout(r,250));ground();api.frame(renderer,scene,camera,schema);
  if(api.status().puddleDetail!=='high'||!api.status().renderers.some(r=>r.puddleDetail==='high')||JSON.stringify(api.status().episode)!==JSON.stringify(episode))throw Error('Live high detail did not reach the renderer or rerolled weather');
  localStorage.setItem('k_rain_puddle_detail','low');window.dispatchEvent(new Event('kasp:settings-changed'));ground();api.frame(renderer,scene,camera,schema);
  if(api.status().puddleDetail!=='high'||!api.status().renderers.some(r=>r.puddleDetail==='high'))throw Error('Legacy low preference overrode fixed high detail');
  if(['tune','exportSettings','setSurfaceTuning'].some(key=>key in api))throw Error('Developer panel API remains');
  const tuneSurface=value=>{localStorage.setItem('k_rain_surface_tuning_v1',JSON.stringify(value));window.dispatchEvent(new Event('kasp:settings-changed'));};
  tuneSurface({});
  tuneSurface({rainIntensity:0});ground();api.frame(renderer,scene,camera,schema);
  if(api.status().weather.rain!==0||api.status().splashes.particles||api.status().audio!=='off')throw Error('Zero shared intensity did not stop drops, splashes and rain audio');
  tuneSurface({});ground();api.frame(renderer,scene,camera,schema);
  if(api.status().weather.rain!==1||api.status().sound.level<=0)throw Error('Shared intensity did not restore rain and sound');
  if(api.status().renderers.some(r=>r.splashError||r.mapError)||!api.status().map.ready)throw Error('Native collision/splash bridge failed: '+JSON.stringify(api.status()));
  const root=document.querySelector('.BattleComponentStyle-canvasContainer');root.remove();await new Promise(r=>setTimeout(r,500));
  if(api.status().audio!=='off'||contexts.some(c=>c.state!=='closed'))throw Error('Rain audio survived exit');
  document.body.append(root);api.environment('qa-match','SUMMER_DAY');api.battle({loaded:true,id:'qa-match',map:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});const returnedScene={};api.frame(renderer,returnedScene,camera,schema);
  await new Promise(r=>setTimeout(r,200));ground();api.frame(renderer,returnedScene,camera,schema);
  if(JSON.stringify(api.status().episode)!==JSON.stringify(episode))throw Error('Re-entry rerolled weather');
  if(api.status().sound.volumes.rain!==0||api.status().sound.volumes.thunder!==.2)throw Error('Re-entry lost muted rain or thunder volume');
  localStorage.setItem('k_rain_chance','0');window.dispatchEvent(new Event('kasp:settings-changed'));ground();api.frame(renderer,returnedScene,camera,schema);
  if(JSON.stringify(api.status().episode)!==JSON.stringify(episode))throw Error('Chance change rerolled current weather');
  api.environment('qa-clear-match','SUMMER_DAY');api.battle({loaded:true,id:'qa-clear-match',map:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});const clearScene={};api.frame(renderer,clearScene,camera,schema);
  if(api.status().episode.preset!==null)throw Error('0% did not prevent weather in the next battle');
  localStorage.setItem('k_rain_chance','1');localStorage.setItem('k_rain_preset','storm');window.dispatchEvent(new Event('kasp:settings-changed'));api.frame(renderer,clearScene,camera,schema);
  if(api.status().episode.preset!==null)throw Error('100% rerolled an already planned clear battle');
  api.environment('qa-selected-storm','SUMMER_DAY');api.battle({loaded:true,id:'qa-selected-storm',map:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});api.frame(renderer,{},camera,schema);
  if(api.status().episode.preset!=='storm')throw Error('New battle did not use 100% and selected storm');
  localStorage.setItem('k_rain_duration','1');window.dispatchEvent(new Event('kasp:settings-changed'));
  api.environment('qa-continuous-weather','SUMMER_DAY');api.battle({loaded:true,id:'qa-continuous-weather',map:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});
  const firstView={},secondView={},realNow=Date.now,baseNow=realNow();let weatherNow=baseNow;Date.now=()=>weatherNow;
  const otherCanvas=document.createElement('canvas');otherCanvas.width=800;otherCanvas.height=500;root.append(otherCanvas);
  const otherGL=otherCanvas.getContext('webgl2'),otherRenderer={...renderer,[schema.gl]:{[schema.context]:otherGL}};
  try{
   ground();api.frame(renderer,firstView,camera,schema);const continuous=JSON.stringify(api.status().episode);
   if(!api.status().episode.continuous)throw Error('Full-battle episode missing');
   for(const seconds of [60,600,1200]){
    weatherNow=baseNow+seconds*1000;
    for(const [native,view]of [[renderer,firstView],[otherRenderer,secondView],[renderer,firstView]]){
     if(native===renderer)ground();else{otherGL.clearDepth(1);otherGL.clear(otherGL.COLOR_BUFFER_BIT|otherGL.DEPTH_BUFFER_BIT);}
     api.frame(native,view,camera,schema);const state=api.status();
     if(JSON.stringify(state.episode)!==continuous||state.weather.rain!==1||state.weather.finished||state.timing.phase!=='holding'||state.sound.level<=0)throw Error('Full-battle weather restarted across render contexts: '+JSON.stringify(state));
    }
   }
   if(otherGL.getError())throw Error('Continuous weather secondary context GL error');
  }finally{Date.now=realNow;otherCanvas.remove();}

  api.map(rawMap,mapSchema);api.battle({loaded:true,id:'qa-mm-winter',map:'Йоркшир SGE'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});
  ground();api.frame(renderer,{},camera,schema);const mmRain=api.status().episode;
  api.terrainSnow(renderer,schema);const mmSnow=api.status();
  if(mmSnow.environment.theme!==null||!mmSnow.environment.terrainSnow||mmSnow.precipitation!=='snow'||mmSnow.audio!=='off'||mmSnow.puddlesAllowed||mmSnow.puddleAmount||mmSnow.renderers.length||JSON.stringify({...mmSnow.episode,precipitation:'rain'})!==JSON.stringify(mmRain))throw Error('MM winter evidence did not correct rain without rerolling: '+JSON.stringify(mmSnow));
  ground();api.frame(renderer,{},camera,schema);if(api.status().weather.sound||api.status().strikes.length||g.getError())throw Error('MM snowfall retained rain resources');
  localStorage.setItem('k_weather_precipitation','snow');localStorage.setItem('k_snow_drifts','true');window.dispatchEvent(new Event('kasp:settings-changed'));
  api.environment('qa-snow-battle','WINTER_DAY');api.battle({loaded:true,id:'qa-snow-battle',map:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});
  const snowScene={},normalNow=Date.now,snowNow=normalNow();let nowSnow=snowNow;Date.now=()=>nowSnow;
  try{
   ground();api.frame(renderer,snowScene,camera,schema);
   for(const seconds of [30,600,3600]){
    nowSnow=snowNow+seconds*1000;ground();api.frame(renderer,snowScene,camera,schema);const state=api.status();
    if(state.precipitation!=='snow'||!state.episode.continuous||state.weather.rain!==1||state.weather.sound!==0||state.audio!=='off'||state.strikes.length||state.splashes.particles||state.puddleAmount||state.renderers.some(r=>r.snowError||r.snowStreakError))throw Error('Snow runtime produced rain effects or restarted: '+JSON.stringify(state));
   }
   const beforeGarage=api.status(),savedSnow=JSON.stringify(beforeGarage.episode),garage=document.createElement('div');garage.className='GarageCommonStyle-garageContainer';document.body.append(garage);garage.append(canvas);
   ground();const garageDry=pixels();api.frame(renderer,{},camera,schema);const garageAfter=api.status();
   if(pixels().some((v,i)=>v!==garageDry[i])||garageAfter.draws!==beforeGarage.draws||!garageAfter.suspended||garageAfter.audio!=='off')throw Error('Weather leaked into garage with stale battle HUD');
   const light=new Float32Array(12).fill(1);if(api.nativeFogStrength(1)!==1||api.lighting(light)!==undefined||api.dropZones(g)!==undefined||api.force('storm').code!=='battle-not-visible')throw Error('Garage still receives weather uniforms');
   root.append(canvas);garage.remove();ground();api.frame(renderer,snowScene,camera,schema);if(api.status().suspended||JSON.stringify(api.status().episode)!==savedSnow||api.status().draws<=beforeGarage.draws)throw Error('Returning from garage restarted or stopped the snow episode');
  }finally{Date.now=normalNow;}
  api.map(rawMap,mapSchema);api.battle({loaded:true,id:'qa-mm-summer',map:'Йоркшир SGE'},{battleLoaded:'loaded',battleId:'id',mapName:'map'});ground();api.frame(renderer,{},camera,schema);
  if(api.status().environment.terrainSnow||api.status().precipitation!=='rain')throw Error('Winter material evidence leaked to the next summer variant');
  localStorage.setItem('k_rain_weather','false');window.dispatchEvent(new Event('kasp:settings-changed'));
  if(api.status().enabled||api.status().renderers.length)throw Error('Live toggle did not release resources');
  if(api.status().runtime.failures)throw Error(JSON.stringify(api.status()));
  window.dispatchEvent(new PageTransitionEvent('pagehide'));
  const error=g.getError();if(error)throw Error('Final WebGL error '+error);
  return{matchmakingSnowMaterial:true,customGraphicsBudgets:true,snow:snowReport,garageSuspendsWeather:true,stateRestored:true,clearSceneUnchanged:true,stormBrightnessRatio:dark/base,fogHazeDifference:difference/(800*100*3),dropCounts:drawCounts,cloudSize:status.cloudSize,
   transitionFlicker,skyDifference,heightDifference,pinkExcess,brightBoltPixels,reflectedObjectPixels,wetWallPixels,highReflectedPixels,highWetWallPixels,animatedPixels,qualityDifference,rippleReport,opticsReport,rampReport,farReport,hoverReport,refractionGhostPixels,foregroundChanged,dropReport,collisionReport,edgeReport,shadowReport,cloudToneReport,stepReport,nativeLightingPreserved:true,reflectionsDisableLive:true,sharedIntensityControlsAudio:true,highShaderFailureFallsBack:true,transparentSpritePreserved:true,framebufferCases,nativeProgramPreserved:true,audioClosedAfterExit:true,reentryDoesNotReroll:true,generationAppliesNextBattle:true,liveToggleReleasesResources:true,developerPanelRemoved:true,continuousWeatherAcrossContexts:true,glError:error};
 },schema);
 const audioReport=await page.evaluate(async()=>{
  const rate=24000,seconds=8;
  const old=new OfflineAudioContext(2,rate*seconds,rate),buffer=old.createBuffer(1,rate*2,rate),data=buffer.getChannelData(0);let seed=43219,low=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<data.length;i++){low=low*.96+(random()*2-1)*.04;data[i]=(random()*2-1)*.24+low*.9;}
  const src=old.createBufferSource(),hp=old.createBiquadFilter(),lp=old.createBiquadFilter(),bass=old.createBiquadFilter(),roar=old.createGain(),master=old.createGain();
  src.buffer=buffer;src.loop=true;hp.type='highpass';hp.frequency.value=500;lp.type='lowpass';lp.frequency.value=7200;bass.type='lowpass';bass.frequency.value=430;roar.gain.value=.8;master.gain.value=.45;
  src.connect(hp);hp.connect(lp);lp.connect(master);src.connect(bass);bass.connect(roar);roar.connect(master);master.connect(old.destination);src.start();
  const original=await old.startRendering(),next=new OfflineAudioContext(2,rate*seconds,rate),sound=window.__rainQA.createWeatherAudio(next,43219);sound.level(.45);
  const updated=await next.startRendering();
  const rms=(array,start,end)=>{let sum=0;for(let i=start;i<end;i++)sum+=array[i]*array[i];return Math.sqrt(sum/(end-start));};
  const before=rms(original.getChannelData(0),rate*2,rate*7),after=rms(updated.getChannelData(0),rate*2,rate*7),windows=[];
  for(let at=rate*2;at<rate*7;at+=rate/4)windows.push(rms(updated.getChannelData(0),at,at+rate/4));
  if(Math.max(...windows)/Math.min(...windows)>1.2)throw Error('Rain bed still swells audibly');
  if(after>=before)throw Error('Rain was not made quieter');
  const calls=[],ctx=new AudioContext(),gain=ctx.createGain.bind(ctx);ctx.createGain=()=>{const node=gain(),set=node.gain.setTargetAtTime.bind(node.gain);node.gain.setTargetAtTime=(...args)=>{calls.push(args);return set(...args);};return node;};
  const realtime=window.__rainQA.createWeatherAudio(ctx,123);await ctx.resume();for(let i=0;i<1000;i++)realtime.level(.45);if(calls.length!==1)throw Error('Constant rain keeps adding gain automation');
  const first=realtime.thunder('one',456,.5),again=realtime.thunder('one',456,.5);if(!first||again||realtime.status().thunders!==1)throw Error('Thunder is duplicated');realtime.stop();await ctx.close();
  return {beforeRms:before,afterRms:after,ratio:after/before,stationaryRmsRatio:Math.max(...windows)/Math.min(...windows),gainEventsFor1000Frames:calls.length-1,thunderExactlyOnce:true};
 });
 report.audio=audioReport;report.defaultBufferCases=defaultBufferCases;report.trees=treeReport;report.skybox=skyboxReport;report.palettes=paletteReport;
 await page.keyboard.press('Control+Alt+KeyW');
 assert.equal(await page.locator('[data-kasp-weather-tuner]').count(),0,'Removed developer panel opened');
 await page.keyboard.press('Control+Alt+KeyS');
 assert.equal(await page.locator('#ki-snow-developer').count(),0,'Archived snow tuner opened');
 assert.equal(await page.evaluate(()=>typeof window.__kaspSnow),'undefined');
 if(errors.length)throw Error(errors.join('\n'));
 const snowPNG=await page.evaluate(()=>window.__rainCaptureSnow);fs.writeFileSync(path.join(output,'snow.png'),Buffer.from(snowPNG.split(',')[1],'base64'));
 const png=await page.evaluate(()=>window.__rainCaptureStorm);fs.writeFileSync(path.join(output,'storm.png'),Buffer.from(png.split(',')[1],'base64'));
 const boltPNG=await page.evaluate(()=>window.__rainCaptureLightning);fs.writeFileSync(path.join(output,'lightning.png'),Buffer.from(boltPNG.split(',')[1],'base64'));
 const puddlesPNG=await page.evaluate(()=>window.__rainCapturePuddles);fs.writeFileSync(path.join(output,'puddles.png'),Buffer.from(puddlesPNG.split(',')[1],'base64'));
 const highPNG=await page.evaluate(()=>window.__rainCapturePuddlesHigh);fs.writeFileSync(path.join(output,'puddles-high.png'),Buffer.from(highPNG.split(',')[1],'base64'));
 for(const [name,key]of [['ramp-dry','__rainCaptureRampDry'],['ramp-wet','__rainCaptureRampWet']]){const png=await page.evaluate(key=>window[key],key);fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(png.split(',')[1],'base64'));}
 report.settings=settingsReport;report.nativeFog=fogSuppressionGPU;
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
