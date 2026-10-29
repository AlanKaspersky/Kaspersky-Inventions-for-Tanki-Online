// Reuse the existing assertions in a real Electron renderer, not a UA spoof.
const fs=require('node:fs'),path=require('node:path');
const runtime=require('../browser/runtime.cjs');
const executablePath=process.env.KI_ELECTRON_PATH;
if(!executablePath)throw Error('Set KI_ELECTRON_PATH to the companion client electron.exe');
const allowed=new Set(['settings','rain-weather-browser','custom-trophies-browser','dom-lifetime','friend-menu']);
const name=process.argv[2];if(!allowed.has(name))throw Error('Choose a fixture: '+[...allowed].join(', '));
runtime.chromium={async launch(options={}){
 const out=path.join(runtime.root,'artifacts/qa/electron-'+name+'-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const env={...process.env,KI_QA_PROFILE:path.join(out,'profile'),KI_QA_ARGS:JSON.stringify(options.args||[])};delete env.ELECTRON_RUN_AS_NODE;
 const app=await runtime.electron.launch({executablePath,args:[path.join(__dirname,'fixture-app.cjs')],env});
 const deadline=setTimeout(()=>{console.error('Electron fixture timed out: '+name);app.close().finally(()=>process.exit(1));},240000);deadline.unref();
 for(let i=0;i<200&&!await app.evaluate(()=>!!global.kiReady);i++)await new Promise(r=>setTimeout(r,50));
 return {
  async newPage(options={}){
   const pending=app.waitForEvent('window');await app.evaluate(()=>global.createFixtureWindow());const page=await pending;
   if(options.viewport)await page.setViewportSize(options.viewport);
   if(options.reducedMotion)await page.emulateMedia({reducedMotion:options.reducedMotion});
   return page;
  },
  close:()=>{clearTimeout(deadline);return app.close();}
 };
}};
require('../browser/'+name+'.cjs');
