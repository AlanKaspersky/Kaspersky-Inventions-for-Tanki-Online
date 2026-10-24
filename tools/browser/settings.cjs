const fs=require('node:fs'),path=require('node:path');
const {chromium,browserOptions,root}=require('./runtime.cjs');
const {transformSync}=require('esbuild');
const out=path.join(root,'artifacts/qa/settings');fs.mkdirSync(out,{recursive:true});
const code=transformSync(fs.readFileSync(path.join(root,'src/core/coreSettings.ts'),'utf8'),{loader:'ts',format:'cjs'}).code;
const gameModule={exports:{}};
require('node:vm').runInNewContext(transformSync(fs.readFileSync(path.join(root,'src/core/gameDOM.ts'),'utf8'),{loader:'ts',format:'cjs'}).code,{module:gameModule});
const art='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/art3.jpg')).toString('base64');
const sheet=fs.readFileSync(path.join(root,'styles/settings.css'),'utf8');
(async()=>{
 const browser=await chromium.launch(browserOptions);
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1000},reducedMotion:'reduce'});
  await page.route('http://settings.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Settings QA</title>'}));
  await page.goto('http://settings.test/');
  for(const [lang,width] of [['RU',1920],['EN',1920],['RU',1100],['EN',760]]){
   await page.setViewportSize({width,height:1000});
   const labels=lang==='RU'?['ИГРА','БИТВА','ГРАФИКА','ЗВУК','УПРАВЛЕНИЕ','АККАУНТ','БЕЗОПАСНОСТЬ','ПОДДЕРЖКА']:['GAME','BATTLE','GRAPHICS','SOUND','CONTROLS','ACCOUNT','SECURITY','SUPPORT'];
   await page.setContent(`<style>html{font-size:13px;background:#101416}body{margin:0;color:white;font-family:Arial}header,h3,p{margin:0}body span{color:white;font-size:1em}*{box-sizing:border-box}.SettingsComponentStyle-blockContentOptions{display:flex;margin:90px auto 0;height:820px;align-items:flex-start;font-size:1em}ul{list-style:none;padding:0;margin:0} @font-face{font-family:BaseFontRegular;src:local('Arial')}@font-face{font-family:BaseFontMedium;src:local('Arial')}@font-face{font-family:BaseFontBold;src:local('Arial Bold')}</style><style>${sheet}</style><div class="SettingsComponentStyle-blockContentOptions"><ul>${labels.map(label=>`<li class="SettingsMenuComponentStyle-menuItemOptions"><span>${label}</span></li>`).join('')}</ul><div class="SettingsComponentStyle-containerBlock"></div></div>`);
   await page.evaluate(({code,gameDOM,art,lang})=>{
    window.module={exports:{}};
    window.chrome={runtime:{getURL:()=>art}};
    window.require=name=>name==='./state'?{state:{lang}}:name==='./gameDOM'?{gameDOM}:name==='./utils'?{utils:{getSetting:(key,def)=>def,setSetting(){}}}:name==='./accountIdentity'?{getVerifiedAccount:()=>({userId:'1'})}:name==='./rainWeather/preferences'?{readWeatherVolumes:()=>({rain:1,thunder:1}),WEATHER_VOLUME_KEYS:{rain:'k_rain_volume',thunder:'k_thunder_volume'}}:{setupNicknamePrivacy(){}};
    (0,eval)(code);window.module.exports.coreSettings.inject();document.getElementById('kaspersky-tab').click();
   },{code,gameDOM:gameModule.exports.gameDOM,art,lang});
   const measure=await page.evaluate(()=>{
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
    const classes=['normal','streamer','advanced','graphics','information'];
    const panels=Object.fromEntries(classes.map(name=>[name,rect('.kasp-settings-'+name)]));
    const content=document.getElementById('kaspersky-settings-content');
    const menuArt=[...document.querySelectorAll('.SettingsMenuComponentStyle-menuItemOptions')].map(tab=>{
     const r=tab.getBoundingClientRect(),style=getComputedStyle(tab),art=getComputedStyle(tab,'::before');
     return {x:r.left+parseFloat(style.borderLeftWidth)+parseFloat(art.left),y:r.top+parseFloat(style.borderTopWidth)+parseFloat(art.top),width:parseFloat(art.width),height:parseFloat(art.height)};
    });
    return {panels,menuArt,menu:rect('.SettingsMenuComponentStyle-menuItemOptions'),scrollable:content.scrollHeight>content.clientHeight,scrollbar:getComputedStyle(content).scrollbarWidth,
     overflow:[...document.querySelectorAll('.kasp-settings-panel,.kasp-toggle-row,.kasp-settings-links a')].filter(el=>el.scrollWidth>el.clientWidth+1).length,
     gutters:[...document.querySelectorAll('.kasp-settings-panel')].filter(el=>el.querySelector('.kasp-toggle-row')).map(el=>{
      const header=el.querySelector('h3').getBoundingClientRect(),label=el.querySelector('.kasp-toggle-text').getBoundingClientRect();return header.x-label.x;})};
   });
   const wide=measure.panels.normal.x!==measure.panels.streamer.x;
   if(wide&&(Math.abs(measure.panels.normal.width-measure.panels.streamer.width)>1||Math.abs(measure.panels.normal.bottom-measure.panels.advanced.bottom)>1))throw Error('Panel edges disagree: '+JSON.stringify(measure));
   if(measure.overflow||measure.gutters.some(value=>Math.abs(value)>1))throw Error('Overflow or gutter mismatch: '+JSON.stringify(measure));
   if(measure.menuArt.length!==9||['x','y','width','height'].some(key=>Math.max(...measure.menuArt.map(art=>art[key]))-Math.min(...measure.menuArt.map(art=>art[key]))>.1))throw Error('Menu image slices disagree: '+JSON.stringify(measure.menuArt));
   console.log(lang,width,JSON.stringify(measure));
   await page.screenshot({path:path.join(out,`${lang}-${width}.png`),fullPage:true});
   await page.evaluate(()=>{document.getElementById('kaspersky-settings-content').scrollTop=10000;});
   await page.screenshot({path:path.join(out,`${lang}-${width}-bottom.png`),fullPage:true});
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
