const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {buildSync}=require('esbuild');
const m={exports:{}};vm.runInNewContext(buildSync({entryPoints:['src/core/graphicsPreferences.ts'],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,{module:m,exports:m.exports,structuredClone});
const api=m.exports;
function memory(){const values=new Map(),writes=[];return{values,writes,getItem:k=>values.get(k)??null,setItem(k,v){writes.push(k);values.set(k,v);},removeItem:k=>values.delete(k)};}
test('graphics export/import round-trips all supported controls, flags and uncapped sunlight without unrelated player data',()=>{
 const store=memory();store.setItem('private-account','secret');const p=api.defaultGraphicsProfile();
 for(const c of api.GRAPHICS_CONTROLS)p.settings.tuning[c.key]=c.options?.at(-1)??c.max;
 Object.keys(p.settings.enabled).forEach(k=>p.settings.enabled[k]=true);p.settings.sunIntensity=150;p.settings.surface.edgeInset=75;
 p.settings.generation={chance:0,duration:1,preset:'storm'};p.settings.volumes={rain:0,thunder:.6};
 api.saveGraphicsProfile(p,store);assert.equal(JSON.stringify(api.readGraphicsProfile(store)),JSON.stringify(p));
 const fresh=memory();api.saveGraphicsProfile(api.parseGraphicsProfile(JSON.stringify(p),fresh),fresh);
 assert.equal(JSON.stringify(api.readGraphicsProfile(fresh)),JSON.stringify(p));assert.equal(fresh.getItem('private-account'),null);
 assert.ok(!JSON.stringify(api.readGraphicsProfile(store)).includes('secret'));
});
test('malformed, out of range, fractional geometry and unsupported future files cannot write partial settings',()=>{
 const store=memory(),valid=api.defaultGraphicsProfile();
 const changes=[p=>p.version=2,p=>p.format='other',p=>p.settings.tuning.sunShadow=1023,p=>p.settings.tuning.snowFaces=1.5,
 p=>p.settings.tuning.rainDrops=60001,p=>p.settings.enabled.weather='true',p=>p.settings.sunIntensity=-1,p=>p.settings.generation.preset='__proto__',
 p=>p.settings.surface.splashSize=0,p=>p.settings.volumes.rain=1.1,p=>p.settings.tuning=42];
 for(const edit of changes){const p=JSON.parse(JSON.stringify(valid));edit(p);assert.throws(()=>api.saveGraphicsProfile(p,store));}
 for(const raw of ['{', 'null','[]','x'.repeat(262145)])assert.throws(()=>api.parseGraphicsProfile(raw,store));
 assert.equal(store.writes.length,0);
});
test('partial imports preserve existing preferences and unknown keys never become storage keys',()=>{
 const store=memory(),p=api.defaultGraphicsProfile();p.settings.sunIntensity=40;api.saveGraphicsProfile(p,store);
 const input='{"format":"ki-graphics-settings","version":1,"settings":{"tuning":{"rainDrops":12000,"__proto__":{"polluted":true}},"enabled":{"weather":true,"k_hideNicknameXP":true}}}';
 api.saveGraphicsProfile(api.parseGraphicsProfile(input,store),store);
 const read=api.readGraphicsProfile(store);assert.equal(read.settings.sunIntensity,40);assert.equal(read.settings.tuning.rainDrops,12000);
 assert.equal(read.settings.enabled.weather,true);assert.equal(store.getItem('k_hideNicknameXP'),null);assert.equal({}.polluted,undefined);
});
test('a failed storage write rolls back the already written graphics keys',()=>{
 const store=memory(),initial=api.defaultGraphicsProfile();api.saveGraphicsProfile(initial,store);const original=[...store.values];
 const next=JSON.parse(JSON.stringify(initial));next.settings.enabled.weather=true;next.settings.generation.chance=1;
 const set=store.setItem;let count=0;store.setItem=(k,v)=>{if(++count===2)throw Error('quota');set(k,v);};
 assert.throws(()=>api.saveGraphicsProfile(next,store),/quota/);assert.deepEqual([...store.values],original);
});
test('corrupt legacy tuning uses defaults and native data getters are never executed',()=>{
 const store=memory();store.setItem(api.GRAPHICS_TUNING_KEY,'broken');assert.equal(api.readGraphicsTuning(store).rainDrops,25000);
 const value={};Object.defineProperty(value,'rainDrops',{get(){throw Error('getter');}});
 assert.equal(api.sanitizeGraphicsTuning(value).rainDrops,25000);
 const defaults=api.defaultGraphicsProfile();assert.equal(defaults.settings.tuning.snowFaces,2);assert.equal(defaults.settings.enabled.weather,false);
});

test('warm evening is a valid sunlight-only look, round-trips JSON and original restores neutral colour',()=>{
 const original=api.defaultGraphicsProfile();original.settings.enabled.weather=true;original.settings.tuning.rainDrops=40000;original.settings.surface.edgeInset=100;
 const saved=JSON.stringify(original),warm=api.applySunLook(original,'warm-evening');assert.equal(JSON.stringify(original),saved);
 assert.equal(warm.settings.sunIntensity,8);assert.equal(warm.settings.tuning.sunTemperature,4500);assert.ok(warm.settings.tuning.sunHaze>0);
 assert.equal(warm.settings.enabled.sunlight,false);assert.equal(warm.settings.tuning.rainDrops,40000);assert.equal(warm.settings.surface.edgeInset,100);
 const store=memory();api.saveGraphicsProfile(warm,store);assert.equal(JSON.stringify(api.readGraphicsProfile(store)),JSON.stringify(warm));
 const neutral=api.applySunLook(warm,'original');assert.equal(neutral.settings.sunIntensity,1);
 assert.equal(neutral.settings.tuning.sunBloom,0);assert.equal(neutral.settings.tuning.sunShadowFill,0);assert.equal(neutral.settings.tuning.sunToneCurve,0);assert.equal(neutral.settings.tuning.sunHaze,0);
 const cinematic=api.applySunLook(warm,'cinematic');assert.equal(cinematic.settings.sunIntensity,4);
 for(const c of api.GRAPHICS_CONTROLS)if(c.group==='sun')assert.equal(cinematic.settings.tuning[c.key],c.value);
 api.saveGraphicsProfile(cinematic,store);assert.equal(JSON.stringify(api.readGraphicsProfile(store)),JSON.stringify(cinematic));
 assert.equal(neutral.settings.enabled.weather,true);assert.throws(()=>api.applySunLook(warm,'unknown'));
 const old=JSON.parse(saved);for(const key of ['sunTemperature','sunHaze','sunHazeTemperature','sunHazeStart','sunHazeDistance','sunSkyWarmth','sunExposure','sunContrast','sunSaturation'])delete old.settings.tuning[key];
 const imported=api.parseGraphicsProfile(JSON.stringify(old),memory());assert.equal(imported.settings.tuning.sunHaze,.24);assert.equal(imported.settings.tuning.sunContrast,1.02);assert.equal(imported.settings.tuning.sunTemperature,5200);
});
