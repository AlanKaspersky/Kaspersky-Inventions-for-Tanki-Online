const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict');
const {parse}=require('acorn'),{generate}=require('astring'),{buildSync}=require('esbuild');
const root=path.resolve(__dirname,"../..");
function load(file){const m=new Module(path.join(root,file),module);m.filename=path.join(root,file);m.paths=module.paths;m._compile(buildSync({entryPoints:[path.join(root,file)],bundle:true,format:'cjs',platform:'node',write:false}).outputFiles[0].text,m.filename);return m.exports;}
(async()=>{
 const {selectRainPlan}=load('src/core/rainWeather/patch.ts'),{mergeClientPatchPlans,validatePatchEdits}=load('src/core/clientPatches.ts');
 const source=fs.readFileSync(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root,'main.js'),'utf8').replace(/^\uFEFF/,'');
 const rainPlans=require("../../src/generated/rain-weather.json").plans;
 const rain=await selectRainPlan(source,rainPlans);assert.ok(rain);
 assert.deepEqual(rain.scene?.capabilities,{map:true,lighting:true,tanks:true,environment:true,treeWind:true,skyTone:true,fogSuppression:true,dropZones:true},'Current native weather contracts are incomplete');
 const plans=[];
 for(const file of fs.readdirSync(path.join(root,'src/generated')).filter(n=>n.endsWith('.json')&&n!=='rain-weather.json')){
  const entries=JSON.parse(fs.readFileSync(path.join(root,'src/generated',file),'utf8')).plans;
  if(!Array.isArray(entries))continue;
  const candidate=entries.find(p=>validatePatchEdits(source,p));if(candidate)plans.push(candidate);
 }
 const merged=mergeClientPatchPlans(source,[...plans,rain]);assert.ok(!merged.rejected.includes(rain),'Rain conflicts with an existing prepared patch');
 parse(merged.code,{ecmaVersion:'latest'});
 const compact=generate(parse(source,{ecmaVersion:'latest'}),{indent:'',lineEnd:''});
 const adapted=await selectRainPlan(compact,rainPlans);assert.ok(adapted,'Real compact bundle failed adaptive template selection');
 const result=mergeClientPatchPlans(compact,[adapted]);assert.equal(result.rejected.length,0);parse(result.code,{ecmaVersion:'latest'});
 console.log(JSON.stringify({nativeBundleBytes:source.length,matchingOtherPlans:plans.length,rejectedOtherPlans:merged.rejected.length,rainMerged:true,compactBytes:compact.length,adaptiveRain:true,syntax:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
