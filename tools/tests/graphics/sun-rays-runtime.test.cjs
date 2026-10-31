const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {build}=require('esbuild');
const compiled=build({entryPoints:['src/core/rainWeather/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,plugins:[{name:'native-gpu-fixture',setup(build){
 build.onLoad({filter:/rainWeather[\\/]renderer\.ts$/},()=>({loader:'ts',contents:`export function createRainRenderer(){return{drawSun(f){window.draws.push(f);},dispose(){window.releases++;},clearReflections(){},warm(){},draw(){throw Error('Weather should remain off');},status(){return{sunError:null,sunSkip:null,sunlight:{frames:window.draws.length}}}};}`}));
}}]}).then(result=>result.outputFiles[0].text);
test('existing native hooks drive independent sunlight with weather off and release it for garage/unload',async()=>{
 const code=await compiled;
 let now=1000,garage=false;const prefs=new Map([['k_sun_rays','true']]),timers=[],page=new EventTarget();
 page.draws=[];page.releases=0;page.setInterval=fn=>{timers.push(fn);return timers.length;};page.setTimeout=()=>0;page.clearInterval=()=>{};page.clearTimeout=()=>{};
 const globals={window:page,console,Event,Float32Array,Uint32Array,performance:{now:()=>now},Date:{now:()=>now},
  document:{querySelector:selector=>selector.includes('GarageCommonStyle-garageContainer')?(garage?{}:null):selector.includes('battleTimer')?{textContent:'10:00'}:{}},
  localStorage:{getItem:key=>prefs.get(key)??null,setItem:(key,value)=>prefs.set(key,value)},sessionStorage:{getItem:()=>null,setItem(){}},crypto:{getRandomValues:data=>data.fill(1)}};
 const module={exports:{}};vm.runInNewContext(code,{...globals,module,exports:module.exports});const api=module.exports.installRainWeather(page);
 const schema={boxes:'boxes',planes:'planes',triangles:'triangles',trianglePosition:'p',triangleRotation:'r',v0:'a',v1:'b',v2:'c',x:'x',y:'y',z:'z'};
 const vec=(x=0,y=0,z=0)=>({x,y,z});
 api.map({boxes:[],planes:[],triangles:[{p:vec(),r:vec(),a:vec(-1000,-1000),b:vec(1000,-1000),c:vec(0,1000)}]},schema);
 api.environment('day','SUMMER_DAY');api.battle({loaded:true,id:'day',name:'Rio'},{battleLoaded:'loaded',battleId:'id',mapName:'name'});
 const light=new Float32Array([.2,.2,.2,0,1,.9,.8,0,-.2,-.5,-.8,0]),original=light.slice();api.lighting(light);
 assert.deepEqual(light,original,'sun observer cannot rewrite native lighting');
 const gl={drawArraysInstanced(){},isContextLost:()=>false},renderer={gl:{context:gl}},camera={vp:new Float32Array(16),position:vec(0,0,1000)},s={gl:'gl',context:'context',vp:'vp',camera:'position',x:'x',y:'y',z:'z'},scene={};
 api.frame(renderer,scene,camera,s,'sky');assert.equal(page.draws.length,0);
 api.frame(renderer,scene,camera,s,'weather');now+=2500;api.frame(renderer,scene,camera,s,'weather');
 assert.equal(page.draws.length,2);assert.equal(page.draws.at(-1).fade,1);assert.equal(page.draws.at(-1).map.supportVertices.length,9);
 assert.equal(api.status().episode,null);assert.equal(api.status().audio,'off');assert.equal(api.nativeFogStrength(1),1);
 garage=true;api.frame(renderer,scene,camera,s,'weather');assert.equal(page.draws.length,2);assert.ok(page.releases>0);
 garage=false;api.frame(renderer,scene,camera,s,'weather');assert.equal(page.draws.length,3);
 api.environment('day','SPACE');api.frame(renderer,scene,camera,s,'weather');assert.equal(page.draws.length,3);assert.equal(page.__kaspSunRays.status().reason,'night-or-space');
 api.environment('day','SUMMER_DAY');api.battle({loaded:false},{battleLoaded:'loaded'});api.frame(renderer,scene,camera,s,'weather');assert.equal(page.draws.length,3);
 page.__kaspSunRays.setEnabled(false);assert.equal(page.__kaspSunRays.status().renderers.length,0);
});
