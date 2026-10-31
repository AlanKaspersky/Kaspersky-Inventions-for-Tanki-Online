const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {buildSync}=require('esbuild');
function load(path){const module={exports:{}};vm.runInNewContext(buildSync({entryPoints:[path],bundle:true,platform:'node',format:'cjs',write:false}).outputFiles[0].text,{module,exports:module.exports});return module.exports;}
const snow=load('src/core/snowWeather/index.ts'),schedule=load('src/core/rainWeather/schedule.ts');
const preferences=load('src/core/rainWeather/preferences.ts'),lightning=load('src/core/rainWeather/lightning.ts');

test('snow owns five presets with distinct snowfall and blizzard profiles',()=>{
 assert.deepEqual(Object.keys(snow.SNOW_PRESETS).sort(),['drizzle','overcast','storm','sunny','sunshower']);
 assert.equal(snow.SNOW_PRESETS.sunny.rain,0);assert.equal(snow.SNOW_PRESETS.overcast.rain,0);
 assert.ok(snow.SNOW_PRESETS.drizzle.rain<snow.SNOW_PRESETS.sunshower.rain);
 assert.ok(snow.SNOW_PRESETS.sunshower.rain<snow.SNOW_PRESETS.storm.rain);
 for(const p of Object.values(snow.SNOW_PRESETS))assert.equal(p.sound,0);
 assert.equal(snow.SNOW.maxFlakes,20000);
});

test('legacy manual precipitation preferences cannot override map weather',()=>{
 for(const value of [null,'','rain','SNOW','unknown','__proto__'])assert.equal(preferences.readWeatherGeneration({getItem:key=>key==='k_weather_precipitation'?value:null}).precipitation,'rain');
 assert.equal(preferences.readWeatherGeneration({getItem:key=>key==='k_weather_precipitation'?'snow':null}).precipitation,'rain');
 assert.equal(preferences.readWeatherGeneration({getItem(){throw Error('blocked');}}).precipitation,'rain');
});

test('all snow presets use the shared duration, cache and transition contract',()=>{
 for(const preset of Object.keys(snow.SNOW_PRESETS)){
  const p=schedule.planRain(5000,600,()=>.5,{chance:1,duration:.5,preset,precipitation:'snow'});
  assert.equal(p.precipitation,'snow');assert.equal(p.preset,preset);assert.equal(schedule.validEpisode(JSON.parse(JSON.stringify(p))),true);
  assert.equal(p.fadeIn+p.hold+p.fadeOut,300);
  assert.equal(schedule.sampleRain(p,p.start-1).rain,0);
  const peak=schedule.sampleRain(p,p.start+60000);
  assert.equal(peak.rain,snow.SNOW_PRESETS[preset].rain);assert.equal(peak.sound,0);
  assert.equal(schedule.sampleRain(p,p.start+300001).finished,true);
  assert.deepEqual([...lightning.stormStrikes(p)],[]);
 }
 const p=schedule.planRain(0,600,()=>.5,{chance:1,duration:1,preset:'storm',precipitation:'snow'});
 assert.equal(schedule.sampleRain(p,3600000).rain,1);assert.equal(schedule.sampleRain(p,3600000).finished,false);
 assert.equal(schedule.planRain(0,600,()=>0,{chance:0,duration:1,preset:'storm',precipitation:'snow'}).preset,null);
 assert.equal(schedule.planRain(0,600,()=>0,{chance:1,duration:0,preset:'storm',precipitation:'snow'}).preset,null);
 assert.equal(schedule.validEpisode({...p,precipitation:'hail'}),false);
 const legacy={...p};delete legacy.precipitation;assert.equal(schedule.validEpisode(legacy),true);
});

test('random snow selects only the three snowy presets without changing legacy rain profiles',()=>{
 const found=new Set();let seed=1234;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1000;i++){
  const p=schedule.planRain(0,600,random,{chance:1,duration:.5,preset:'random',precipitation:'snow'});
  assert.ok(snow.SNOW_PRESETS[p.preset].rain>0);found.add(p.preset);
 }
 assert.equal(found.size,3);
 assert.equal(schedule.weatherProfile('sunshower','rain').rain,.45);
 assert.equal(schedule.weatherProfile('sunshower','snow').rain,.5);
});

const environment=load('src/core/rainWeather/environment.ts');
test('native themes select precipitation and an absent lobby theme does not block ordinary maps',()=>{
 for(const theme of ['SUMMER_DAY','SUMMER_NIGHT','SUMMER_EVENING','AUTUMN_DAY']){assert.equal(environment.mapWeather(theme,'Rio'),'rain');assert.equal(environment.mapWeather(theme,'Бойня CTF'),null);assert.equal(environment.mapWeather(theme,undefined),undefined);}
 for(const theme of ['WINTER_DAY','WINTER_NIGHT'])assert.equal(environment.mapWeather(theme,'Rio'),'snow');
 assert.equal(environment.mapWeather('SPACE','Rio'),null);assert.equal(environment.mapWeather(undefined,'Rio'),'rain');
});


test('production bundles cannot include archived snowbanks or developer controls',()=>{
 const result=buildSync({entryPoints:['src/kasp_main.ts','src/kasp_injector.ts'],bundle:true,format:'iife',outdir:'unused',write:false,metafile:true});
 for(const path of Object.keys(result.metafile.inputs))assert.doesNotMatch(path,/archive\/|snowWeather\/(?:drifts|tuning|developerPanel)/);
 for(const output of result.outputFiles)assert.doesNotMatch(output.text,/__kaspSnow|ki-snow-developer|k_snow_drifts|ki\.snow-tuning|k_weather_precipitation/);
 const archived='archive/snowdrifts-and-snow-tuner-2026-10-27/';
 for(const file of ['src/core/snowWeather/drifts/index.ts','src/core/snowWeather/developerPanel.ts','src/core/snowWeather/tuning.ts','tools/tests/graphics/snow-drifts.test.cjs','tools/tests/graphics/snow-tuning.test.cjs'])assert.ok(require('node:fs').existsSync(archived+file),file+' must be recoverable');
});


test('every shipped native-bundle plan omits the archived chassis observer',()=>{
 const plans=require('../../../src/generated/rain-weather.json').plans;assert.ok(plans.length>=1);
 for(const plan of plans){assert.equal(plan.status.ready,true);assert.equal(plan.edits.length,29);assert.equal(plan.templates.length,59);assert.equal(plan.scene.capabilities.terrainSeason,true);assert.doesNotMatch(JSON.stringify(plan),/__kaspRain\?\.chassis|_kiChassis|chassisComponentClass|chassisEnum/);}
});


test('only the native map title fallback is classified, with exact seasonal words and native-theme priority',()=>{
 assert.equal(environment.mapWeather(undefined,'Year 2042 RGB'),'rain');assert.equal(environment.mapWeather(undefined,undefined),undefined);
 for(const name of ['Space RGB','Космос CTF'])assert.equal(environment.mapWeather(undefined,name),null);
 for(const name of ['Sandbox Winter CTF','Песочница (Зима) CTF','Snow REMASTER DM'])assert.equal(environment.mapWeather(undefined,name),'snow');
 assert.equal(environment.mapWeather('SUMMER_DAY','Sandbox Winter CTF'),'rain');assert.equal(environment.mapWeather(undefined,'Spaceport CTF'),'rain');
});

test('actual snowy terrain identifies winter MM variants without changing summer or space policy',()=>{
 for(const name of ['Йоркшир SGE','Yorkshire CTF','Rio']){
  assert.equal(environment.mapWeather(undefined,name,true),'snow');assert.equal(environment.mapWeather(undefined,name,false),'rain');
  assert.equal(environment.mapWeather('SUMMER_DAY',name,true),'rain');assert.equal(environment.mapWeather('SPACE',name,true),null);
 }
 assert.equal(environment.mapWeather(undefined,'Space RGB',true),null);assert.equal(environment.mapWeather(undefined,'Космос CTF',true),null);
 assert.equal(environment.mapWeather(undefined,'Yorkshire',1),'rain');assert.equal(environment.mapWeather(undefined,undefined,true),undefined);
});
