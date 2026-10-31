const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {buildSync}=require('esbuild');
const {chromium,browserOptions,root}=require('./runtime.cjs');
const prefix='BattleTabStatisticComponentStyle-';
const label=(type,n)=>`<div class="${prefix}defenceLabel"><div style="background:#bfd5ff;mask-image:url('/${type}_resistance.svg')"></div><h3>${n}</h3></div>`;
const row=(n)=>`<tr class="${prefix}${n===0?'selectedRowBackGround':'rowBackGround'}"><td class="${prefix}nicknameCell"><div><img src="/rank.svg"><div><span>${n===0?'PrivatePlayer':'Player '+n}</span></div></div></td><td class="${prefix}resistanceModuleCell">${label('smoky',50)+label('freeze',30)+label('all',40)+label('crit',20)}</td><td class="${prefix}gsCell"><span class="${n===1?'GearScoreStyle-bestGS':'GearScoreStyle-gs_9001_9998'}">${n===1?'9 999':'9 500'}</span></td><td class="${prefix}deviceCell"><div class="${prefix}commonBlock"><div></div></div></td><td class="${prefix}defenceCell"><div class="${prefix}commonBlock"><div></div></div></td><td class="${prefix}scoreCell"><span>123</span></td><td class="${prefix}dlCell"><span>4/2</span></td><td class="kasp-change-td"></td></tr>`;
const team=(name)=>`<div class="${prefix}${name}TeamTableContainer"><table><thead class="TableComponentStyle-thead"><tr><th><h2>Nickname</h2></th><th><span>GS</span></th><th class="kasp-defence-th"><img class="kasp-shield-img" src="/assets/modulesTAB.svg"></th><th>W</th><th>H</th><th>S</th><th>K/D</th><th class="kasp-change-th"></th></tr></thead><tbody>${[0,1,2].map(row).join('')}</tbody></table></div>`;
const markup=`<div class="${prefix}container"><div class="${prefix}containerInsideTeams"><div class="${prefix}header"><span class="${prefix}battleName">Map CTF</span></div><div class="${prefix}commonBlockScroll"><div class="${prefix}tablesContainer">${team('blue')+team('red')}</div></div><div class="-flexCenterAlignCenter"><div id="kasp-enemy-weapons-btn"><div class="kasp-toggle-icon"></div></div></div></div></div>`;
const native=`html{font-size:14px}body{margin:0;min-height:100vh;background:repeating-linear-gradient(35deg,#686868 0 12px,#242b38 12px 24px);color:white}body span{color:white;font-size:1em}.${prefix}container{position:fixed;inset:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.${prefix}containerInsideTeams,.${prefix}containerInsideResults{position:relative;display:flex;flex-direction:column;align-items:center}.${prefix}header{display:flex;width:100%;align-items:center}.${prefix}commonBlockScroll{overflow:auto;width:100%}.${prefix}tablesContainer{display:flex;width:100%}table{border-spacing:0}thead tr{display:flex;align-items:center}td,th{padding:0}th h2{font-size:.875em}tbody tr{background:var(--row-background-color)}.${prefix}defenceLabel{display:flex;align-items:center}.${prefix}defenceLabel div{width:1em;height:1em;mask-size:contain;mask-repeat:no-repeat}.${prefix}defenceLabel h3{font-size:1em;margin:0}.${prefix}commonBlock div{background:#bfd5ff;width:1em;height:1em;mask:url('/weapon.svg') center/contain no-repeat}.GearScoreStyle-gs_9001_9998{color:rgb(255,0,0);text-shadow:red 0 0 8px}.GearScoreStyle-bestGS{background-image:linear-gradient(to left,rgb(40,255,203),rgb(255,235,51));background-clip:text;-webkit-text-fill-color:transparent;color:rgb(255,235,51)}.-flexCenterAlignCenter{display:flex;align-items:center;justify-content:center}`;
const styles=['styles/battleStats.css','styles/hideNickname.css','styles/overdriveTimer.css'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n').split('chrome-extension://__MSG_@@extension_id__/').join('/');
const bundle=buildSync({stdin:{contents:`import {featureScope} from './src/core/featureRuntime';import {zeroResists} from './src/modules/zeroResists';import {overdriveTimer} from './src/modules/overdriveTimer';import {BONUS_PICKUP_MESSAGE,OVERDRIVE_BOX_MODEL} from './src/core/bonusPickup';overdriveTimer.setup();window.postMessage({type:BONUS_PICKUP_MESSAGE,detail:OVERDRIVE_BOX_MODEL},location.origin);window.qaAPI={mount(){document.body.insertAdjacentHTML('beforeend',window.qaMarkup);zeroResists.sync();},refresh(cells){zeroResists.sync(cells);},remove(){document.querySelector('.BattleTabStatisticComponentStyle-container')?.remove();},dispose(){featureScope('zeroResists').dispose('manual');featureScope('overdriveTimer').dispose('manual');},status(){return featureScope('zeroResists').status();},timerStatus(){return featureScope('overdriveTimer').status();}};`,resolveDir:root},bundle:true,write:false,format:'iife',target:'chrome100'}).outputFiles[0].text;
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="M12 1 23 12 12 23 1 12Z"/></svg>';
const server=http.createServer((req,res)=>{
 if(['/styles/battleStats.css','/styles/hideNickname.css'].includes(req.url)){res.setHeader('Content-Type','text/css');return res.end(fs.readFileSync(path.join(root,req.url)));}
 if(req.url==='/assets/modulesTAB.svg'){res.setHeader('Content-Type','image/svg+xml');return res.end(fs.readFileSync(path.join(root,'assets/modulesTAB.svg')));}
 if(req.url.endsWith('.svg')){res.setHeader('Content-Type','image/svg+xml');return res.end(svg);}
 res.setHeader('Content-Type','text/html;charset=utf-8');res.end('<!doctype html><html><head><style>'+native+'</style><style>'+styles+'</style></head><body><div class="BattleComponentStyle-canvasContainer"></div></body></html>');
});
(async()=>{
 fs.mkdirSync(path.join(root,'artifacts/qa'),{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(browserOptions);
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://s.eu.tankionline.com/**',route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(({markup,styles})=>{window.qaMarkup=markup;window.qaStyles=styles;localStorage.setItem('k_overdrive_timer','true');window.chrome={runtime:{getURL:p=>location.origin+'/'+p,id:'qa'}};},{markup,styles});
  await page.addScriptTag({content:bundle});
  await page.waitForSelector('#kasp-overdrive-timer');
  await page.evaluate(()=>{window.qaTimer=document.querySelector('#kasp-overdrive-timer');window.qaOverlay=document.querySelector('.kasp-overdrive-timers');});
  const timerPixel=async()=>{const r=await page.locator('#kasp-overdrive-timer').boundingBox(),png=(await page.screenshot({clip:{x:Math.ceil(r.x+8),y:Math.ceil(r.y+8),width:1,height:1}})).toString('base64');return page.evaluate(async encoded=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),image=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(1,1),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const result=[...ctx.getImageData(0,0,1,1).data].slice(0,3);image.close();return result;},png);};
  const timerBefore=await timerPixel();
  const enter=await page.evaluate(async()=>{window.qaAPI.mount();const e=document.querySelector('.BattleTabStatisticComponentStyle-container'),r=e.querySelector('tbody tr'),samples=[];for(let i=0;i<8;i++){await new Promise(requestAnimationFrame);samples.push({root:+getComputedStyle(e).opacity,row:+getComputedStyle(r).opacity,blur:getComputedStyle(r.parentElement).backdropFilter,rowFilter:getComputedStyle(r).backdropFilter});}return samples;});assert.ok(enter.some(n=>n.row>0&&n.row<1));assert.ok(enter.every(n=>n.root===1&&n.blur==='blur(6px)'&&n.rowFilter==='none'));
  // Freeze the entry at 70ms and compare real pixels, not just the declared filter.
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=70;}));
  const blank=await page.locator('tbody tr .kasp-change-td').first().boundingBox();
  const clip={x:Math.ceil(blank.x+4),y:Math.ceil(blank.y+8),width:Math.floor(blank.width-8),height:Math.floor(blank.height-16)};
  const blurred=(await page.screenshot({clip})).toString('base64');
  await page.locator('tbody').first().evaluate(e=>e.style.setProperty('backdrop-filter','none','important'));
  const sharp=(await page.screenshot({clip})).toString('base64');
  await page.locator('tbody').first().evaluate(e=>e.style.removeProperty('backdrop-filter'));
  const contrast=await page.evaluate(async images=>{const values=[];for(const encoded of images){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,grey=[];for(let i=0;i<data.length;i+=4)grey.push((data[i]+data[i+1]+data[i+2])/3);const mean=grey.reduce((a,b)=>a+b,0)/grey.length;values.push(Math.sqrt(grey.reduce((sum,n)=>sum+(n-mean)**2,0)/grey.length));bitmap.close();}return{blurred:values[0],sharp:values[1]};},[blurred,sharp]);
  assert.ok(contrast.sharp>1&&contrast.blurred<contrast.sharp*.85,'backdrop must already be blurred during entry: '+JSON.stringify(contrast));
  await page.evaluate(()=>document.getAnimations().forEach(a=>a.play()));await page.waitForTimeout(200);
  const reports=[];
  for(const [width,height] of [[1920,1080],[1366,768],[960,600],[2560,1440]]){
   await page.setViewportSize({width,height});await page.mouse.move(0,0);
   const geometry=()=>page.evaluate(()=>[...document.querySelectorAll('table tr')].map(r=>[...r.children].map(e=>{const b=e.getBoundingClientRect();return[b.x,b.y,b.width,b.height];})));
   const before=await geometry(),cell=page.locator('.BattleTabStatisticComponentStyle-resistanceModuleCell').first(),row=page.locator('tbody tr').first();
   const compact=await cell.locator('.kasp-compact-cell').evaluate(e=>getComputedStyle(e).display);assert.equal(compact,'grid');
   await row.locator('.BattleTabStatisticComponentStyle-nicknameCell').hover();
   assert.equal(await cell.locator('.kasp-compact-cell').evaluate(e=>getComputedStyle(e).display),'none');
   assert.equal(await cell.locator(':scope > .BattleTabStatisticComponentStyle-defenceLabel').first().evaluate(e=>getComputedStyle(e).display),'flex');
   assert.deepEqual(await geometry(),before,'row hover must not move any column');
   await page.mouse.move(0,0);await page.locator('#kasp-tab-toggle-btn').click();assert.deepEqual(await geometry(),before,'pinning must not move any column');
   assert.equal(await page.locator('tbody tr').nth(1).locator('.kasp-compact-cell').evaluate(e=>getComputedStyle(e).display),'none');
   await page.locator('#kasp-tab-toggle-btn').click();assert.deepEqual(await geometry(),before);
   const report=await page.evaluate(()=>{const rows=[...document.querySelectorAll('tbody tr')],p=rows[0],gs=document.querySelector('.GearScoreStyle-gs_9001_9998'),best=document.querySelector('.GearScoreStyle-bestGS'),shield=document.querySelector('.kasp-shield-img');return{thead:getComputedStyle(document.querySelector('thead')).backgroundColor,scrollbar:getComputedStyle(document.querySelector('.BattleTabStatisticComponentStyle-commonBlockScroll')).scrollbarWidth,timer:getComputedStyle(document.querySelector('.kasp-overdrive-timers')).filter,dim:getComputedStyle(document.querySelector('.BattleTabStatisticComponentStyle-container'),'::before').opacity,blur:getComputedStyle(p.parentElement).backdropFilter,height:p.getBoundingClientRect().height,gs:getComputedStyle(gs).color,best:getComputedStyle(best).backgroundImage,shield:(()=>{const s=getComputedStyle(shield);return{width:parseFloat(s.width),height:parseFloat(s.height),opacity:s.opacity,display:s.display,pseudo:getComputedStyle(shield.parentElement,'::before').content};})(),rank:rows.slice(0,3).map(r=>r.querySelector('.BattleTabStatisticComponentStyle-nicknameCell img').getBoundingClientRect().toJSON()),footer:document.querySelector('#kasp-tab-toggle-btn').getBoundingClientRect().bottom,viewport:innerHeight};});
   assert.equal(report.thead,'rgba(0, 0, 0, 0)');assert.equal(report.scrollbar,'none');assert.equal(report.timer,'none');assert.equal(report.dim,'0.8');assert.equal(report.blur,'blur(6px)');assert.equal(report.gs,'rgb(255, 0, 0)');assert.ok(report.best.includes('linear-gradient'));assert.equal(report.shield.width,report.shield.height);assert.ok(report.shield.width>0&&report.shield.width<16);assert.equal(report.shield.opacity,'0.58');assert.equal(report.shield.display,'block');assert.equal(report.shield.pseudo,'none');assert.ok(report.height<45);assert.ok(report.footer<=report.viewport);assert.ok(report.rank.every(r=>r.x===report.rank[0].x&&r.width>22));reports.push(report);
  }
  const updates=await page.evaluate(async()=>{let pane=document.querySelector('.BattleTabStatisticComponentStyle-containerInsideTeams');const owner=pane.parentElement,animation=owner.getAnimations().find(a=>a.animationName==='kasp-tab-enter'),start=animation.startTime,samples=[];for(let i=0;i<12;i++){if(i===8){const copy=pane.cloneNode(true);copy.querySelector('#kasp-tab-toggle-btn')?.remove();pane.replaceWith(copy);pane=copy;}const row=pane.querySelector('tbody tr'),copy=row.cloneNode(true);copy.querySelector('.BattleTabStatisticComponentStyle-scoreCell span').textContent=String(i);row.replaceWith(copy);if(i%3===0){const head=pane.querySelector('thead');head.replaceWith(head.cloneNode(true));}window.qaAPI.refresh();await new Promise(requestAnimationFrame);samples.push({row:getComputedStyle(copy).opacity,rowAnimations:copy.getAnimations().length,heading:getComputedStyle(pane.querySelector('thead')).opacity,start:owner.getAnimations().find(a=>a.animationName==='kasp-tab-enter').startTime,timer:getComputedStyle(window.qaTimer).backgroundColor,filter:getComputedStyle(window.qaOverlay).filter,same:window.qaTimer===document.querySelector('#kasp-overdrive-timer')});}return{start,samples};});
  assert.ok(updates.samples.every(s=>s.row==='1'&&s.heading==='1'&&s.rowAnimations===0&&s.start===updates.start&&s.filter==='none'&&s.same&&s.timer==='rgb(255, 204, 0)'),'updates must not restart entry or recolour the timer');
  const timerUnder=await timerPixel();assert.ok(timerUnder[0]<timerBefore[0]*.3,'the actual TAB backdrop must cover the timer: '+JSON.stringify({timerBefore,timerUnder}));
  assert.equal(await page.locator('.kasp-overdrive-timers').evaluate(e=>e.parentElement.matches('.BattleTabStatisticComponentStyle-container')&&getComputedStyle(e).zIndex==='-2'),true);
  await page.locator('.kasp-shield-img').first().evaluate(e=>e.parentElement.style.setProperty('background','#000','important'));
  const shieldRect=await page.locator('.kasp-shield-img').first().boundingBox();
  const shieldPNG=(await page.screenshot({clip:{x:Math.floor(shieldRect.x),y:Math.floor(shieldRect.y),width:Math.ceil(shieldRect.width),height:Math.ceil(shieldRect.height)}})).toString('base64');
  const shieldMax=await page.evaluate(async encoded=>{const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let max=0;for(let i=0;i<data.length;i+=4)max=Math.max(max,data[i],data[i+1],data[i+2]);bitmap.close();return max;},shieldPNG);
  assert.ok(shieldMax>=140&&shieldMax<=151,'rendered shield must be 58% white, not opaque white: '+shieldMax);
  await page.locator('.kasp-shield-img').first().evaluate(e=>e.parentElement.style.removeProperty('background'));
  await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(root,'artifacts/qa/tab-fixed-resists.png')});
  await page.evaluate(()=>window.qaAPI.remove());
  assert.equal(await page.locator('.BattleTabStatisticComponentStyle-container').count(),0);
  assert.equal(await page.locator('#kasp-tab-exit').count(),0,'closing is entirely native');
  assert.equal(await page.evaluate(()=>window.qaTimer===document.querySelector('#kasp-overdrive-timer')&&window.qaOverlay.parentElement===document.body),true);
  const timerAfter=await timerPixel();assert.deepEqual(timerAfter,timerBefore,'timer restores without changing its palette or DOM');
  assert.equal(await page.locator('.kasp-overdrive-timers').evaluate(e=>getComputedStyle(e).filter),'none');
  await page.evaluate(()=>window.qaAPI.mount());await page.waitForTimeout(180);
  await page.evaluate(()=>document.querySelector('.BattleTabStatisticComponentStyle-container').style.display='none');
  assert.equal(await page.locator('.kasp-overdrive-timers').evaluate(e=>getComputedStyle(e).filter),'none');
  await page.evaluate(()=>document.querySelector('.BattleTabStatisticComponentStyle-container').style.display='flex');
  assert.equal(await page.locator('.kasp-overdrive-timers').evaluate(e=>getComputedStyle(e).filter),'none');
  assert.equal(await page.locator('.kasp-overdrive-timers').evaluate(e=>e.parentElement.matches('.BattleTabStatisticComponentStyle-container')),true);
  await page.setViewportSize({width:1366,height:768});
  await page.evaluate(()=>document.querySelectorAll('tbody').forEach(t=>{while(t.children.length<35){const row=t.firstElementChild.cloneNode(true);row.className='BattleTabStatisticComponentStyle-rowBackGround';t.appendChild(row);}}));
  const scroller=page.locator('.BattleTabStatisticComponentStyle-commonBlockScroll');await scroller.hover();await page.mouse.wheel(0,550);await page.waitForTimeout(180);
  const scroll=await scroller.evaluate(e=>({top:e.scrollTop,total:e.scrollHeight,height:e.clientHeight,width:getComputedStyle(e).scrollbarWidth,webkit:getComputedStyle(e,'::-webkit-scrollbar').display,overflow:getComputedStyle(e).overflowY}));
  assert.ok(scroll.top>0&&scroll.total>scroll.height);assert.equal(scroll.width,'none');assert.equal(scroll.webkit,'none');assert.equal(scroll.overflow,'auto');
  const workload=await page.evaluate(()=>{
   const bodies=[...document.querySelectorAll('tbody')],rows=bodies.flatMap(body=>[...body.querySelectorAll('tr')]);
   const filters=[...bodies,...rows].filter(node=>getComputedStyle(node).backdropFilter!=='none').length;
   const native=window.getComputedStyle;let reads=0;
   window.getComputedStyle=function(...args){reads++;return native.apply(window,args);};
   try{
    window.qaAPI.refresh();const fullReads=reads;reads=0;
    const cell=rows[0].querySelector('.BattleTabStatisticComponentStyle-resistanceModuleCell');
    cell.querySelector('h3').textContent='51';window.qaAPI.refresh([cell]);
    return{rows:rows.length,filters,fullReads,dirtyReads:reads};
   }finally{window.getComputedStyle=native;}
  });
  assert.equal(workload.rows,70);assert.equal(workload.filters,2,'blur passes must scale with teams, not players');
  assert.ok(workload.dirtyReads<workload.fullReads/10,'a one-player change must avoid a full style scan: '+JSON.stringify(workload));
  await page.evaluate(()=>window.qaAPI.dispose());const disposed=await page.evaluate(()=>window.qaAPI.status()),timerDisposed=await page.evaluate(()=>window.qaAPI.timerStatus());assert.equal(disposed.resources,0);assert.equal(disposed.listeners,0);assert.equal(timerDisposed.resources,0);assert.equal(timerDisposed.listeners,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,viewports:reports.length,enter,contrast,updates:updates.samples.length,timerBefore,timerUnder,timerAfter,shieldMax,scroll,workload,disposed}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
