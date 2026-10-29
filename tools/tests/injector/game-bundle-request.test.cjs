const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test'),{transformSync}=require('esbuild');
const code=transformSync(fs.readFileSync('src/core/gameBundleRequest.ts','utf8'),{loader:'ts',format:'cjs'}).code;
function fixture(fetch) {
 const module={exports:{}},timers=new Map();let id=0;
 vm.runInNewContext(code,{module,fetch,AbortController,setTimeout(callback,ms){timers.set(++id,{callback,ms});return id;},clearTimeout(id){timers.delete(id);}});
 return {read:module.exports.readGameBundle,timers,expire(){for(const {callback} of timers.values())callback();}};
}
test('successful text reads preserve the source and release the default deadline',async()=>{
 let options;const f=fixture(async(url,init)=>{assert.equal(url,'https://game/main.js');options=init;return{ok:true,text:async()=> '"use strict";window.game=1;'};});
 const read=f.read('https://game/main.js');assert.equal([...f.timers.values()][0].ms,15000);
 assert.equal(await read,'"use strict";window.game=1;');assert.equal(f.timers.size,0);assert.equal(options.signal.aborted,false);
});
test('HTTP errors never read the body, and rejected or empty bodies clean their timers',async()=>{
 let reads=0;for(const response of [{ok:false,status:503,text:async()=>{reads++;return 'html';}},{ok:true,text:async()=>{throw Error('body failed');}},{ok:true,text:async()=> '  '}]){
  const f=fixture(async()=>response);await assert.rejects(f.read('/main.js'),/HTTP 503|body failed|response is empty/);assert.equal(f.timers.size,0);
 }assert.equal(reads,0);
 const f=fixture(()=>{throw Error('offline')});await assert.rejects(f.read('/main.js'),/offline/);assert.equal(f.timers.size,0);
});
test('timeout settles even when fetch ignores abort, and also bounds a pending response body',async()=>{
 for(const body of [false,true]){
  let resolve,signal;const pending=new Promise(done=>resolve=done);const f=fixture((_url,options)=>{signal=options.signal;return body?Promise.resolve({ok:true,text:()=>pending}):pending;});
  const read=f.read('/main.js',35);const rejected=assert.rejects(read,/timed out/);f.expire();await rejected;
  assert.equal(signal.aborted,true);assert.equal(f.timers.size,0);resolve(body?'late':{ok:true,text:async()=> 'late'});await Promise.resolve();
 }
});
