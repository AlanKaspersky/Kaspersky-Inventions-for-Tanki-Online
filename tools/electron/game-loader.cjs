// Run against the same Electron executable/gate as the companion client.
// Only local Tanki-shaped fixtures are loaded; the installed profile stays untouched.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const electronPath=process.env.KI_ELECTRON_PATH;
const clientRoot=process.env.KI_CLIENT_ROOT;
if(!electronPath||!clientRoot)throw Error('Set KI_ELECTRON_PATH to electron.exe and KI_CLIENT_ROOT to the client 1.0.8 source checkout');
const {electron}=require('../browser/runtime.cjs');
const out=path.join(root,'artifacts/qa/electron-loader-'+Date.now());fs.mkdirSync(out,{recursive:true});
const gate=path.join(out,'gate.cjs');
buildSync({entryPoints:[path.join(clientRoot,'src/kiGameGate.ts')],bundle:true,platform:'node',format:'cjs',outfile:gate});
const requests=[],report=[];
const source='window.actualStarts=(window.actualStarts||0)+1;';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 res.setHeader('Cache-Control','no-store');
 if(url.pathname==='/service-worker.js'){
  res.setHeader('Content-Type','text/javascript');
  res.end(`self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(!new URL(e.request.url).pathname.includes('/static/js/main.'))return;e.respondWith((async()=>{const cache=await caches.open('ki-electron-loader');${url.searchParams.has('cacheOnly')?'const cached=await cache.match(e.request);if(cached)return cached;':''}try{const response=await fetch(e.request);if(response.ok)await cache.put(e.request,response.clone());return response;}catch(error){const cached=await cache.match(e.request);if(cached)return cached;throw error;}})());});`);return;
 }
 if(url.pathname.includes('/static/js/main.')){
  requests.push({url:req.url,dest:req.headers['sec-fetch-dest']});
  res.setHeader('Content-Type','text/javascript');res.setHeader('Access-Control-Allow-Origin','*');res.end(source);return;
 }
 res.setHeader('Content-Type','text/html');
 const cdn='http://s.eu.tankionline.com:'+server.address().port;
 const mode=url.searchParams.get('mode')||'parser';
 res.end(`<!doctype html><html lang="en"><head><script defer src="${cdn}/static/js/main.${mode}.js"></script></head><body><div id="root"></div></body></html>`);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://game.tankionline.com:'+server.address().port;
 const env={...process.env,KI_QA_PROFILE:path.join(out,'profile'),KI_QA_EXTENSION:root,KI_QA_GATE:gate,KI_QA_ORIGIN:origin};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:electronPath,args:[path.join(__dirname,'loader-app.cjs')],env,timeout:30000});
 app.process().stderr.on('data',chunk=>fs.appendFileSync(path.join(out,'stderr.log'),chunk));
 try{
  for(let i=0;i<100&&!await app.evaluate(()=>!!global.kiReady);i++)await new Promise(r=>setTimeout(r,50));
  assert.ok(await app.evaluate(()=>!!global.kiReady));
  const versions=await app.evaluate(()=>({...process.versions}));
  async function open(mode){
   const pending=app.waitForEvent('window');await app.evaluate(()=>{global.kiWindow=global.createWindow();global.kiWindow.loadURL('about:blank');});const page=await pending;
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.on('console',e=>fs.appendFileSync(path.join(out,'console.log'),e.type()+': '+e.text()+'\n'));
   await page.goto(origin+'/?mode='+mode);await page.waitForTimeout(800);
   return {page,errors};
  }
  async function snapshot(mode,page,errors){
   const result=await page.evaluate(()=>({starts:window.actualStarts,loader:window.__kaspGameLoader?.status(),content:document.documentElement.style.getPropertyValue('--kasp-loader-bg'),rain:!!window.__kaspRain,identity:!!window.__kaspAccountDebug,worker:navigator.serviceWorker.controller?.scriptURL}));
   report.push({mode,...result,errors});console.log(JSON.stringify(report.at(-1)));return result;
  }
  let {page,errors}=await open('without-client-gate');
  const without=await snapshot('without-client-gate',page,errors);assert.equal(without.starts,1);
  assert.equal(without.loader.reason,'network-gate-unavailable');await page.close();
  await app.evaluate(()=>global.installGate());
  ({page,errors}=await open('client-gate'));
  const plain=await snapshot('client-gate',page,errors);assert.equal(plain.starts,1);assert.equal(plain.loader.phase,'running');
  assert.ok(plain.content.includes('chrome-extension://'));assert.ok(plain.rain&&plain.identity);
  await page.evaluate(async()=>{await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  for(const mode of ['worker-cold','worker-warm']){
   await page.goto(origin+'/?mode=worker');await page.waitForTimeout(800);
   const value=await snapshot(mode,page,errors);assert.equal(value.starts,1);assert.equal(value.loader.phase,'running');assert.ok(value.worker);
  }
  // Seed an old raw script, exactly as a pre-upgrade NetworkFirst worker may retain it.
  await page.evaluate(async({url,source})=>{const cache=await caches.open('ki-electron-loader');await cache.put(url,new Response(source,{headers:{'Content-Type':'text/javascript'}}));},{url:'http://s.eu.tankionline.com:'+server.address().port+'/static/js/main.seeded.js',source});
  await page.goto(origin+'/?mode=seeded');await page.waitForTimeout(800);
  const seeded=await snapshot('worker-old-native-cache',page,errors);assert.equal(seeded.starts,1);assert.equal(seeded.loader.phase,'running');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({versions,report,requests,gateCalls:await app.evaluate(()=>global.kiGateCalls)},null,2));
  console.log('Report: '+path.join(out,'result.json'));
 }finally{await app.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);server.closeAllConnections();server.close();process.exitCode=1;});
