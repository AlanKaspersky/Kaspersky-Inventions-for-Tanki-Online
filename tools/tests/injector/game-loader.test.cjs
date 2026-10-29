const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {buildSync}=require('esbuild');
const code=buildSync({entryPoints:['src/core/gameLoader.ts'],bundle:true,format:'cjs',write:false}).outputFiles[0].text;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(prepare=async source=>source,source='window.starts=(window.starts||0)+1;',options={}){
 const timers=new Map(),appended=[],listeners=new Map(),events=[],fetched=[];let id=0;
 class Script{
  constructor(){this.src='';this.type='';this.nonce='';this.async=false;this.attributes=[];this.listeners=new Map();}
  setAttribute(name,value){this[name]=value;this.attributes.push({name,value});}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  dispatchEvent(event){events.push(event.type);this.listeners.get(event.type)?.(event);return true;}
 }
 const page={document:{createElement:()=>new Script(),addEventListener(){}},addEventListener:(type,fn)=>listeners.set(type,fn),
  setTimeout:(fn,ms)=>{timers.set(++id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)};
 const context=vm.createContext({module:{exports:{}},window:page,HTMLScriptElement:Script,URL,AbortController,
  Event:class{constructor(type){this.type=type;}},console:{error(){},warn(){}},
  setTimeout:page.setTimeout,clearTimeout:page.clearTimeout,
  fetch:async url=>{fetched.push(url);return {ok:true,text:async()=>source};}});
 page.document.head=page.document.documentElement={appendChild(script){
  if(options.nativeInsertError&&script.src)throw Error('native insert');
  appended.push(script);if(!script.src&&!options.blockInline){try{vm.runInContext(script.textContent,context);}catch(error){const filename=script.textContent.match(/sourceURL=(.+)$/)?.[1];listeners.get('error')?.({filename,error});}}
  return script;
 }};
 vm.runInContext(code,context);const {installGameLoader}=context.module.exports;
 const loader=installGameLoader(page,prepare),script=new Script();script.src='https://s.eu.tankionline.com/static/js/main.fixture.js';script.setAttribute('nonce','native-nonce');
 return {loader,page,script,appended,events,timers,fetched,install:()=>installGameLoader(page,prepare),expire(){for(const {fn} of [...timers.values()])fn();}};
}
test('one controlled execution, strict mode and duplicate installer/load calls',async()=>{
 const f=fixture(undefined,'"use strict";window.starts=(window.starts||0)+1;window.strict=(function(){return this===undefined})();');
 assert.equal(f.install(),f.loader);f.loader.load(f.script);f.loader.load(f.script);await tick();
 assert.equal(f.page.starts,1);assert.equal(f.page.strict,true);assert.equal(f.loader.status().phase,'running');assert.equal(f.appended.length,1);assert.deepEqual(f.events,['load']);assert.equal(f.timers.size,0);
 assert.deepEqual(f.fetched,[f.script.src+'?ki_native=1']);
 f.loader.load(f.script);await tick();assert.equal(f.page.starts,1);
});
test('a partial execution error never launches the original again',async()=>{
 const f=fixture(undefined,'window.starts=(window.starts||0)+1;throw Error("partial");');f.loader.load(f.script);await tick();
 assert.equal(f.page.starts,1);assert.equal(f.loader.status().phase,'failed');assert.equal(f.loader.status().nativeFallback,false);assert.equal(f.appended.length,1);assert.deepEqual(f.events,['error']);
});
test('different gate tags share one game execution and each receive one completion',async()=>{
 const f=fixture(),other=new f.script.constructor();other.src=f.script.src;
 f.loader.load(f.script);f.loader.load(other);await tick();
 assert.equal(f.page.starts,1);assert.equal(f.appended.length,1);assert.deepEqual(f.events,['load','load']);
 f.loader.load(f.script);await tick();assert.equal(f.events.length,2);
});
test('preparation rejection, blocked inline and native insertion failures have one bounded fallback',async()=>{
 for(const mode of ['prepare','empty','blocked','insert']){
  const f=fixture(mode==='prepare'?async()=>{throw Error('prepare');}:mode==='empty'?async()=> '':undefined,undefined,{blockInline:mode==='blocked'||mode==='insert',nativeInsertError:mode==='insert'});
  f.loader.load(f.script);await tick();assert.equal(f.loader.status().nativeFallback,true);assert.equal(f.timers.size,0);
  assert.equal(f.loader.status().phase,mode==='insert'?'failed':'native');
  assert.ok(f.appended.filter(s=>s.src).length<=1);assert.equal(f.page.starts,undefined);f.loader.load(f.script);await tick();assert.ok(f.appended.filter(s=>s.src).length<=1);
 }
});
test('a stalled preparation is aborted; resolving it later cannot execute a second client',async()=>{
 let resolve,signal;const f=fixture((_source,s)=>{signal=s;return new Promise(done=>resolve=done);});
 f.loader.load(f.script);await tick();assert.equal(f.loader.status().phase,'preparing');f.expire();await tick();
 assert.equal(signal.aborted,true);assert.equal(f.loader.status().phase,'native');assert.equal(f.appended.length,1);
 resolve('window.starts=99;');await tick();assert.equal(f.page.starts,undefined);assert.equal(f.appended.length,1);assert.equal(f.timers.size,0);
});
test('module and integrity contracts use a query bypass with original attributes and no fetch preparation',async()=>{
 for(const key of ['type','integrity']){
  let calls=0;const f=fixture(async s=>{calls++;return s;});f.script.setAttribute(key,key==='type'?'module':'sha256-original');f.loader.load(f.script);await tick();
  const native=f.appended[0];assert.equal(calls,0);assert.equal(f.loader.status().phase,'native');assert.equal(native.src,f.script.src+'?ki_native=1');assert.equal(native.nonce,'native-nonce');assert.equal(native[key],f.script[key]);
  native.listeners.get('error')();assert.equal(f.loader.status().phase,'failed');f.loader.load(f.script);assert.equal(f.appended.length,1);
 }
});
test('network rules cover script and worker fetches only at the main URL; source/recovery bypass cannot redirect',()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.json')),rules=JSON.parse(fs.readFileSync('rules/game-bundle.json'));
 assert.ok(manifest.permissions.includes('declarativeNetRequestWithHostAccess'));assert.equal(rules.length,1);
 assert.ok(manifest.declarative_net_request.rule_resources.some(r=>r.enabled&&r.path==='rules/game-bundle.json'));
 assert.ok(manifest.web_accessible_resources.some(r=>r.resources.includes('dist/kasp_game_gate.js')));
 const rule=rules[0],pattern=new RegExp(rule.condition.regexFilter);assert.deepEqual(rule.condition.resourceTypes,['script','xmlhttprequest']);assert.deepEqual(rule.condition.initiatorDomains,['tankionline.com']);assert.ok(rule.condition.requestDomains.includes('s.eu.tankionline.com'));
 for(const url of ['https://s.eu.tankionline.com/static/js/main.289a5d50.js','https://public-deploy3.test-eu.tankionline.com/browser-public/static/js/main.test.js'])assert.ok(pattern.test(url));
 for(const url of ['https://other.example/static/js/main.x.js','https://s.eu.tankionline.com/static/js/vendor.x.js','https://s.eu.tankionline.com/static/js/main.x.js?ki_native=1'])assert.equal(pattern.test(url),false);
 assert.ok(fs.readFileSync('tools/build/build-release.js','utf8').includes("'rules'"));
});
