// Isolated Electron host: no updater, real game, Discord or user profile.
const {app, BrowserWindow, session}=require('electron');
app.setPath('userData',process.env.KI_QA_PROFILE);
if(!process.env.KI_QA_LIVE)app.commandLine.appendSwitch('host-resolver-rules','MAP s.eu.tankionline.com 127.0.0.1, MAP game.tankionline.com 127.0.0.1');
app.commandLine.appendSwitch('no-proxy-server');
app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure',process.env.KI_QA_ORIGIN);
app.whenReady().then(async()=>{
 global.kiExtension=await session.defaultSession.extensions.loadExtension(process.env.KI_QA_EXTENSION);
 global.kiGateCalls=[];
 global.installGate=()=>{
  const {installKiGameGate}=require(process.env.KI_QA_GATE);
  return installKiGameGate(session.defaultSession,global.kiExtension.id,(url,type)=>global.kiGateCalls.push({url,type}));
 };
 global.createWindow=()=>new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 global.kiReady=true;
});
app.on('window-all-closed',()=>{});
