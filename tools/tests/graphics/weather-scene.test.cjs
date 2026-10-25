const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {buildSync}=require('esbuild');
function load(name){const module={exports:{}};vm.runInNewContext(buildSync({entryPoints:['src/core/rainWeather/'+name+'.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,{module,exports:module.exports,Float32Array,console});return module.exports;}
const {buildMapSurface,MAP_SURFACE}=load('mapSurface'),lighting=load('lighting'),{createSplashEmitter,SPLASHES}=load('splashes'),{DEFAULT_SURFACE_TUNING}=load('tuning');
const {hullSurface,rainHit}=load('tankSurface'),{treeWindShader}=load('treeWind'),{cloudTone,mapTheme,mapAllowsPuddles}=load('environment'),{skyboxDarkness,skyboxShader}=load('skybox');
const xyz=(x=0,y=0,z=0)=>({x,y,z});
const schema=Object.fromEntries(['boxes','planes','triangles','size','width','length','v0','v1','v2','x','y','z'].map(k=>[k,k]));
Object.assign(schema,{planePosition:'position',planeRotation:'rotation',boxPosition:'position',boxRotation:'rotation',trianglePosition:'position',triangleRotation:'rotation'});
const raw=(extra={})=>({boxes:[],planes:[{position:xyz(),rotation:xyz(),width:4000,length:4000}],triangles:[],...extra});
test('only upward, flat map collision faces enter the puddle mesh',()=>{
 const mesh=buildMapSurface(raw({planes:[...raw().planes,{position:xyz(5000,0,200),rotation:xyz(.3,0,0),width:2000,length:2000}]}),schema);
 assert.equal(mesh.triangles,2);assert.deepEqual([...mesh.ground(0,0,10)],[0,0,0]);assert.equal(mesh.ground(5000,0,200),null);
 assert.ok(mesh.ground(5000,0,200,100,false),'inclined collision remains available for rain splashes');
 assert.equal(mesh.ground(3000,0,0),null,'noncolliding ground is excluded');assert.ok(MAP_SURFACE.minUp>.999);
});
test('collision boxes use native size and Euler convention; undersides and dynamic extras are excluded',()=>{
 const mesh=buildMapSurface(raw({planes:[],boxes:[{position:xyz(100,200,50),rotation:xyz(0,0,Math.PI/2),size:xyz(400,200,100)}],tanks:[{position:xyz(),size:xyz(1000,1000,1000)}]}),schema);
 assert.equal(mesh.triangles,2);assert.equal(mesh.supportVertices.length,12*9,'static walls support banks; dynamic extras are excluded');assert.deepEqual([...mesh.ground(100,200,100)],[100,200,100]);assert.equal(mesh.ground(100,200,0,1),null);
 assert.equal(buildMapSurface(raw({planes:[{position:xyz(),rotation:xyz(Math.PI,0,0),width:100,length:100}]}),schema).triangles,0);
});
test('collision triangles preserve transforms and malformed geometry fails closed',()=>{
 const mesh=buildMapSurface(raw({planes:[],triangles:[{position:xyz(10,20,30),rotation:xyz(),v0:xyz(),v1:xyz(100,0),v2:xyz(0,100)}]}),schema);
 assert.equal(mesh.triangles,1);assert.deepEqual([...mesh.ground(20,30,31)],[20,30,30]);
 assert.throws(()=>buildMapSurface(raw({planes:[{position:xyz(),rotation:xyz(),width:NaN,length:10}]}),schema));
 assert.throws(()=>buildMapSurface(raw({boxes:{}}),schema));
});
test('native lighting attenuates only ambient/sun and restores the CPU buffer after upload',()=>{
 const buffer=new Float32Array([1,.5,.25,9,.8,.7,.6,8,2,3,4,7]),before=buffer.slice();
 const undo=lighting.attenuateLighting(buffer,.4);assert.ok(undo);assert.ok(buffer[0]<before[0]);assert.deepEqual([...buffer.slice(8)],[2,3,4,7]);
 const dynamic=5,lit=buffer[0]+dynamic;undo();assert.ok(lit>dynamic,'native dynamic addition is not multiplied');assert.deepEqual([...buffer],[...before]);undo();
 assert.equal(lighting.attenuateLighting(buffer,1),undefined);assert.equal(lighting.lightAttenuation(0,0,1),1);assert.ok(lighting.lightAttenuation(1,1,1)<.4);
 assert.ok(lighting.lightAttenuation(1,1,1,1)>lighting.lightAttenuation(1,1,1,0));
});
test('prepared native lighting wrapper calls the original upload once and restores even on native errors',()=>{
 const plan=require('../../../src/generated/rain-weather.json').plans.at(-1),before=plan.edits.find(e=>e.text.startsWith('(()=>{let _kiLightRestore'));
 assert.ok(before);const after=plan.edits.find(e=>e.text.startsWith('}finally{try{_kiLightRestore'));
 let middle;for(let n=Math.min(before.after.length,after.before.length);n>=0;n--)if(before.after.endsWith(after.before.slice(0,n))){middle=before.after+after.before.slice(n);break;}
 assert.equal(middle.length,after.start-before.start);const fields=/this\.([\w$]+)\.([\w$]+)\(this\.([\w$]+)\)/.exec(middle);assert.ok(fields);
 const data=/lighting\(this\.[\w$]+\.([\w$]+)\)/.exec(before.text)[1];
 for(const observerFails of [false,true])for(const nativeFails of [false,true]){
  const buffer=new Float32Array(12).fill(1),page={__kaspRain:{lighting:b=>{if(observerFails)throw Error('observer');return lighting.attenuateLighting(b,.4);}}};
  const obj=vm.runInNewContext('({run:function(){return '+before.text+middle+after.text+';}})',{window:page});let calls=0;
  obj[fields[1]]={[data]:buffer,[fields[2]](){calls++;assert.equal(buffer[0],observerFails?1:Math.fround(.4));if(nativeFails)throw Error('native');return 47;}};obj[fields[3]]={};
  if(nativeFails)assert.throws(()=>obj.run(),/native/);else assert.equal(obj.run(),47);assert.equal(calls,1);assert.equal(buffer[0],1);
 }
});
const vp=new Float32Array([1/6000,0,0,0,0,1/6000,0,0,0,0,1/6000,0,0,0,0,1]);
function simulate(rain,tuning={},tanks=[]){
 const emitter=createSplashEmitter(),map={ground:(x,y)=>[x,y,0]};let data;
 const frame={seed:6,rain,puddles:1,camera:[0,0,300],map,tanks,vp,tuning:{...DEFAULT_SURFACE_TUNING,...tuning}};
 for(let i=0;i<120;i++)data=emitter.update({...frame,time:1+i/60});return {emitter,data,frame};
}
test('more rain emits more ground splash droplets, with zero and missing collisions producing none',()=>{
 const light=simulate(.25),heavy=simulate(1);assert.ok(heavy.data.length>light.data.length*2);assert.equal(simulate(0).data.length,0);
 assert.equal(simulate(1,{groundSplashDensity:0,tankSplashDensity:0}).data.length,0);
 const emitter=createSplashEmitter(),frame={...heavy.frame,map:{ground:()=>null}};emitter.update({...frame,time:1});assert.equal(emitter.update({...frame,time:1.1}).length,0);
});
const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
const matrixSchema={...schema,halfSize:'half',boxMatrix:'matrix',...Object.fromEntries([0,1,2,4,5,6,8,9,10,12,13,14].map(i=>['m'+i,'m'+i]))};
const nativeMatrix=(array=identity())=>Object.fromEntries([...array].map((v,i)=>['m'+i,v]));
const tankHull=()=>hullSurface({half:xyz(150,250,100),matrix:nativeMatrix()},[],matrixSchema);
test('rain hits actual transformed hull faces and does not invent a roof without native geometry',()=>{
 const hull=tankHull(),m=identity();m[12]=100;m[14]=200;
 assert.deepEqual([...rainHit(hull,m,100,0,200,0)],[100,0,300]);assert.equal(rainHit(hull,m,1000,0,200,0),null);
 m[0]=0;m[1]=1;m[4]=-1;m[5]=0;
 assert.ok(rainHit(hull,m,300,0,200,0));assert.equal(rainHit(hull,m,100,200,200,0),null);
 assert.equal(hullSurface({},[],matrixSchema).length,0);
});
test('rain splashes off stationary tanks without puddles; movement does not alter the impact rate',()=>{
 const matrix=identity();matrix[14]=200;
 const tank={position:[0,0,200],size:[300,500,200],velocity:[0,0,0],at:0,hull:tankHull(),matrix};
 const settings={groundSplashDensity:0},stationary=simulate(1,settings,[tank]);assert.ok(stationary.data.length>0);
 for(let i=0;i<stationary.data.length;i+=SPLASHES.stride)assert.ok(stationary.data[i+2]>=300,'births belong to the hull top');
 assert.equal(simulate(1,settings,[{...tank,hull:undefined}]).data.length,0);
 assert.equal(simulate(1,{...settings,tankSplashDensity:0},[tank]).data.length,0);
 assert.equal(simulate(1,settings,[{...tank,velocity:[2000,0,0]}]).data.length,stationary.data.length);
 const emitter=createSplashEmitter(),f={...stationary.frame,puddles:0,map:undefined};emitter.update({...f,time:1});assert.ok(emitter.update({...f,time:1.08}).length>0);
 const covered={...f,map:{ground:(x,y)=>[x,y,800]}};emitter.clear();emitter.update({...covered,time:1});assert.equal(emitter.update({...covered,time:1.08}).length,0);
});
test('all validated foliage paths remove native and added motion completely',()=>{
 const instance='vec3 instancePosition; void main(){vertexWorldPosition = getPositionModifiedByWind(vertexWorldPosition, time, windStrength);}';
 const single='uniform mat4 uWorldMatrix; void main(){vec3 localPosition = position + positionOffset;}';
 for(const [source,instanced]of [[instance,true],[single,false]]){const result=treeWindShader(source,instanced);assert.ok(result.includes('kiStaticFoliage'));assert.ok(!result.includes('kiWeatherWind'));assert.equal(treeWindShader(result,instanced),result);}
 assert.ok(treeWindShader(instance,true).includes('if(kiFoliageMotion>0.)')); assert.ok(treeWindShader(single,false).includes('vec3 localPosition = position;'));assert.equal(treeWindShader('unrelated',true),'unrelated');
});
test('native map themes distinguish space, season and time of day without matching arbitrary names',()=>{
 assert.equal(mapTheme('SPACE'),'SPACE');assert.equal(mapTheme('WINTER_NIGHT'),'WINTER_NIGHT');assert.equal(mapTheme('Space Station'),undefined);
 assert.ok(cloudTone('WINTER_NIGHT')[0]<cloudTone('WINTER_DAY')[0]);assert.ok(cloudTone('SUMMER_EVENING')[0]>cloudTone('SUMMER_EVENING')[2]);
 assert.deepEqual([...cloudTone(undefined)],[1,1,1]);
});
test('only Massacre native map titles disable puddles across RU/EN and battle modes',()=>{
 for(const name of ['Бойня',' БОЙНЯ CTF ','Massacre','Massacre [TDM]','Бойня (DM)'])assert.equal(mapAllowsPuddles(name),false,name);
 for(const name of [undefined,'Rio','Massacre Yard','Моя Бойня','Бойня2'])assert.equal(mapAllowsPuddles(name),true,String(name));
});
test('skybox darkens smoothly with cloud/rain/storm and preserves a zero-uniform native baseline',()=>{
 const clear={clouds:0,rain:0,storm:0},storm={clouds:1,rain:1,storm:1};assert.equal(skyboxDarkness(clear,1),0);assert.equal(skyboxDarkness(storm,0),0);
 const full=skyboxDarkness(storm,1);assert.ok(full>.8&&full<=.85);assert.ok(skyboxDarkness(storm,1,'WINTER_NIGHT')<full);assert.ok(skyboxDarkness(storm,.5)<full);
 const native='uniform samplerCube skyboxTexture;void main(){vec4 color=texture(skyboxTexture,vec3(1.));outColor0 = color;}';
 const result=skyboxShader(native);assert.ok(result.includes('1.-clamp(kiWeatherSky'));assert.equal(skyboxShader(result),result);assert.equal(skyboxShader('unrelated'),'unrelated');
});
test('droplets retain their birth coordinates as the camera moves, expire and stay within the pool budget',()=>{
 const {emitter,data,frame}=simulate(1,{groundSplashDensity:4,splashLifetime:1.5});assert.ok(data.length>0);const point=[...data.slice(-SPLASHES.stride,-SPLASHES.stride+3)];
 const moved=emitter.update({...frame,camera:[5000,5000,300],time:3.01});let preserved=false;
 for(let i=0;i<moved.length;i+=SPLASHES.stride)if(moved[i]===point[0]&&moved[i+1]===point[1]&&moved[i+2]===point[2])preserved=true;
 assert.ok(preserved,'a live droplet keeps its world position after camera movement');
 assert.ok(moved.length/SPLASHES.stride<=SPLASHES.capacity);assert.equal(emitter.update({...frame,map:undefined,time:10}).length,0);
 emitter.clear();assert.equal(emitter.status().particles,0);
});


const appearance=load('appearance');
test('weather palettes default to dark storm and have lighter distinct dry/rain presets',()=>{
 const storm=appearance.weatherPalette(),luma=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;assert.ok(luma(storm.haze)<.15);assert.ok(luma(storm.high)<.25);
 for(const name of ['drizzle','overcast','sunshower','sunny'])assert.ok(luma(appearance.weatherPalette(name).haze)>luma(storm.haze));
 assert.notDeepEqual([...appearance.weatherPalette('sunshower').haze],[...appearance.weatherPalette('drizzle').haze]);
});

test('drop-zone overlay depth is scoped, preserves native depth testing and restores after failure',()=>{
 let depth=true,tests=true;const gl={DEPTH_WRITEMASK:1,isContextLost:()=>false,getParameter:()=>depth,depthMask:v=>{depth=v;}};
 const restore=appearance.suppressOverlayDepth(gl);assert.equal(depth,false);try{throw Error('native');}catch{}finally{restore();}assert.equal(depth,true);assert.equal(tests,true);
 depth=false;assert.equal(appearance.suppressOverlayDepth(gl),undefined);assert.equal(depth,false);
});



















test('native fog suppression affects only the strength of each upload, with no persistent state edits',()=>{
 assert.equal(appearance.suppressNativeFog(.8,0),.8);assert.equal(appearance.suppressNativeFog(.8,1),0);assert.equal(appearance.suppressNativeFog(.8,.5),.4);assert.equal(appearance.suppressNativeFog(0,1),0);
 assert.equal(appearance.suppressNativeFog(.8,-1),.8);assert.equal(appearance.suppressNativeFog(.8,2),0);assert.equal(appearance.suppressNativeFog(.8,NaN),.8);
 const plan=require('../../../src/generated/rain-weather.json').plans.at(-1);assert.equal(plan.scene.capabilities.fogSuppression,true);assert.equal(plan.scene.capabilities.dynamicLights,undefined);assert.equal(plan.scene.capabilities.fogTone,undefined);
 const edits=plan.edits.filter(e=>e.text.startsWith('((_kiFog)=>'));assert.equal(edits.length,3);
 for(const before of edits)for(const observer of ['enabled','absent','error'])for(const nativeFails of [false,true]){
  let argumentsRead=0,called=0;const run=vm.runInNewContext('(function(){return native('+before.text+'next()'+'));})',{window:{__kaspRain:{nativeFogStrength:value=>{if(observer==='error')throw Error('observer');return observer==='enabled'?0:undefined;}}},next:()=>{argumentsRead++;return .7;},native:value=>{called++;assert.equal(value,observer==='enabled'?0:.7);if(nativeFails)throw Error('native');return 47;}});
  if(nativeFails)assert.throws(run,/native/);else assert.equal(run(),47);assert.equal(argumentsRead,1);assert.equal(called,1);
 }
});
