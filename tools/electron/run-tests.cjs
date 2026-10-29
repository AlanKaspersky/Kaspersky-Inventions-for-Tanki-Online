const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const cases=[['game-loader.cjs'],...['settings','friend-menu','custom-trophies-browser','dom-lifetime','rain-weather-browser'].map(name=>['run-browser.cjs',name])];
for(const [entry,...args]of cases){
 console.log('[Electron QA] '+[entry,...args].join(' '));
 const result=spawnSync(process.execPath,[path.join(__dirname,entry),...args],{cwd:root,stdio:'inherit',windowsHide:true,timeout:300000});
 if(result.error)throw result.error;
 if(result.status!==0){process.exitCode=result.status||1;break;}
}
