// Native-shaped local fixture: no game session or external resources.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {build}=require('esbuild');
const {chromium,browserOptions,root}=require('./runtime.cjs');
(async()=>{
 const bundle=(await build({stdin:{contents:`
  import {startBoot} from './src/boot';
  import {setupAccountIdentity,getPlayerUserId} from './src/core/accountIdentity';
  import {featureScope} from './src/core/featureRuntime';
  startBoot(); setupAccountIdentity();
  window.friendQA={getPlayerUserId,scope:featureScope('customFriends')};`,resolveDir:root},bundle:true,write:false,format:'iife',plugins:[{name:'fixture',setup(b){
   b.onResolve({filter:/^\.\/modules$/},()=>({path:'modules',namespace:'fixture'}));
   b.onResolve({filter:/\/core\/(state|utils|coreSettings)$/},args=>({path:args.path.split('/').pop(),namespace:'fixture'}));
   b.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:root,contents:{
    modules:`import {friendContextMenu} from './src/modules/customFriends';
      const noop=Object.assign(()=>{},{sync(){},setup(){},onTick(){}});
      export const modules=new Proxy({friendContextMenu},{get:(target,key)=>target[key]||noop});`,
    state:`export const state={lang:'EN',currentScreen:'lobby',friendsMenuOpen:false,settingsOpen:false};`,
    utils:`export const utils={getLang:()=> 'EN',getSetting:key=>key==='k_friends'};`,
    coreSettings:`export const coreSettings={inject(){},onClose(){}};`,
   }[args.path]}));
 }}]})).outputFiles[0].text;
 const css=fs.readFileSync(path.join(root,'styles/customFriends.css'),'utf8');
 const server=http.createServer((req,res)=>{
  res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':req.url==='/friends.css'?'text/css':'text/html; charset=utf-8');
  res.end(req.url==='/fixture.js'?bundle:req.url==='/friends.css'?css:`<!doctype html><link rel="stylesheet" href="/friends.css"><style>
   body{margin:0;background:#161a1c;color:white;font:14px Arial}.ContextMenuStyle-menu{position:absolute;top:40px;left:40px;width:237px;background:#08212b;padding:12px;box-sizing:border-box}.ContextMenuStyle-menuItemRank{color:#ffdf00}p{margin:20px 12px}
  </style><div class="UserInfoContainerStyle-userNameRank">Player</div><div class="FriendListComponentStyle-containerFriends"><div class="FriendListComponentStyle-scrollCommunity"></div></div><script src="/fixture.js"></script>`);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch(browserOptions);const page=await browser.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{if(route.request().url().startsWith('http://127.0.0.1:'))return route.continue();external.push(route.request().url());return route.abort();});
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   window.friendQA.requests=[];
   window.addEventListener('message',event=>{if(event.data?.type==='kasp:account-identity:request')window.friendQA.requests.push(event.data);});
   window.friendQA.identity=(players=[],userId='1001',nickname='Player',origin=location.origin)=>window.dispatchEvent(new MessageEvent('message',{
    source:window,origin,data:{type:'kasp:account-identity',snapshot:{account:{userId,nickname,clanTag:''},players}}}));
   window.friendQA.identity([{userId:'2001',nickname:'Friend'}]);
  });
  const opened=await page.evaluate(()=>new Promise(resolve=>{
   requestAnimationFrame(()=>resolve({buttons:document.querySelectorAll('.custom-category-menu-btn').length,disabled:document.querySelector('.custom-category-menu-btn')?.getAttribute('aria-disabled')}));
   const menu=document.createElement('div');menu.className='ContextMenuStyle-menu';
   menu.innerHTML='<div class="ContextMenuStyle-menuItemRank"><span class="-whiteSpaceNoWrap">[Clan] Friend</span></div><p>Private message</p><p>Copy name</p><p>Profile</p>';
   document.querySelector('.FriendListComponentStyle-containerFriends').append(menu);
  }));
  assert.deepEqual(opened,{buttons:3,disabled:'false'},'menu must decorate before the first animation frame');
  assert.equal(await page.locator('.custom-category-row img').count(),0,'menu diamonds must not depend on CDN images');
  await page.locator('.custom-category-menu-btn').first().click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tankiCustomCategories_uid_1001'))['2001']),'purple');
  const pending=await page.evaluate(()=>new Promise(resolve=>{
   requestAnimationFrame(()=>{document.querySelector('.custom-category-menu-btn').click();resolve({buttons:document.querySelectorAll('.custom-category-menu-btn').length,disabled:document.querySelector('.custom-category-menu-btn').getAttribute('aria-disabled'),saved:localStorage.getItem('tankiCustomCategories_uid_1001')});});
   document.querySelector('.ContextMenuStyle-menuItemRank span').textContent='NewFriend';
  }));
  assert.equal(pending.buttons,3);assert.equal(pending.disabled,'true');assert.deepEqual(JSON.parse(pending.saved),{'2001':'purple'});
  const hydrated=await page.evaluate(()=>new Promise(resolve=>{
   requestAnimationFrame(()=>resolve(document.querySelector('.custom-category-menu-btn').getAttribute('aria-disabled')));
   window.friendQA.identity([{userId:'2002',nickname:'NewFriend'}]);
  }));
  assert.equal(hydrated,'false','fresh identity must hydrate an open menu without a DOM mutation');
  await page.evaluate(()=>{
   window.friendQA.oldButton=document.querySelector('.custom-category-menu-btn');
   document.querySelector('.UserInfoContainerStyle-userNameRank').textContent='Other';
   window.friendQA.identity([{userId:'2002',nickname:'NewFriend'}],'1002','Other');
  });
  await page.waitForFunction(()=>document.querySelector('.ContextMenuStyle-menu').dataset.customCategoriesInjected==='1002:2002');
  await page.evaluate(()=>window.friendQA.oldButton.click());
  assert.equal(await page.evaluate(()=>localStorage.getItem('tankiCustomCategories_uid_1002')),null,'stale owner button must not write');
  await page.locator('.custom-category-menu-btn').nth(2).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('tankiCustomCategories_uid_1002'))['2002']),'red');
  const stable=await page.evaluate(async()=>{
   let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(document.querySelector('.ContextMenuStyle-menu'),{subtree:true,childList:true,attributes:true});
   for(let i=0;i<10;i++)window.friendQA.identity([{userId:'2002',nickname:'NewFriend'}],'1002','Other');
   await new Promise(resolve=>setTimeout(resolve,200));observer.disconnect();return mutations;
  });
  assert.equal(stable,0,'unchanged identity updates must not rebuild or mutate the menu');
  assert.ok(await page.evaluate(()=>window.friendQA.requests.some(r=>r.refreshPlayers===true)),'pending menu must request fresh native data');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  const output=path.join(root,'artifacts/qa/friend-menu');fs.mkdirSync(output,{recursive:true});
  await page.screenshot({path:path.join(output,'menu.png')});
  console.log('Friend menu: before-first-frame rendering, delayed identity hydration, CSS-only diamonds, demand refresh, stale-owner rejection and stable updates passed.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
