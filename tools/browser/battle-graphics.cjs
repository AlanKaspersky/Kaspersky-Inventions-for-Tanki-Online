const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async function battleGraphicsQA({browser,bundle,sheet,out}){
 const page=await browser.newPage({viewport:{width:1600,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.route('http://battle-settings.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Battle graphics QA</title>'}));await page.goto('http://battle-settings.test/');
  await page.setContent('<style>html{font-size:13px}body{margin:0;color:white;font:14px Arial;background:linear-gradient(145deg,#293939,#16202a);height:100vh}#chat{position:fixed;left:20px;bottom:20px}.BattleComponentStyle-canvasContainer{position:fixed;inset:0;outline:none}.qa-label{position:fixed;top:20px;left:20px;color:#ddd;pointer-events:none}</style><style>'+sheet+'</style><div class="BattleComponentStyle-canvasContainer" tabindex="0"></div><div class="qa-label">Battlefield remains visible</div><input id="chat" aria-label="Chat">');
  await page.evaluate(()=>{localStorage.setItem('language_store_key','ru');window.chrome={runtime:{id:'qa',getURL:()=>''}};});
  await page.addScriptTag({content:bundle});
  await page.evaluate(()=>{window.battleGraphics=window.qaSettings.battle();window.nativeKeys=[];window.nativeUps=[];window.nativePresses=[];window.addEventListener('keydown',e=>window.nativeKeys.push(e.code));window.addEventListener('keyup',e=>window.nativeUps.push(e.code));window.addEventListener('keypress',e=>window.nativePresses.push(e.code));});
  const button=page.locator('#kasp-battle-graphics-button'),panel=page.locator('#kasp-battle-graphics');
  assert.equal(await button.count(),0);await page.keyboard.press('Control+Alt+KeyG');assert.equal(await panel.count(),1);assert.equal(await panel.locator('.kasp-gfx-card').count(),4);
  assert.equal(await panel.locator('.kasp-toggle-switch').first().evaluate(e=>getComputedStyle(e).appearance==='none'&&e.getBoundingClientRect().width>30),true,'battle editor must share the styled switches');
  assert.equal(await panel.getAttribute('aria-modal'),'false');assert.equal(await panel.locator('h2').textContent(),'Графические настройки');
  await panel.locator('.kasp-gfx-sunlight > details > summary').click();await panel.locator('[data-graphics-sun-look="warm-evening"]').click();
  await panel.locator('[data-graphics-enabled="sunlight"]').check();
  let settings=await page.evaluate(()=>window.qaSettings.profile().settings);assert.equal(settings.sunIntensity,8);assert.equal(settings.tuning.sunTemperature,4500);assert.equal(settings.enabled.sunlight,true);
  await panel.locator('.kasp-gfx-sunlight .kasp-gfx-group > summary').first().click();
  const input=panel.locator('[data-graphics-field="sunIntensity"][type="number"]');await input.fill('12');await input.dispatchEvent('input');
  assert.equal(await page.evaluate(()=>window.qaSettings.profile().settings.sunIntensity),12);
  await input.focus();await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>window.qaSettings.profile().settings.sunIntensity),12.1);assert.equal(await page.evaluate(()=>window.nativeKeys.includes('ArrowUp')),false);
  await page.keyboard.press('Control+a');await page.keyboard.type('9');assert.equal(await page.evaluate(()=>window.qaSettings.profile().settings.sunIntensity),9);assert.equal(await page.evaluate(()=>window.nativePresses.length),0);
  await input.fill('12');await input.dispatchEvent('input');
  // The same editor supports local JSON files while the game screen stays mounted.
  const [download]=await Promise.all([page.waitForEvent('download'),panel.locator('[data-graphics-action="export"]').click()]);assert.ok(await download.path());
  await panel.locator('[data-graphics-file]').setInputFiles({name:'battle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'ki-graphics-settings',version:1,settings:{tuning:{sunDiskSize:1.25}}}))});
  await page.waitForFunction(()=>window.qaSettings.profile().settings.tuning.sunDiskSize===1.25);
  await page.keyboard.press('Escape');assert.equal(await panel.count(),0);assert.equal(await page.evaluate(()=>window.nativeKeys.includes('Escape')),false);
  await page.keyboard.press('Control+Alt+KeyG');assert.equal(await panel.count(),1);assert.equal(await page.evaluate(()=>window.nativeKeys.includes('KeyG')),false);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#kasp-battle-graphics')),true);
  await page.keyboard.press('Control+Alt+KeyG');assert.equal(await panel.count(),0);
  await page.locator('#chat').focus();await page.keyboard.press('Control+Alt+KeyG');assert.equal(await panel.count(),0,'typing in chat must not open the panel');
  await page.locator('.BattleComponentStyle-canvasContainer').focus();await page.keyboard.down('w');await page.keyboard.press('Control+Alt+KeyG');await page.keyboard.up('w');
  assert.equal(await page.evaluate(()=>window.nativeUps.includes('KeyW')),true,'release of an already held movement key must reach the game');
  await panel.locator('.kasp-gfx-sunlight > details > summary').click();
  await page.screenshot({path:path.join(out,'RU-battle-graphics.png')});
  await page.evaluate(()=>{localStorage.setItem('language_store_key','en');window.battleGraphics.sync();});assert.equal(await panel.count(),0);assert.equal(await button.count(),0);
  await page.keyboard.press('Control+Alt+KeyG');assert.equal(await panel.locator('h2').textContent(),'Graphics settings');
  await page.evaluate(()=>{document.querySelector('.BattleComponentStyle-canvasContainer').remove();window.battleGraphics.sync();});
  assert.equal(await panel.count(),0);assert.equal(await button.count(),0);
  await page.evaluate(()=>window.qaSettings.disposeBattle());const status=await page.evaluate(()=>window.qaSettings.battleStatus());assert.equal(status.resources,0);assert.equal(status.listeners,0);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({battleGraphics:true,hotkeyOnly:true,keyboardIsolation:true,heldKeyRelease:true,json:true,localization:true,cleanup:true}));
 }finally{await page.close();}
};
