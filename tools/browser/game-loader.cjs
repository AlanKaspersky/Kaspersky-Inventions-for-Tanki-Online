// Real unpacked extension, real parser/network/CSP behavior, no live game/account.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium,browserOptions,root}=require('./runtime.cjs');process.chdir(root);
const report=[],requests=[];
const baseSource='window.actualStarts=(window.actualStarts||0)+1;window.startedFrom=document.currentScript?.src;';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const cdn='http://s.eu.tankionline.com:'+server.address().port;
 if(url.pathname==='/service-worker.js'){
  res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');
  res.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(!new URL(e.request.url).pathname.includes('/static/js/main.'))return;e.respondWith((async()=>{const cache=await caches.open('ki-loader-fixture');try{const response=await fetch(e.request);await cache.put(e.request,response.clone());return response;}catch(error){const stored=await cache.match(e.request);if(stored)return stored;throw error;}})());});`);return;
 }
 if(url.pathname.endsWith('.js')&&url.pathname.includes('/static/js/main.')){
  requests.push({url:req.url,dest:req.headers['sec-fetch-dest']});
  const mode=url.pathname.match(/main\.([\w-]+)\.js/)[1],native=url.searchParams.has('ki_native')&&!req.headers.origin;
  if((mode==='network-error'&&!native)||mode==='native-failure'){res.writeHead(503);res.end('unavailable');return;}
  if(mode==='fetch-timeout'&&!native){req.on('close',()=>res.destroy());return;}
  res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','public,max-age=3600');res.setHeader('Access-Control-Allow-Origin','*');
  if(mode==='body-timeout'&&!native){res.write('/* pending body */');req.on('close',()=>res.destroy());return;}
  res.end(mode==='syntax-error'?'window.actualStarts=;':baseSource+(mode==='runtime-error'?';throw new Error("fixture-runtime-error");':''));return;
 }
 if(url.pathname==='/bootstrap.js'){
  res.setHeader('Content-Type','text/javascript');res.end(`
   const mode=new URLSearchParams(location.search).get('mode');
   if(mode?.includes('timeout')){const timeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===15000?120:ms,...args);}
   if(mode==='missing-injector')delete window.__kaspGameLoader;
   window.nativeLoadEvents=0;
   document.addEventListener('load',e=>{if(e.target instanceof HTMLScriptElement&&/main\\./.test(e.target.src))nativeLoadEvents++;},true);
   if(mode?.startsWith('dynamic')){window.elementLoads=[];const s=document.createElement('script');s.src=${JSON.stringify(cdn)}+'/static/js/main.'+mode+'.js';s.async=mode!=='dynamic-ordered';s.onload=()=>window.elementLoads.push(window.actualStarts||0);document.head.appendChild(s);if(mode==='dynamic-duplicate'){const t=document.createElement('script');t.src=s.src;document.head.appendChild(t);}}
  `);return;
 }
 const mode=url.searchParams.get('mode')||'parser';
 res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 const policy="script-src 'self' "+cdn;
 res.setHeader('Content-Security-Policy',policy+(mode==='csp-block'?'':mode==='nonce'?" 'nonce-fixture'":" 'unsafe-inline'"));
 const scriptMode=mode==='cache-warm'?'cache':mode;
 const attrs=mode==='parser-async'?'async':mode==='parser-blocking'?'':'defer';
 const type=mode==='module'?'type="module"':'';
 const src=cdn+'/static/js/main.'+scriptMode+'.js'+(mode==='query-native'?'?v=1':'');
 const integrity=mode==='integrity'?'crossorigin="anonymous" integrity="sha256-'+createHash('sha256').update(baseSource).digest('base64')+'"':'';
 res.end('<!doctype html><html><head><script src="/bootstrap.js"></script>'+(mode.startsWith('dynamic')?'':`<script ${attrs} ${type} ${integrity} ${mode==='nonce'?'nonce="fixture"':''} src="${src}"></script>`)+'</head><body><div id="root"></div></body></html>');
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const profile=path.resolve('artifacts/qa/loader-browser-'+Date.now());fs.mkdirSync(profile,{recursive:true});
 const context=await chromium.launchPersistentContext(profile,{...browserOptions,args:[`--disable-extensions-except=${root}`,`--load-extension=${root}`,'--host-resolver-rules=MAP s.eu.tankionline.com 127.0.0.1, MAP game.tankionline.com 127.0.0.1','--no-proxy-server',`--unsafely-treat-insecure-origin-as-secure=http://game.tankionline.com:${server.address().port}`]});
 try{
  if(process.env.KI_LOADER_WORKER_PROBE){
   const page=await context.newPage();await page.goto('http://game.tankionline.com:'+server.address().port+'/?mode=parser');
   await page.evaluate(async()=>{await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));});
   await page.reload();await page.waitForFunction(()=>window.actualStarts===1);await page.waitForTimeout(200);
   console.log(JSON.stringify(await page.evaluate(()=>({controller:navigator.serviceWorker.controller?.scriptURL,loader:window.__kaspGameLoader?.status()}))));console.log(JSON.stringify(requests));return;
  }
  for(const mode of ['parser','parser-async','parser-blocking','dynamic','dynamic-ordered','dynamic-duplicate','cache','cache-warm','query-native','module','csp-block','nonce','network-error','fetch-timeout','body-timeout','runtime-error','missing-injector','integrity','native-failure','syntax-error']){
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://game.tankionline.com:'+server.address().port+'/?mode='+mode);
   try {
    if(['native-failure','syntax-error'].includes(mode))await page.waitForFunction(mode=>{const s=window.__kaspGameLoader?.status();return s?.phase==='failed'||mode==='syntax-error'&&s?.phase==='native'&&s.completed;},mode,{timeout:20000});
    else await page.waitForFunction(()=>window.actualStarts===1,{},{timeout:20000});
   } catch(error) {console.error(mode,await page.evaluate(()=>({status:window.__kaspGameLoader?.status(),starts:window.actualStarts,scripts:[...document.scripts].map(s=>({src:s.src,integrity:s.integrity,crossOrigin:s.crossOrigin}))})));throw error;}
   await page.waitForTimeout(220);
   const value=await page.evaluate(()=>({starts:window.actualStarts,status:window.__kaspGameLoader?.status(),loadEvents:window.nativeLoadEvents,elementLoads:window.elementLoads}));
   assert.equal(value.starts||0,['native-failure','syntax-error'].includes(mode)?0:1,mode);
   if(mode==='runtime-error'){assert.equal(value.status.phase,'failed');assert.equal(value.status.nativeFallback,false);assert.ok(errors.some(e=>e.includes('fixture-runtime-error')));}
   else if(mode==='missing-injector'){assert.equal(value.status,undefined);}
   else if(mode==='native-failure'){assert.equal(value.status.phase,'failed');assert.equal(value.status.nativeFallback,true);}
   // Native cross-origin classic scripts without crossorigin can report opaque
   // errors. Their load event is not evidence of successful game execution.
   else if(mode==='syntax-error'){assert.ok(['failed','native'].includes(value.status.phase));assert.equal(value.status.nativeFallback,true);assert.ok(errors.length>=1);}
   else if(['query-native','module','csp-block','network-error','fetch-timeout','body-timeout','integrity'].includes(mode)){assert.equal(value.status.phase,'native',JSON.stringify({mode,...value}));}
   else {assert.equal(value.status.phase,'running',JSON.stringify({mode,...value}));assert.equal(value.status.nativeFallback,false);}
   if(!['runtime-error','syntax-error'].includes(mode))assert.deepEqual(errors,[],mode);
   if(mode.startsWith('dynamic'))assert.deepEqual(value.elementLoads,[1],mode+' must forward completion after the game starts');
   report.push({mode,...value,errors});console.log(JSON.stringify(report.at(-1)));await page.close();
  }
  const workerPage=await context.newPage();
  await workerPage.goto('http://game.tankionline.com:'+server.address().port+'/?mode=parser');
  await workerPage.evaluate(async({url,source})=>{
   await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
   const cache=await caches.open('ki-loader-fixture');await cache.put(url,new Response(source,{headers:{'Content-Type':'text/javascript'}}));
  },{url:'http://s.eu.tankionline.com:'+server.address().port+'/static/js/main.worker-cold.js',source:baseSource});
  for(const mode of ['worker-cold','worker-warm']){
   if(mode==='worker-cold')await workerPage.goto('http://game.tankionline.com:'+server.address().port+'/?mode=worker-cold');else await workerPage.reload();
   await workerPage.waitForFunction(()=>window.actualStarts===1&&window.__kaspGameLoader?.status().phase==='running');
   const value=await workerPage.evaluate(()=>({starts:window.actualStarts,status:window.__kaspGameLoader.status(),controller:navigator.serviceWorker.controller?.scriptURL}));
   assert.ok(value.controller);assert.equal(value.status.nativeFallback,false);report.push({mode,...value});console.log(JSON.stringify(report.at(-1)));
  }await workerPage.close();
  assert.equal(requests.filter(r=>r.url==='/static/js/main.cache.js?ki_native=1').length,1,'warm-cache page must reuse the cached source');
  assert.equal(requests.filter(r=>r.url==='/static/js/main.dynamic-duplicate.js?ki_native=1').length,1,'duplicate gate tags must fetch game code once');
  assert.equal(requests.filter(r=>r.url==='/static/js/main.worker-cold.js?ki_native=1').length,1,'warm worker must reuse raw source without redirecting it');
  const invalidRequests=requests.filter(r=>r.url.startsWith('/static/js/main.syntax-error.js')).length;
  assert.ok(invalidRequests>=1&&invalidRequests<=2,'invalid source may reuse HTTP cache, but must not cause a recovery loop');
  fs.writeFileSync('artifacts/qa/game-loader-browser.json',JSON.stringify({report,requests},null,2));
 }finally{await context.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
