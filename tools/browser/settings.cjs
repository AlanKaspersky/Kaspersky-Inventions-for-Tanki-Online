const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,browserOptions,root}=require('./runtime.cjs');
const {buildSync}=require('esbuild');
const out=path.join(root,'artifacts/qa/settings');fs.mkdirSync(out,{recursive:true});
const bundle=buildSync({stdin:{contents:"import {coreSettings} from './src/core/coreSettings';import {setupBattleGraphics} from './src/core/battleGraphics';import {featureScope} from './src/core/featureRuntime';import {state} from './src/core/state';import {readGraphicsProfile} from './src/core/graphicsPreferences';window.qaSettings={battle:()=>setupBattleGraphics(window),disposeBattle:()=>featureScope('battleGraphics').dispose('qa'),battleStatus:()=>featureScope('battleGraphics').status(),open(lang){state.lang=lang;coreSettings.inject();document.getElementById('kaspersky-tab').click();},profile:()=>readGraphicsProfile(localStorage),close:coreSettings.onClose};",resolveDir:root},bundle:true,format:'iife',write:false}).outputFiles[0].text;
const art='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/art3.jpg')).toString('base64');
const sheet=fs.readFileSync(path.join(root,'styles/settings.css'),'utf8');
(async()=>{
 const browser=await chromium.launch(browserOptions);
 try{
  for(const [lang,width] of [['RU',1920],['EN',1920],['RU',1100],['EN',760]]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('http://settings.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Settings QA</title>'}));await page.goto('http://settings.test/');
   const titles=lang==='RU'?['ИГРА','БИТВА','ГРАФИКА','ЗВУК','УПРАВЛЕНИЕ','АККАУНТ','БЕЗОПАСНОСТЬ','ПОДДЕРЖКА']:['GAME','BATTLE','GRAPHICS','SOUND','CONTROLS','ACCOUNT','SECURITY','SUPPORT'];
   await page.setContent('<style>html{font-size:13px;background:#101416}body{margin:0;color:white;font-family:Arial}body span{color:white;font-size:1em}*{box-sizing:border-box}.SettingsComponentStyle-blockContentOptions{display:flex;margin:60px auto 0;height:900px;align-items:flex-start;font-size:1em}ul{list-style:none;padding:0;margin:0}</style><style>'+sheet+'</style><div class="SettingsComponentStyle-blockContentOptions"><ul>'+titles.map(t=>'<li class="SettingsMenuComponentStyle-menuItemOptions"><span>'+t+'</span></li>').join('')+'</ul><div class="SettingsComponentStyle-containerBlock"></div></div>');
   await page.evaluate(art=>{window.chrome={runtime:{getURL:()=>art,id:'qa'}};},art);await page.addScriptTag({content:bundle});await page.evaluate(lang=>window.qaSettings.open(lang),lang);
   const editor=page.locator('.kasp-graphics-editor');assert.equal(await editor.locator('.kasp-gfx-card').count(),4);
   assert.equal(await editor.locator('.kasp-gfx-config[open]').count(),0);assert.equal(await editor.locator('[data-graphics-file]').count(),1);
   const cards=await editor.locator('.kasp-gfx-card').evaluateAll(nodes=>nodes.map(e=>({width:e.clientWidth,overflow:e.scrollWidth-e.clientWidth})));assert.ok(cards.every(c=>c.width>150&&c.overflow<2));
   assert.equal(await page.locator('#kaspersky-settings-content').evaluate(e=>getComputedStyle(e).scrollbarWidth),'none');
   await editor.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,lang+'-'+width+'.png'),fullPage:true});
   await editor.locator('[data-graphics-enabled="weather"]').check();assert.equal(await page.evaluate(()=>window.qaSettings.profile().settings.enabled.weather),true);
   const set=async(field,value,type='range')=>page.locator('[data-graphics-field="'+field+'"][type="'+type+'"]').evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));},value);
   await page.evaluate(()=>document.querySelectorAll('.kasp-gfx-weather details').forEach(e=>e.open=true));
   await set('generation.chance',100);await set('generation.duration',100);await set('tuning.rainDrops',40000);await set('tuning.snowFaces',1);await set('volumes.rain',0);
   await editor.locator('[data-graphics-preset]').selectOption('storm');
   let s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(s.generation.chance,1);assert.equal(s.generation.duration,1);assert.equal(s.tuning.rainDrops,40000);assert.equal(s.tuning.snowFaces,1);assert.equal(s.volumes.rain,0);assert.equal(s.generation.preset,'storm');
   await editor.locator('.kasp-gfx-sunlight > details > summary').click();await page.evaluate(()=>document.querySelectorAll('.kasp-gfx-sunlight details').forEach(e=>e.open=true));
   await editor.locator('[data-graphics-sun-look="warm-evening"]').click();s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(s.sunIntensity,8);assert.equal(s.tuning.sunTemperature,4500);assert.equal(s.tuning.sunHaze,.42);assert.equal(s.enabled.sunlight,false);assert.equal(s.tuning.rainDrops,40000);
   await editor.locator('[data-graphics-sun-look="cinematic"]').click();s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(s.sunIntensity,4);assert.equal(s.tuning.sunBloom,.22);assert.equal(s.enabled.sunlight,false);
   await editor.locator('[data-graphics-sun-look="original"]').click();s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(s.tuning.sunHaze,0);assert.equal(s.tuning.sunTemperature,6500);assert.equal(s.tuning.sunContrast,1);
   await editor.locator('[data-graphics-sun-look="warm-evening"]').click();await set('sunIntensity',150,'number');assert.equal(await page.evaluate(()=>window.qaSettings.profile().settings.sunIntensity),150);
   const overflow=await editor.locator('input[type="range"]').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).some(n=>Math.abs(n.getBoundingClientRect().width-n.closest('.kasp-gfx-control').getBoundingClientRect().width)>1));assert.equal(overflow,false,'range controls fill their rows');
   const [download]=await Promise.all([page.waitForEvent('download'),editor.locator('[data-graphics-action="export"]').click()]);const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.format,'ki-graphics-settings');assert.equal(exported.settings.tuning.rainDrops,40000);assert.equal(exported.settings.sunIntensity,150);assert.equal(exported.settings.tuning.sunTemperature,4500);assert.equal(exported.settings.tuning.sunHaze,.42);
   exported.settings.tuning.rainDrops=9000;exported.settings.volumes.thunder=.33;exported.settings.enabled.boxes=true;
   await editor.locator('[data-graphics-file]').setInputFiles({name:'graphics.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await page.waitForFunction(()=>window.qaSettings.profile().settings.tuning.rainDrops===9000);
   assert.equal(await editor.locator('[data-graphics-enabled="boxes"]').isChecked(),true);assert.equal(await editor.locator('[data-graphics-field="volumes.thunder"][type="number"]').inputValue(),'33');
   const before=await page.evaluate(()=>JSON.stringify(window.qaSettings.profile()));
   await editor.locator('[data-graphics-file]').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"ki-graphics-settings","version":99,"settings":{}}')});await page.waitForSelector('.kasp-gfx-message.kasp-gfx-error');assert.equal(await page.evaluate(()=>JSON.stringify(window.qaSettings.profile())),before);
   await editor.locator('[data-graphics-reset="weather"]').click();s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(s.tuning.rainDrops,25000);assert.equal(s.enabled.weather,true);assert.equal(s.sunIntensity,150);
   await page.evaluate(()=>{document.querySelectorAll('.kasp-gfx-config').forEach(e=>e.open=false);document.querySelector('.kasp-gfx-weather > details').open=true;document.querySelector('.kasp-gfx-weather .kasp-gfx-group').open=true;document.querySelector('.kasp-gfx-sunlight > details').open=true;document.querySelector('.kasp-gfx-sunlight .kasp-gfx-group').open=true;document.querySelector('.kasp-settings-graphics').scrollIntoView();});
   await page.screenshot({path:path.join(out,lang+'-'+width+'-expanded.png'),fullPage:true});
   await page.evaluate(()=>{document.querySelector('.kasp-gfx-weather > details').open=false;const sun=document.querySelector('.kasp-gfx-sunlight');sun.querySelectorAll('.kasp-gfx-group').forEach((e,i)=>e.open=i===1);sun.scrollIntoView({block:'start'});});
   await page.screenshot({path:path.join(out,lang+'-'+width+'-sunlight.png'),fullPage:true});
   await editor.locator('[data-graphics-action="reset"]').click();s=await page.evaluate(()=>window.qaSettings.profile().settings);assert.ok(Object.values(s.enabled).every(v=>v===false));assert.equal(s.sunIntensity,4);
   assert.deepEqual(errors,[]);console.log(JSON.stringify({lang,width,cards,exportImport:true,invalidImportPreservesSettings:true,unlimitedSunlight:true,reset:true}));await page.close();
  }
  await require('./battle-graphics.cjs')({browser,bundle,sheet,out});
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
