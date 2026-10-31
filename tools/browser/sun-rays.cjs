// Real WebGL2 prototype QA, isolated from the game/account and the user's browser profile.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild'),{chromium,browserOptions,root}=require('./runtime.cjs');
const bundle=buildSync({stdin:{contents:"import {DEFAULT_GRAPHICS_TUNING,applySunLook,defaultGraphicsProfile} from './src/core/graphicsPreferences';import {createRainRenderer} from './src/core/rainWeather/renderer';import {installSunRays} from './src/core/sunRays';import {featureScope} from './src/core/featureRuntime';window.qa={DEFAULT_GRAPHICS_TUNING,applySunLook,defaultGraphicsProfile,createRainRenderer,installSunRays,featureScope};",resolveDir:root},bundle:true,write:false,format:'iife',target:'chrome100'}).outputFiles[0].text;
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><body style="margin:0;background:#111"><canvas width="1100" height="650"></canvas></body>');});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...browserOptions,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:650}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:bundle});
  const report=await page.evaluate(()=>{
   const canvas=document.querySelector('canvas'),g=canvas.getContext('webgl2',{antialias:false,alpha:false,preserveDrawingBuffer:true});if(!g)throw Error('WebGL2 missing');
   const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
   function view(eye,target){
    const z=norm(eye.map((v,i)=>v-target[i])),x=norm(cross([0,0,1],z)),y=cross(z,x),v=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
    const f=1/Math.tan(.55),near=20,far=65000,p=[f/(1100/650),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],out=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=p[k*4+r]*v[c*4+k];return out;
   }
   function program(vs,fs){const p=g.createProgram();for(const [type,src]of[[g.VERTEX_SHADER,vs],[g.FRAGMENT_SHADER,fs]]){const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
   const native=program(`#version 300 es
precision highp float;layout(location=0)in vec3 position;uniform mat4 vp;out vec3 world;void main(){world=position;gl_Position=vp*vec4(position,1.);}`,`#version 300 es
precision highp float;in vec3 world;out vec4 o;void main(){vec3 n=normalize(cross(dFdx(world),dFdy(world)));float light=.35+.65*max(0.,dot(n,normalize(vec3(.25,.55,.8))));float grid=mod(floor(world.x/650.)+floor(world.y/650.),2.);vec3 c=world.z<1.?mix(vec3(.22,.25,.21),vec3(.27,.29,.25),grid):vec3(.28,.30,.31);o=vec4(c*light,1.);}`);
   const points=[];
   const quad=(a,b,c,d)=>points.push(...a,...b,...c,...a,...c,...d);
   quad([-18000,-16000,0],[18000,-16000,0],[18000,26000,0],[-18000,26000,0]);
   function box(x,y,z,w,d,h){const p=(a,b,c)=>[x+a*w,y+b*d,z+c*h];for(const a of[[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],[[1,1,0],[0,1,0],[0,1,1],[1,1,1]],[[0,1,0],[0,0,0],[0,0,1],[0,1,1]],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]])quad(...a.map(v=>p(...v)));}
   box(-8000,3000,0,4500,4000,6500);box(3800,7000,0,4200,6000,9000);
   box(-3500,4000,4200,7000,4500,500);box(-3500,4000,0,500,4500,4200);box(3000,4000,0,500,4500,4200);
   const vertices=new Float32Array(points),map={vertices,supportVertices:vertices,triangles:vertices.length/9,ground:()=>null};
   const vao=g.createVertexArray(),buffer=g.createBuffer();g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,vertices,g.STATIC_DRAW);g.enableVertexAttribArray(0);g.vertexAttribPointer(0,3,g.FLOAT,false,12,0);
   const camera=[0,-11000,2500],vp=view(camera,[0,8000,3300]),direction=norm([.2,.55,.8]),colour=[1,.88,.70];
   function scene(matrix=vp){g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,1100,650);g.disable(g.SCISSOR_TEST);g.disable(g.BLEND);g.enable(g.DEPTH_TEST);g.depthFunc(g.LESS);g.depthMask(true);g.clearColor(.20,.25,.29,1);g.clearDepth(1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.bindVertexArray(vao);g.useProgram(native);g.uniformMatrix4fv(g.getUniformLocation(native,'vp'),false,matrix);g.drawArrays(g.TRIANGLES,0,vertices.length/3);}
   function pixels(){const out=new Uint8Array(1100*650*4);g.readPixels(0,0,1100,650,g.RGBA,g.UNSIGNED_BYTE,out);return out;}
   function state(){const fields=['CURRENT_PROGRAM','VERTEX_ARRAY_BINDING','ARRAY_BUFFER_BINDING','ACTIVE_TEXTURE','DRAW_FRAMEBUFFER_BINDING','READ_FRAMEBUFFER_BINDING','BLEND_SRC_RGB','BLEND_DST_RGB','BLEND_SRC_ALPHA','BLEND_DST_ALPHA','DEPTH_WRITEMASK','DEPTH_FUNC','DEPTH_CLEAR_VALUE','CULL_FACE_MODE','FRONT_FACE'];return fields.map(key=>g.getParameter(g[key])).concat([...g.getParameter(g.VIEWPORT)],['BLEND','DEPTH_TEST','CULL_FACE','STENCIL_TEST','SCISSOR_TEST','RASTERIZER_DISCARD'].map(key=>g.isEnabled(g[key])));}
   const original=window.qa.applySunLook(window.qa.defaultGraphicsProfile(),'original').settings;
   const gpu=window.qa.createRainRenderer(g),frame={vp,camera,map,direction,colour,time:12,fade:1,intensity:1,graphics:original.tuning};
   scene();const baseline=pixels(),before=state();gpu.drawSun(frame);const after=state();if(before.some((v,i)=>v!==after[i]))throw Error('Native GL state changed');
   const image=pixels(),status=gpu.status();if(status.sunError||status.sunSkip)throw Error(JSON.stringify(status));
   let changed=0,brighter=0,difference=0;for(let i=0;i<image.length;i+=4){const delta=image[i]+image[i+1]+image[i+2]-baseline[i]-baseline[i+1]-baseline[i+2];if(Math.abs(delta)>3)changed++;if(delta>3)brighter++;difference+=Math.abs(delta);}
   if(changed<1000||brighter<1000)throw Error('No visible volume '+JSON.stringify({changed,brighter,difference}));
   window.sunImage=canvas.toDataURL();
   const warm=window.qa.applySunLook(window.qa.defaultGraphicsProfile(),'warm-evening').settings;
   scene();const warmBefore=state();gpu.drawSun({...frame,intensity:warm.sunIntensity,graphics:warm.tuning});const warmImage=pixels();
   if(warmBefore.some((v,i)=>v!==state()[i]))throw Error('Warm look changed native GL state');
   let warmDifference=0,warmBalance=0,originalBalance=0;for(let i=0;i<image.length;i+=4){warmDifference+=Math.abs(warmImage[i]-image[i])+Math.abs(warmImage[i+1]-image[i+1])+Math.abs(warmImage[i+2]-image[i+2]);warmBalance+=warmImage[i]-warmImage[i+2];originalBalance+=image[i]-image[i+2];}
   if(warmDifference<10000||warmBalance<=originalBalance)throw Error('Warm look is not visibly warm');
   window.sunWarmImage=canvas.toDataURL();
   scene();const fadeBaseline=pixels();gpu.drawSun({...frame,intensity:8,fade:0,graphics:warm.tuning});if(pixels().some((v,i)=>v!==fadeBaseline[i]))throw Error('Warm look flashes before its fade begins');
   scene();gpu.drawSun({...frame,intensity:0,graphics:warm.tuning});if(pixels().some((v,i)=>v!==fadeBaseline[i]))throw Error('Zero strength retained warm grading');
   const cinematic=window.qa.applySunLook(window.qa.defaultGraphicsProfile(),'cinematic').settings;
   scene();gpu.drawSun({...frame,intensity:cinematic.sunIntensity,graphics:cinematic.tuning});window.sunCinematicImage=canvas.toDataURL();
   if(gpu.status().sunlight.bloom.error||!gpu.status().sunlight.bloom.frames)throw Error('Cinematic bloom did not render');
   const highlight=()=>{scene();g.enable(g.SCISSOR_TEST);g.scissor(220,520,20,20);g.clearColor(.95,.86,.65,1);g.clear(g.COLOR_BUFFER_BIT);g.disable(g.SCISSOR_TEST);};
   highlight();gpu.drawSun({...frame,intensity:4,graphics:{...cinematic.tuning,sunBloom:0}});const unbloomed=pixels();
   highlight();gpu.drawSun({...frame,intensity:4,graphics:cinematic.tuning});const bloomed=pixels();let bloomGlow=0;
   for(let y=508;y<552;y++)for(let x=208;x<252;x++)if(x<220||x>=240||y<520||y>=540){const i=(y*1100+x)*4;bloomGlow+=Math.max(0,bloomed[i]+bloomed[i+1]+bloomed[i+2]-unbloomed[i]-unbloomed[i+1]-unbloomed[i+2]);}
   if(bloomGlow<50)throw Error('Bright native surfaces produced no bloom: '+bloomGlow);
   scene();gpu.drawSun(frame);if(gpu.status().sunlight.bloom.resolution.some(n=>n!==0))throw Error('Zero bloom retained its render targets');
   const fallback=window.qa.createRainRenderer(g),compileShader=g.compileShader;
   try{
    g.compileShader=function(shader){if(g.getShaderSource(shader).includes('uniform float uThreshold;'))g.shaderSource(shader,'#version 300 es\nnot valid GLSL');return compileShader.call(this,shader);};
    scene();fallback.drawSun({...frame,intensity:4,graphics:cinematic.tuning});const status=fallback.status();
    if(status.sunError||!status.sunlight?.frames||!status.sunlight.bloom.error)throw Error('Bloom compile failure stopped the whole lighting shader');
   }finally{g.compileShader=compileShader;fallback.dispose();}
   const skyView=view(camera,camera.map((v,i)=>v+direction[i]*10000)),diskTuning={...original.tuning,sunDensity:0,sunSurface:0,sunHalo:0};
   const centre=(325*1100+550)*4;
   scene(skyView);const noSource=pixels();gpu.drawSun({...frame,vp:skyView,graphics:diskTuning});const disk=pixels();
   if(disk[centre]<200||disk[centre+1]<200||disk[centre+2]<200)throw Error('Sun disk missing in the native light direction');
   window.sunDiskImage=canvas.toDataURL();
   scene(skyView);gpu.drawSun({...frame,vp:skyView,graphics:{...diskTuning,sunDiskBrightness:0}});if(pixels().some((v,i)=>v!==noSource[i]))throw Error('Zero disk brightness retained the source');
   scene(skyView);g.clearDepth(.4);g.clear(g.DEPTH_BUFFER_BIT);const wall=pixels();gpu.drawSun({...frame,vp:skyView,graphics:diskTuning});if(pixels().some((v,i)=>v!==wall[i]))throw Error('Sun disk leaked through foreground depth');
   const raised=[camera[0],camera[1],camera[2]+1500],raisedView=view(raised,raised.map((v,i)=>v+direction[i]*10000));
   scene(raisedView);gpu.drawSun({...frame,vp:raisedView,camera:raised,graphics:diskTuning});const raisedDisk=pixels();if(Math.abs(raisedDisk[centre]-disk[centre])>1)throw Error('Camera height moved the solar direction');
   scene();gpu.drawSun({...frame,intensity:40});const strong=pixels();
   const skyPixel=(640*1100+40)*4;
   for(let c=0;c<3;c++)if(strong[skyPixel+c]>baseline[skyPixel+c]+16)throw Error('Intensity 40 overexposes the sky');
   const tuned=window.qa.createRainRenderer(g),tuning={...original.tuning,sunSteps:12,sunResolution:320,sunShadow:512,sunSurface:0,sunDensity:0};
   scene();const dry=pixels();tuned.drawSun({...frame,graphics:tuning});const tunedStatus=tuned.status().sunlight;
   if(pixels().some((v,i)=>v!==dry[i])||tunedStatus.steps!==12||tunedStatus.shadowSize!==512||tunedStatus.resolution[0]!==320)throw Error('Sunlight settings ignored: '+JSON.stringify(tunedStatus));tuned.dispose();
   let previous=null,previousX=0;const cameraDifferences=[];
   for(const x of[1999,2001,3999,4001]){
    const eye=[x,camera[1],camera[2]],matrix=view(eye,[x,8000,3300]);scene(matrix);gpu.drawSun({...frame,vp:matrix,camera:eye});const current=pixels();
    if(previous&&x-previousX===2){let delta=0;for(let i=0;i<current.length;i++)delta+=Math.abs(current[i]-previous[i]);cameraDifferences.push(delta/current.length);}
    previous=current;previousX=x;
   }
   if(cameraDifferences.some(delta=>delta>1.5))throw Error('A camera grid boundary caused a visible discontinuity: '+cameraDifferences);
   if(gpu.status().sunlight.shadowBuilds!==1)throw Error('Camera movement rebuilt the world shadow map');
   // An offscreen roof changes volumetric light although the camera depth image is identical.
   const roof=new Float32Array([...vertices,-18000,-16000,12000,18000,-16000,12000,18000,26000,12000,-18000,-16000,12000,18000,26000,12000,-18000,26000,12000]);
   scene();gpu.drawSun({...frame,map:{...map,supportVertices:roof}});const covered=pixels();
   let shadowDifference=0;for(let i=0;i<covered.length;i+=4)shadowDifference+=Math.max(0,image[i]+image[i+1]+image[i+2]-covered[i]-covered[i+1]-covered[i+2]);
   if(shadowDifference<10000)throw Error('Offscreen collision roof did not shadow the air');
   scene();const clean=pixels();gpu.drawSun({...frame,intensity:0});if(pixels().some((v,i)=>v!==clean[i]))throw Error('Zero intensity changes the scene');
   scene();g.depthFunc(g.GREATER);gpu.drawSun(frame);if(gpu.status().sunSkip!=='unsupported-depth-convention')throw Error('Unsupported depth convention did not fail closed');g.depthFunc(g.LESS);
   const api=window.qa.installSunRays(window);api.api.setEnabled(false);api.frame(g,vp,camera,map,'SUMMER_DAY');if(api.api.status().renderers.length)throw Error('Disabled feature allocated a renderer');
   api.api.setEnabled(true);api.lighting(new Float32Array([.2,.2,.2,0,1,.88,.70,0,-direction[0],-direction[1],-direction[2],0]));
   for(const theme of['SPACE','SUMMER_NIGHT','WINTER_NIGHT']){api.frame(g,vp,camera,map,theme);if(api.api.status().reason!=='night-or-space')throw Error('Sun active at night/in space');}
   api.frame(g,vp,camera,undefined,'SUMMER_DAY');if(api.api.status().reason!=='map-pending')throw Error('Unshadowed map fallback enabled');
   api.api.setIntensity(0);api.frame(g,vp,camera,map,'SUMMER_DAY');if(api.api.status().reason!=='zero-intensity')throw Error('Zero intensity not preserved');
   api.api.setEnabled(false);window.qa.featureScope('sunRays').dispose('manual');const disposed=api.api.status().runtime;if(disposed.resources)throw Error('Sun controller leaked resources');
   const formats=[];
   for(const alpha of[false,true]){
    const small=document.createElement('canvas');small.width=256;small.height=160;
    const ms=small.getContext('webgl2',{antialias:true,alpha});if(!ms)throw Error('MSAA context missing');
    ms.clearColor(.2,.25,.3,1);ms.clearDepth(1);ms.enable(ms.DEPTH_TEST);ms.depthFunc(ms.LESS);ms.clear(ms.COLOR_BUFFER_BIT|ms.DEPTH_BUFFER_BIT);
    const holder=window.qa.createRainRenderer(ms);holder.drawSun(frame);const result=holder.status();
    if(result.sunError||result.sunSkip||!result.sunlight?.frames)throw Error('MSAA solar failure '+JSON.stringify(result));
    const error=ms.getError();if(error)throw Error('MSAA WebGL error '+error);
    formats.push({alpha,samples:ms.getParameter(ms.SAMPLES),format:result.depthCopy.format});holder.dispose();ms.getExtension('WEBGL_lose_context')?.loseContext();
   }
   gpu.dispose();const glError=g.getError();if(glError)throw Error('WebGL error '+glError);if(!g.isProgram(native))throw Error('Native program deleted');
   return{cinematic:true,bloomGlow,bloomFallback:true,sunDisk:true,sunDiskOccluded:true,sunDiskCameraStable:true,warmEvening:true,warmDifference,warmBalance,originalBalance,changed,brighter,meanDifference:difference/(1100*650),cameraDifferences,shadowDifference,formats,status:status.sunlight,stateRestored:true,disabledResources:0,glError};
  });
  fs.mkdirSync(path.join(root,'artifacts/qa/sun-rays'),{recursive:true});
  const png=await page.evaluate(()=>window.sunImage);fs.writeFileSync(path.join(root,'artifacts/qa/sun-rays/prototype.png'),Buffer.from(png.split(',')[1],'base64'));
  const warmPNG=await page.evaluate(()=>window.sunWarmImage);fs.writeFileSync(path.join(root,'artifacts/qa/sun-rays/warm-evening.png'),Buffer.from(warmPNG.split(',')[1],'base64'));
  const diskPNG=await page.evaluate(()=>window.sunDiskImage);fs.writeFileSync(path.join(root,'artifacts/qa/sun-rays/sun-disk.png'),Buffer.from(diskPNG.split(',')[1],'base64'));
  const cinematicPNG=await page.evaluate(()=>window.sunCinematicImage);fs.writeFileSync(path.join(root,'artifacts/qa/sun-rays/cinematic.png'),Buffer.from(cinematicPNG.split(',')[1],'base64'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
