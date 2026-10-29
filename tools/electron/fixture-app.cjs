// Minimal hidden host for the existing DOM and WebGL regression fixtures.
const {app,BrowserWindow}=require('electron');
app.setPath('userData',process.env.KI_QA_PROFILE);
for(const value of JSON.parse(process.env.KI_QA_ARGS||'[]')){
 const match=/^--([^=]+)(?:=(.*))?$/.exec(value);
 if(match)app.commandLine.appendSwitch(match[1],match[2]);
}
app.whenReady().then(()=>{
 global.createFixtureWindow=()=>{
  const window=new BrowserWindow({show:false,opacity:0,skipTaskbar:true,focusable:false,
   webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  // CDP screenshots need an active compositor. Keep the native window fully
  // transparent, absent from the taskbar and unable to take user focus.
  window.showInactive();
  window.loadURL('about:blank');
 };
 global.kiReady=true;
});
app.on('window-all-closed',()=>{});
