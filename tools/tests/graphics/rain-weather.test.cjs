const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {buildSync}=require('esbuild'),{parse}=require('acorn'),{generate}=require('astring'),{webcrypto}=require('node:crypto');
const {analyzeRain}=require("../../ast/rain-weather-ast.cjs");
const compiled=new Map();
function load(name,extra={}){
 if(!compiled.has(name))compiled.set(name,buildSync({entryPoints:['src/core/rainWeather/'+name+'.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text);
 const module={exports:{}};vm.runInNewContext(compiled.get(name),{module,exports:module.exports,console,crypto:webcrypto,TextEncoder,Float32Array,Uint32Array,...extra});return module.exports;
}
const schedule=load('schedule');
const lightning=load('lightning'),audioModel=load('audio');
const preferences=load('preferences');
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('weather volumes preserve zero, validate stored values and default to existing loudness',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null};
 assert.deepEqual({...preferences.readWeatherVolumes(storage)},{rain:1,thunder:1});
 values.set('k_rain_volume','0');values.set('k_thunder_volume','0.25');
 assert.deepEqual({...preferences.readWeatherVolumes(storage)},{rain:0,thunder:.25});
 for(const value of ['','NaN','undefined','Infinity']){values.set('k_rain_volume',value);assert.equal(preferences.readWeatherVolumes(storage).rain,1);}
 values.set('k_rain_volume','5');assert.equal(preferences.readWeatherVolumes(storage).rain,1);
 values.set('k_rain_volume','-3');assert.equal(preferences.readWeatherVolumes(storage).rain,0);
 assert.equal(preferences.readWeatherVolumes({getItem(){throw Error('blocked');}}).rain,1);
});

test('rain and queued thunder have independent live volume buses without resetting intensity or duplicating events',()=>{
 const gains=[],filters=[],sources=[];
 const parameter=()=>({value:1,events:[],setTargetAtTime(...args){this.events.push(args);},cancelScheduledValues(){}});
 const node=()=>({connections:[],connect(target){this.connections.push(target);},disconnect(){}});
 const ctx={sampleRate:1000,currentTime:5,state:'running',destination:{},
  createGain(){const value={...node(),gain:parameter()};gains.push(value);return value;},
  createBufferSource(){const value={...node(),start(){}};sources.push(value);return value;},
  createBiquadFilter(){const value={...node(),frequency:parameter()};filters.push(value);return value;},
  createBuffer(channels,length){const data=Array.from({length:channels},()=>new Float32Array(length));return{getChannelData:i=>data[i]};}};
 const sound=audioModel.createWeatherAudio(ctx,123,{rain:0,thunder:.25});
 assert.equal(gains[2].gain.value,0,'muted rain is silent from its first sample');
 assert.equal(gains[3].gain.value,.25);
 sound.level(.45);assert.equal(gains[1].gain.events.length,1);
 sound.thunder('queued',321,3);assert.equal(filters.at(-1).connections[0],gains[3]);
 sound.volumes({rain:.5,thunder:0});
 assert.equal(gains[2].gain.events.at(-1)[0],.5);assert.equal(gains[3].gain.events.at(-1)[0],0);
 for(let i=0;i<100;i++)sound.volumes({rain:.5,thunder:0});
 assert.equal(gains[2].gain.events.length,1);assert.equal(gains[3].gain.events.length,1);
 assert.equal(gains[1].gain.events.length,1,'volume controls must not reapply weather intensity');
 assert.equal(sound.thunder('queued',321,3),false);
 assert.equal(sound.status().thunders,1);sound.stop();sound.volumes({rain:1,thunder:1});
 assert.equal(gains[2].gain.events.length,1);
});
test('rain is rare, all five presets remain possible, and short battles stay clear',()=>{
 const random=rng(12345),counts={};let wet=0,clear=0;
 for(let i=0;i<20000;i++){const p=schedule.planRain(1000,900,random);counts[p.preset]=(counts[p.preset]||0)+1;if(p.preset&&schedule.RAIN_PRESETS[p.preset].rain>0)wet++;if(p.preset===null)clear++;}
 assert.ok(wet/20000>.22&&wet/20000<.26);assert.ok(clear>11000);
 for(const name of Object.keys(schedule.RAIN_PRESETS))assert.ok(counts[name]>1000);
 assert.equal(schedule.planRain(0,60,()=>0).preset,null);
});
test('one bounded episode has gradual cloud lead-in, rain and clearing, with no second shower',()=>{
 const sequence=[.2,.1,.45,.5,.5,.5];const plan=schedule.planRain(100000,900,()=>sequence.shift()??.5);
 assert.equal(plan.preset,'storm');assert.ok(plan.start>=100000);
 let first=null,last=null,largest=0,prior=0;
 for(let t=plan.start-1000;t<plan.start+600000;t+=100){const s=schedule.sampleRain(plan,t);if(s.rain>0&&first===null)first=t;if(s.rain>0)last=t;largest=Math.max(largest,Math.abs(s.rain-prior));prior=s.rain;}
 assert.ok(largest<.025);assert.ok(first>plan.start+10000);assert.ok(last+30000<100000+900000);
 assert.equal(schedule.sampleRain(plan,plan.start+600000).rain,0);
 assert.equal(schedule.sampleRain(plan,plan.start).clouds,0);
 assert.equal(schedule.sampleRain(plan,plan.start+5000).rain,0);
 assert.ok(schedule.sampleRain(plan,plan.start+5000).clouds>0);
});
test('fog honours both native flags and starts much closer than map fog',()=>{
 const {rainFog}=load('index');const s={settings:'config',fogEnabled:'enabled',mapFog:'map',fogStart:'start',fogEnd:'end',fogColor:'color',red:'r',green:'g',blue:'b',alpha:'a'};
 const native={config:{enabled:true,map:true},start:7500,end:46000,color:{r:.5,g:.6,b:.7,a:.8}};
 const on=rainFog(native,s);assert.equal(on.fog[0],1);assert.ok(on.fog[1]<2000);assert.ok(on.fog[2]<=6000);assert.deepEqual([...on.color],[.5,.6,.7,.8]);
 native.config.enabled=false;assert.equal(rainFog(native,s).fog[0],0);native.config.enabled=true;native.config.map=false;assert.equal(rainFog(native,s).fog[0],0);
});
function runtime(){
 let now=100000,present=true,enabled=true;const timers=new Map(),memory=new Map(),page=new EventTarget();let next=0;
 page.setInterval=cb=>{timers.set(++next,cb);return next;};page.clearInterval=id=>timers.delete(id);page.setTimeout=()=>0;page.clearTimeout=()=>{};
 const document={querySelector:selector=>selector.includes('battleTimer')?{textContent:'10:00'}:present?{}:null};
 const api=load('index',{window:page,EventTarget,Event,document,performance:{now:()=>now},Date:{now:()=>now},
  localStorage:{getItem:()=>enabled?'true':'false'},sessionStorage:{getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)},
  crypto:{getRandomValues:data=>{data[0]=0xffffffff;return data;}}}).installRainWeather(page);
 const schema={gl:'gl',context:'ctx',vp:'vp',camera:'pos',x:'x',y:'y',z:'z'};
 const renderer={gl:{ctx:{isContextLost:()=>false,drawArraysInstanced(){}}}},camera={vp:new Float32Array(16),pos:{x:0,y:0,z:2000}};
 return {api,page,memory,frame:scene=>api.frame(renderer,scene,camera,schema),poll:()=>{for(const cb of timers.values())cb();},
  present:value=>{present=value;},enabled:value=>{enabled=value;},advance:value=>{now+=value;}};
}
test('native battle identity prevents rerolls across settings changes, scene changes and menus',()=>{
 const f=runtime(),s={battleLoaded:'loaded',battleId:'id'},scene={};f.api.battle({loaded:true,id:'battle-1'},s);f.frame(scene);
 const first=JSON.stringify(f.api.status().episode);assert.ok(first.includes('"preset":null'));
 f.enabled(false);f.page.dispatchEvent(new Event('kasp:settings-changed'));f.enabled(true);f.page.dispatchEvent(new Event('kasp:settings-changed'));f.advance(30000);f.frame(scene);
 assert.equal(JSON.stringify(f.api.status().episode),first);
 f.present(false);f.poll();assert.equal(f.api.status().present,false);f.present(true);f.poll();f.api.battle({loaded:true,id:'battle-1'},s);f.frame({});
 assert.equal(JSON.stringify(f.api.status().episode),first);assert.equal(f.api.status().renderers.length,0);
 assert.ok(f.memory.get('ki.rain-episodes.v1').includes('battle-1'));
});
test('feature is off by default and invalid native contracts cannot break game rendering',()=>{
 const f=runtime();f.enabled(false);f.poll();f.frame({});assert.equal(f.api.status().episode,null);assert.equal(f.api.status().audio,'off');
 f.enabled(true);f.poll();assert.doesNotThrow(()=>f.api.frame({},null,null,{}));assert.equal(f.api.status().renderers.length,0);
});

test('forced storm respects the setting and preserves the random episode and session cache',()=>{
 const f=runtime();assert.equal(f.api.force('storm').ok,false);
 f.api.battle({loaded:true,id:'preview-match'},{battleLoaded:'loaded',battleId:'id'});f.frame({});
 const original=JSON.stringify(f.api.status().episode),saved=f.memory.get('ki.rain-episodes.v1');
 assert.equal(f.api.force('storm').ok,true);assert.equal(f.api.status().override.preset,'storm');
 f.advance(25000);assert.equal(f.api.status().weather.rain,1);
 assert.equal(JSON.stringify(f.api.status().episode),original);assert.equal(f.memory.get('ki.rain-episodes.v1'),saved);
 f.api.clearOverride();assert.equal(f.api.status().override,null);assert.equal(f.api.status().weather.rain,0);
 assert.equal(f.api.force('unknown').ok,false);assert.equal(f.api.force('storm',NaN).ok,false);
 f.api.force('storm');f.api.battle({loaded:true,id:'next-match'},{battleLoaded:'loaded',battleId:'id'});assert.equal(f.api.status().override,null);
 f.api.force('storm');f.enabled(false);f.poll();assert.equal(f.api.status().override,null);assert.equal(f.api.force('storm').ok,false);
 f.enabled(true);f.poll();f.api.force('storm');f.present(false);f.poll();assert.equal(f.api.status().override,null);
});

const fixture=`(function(){function Is(t){return t.prototype;}function Enum(n,i){this.k3_1=i;}function R(){}function Cam(){}function Ctx(){}function Sky(){}function Config(){}
let L,S;function init(){S=new Enum('SkyBox',5);L=new Enum('SpritesOnTop',18);}function sky(){return init(),S;}function sprite(){return init(),L;}
Is(R).render=function(t,n){this.y39_1.x3d(32926);this.y39_1.d3f(17664);upload(n.g37_1,0,32);this.inverse=1/(this.b3a_1-this.c3a_1);var background=this.g39_1[sky().k3_1];if(background)do{trace.push('native-sky');}while(false);trace.push('transparent');var list=this.g39_1[sprite().k3_1];trace.push('HUD');};
Is(Cam).view=function(){let a=this.t35_1.f20_1,b=this.t35_1.g20_1,c=this.t35_1.h20_1;let m=[];m[13]=0;m[15]=1;};
Is(Ctx).range=function(t,n){return this.f75_1.depthRange(t,n);};
Is(Sky).color=function(t){t.y39_1.m3f(1,t.d3a_1.l2r_1,t.d3a_1.m2r_1,t.d3a_1.n2r_1,t.d3a_1.o2r_1*this.u62_1);};
Is(Config).get=function(t){var n=t.y38_1,i=t.y38_1.o3o_1&&n.n3o_1;return new Config(1,2,3,4,5,i,7,8,9);};
window.Renderer=R;})();`;
test('AST renders clouds after native sky and before transparency, then rain before HUD',()=>{
 const p=analyzeRain(fixture);assert.equal(p.status.ready,true,p.status.issues.join(','));assert.equal(p.edits.length,2);
 let patched=fixture;for(const e of [...p.edits].reverse())patched=patched.slice(0,e.start)+e.text+patched.slice(e.end);parse(patched,{ecmaVersion:'latest'});
 const trace=[],page={__kaspRain:{frame:(r,t,c,s,stage)=>{assert.equal(s.vp,'g37_1');trace.push(stage);}}};
 vm.runInNewContext(patched,{window:page,trace,upload(){}});const r=new page.Renderer();r.y39_1={x3d(){},d3f(){}};r.g39_1=Array.from({length:26},()=>[]);r.render({},{});
 assert.deepEqual(trace,['native-sky','sky','transparent','weather','HUD']);
 const broken=analyzeRain(fixture.replace("'SpritesOnTop'","'ChangedLayer'"));assert.equal(broken.status.ready,false);assert.equal(broken.edits.length,0);
 const noSky=analyzeRain(fixture.replace("'SkyBox'","'ChangedSky'"));assert.equal(noSky.status.ready,false);assert.equal(noSky.edits.length,0);
});
test('AST template follows renamed native properties and minification',async()=>{
 const plan=analyzeRain(fixture);assert.equal(plan.status.ready,true,plan.status.issues.join(','));
 let changed=fixture;let i=0;for(const property of new Set(Object.values(plan.schema)))changed=changed.replace(new RegExp('\\b'+property+'\\b','g'),'native'+(++i));
 changed=generate(parse(changed,{ecmaVersion:'latest'}),{indent:'',lineEnd:''});
 const {selectRainPlan}=load('patch');const adapted=await selectRainPlan(changed,[plan]);assert.ok(adapted);
 assert.equal(await selectRainPlan(changed,[{...plan,format:'ki-rain-v1'}]),undefined);
 assert.notEqual(adapted.schema.vp,plan.schema.vp);let patched=changed;for(const e of [...adapted.edits].reverse())patched=patched.slice(0,e.start)+e.text+patched.slice(e.end);
 parse(patched,{ecmaVersion:'latest'});assert.equal(patched.includes('__KI_RAIN_SCHEMA__'),false);
});

test('storm onset, hold and clearing never add artificial screen flashes',()=>{
 const plan={version:1,preset:'storm',start:100000,hold:120,seed:19027,fadeIn:24,fadeOut:30};
 for(let ms=0;ms<=180000;ms+=50)assert.equal(schedule.sampleRain(plan,plan.start+ms).flash,0);
});

test('distant lightning is rare, deterministic, and only scheduled inside full storm strength',()=>{
 const plan={version:1,preset:'storm',start:100000,hold:135,seed:19027,fadeIn:24,fadeOut:30},strikes=lightning.stormStrikes(plan);
 assert.ok(strikes.length>=1&&strikes.length<=3);assert.equal(JSON.stringify(lightning.stormStrikes(plan)),JSON.stringify(strikes));
 for(let i=0;i<strikes.length;i++){const s=strikes[i];assert.ok(s.at>plan.start+plan.fadeIn*1000);assert.ok(s.at<plan.start+(plan.fadeIn+plan.hold-8)*1000);assert.ok(s.delay>=2&&s.delay<4);if(i)assert.ok(s.at-strikes[i-1].at>=48000);}
 for(const preset of ['sunshower','drizzle','sunny','overcast',null])assert.equal(lightning.stormStrikes({...plan,preset}).length,0);
 const mesh=lightning.buildBolt(strikes[0],[1000,2000,0]);assert.ok(mesh.length/8>=100&&mesh.length/8<=lightning.LIGHTNING.maxSegments);assert.ok([...mesh].every(Number.isFinite));
 for(let i=0;i<mesh.length;i+=8){assert.ok(mesh[i+2]>=mesh[i+5]);assert.ok(Math.hypot(mesh[i]-1000,mesh[i+1]-2000)>70000);assert.ok(mesh[i+6]>0&&mesh[i+7]>0);}
 assert.deepEqual([...mesh],[...lightning.buildBolt(strikes[0],[1000,2000,0])]);
 assert.equal(lightning.strikeLight(-1).power,0);assert.ok(lightning.strikeLight(.03).power>.5);assert.equal(lightning.strikeLight(1).flash,0);
});

test('stationary rain has stable loudness and thunder has a bounded powerful delayed tail',()=>{
 const rate=16000,bed=audioModel.rainSamples(rate,456),rms=[];
 for(let start=0;start<bed.length;start+=rate/4){let sum=0;for(let i=start;i<start+rate/4;i++)sum+=bed[i]*bed[i];rms.push(Math.sqrt(sum/(rate/4)));}
 assert.ok(Math.max(...rms)/Math.min(...rms)<1.12);assert.ok(Math.abs(rms[0]-.14)<.015);
 const thunder=audioModel.thunderSamples(rate,789);assert.ok([...thunder].every(Number.isFinite));let peak=0,tail=0;for(let i=0;i<thunder.length;i++){peak=Math.max(peak,Math.abs(thunder[i]));if(i>rate*2)tail+=thunder[i]*thunder[i];}
 assert.ok(peak>.6&&peak<=.681);assert.ok(tail>1);assert.ok(Math.abs(thunder[thunder.length-1])<.001);
});
test('removed water, rainbow, birds and global rendering hooks are absent from the feature',()=>{
 const files=['index','schedule','shaders','renderer'].map(n=>fs.readFileSync('src/core/rainWeather/'+n+'.ts','utf8')).join('\n');
 assert.doesNotMatch(files,/puddle|rainbow|bird|waveStrength|sprayP|defineProperty\(Object\.prototype|requestAnimationFrame\s*=/i);
});
