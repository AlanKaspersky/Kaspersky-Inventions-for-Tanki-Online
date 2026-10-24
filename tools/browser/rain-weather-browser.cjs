// Isolated localhost QA. Never uses the user's browser profile or installed extension.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const playwright=require('./runtime.cjs');
process.chdir(playwright.root);
const schema=require("../../src/generated/rain-weather.json").plans.at(-1).schema;
const bundle=buildSync({stdin:{contents:`import {createRainRenderer} from './src/core/rainWeather/renderer';import {installRainWeather} from './src/core/rainWeather';import {createWeatherAudio} from './src/core/rainWeather/audio';import {coreSettings} from './src/core/coreSettings';import {state} from './src/core/state';window.__rainQA={createRainRenderer,installRainWeather,createWeatherAudio,coreSettings,state};`,resolveDir:path.resolve('.')},bundle:true,format:'iife',write:false}).outputFiles[0].text;
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
   const root=document.createElement('div');root.className='SettingsComponentStyle-containerBlock';root.innerHTML='<ul></ul>';document.body.append(root);
   // Use the exact settings root binding, with a native scroll area kept beside it.
   root.className='SettingsComponentStyle-blockContentOptions';
   coreSettings.inject();
   const tab=document.querySelector('#kaspersky-tab');if(!tab)throw Error('Settings fixture root not found');tab.click();
   const content=document.querySelector('#kaspersky-settings-content');content.style.cssText='position:relative;width:760px;height:auto;margin:0;';
   const toggle=content.querySelector('[data-id="k_rain_weather"] input'),options=content.querySelector('#kasp-weather-options');
   const settle=async()=>{options.getBoundingClientRect();await Promise.all(options.getAnimations().map(animation=>animation.finished));};
   if(toggle.checked||options.getBoundingClientRect().height>.1||!options.inert)throw Error('Disabled weather controls visible');
   toggle.click();if(!toggle.checked||document.querySelector('[role="alertdialog"]'))throw Error('Weather still asks for confirmation');
   await settle();
   if(options.getBoundingClientRect().height<60||options.inert)throw Error('Controls did not expand: '+JSON.stringify({height:options.getBoundingClientRect().height,classes:options.className,rows:getComputedStyle(options).gridTemplateRows,checked:toggle.checked,inner:options.firstElementChild.scrollHeight,display:getComputedStyle(options).display}));
   const sliders=[...options.querySelectorAll('input')];
   if(lang==='EN'&&(sliders[0].value!=='25'||sliders[1].value!=='0'))throw Error('Reopening settings lost volume preferences');
   const widths=sliders.map(input=>{const row=input.closest('label');return{slider:input.getBoundingClientRect().width,row:row.getBoundingClientRect().width};});
   if(widths.some(item=>item.slider<300||Math.abs(item.slider-item.row)>.5))throw Error('Sliders are not full width: '+JSON.stringify(widths));
   sliders[0].value='25';sliders[0].dispatchEvent(new Event('input',{bubbles:true}));sliders[1].value='0';sliders[1].dispatchEvent(new Event('input',{bubbles:true}));
   if(localStorage.getItem('k_thunder_volume')!=='.25'&&localStorage.getItem('k_thunder_volume')!=='0.25')throw Error('Thunder volume not saved');
   if(localStorage.getItem('k_rain_volume')!=='0')throw Error('Rain mute not saved');
   const labels=sliders.map(input=>input.getAttribute('aria-label'));if(!labels.every(label=>lang==='RU'?label.includes('Громкость'):label.includes('volume')))throw Error('Volume localization missing');
   toggle.click();await settle();
   if(options.getBoundingClientRect().height>.1||sliders.some(input=>!input.disabled))throw Error('Controls did not collapse: '+JSON.stringify({height:options.getBoundingClientRect().height,classes:options.className,rows:getComputedStyle(options).gridTemplateRows,checked:toggle.checked}));
   coreSettings.onClose();root.remove();document.querySelector('#kaspersky-reload-tooltip')?.remove();
   return{lang,widths,labels,expanded:true,collapsed:true};
  },lang));
 }
 await page.evaluate(()=>{localStorage.removeItem('k_rain_volume');localStorage.removeItem('k_thunder_volume');});
 const report=await page.evaluate(async schema=>{
  const {createRainRenderer,installRainWeather}=window.__rainQA,canvas=document.querySelector('canvas'),g=canvas.getContext('webgl2',{depth:true,antialias:true,preserveDrawingBuffer:true});
  if(!g)throw Error('WebGL2 unavailable');
  const drawCounts=[];for(const name of ['drawArrays','drawArraysInstanced','blitFramebuffer','texImage2D']){
   const original=g[name].bind(g);g[name]=function(...args){const result=original(...args);if(name==='drawArraysInstanced')drawCounts.push(args[3]);const e=g.getError();if(e)throw Error(name+' WebGL error '+e);return result;};
  }
  const norm=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const eye=[2400,-4200,2200],target=[0,0,300],z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,0,1],z)),y=cross(z,x);
  const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(Math.PI/6),near=50,far=100000,proj=[f/1.6,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],vp=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)vp[c*4+r]+=proj[k*4+r]*view[c*4+k];
  function program(vs,fs){const p=g.createProgram();for(const[type,src]of[[g.VERTEX_SHADER,vs],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
  const native=program(`#version 300 es
precision highp float;uniform mat4 vp;out vec2 xy;void main(){vec2 p=vec2((gl_VertexID==1||gl_VertexID==2||gl_VertexID==4)?1.:-1.,(gl_VertexID==2||gl_VertexID==4||gl_VertexID==5)?1.:-1.);xy=p*16000.;gl_Position=vp*vec4(xy,0.,1.);}`,`#version 300 es
precision highp float;in vec2 xy;out vec4 o;void main(){float line=max(step(.98,fract(xy.x/700.)),step(.98,fract(xy.y/700.)));o=vec4(vec3(.38,.40,.42)-line*.055,1.);}`);
  const vao=g.createVertexArray();
  function ground(target=null){g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(0,0,800,500);g.depthRange(0,1);g.disable(g.RASTERIZER_DISCARD);g.disable(g.SAMPLE_ALPHA_TO_COVERAGE);g.disable(g.SCISSOR_TEST);g.disable(g.CULL_FACE);g.disable(g.BLEND);g.enable(g.DEPTH_TEST);g.depthFunc(g.LEQUAL);g.depthMask(true);g.colorMask(true,true,true,true);g.clearColor(.54,.67,.82,1);g.clearDepth(1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.useProgram(native);g.bindVertexArray(vao);g.uniformMatrix4fv(g.getUniformLocation(native,'vp'),false,vp);g.drawArrays(g.TRIANGLES,0,6);}
  function pixels(){const p=new Uint8Array(800*500*4);g.readPixels(0,0,800,500,g.RGBA,g.UNSIGNED_BYTE,p);return p;}
  function state(){const keys=['CURRENT_PROGRAM','VERTEX_ARRAY_BINDING','ACTIVE_TEXTURE','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','BLEND_EQUATION_RGB','BLEND_EQUATION_ALPHA','DEPTH_WRITEMASK','DEPTH_FUNC','DRAW_FRAMEBUFFER_BINDING','READ_FRAMEBUFFER_BINDING','VIEWPORT','COLOR_WRITEMASK','PIXEL_UNPACK_BUFFER_BINDING','UNPACK_ALIGNMENT','UNPACK_ROW_LENGTH','UNPACK_SKIP_PIXELS','UNPACK_SKIP_ROWS'];const s={};for(const k of keys){const v=g.getParameter(g[k]);s[k]=ArrayBuffer.isView(v)?[...v]:v;}for(const k of ['BLEND','DEPTH_TEST','CULL_FACE','STENCIL_TEST','SCISSOR_TEST','RASTERIZER_DISCARD','SAMPLE_ALPHA_TO_COVERAGE'])s[k]=g.isEnabled(g[k]);const unit=g.getParameter(g.ACTIVE_TEXTURE);for(let i=12;i<=15;i++){g.activeTexture(g.TEXTURE0+i);s['texture'+i]=g.getParameter(g.TEXTURE_BINDING_2D);s['sampler'+i]=g.getParameter(g.SAMPLER_BINDING);}g.activeTexture(unit);return s;}
  const frame={vp,camera:eye,time:5,seed:19027,fade:1,rain:1,clouds:1,wind:1,flash:0,storm:1,fog:[1,1000,5000],fogColor:[.65,.72,.82,1]};
  ground();const clear=pixels(),gpu=createRainRenderer(g);
  const pbo=g.createBuffer();g.bindBuffer(g.PIXEL_UNPACK_BUFFER,pbo);g.bufferData(g.PIXEL_UNPACK_BUFFER,32,g.STATIC_DRAW);g.pixelStorei(g.UNPACK_ALIGNMENT,8);g.pixelStorei(g.UNPACK_ROW_LENGTH,7);g.pixelStorei(g.UNPACK_SKIP_ROWS,2);g.pixelStorei(g.UNPACK_SKIP_PIXELS,1);
  const sampler=g.createSampler();for(let i=12;i<=15;i++)g.bindSampler(i,sampler);const read=g.createFramebuffer();g.bindFramebuffer(g.READ_FRAMEBUFFER,read);g.enable(g.RASTERIZER_DISCARD);g.enable(g.SAMPLE_ALPHA_TO_COVERAGE);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE,g.ONE,g.ZERO);g.activeTexture(g.TEXTURE3);
  g.depthRange(.15,.85);const rangeBefore=[...g.getParameter(g.DEPTH_RANGE)];
  const before=state();gpu.warm();gpu.draw(frame);const after=state();
  if(JSON.stringify([...g.getParameter(g.DEPTH_RANGE)])!==JSON.stringify(rangeBefore))throw Error('Changed native depth range');
  for(const k of Object.keys(before)){if(Array.isArray(before[k])){if(JSON.stringify(before[k])!==JSON.stringify(after[k]))throw Error('State array changed '+k);}else if(before[k]!==after[k])throw Error('State changed '+k);}
  g.bindBuffer(g.PIXEL_UNPACK_BUFFER,null);g.pixelStorei(g.UNPACK_ALIGNMENT,4);g.pixelStorei(g.UNPACK_ROW_LENGTH,0);g.pixelStorei(g.UNPACK_SKIP_ROWS,0);g.pixelStorei(g.UNPACK_SKIP_PIXELS,0);for(let i=12;i<=15;i++)g.bindSampler(i,null);g.bindFramebuffer(g.READ_FRAMEBUFFER,null);
  ground();gpu.draw({...frame,rain:0,clouds:0,storm:0});const unchanged=pixels();if(unchanged.some((v,i)=>v!==clear[i]))throw Error('Clear battle is modified');
  ground();gpu.draw({...frame,time:6});const storm=pixels();let base=0,dark=0;for(let y=0;y<200;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;base+=clear[i]+clear[i+1]+clear[i+2];dark+=storm[i]+storm[i+1]+storm[i+2];}
  if(dark/base>.70)throw Error('Storm is not gloomy enough '+dark/base);
  const noFog=createRainRenderer(g),withFog=createRainRenderer(g);
  ground();noFog.draw({...frame,rain:0,storm:0,fog:[0,1000,5000]});const low=pixels();
  ground();withFog.draw({...frame,rain:0,storm:0,fog:[1,1000,5000]});const high=pixels();let difference=0;for(let y=400;y<500;y++)for(let x=0;x<800;x++){const i=(y*800+x)*4;difference+=high[i]+high[i+1]+high[i+2]-low[i]-low[i+1]-low[i+2];}
  if(difference/(800*100*3)<3)throw Error('Native fog does not lighten distant clouds');noFog.dispose();withFog.dispose();
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
  const status=gpu.status();gpu.dispose();if(!g.isProgram(native))throw Error('Disposed native game program');
  const extension=g.getExtension.bind(g);g.getExtension=name=>name==='EXT_color_buffer_float'?null:extension(name);const fallback=createRainRenderer(g);g.getExtension=extension;ground();fallback.draw(frame);if(fallback.status().cloudFloat)throw Error('Cloud RGBA8 fallback was not selected');fallback.dispose();
  const framebufferCases=[];
  for(const [format,texture,multisample]of [[g.DEPTH_COMPONENT16,false,false],[g.DEPTH_COMPONENT24,false,false],[g.DEPTH_COMPONENT32F,false,false],[g.DEPTH24_STENCIL8,false,false],[g.DEPTH32F_STENCIL8,false,false],[g.DEPTH24_STENCIL8,false,true],[g.DEPTH_COMPONENT24,true,false],[g.DEPTH24_STENCIL8,true,false]]){
   const fbo=g.createFramebuffer(),colour=g.createRenderbuffer(),depth=texture?g.createTexture():g.createRenderbuffer();g.bindFramebuffer(g.FRAMEBUFFER,fbo);
   const samples=multisample?Math.min(4,g.getParameter(g.MAX_SAMPLES)):0;
   g.bindRenderbuffer(g.RENDERBUFFER,colour);g.renderbufferStorageMultisample(g.RENDERBUFFER,samples,g.RGBA8,800,500);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,colour);
   const attachment=format===g.DEPTH24_STENCIL8||format===g.DEPTH32F_STENCIL8?g.DEPTH_STENCIL_ATTACHMENT:g.DEPTH_ATTACHMENT;
   if(texture){g.bindTexture(g.TEXTURE_2D,depth);g.texStorage2D(g.TEXTURE_2D,1,format,800,500);g.framebufferTexture2D(g.FRAMEBUFFER,attachment,g.TEXTURE_2D,depth,0);}
   else{g.bindRenderbuffer(g.RENDERBUFFER,depth);g.renderbufferStorageMultisample(g.RENDERBUFFER,samples,format,800,500);g.framebufferRenderbuffer(g.FRAMEBUFFER,attachment,g.RENDERBUFFER,depth);}
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('QA FBO incomplete '+format);
   ground(fbo);const own=createRainRenderer(g);own.draw(frame);if(g.getParameter(g.DRAW_FRAMEBUFFER_BINDING)!==fbo)throw Error('Weather changed native FBO');own.dispose();
   g.bindFramebuffer(g.FRAMEBUFFER,null);g.deleteFramebuffer(fbo);g.deleteRenderbuffer(colour);if(texture)g.deleteTexture(depth);else g.deleteRenderbuffer(depth);
   framebufferCases.push({format,texture,samples});
  }
  localStorage.setItem('k_rain_weather','true');const episode={version:1,preset:'storm',start:Date.now()-60000,hold:100,seed:19027,fadeIn:24,fadeOut:30};sessionStorage.setItem('ki.rain-episodes.v1',JSON.stringify([['qa-match',episode]]));
  const contexts=[],AC=window.AudioContext;window.AudioContext=class extends AC{constructor(){super();contexts.push(this);}};
  const api=installRainWeather(window);api.battle({loaded:true,id:'qa-match'},{battleLoaded:'loaded',battleId:'id'});
  const renderer={[schema.gl]:{[schema.context]:g},[schema.settings]:{[schema.fogEnabled]:true,[schema.mapFog]:true},[schema.fogStart]:7500,[schema.fogEnd]:46000,[schema.fogColor]:{[schema.red]:.65,[schema.green]:.72,[schema.blue]:.82,[schema.alpha]:1}};
  const camera={[schema.vp]:vp,[schema.camera]:{[schema.x]:eye[0],[schema.y]:eye[1],[schema.z]:eye[2]}},scene={};
  ground();api.frame(renderer,scene,camera,schema);await new Promise(r=>setTimeout(r,300));ground();api.frame(renderer,scene,camera,schema);
  if(!contexts.length)throw Error('Scheduled rain audio did not start');
  localStorage.setItem('k_rain_volume','0');localStorage.setItem('k_thunder_volume','0.2');window.dispatchEvent(new Event('kasp:settings-changed'));
  if(api.status().sound.volumes.rain!==0||api.status().sound.volumes.thunder!==.2)throw Error('Live volume event did not reach active weather audio');
  const root=document.querySelector('.BattleComponentStyle-canvasContainer');root.remove();await new Promise(r=>setTimeout(r,500));
  if(api.status().audio!=='off'||contexts.some(c=>c.state!=='closed'))throw Error('Rain audio survived exit');
  document.body.append(root);api.battle({loaded:true,id:'qa-match'},{battleLoaded:'loaded',battleId:'id'});const returnedScene={};api.frame(renderer,returnedScene,camera,schema);
  await new Promise(r=>setTimeout(r,200));ground();api.frame(renderer,returnedScene,camera,schema);
  if(JSON.stringify(api.status().episode)!==JSON.stringify(episode))throw Error('Re-entry rerolled weather');
  if(api.status().sound.volumes.rain!==0||api.status().sound.volumes.thunder!==.2)throw Error('Re-entry lost muted rain or thunder volume');
  localStorage.setItem('k_rain_weather','false');window.dispatchEvent(new Event('kasp:settings-changed'));
  if(api.status().enabled||api.status().renderers.length)throw Error('Live toggle did not release resources');
  if(api.status().runtime.failures)throw Error(JSON.stringify(api.status()));
  const error=g.getError();if(error)throw Error('Final WebGL error '+error);
  return{stateRestored:true,clearSceneUnchanged:true,stormBrightnessRatio:dark/base,fogLightening:difference/(800*100*3),dropCounts:drawCounts,cloudSize:status.cloudSize,
   transitionFlicker,skyDifference,heightDifference,pinkExcess,brightBoltPixels,transparentSpritePreserved:true,framebufferCases,nativeProgramPreserved:true,audioClosedAfterExit:true,reentryDoesNotReroll:true,liveToggleReleasesResources:true,glError:error};
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
 report.audio=audioReport;
 if(errors.length)throw Error(errors.join('\n'));
 const png=await page.evaluate(()=>window.__rainCaptureStorm);fs.writeFileSync(path.join(output,'storm.png'),Buffer.from(png.split(',')[1],'base64'));
 const boltPNG=await page.evaluate(()=>window.__rainCaptureLightning);fs.writeFileSync(path.join(output,'lightning.png'),Buffer.from(boltPNG.split(',')[1],'base64'));
 report.settings=settingsReport;
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
