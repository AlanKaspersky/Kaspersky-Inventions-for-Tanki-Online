import { SNOW_PALETTES } from '../snowWeather/config';
import { featureScope } from '../featureRuntime';
import { gameDOM } from '../gameDOM';
import { createRainRenderer } from './renderer';
import type { RainStage } from './renderer';
import { planRain, RAIN_PRESETS, weatherProfile, rainTiming, sampleRain, smooth, validEpisode, WEATHER } from './schedule';
import type { RainEpisode, RainPreset } from './schedule';
import type { RainSchema } from './patch';
import { createWeatherAudio, rainSoundLevel } from './audio';
import { PUDDLES, PUDDLE_SURFACE_REVISION } from './puddles';
import { readWeatherGeneration, readWeatherVolumes } from './preferences';
import type { PuddleDetail } from './preferences';
import { stormStrikes, strikeLight, LIGHTNING } from './lightning';
import type { Strike, LightningFrame, Point } from './lightning';
import { readSurfaceTuning } from './tuning';
import { buildMapSurface } from './mapSurface';
import type { CollisionSurface,MapSchema,V3 } from './mapSurface';
import { createSplashEmitter } from './splashes';
import type { WetTank } from './splashes';
import { lightAttenuation,attenuateLighting } from './lighting';
import { cloudTone,mapTheme,mapWeather } from './environment';
import type { MapTheme } from './environment';
import { treeWindShader } from './treeWind';
import { hullSurface,nativeMatrix } from './tankSurface';
import { createSkyboxUniforms,skyboxDarkness,skyboxShader } from './skybox';
import { weatherPalette,suppressNativeFog,suppressOverlayDepth } from './appearance';
import { installSunRays } from '../sunRays';
import { readGraphicsTuning } from '../graphicsPreferences';
type Native = Record<string, unknown>;
const nativeObject=(value:unknown):Native|undefined=>value!==null&&typeof value==='object'?value as Native:undefined;
const STORE='ki.rain-episodes.v1';
const random=()=>{const data=new Uint32Array(1);crypto.getRandomValues(data);return data[0]/4294967296;};
function clock(text:string):number|undefined{
    const p=text.trim().split(':');if(p.length<2||p.length>3||p.some(v=>!/^\d+$/.test(v)))return;
    const n=p.map(Number);if(n[n.length-1]>59||n.length===3&&n[1]>59)return;
    return n.reduce((a,b)=>a*60+b,0);
}
export function rainFog(renderer:Native,s:RainSchema):{fog:[number,number,number];color:[number,number,number,number]}{
    const settings=nativeObject(renderer[s.settings]);
    const enabled=settings?.[s.fogEnabled]===true&&settings?.[s.mapFog]===true;
    const near=Math.max(450,Math.min(1600,(Number(renderer[s.fogStart])||7500)*WEATHER.fogDistanceScale));
    const far=Math.max(near+1200,Math.min(6000,(Number(renderer[s.fogEnd])||46000)*WEATHER.fogDistanceScale));
    const c=nativeObject(renderer[s.fogColor])||{};
    const value=(key:string,fallback:number)=>typeof c[key]==='number'&&Number.isFinite(c[key])?Math.max(0,Math.min(1,c[key])):fallback;
    return {fog:[enabled?1:0,near,far],color:[value(s.red,.65),value(s.green,.72),value(s.blue,.82),value(s.alpha,1)]};
}
export function installRainWeather(page:Window){
    const scope=featureScope('rainWeather',{budgetMs:12});
    const sunlight=installSunRays(page);
    const episodes=new Map<string,RainEpisode>();
    const contexts=new Map<WebGL2RenderingContext,ReturnType<typeof createRainRenderer>>();
    let enabled=false,present=false,battleId:string|undefined,nativeLoaded:boolean|undefined;
    let mapName:string|undefined;
    let entryAt=0,lastFrame=0,current:RainEpisode|undefined,hookReady=false,error:string|null=null;
    let override:RainEpisode|undefined;
    let draws=0;
    let nativeFrameAt=-Infinity,nativeMapCaptured=false,terrainSnow=false,seasonPendingId=false;
    let nativeCanvas:HTMLCanvasElement|OffscreenCanvas|undefined;
    let battleScenes=new WeakSet<object>(),sceneCount=0,suspended=false;
    const excluded=()=>!!document.querySelector(gameDOM.screens.weatherExcluded);
    let patchState:'pending'|'loading'|'installed'|'unsupported'|'conflict'|'error'='pending';
    let puddles=false,puddleAmount=0,puddleAt=performance.now();
    const puddleDetail:PuddleDetail='high';
    let surfaceTuning=readSurfaceTuning(localStorage);
    let graphics=readGraphicsTuning(localStorage);
    let pendingMap:{raw:unknown;schema:MapSchema}|undefined,mapSurface:CollisionSurface|undefined,mapError:string|null=null,nativeLightingReady=false;
    const tanks=new Map<object,WetTank>(),splashes=createSplashEmitter();
    const hulls=new WeakMap<object,Float32Array>(),themes=new Map<string,MapTheme>(),snowBattles=new Set<string>();
    const theme=()=>battleId?themes.get(battleId):undefined;
    const precipitation=()=>mapWeather(theme(),mapName,terrainSnow);
    const permits=(plan:RainEpisode|undefined):plan is RainEpisode=>!!plan&&!!precipitation()&&(plan.precipitation??'rain')===precipitation();
    const skyUniforms=createSkyboxUniforms();
    let sunDirection:V3=[0,0,1];
    let audio:ReturnType<typeof createWeatherAudio>|null=null;
    let strikePlan:RainEpisode|undefined,strikes:Strike[]=[],strikeOrigin:Point|undefined;
    const heard=new Set<string>(),prepared=new Set<string>();
    try{const data=JSON.parse(sessionStorage.getItem(STORE)||'[]');if(Array.isArray(data))for(const [id,p]of data.slice(-24))
        if(typeof id==='string'&&id.length<150&&validEpisode(p)&&Date.now()-p.start<86400000)episodes.set(id,p);}catch{}
    const save=()=>{try{sessionStorage.setItem(STORE,JSON.stringify([...episodes].slice(-24)));}catch{}};
    const prepareMap=()=>{if(!pendingMap||(!sunlight.enabled()&&precipitation()!=='rain'))return;const capture=pendingMap;pendingMap=undefined;try{mapSurface=buildMapSurface(capture.raw,capture.schema);}catch(cause){mapError=String(cause);}};
    const stopSound=()=>{
        const old=audio;audio=null;if(!old)return;
        try{old.stop();
            page.setTimeout(()=>{old.ctx.close().catch(()=>{});},130);}catch{old.ctx.close().catch(()=>{});}
    };
    const dropContexts=()=>{for(const r of contexts.values())r.dispose();contexts.clear();};
    const leave=()=>{sunlight.reset();present=false;suspended=false;battleScenes=new WeakSet();sceneCount=0;entryAt=0;lastFrame=0;nativeFrameAt=-Infinity;nativeMapCaptured=false;terrainSnow=false;seasonPendingId=false;nativeCanvas=undefined;current=undefined;override=undefined;battleId=undefined;mapName=undefined;nativeLoaded=undefined;strikePlan=undefined;strikeOrigin=undefined;strikes=[];heard.clear();puddleAmount=0;pendingMap=undefined;mapSurface=undefined;tanks.clear();splashes.clear();for(const r of contexts.values())r.clearReflections();stopSound();};
    // A mode change must never leave liquid resources or the previous weather active.
    function reconcileMap(){
        if(permits(current)&&(!override||permits(override)))return;
        // MM can reveal native snow only when its first terrain material binds.
        // Correct the kind of precipitation without rerolling its time or chance.
        const correctSnow=terrainSnow&&!theme()&&precipitation()==='snow';
        current=correctSnow&&current?{...current,precipitation:'snow'}:undefined;
        override=correctSnow&&override?{...override,precipitation:'snow'}:undefined;
        if(current&&battleId){episodes.set(battleId,current);save();}
        puddleAmount=0;strikePlan=undefined;strikes=[];
        splashes.clear();dropContexts();stopSound();
        if(precipitation()!=='rain'&&!sunlight.enabled())mapSurface=undefined;
    }
    const nativeBattle=()=>!excluded()&&nativeLoaded!==false&&performance.now()-nativeFrameAt<1000&&(!nativeCanvas||!('isConnected' in nativeCanvas)||nativeCanvas.isConnected);
    const sync=()=>{
        sunlight.sync();
        let next=false;try{next=localStorage.getItem('k_rain_weather')==='true';}catch{}
        if(enabled&&!next){override=undefined;stopSound();dropContexts();}enabled=next;
        try{puddles=localStorage.getItem('k_rain_puddles')==='true';}catch{puddles=false;}
        surfaceTuning=readSurfaceTuning(localStorage);
        const nextGraphics=readGraphicsTuning(localStorage);
        if(graphics.lightningFrequency!==nextGraphics.lightningFrequency||graphics.lightningDistance!==nextGraphics.lightningDistance){strikePlan=undefined;stopSound();}
        graphics=nextGraphics;
        if((enabled||sunlight.enabled())&&pendingMap)scope.timeout(prepareMap,0);
        audio?.volumes(readWeatherVolumes(localStorage));
        if(excluded()){if(!suspended){suspended=true;tanks.clear();splashes.clear();sunlight.reset();for(const r of contexts.values())r.clearReflections();}stopSound();return;}
        const visible=!!document.querySelector(gameDOM.screens.battleHud)||nativeBattle();
        if(!visible&&present&&(!suspended||nativeLoaded===false))leave();
        if(visible&&!present){present=true;entryAt=Date.now();}
    };
    scope.listen(page,'kasp:settings-changed',sync);scope.listen(page,'storage',sync);
    scope.interval(sync,200);scope.listen(page,'pagehide',()=>{leave();dropContexts();});
    scope.onCleanup(()=>{leave();dropContexts();});sync();
    function sound(level:number,seed:number){
        if(level<.0005){if(audio)stopSound();return;}
        if(!audio){
            try{
                const AC=(page as unknown as {AudioContext:typeof AudioContext}).AudioContext;if(!AC)return;
                const ctx=new AC({latencyHint:'playback'});audio=createWeatherAudio(ctx,seed,readWeatherVolumes(localStorage));ctx.resume().catch(()=>{});
            }catch(cause){error=String(cause);return;}
        }
        audio.level(level);
    }
    scope.listen(page,'pointerdown',()=>{if(enabled&&present&&audio?.ctx.state==='suspended')audio.ctx.resume().catch(()=>{});},{passive:true});
    scope.listen(page,'keydown',()=>{if(enabled&&present&&audio?.ctx.state==='suspended')audio.ctx.resume().catch(()=>{});},{passive:true});
    const weather=(plan:RainEpisode,now:number)=>{const value=sampleRain(plan,now);value.rain*=surfaceTuning.rainIntensity;value.clouds=Math.min(1,value.clouds*graphics.cloudAmount);value.wind*=graphics.wind;value.sound=plan.precipitation==='snow'?0:rainSoundLevel(value.rain);return value;};
    // Normalize by the selected preset: drizzle and downpour both remove native
    // fog completely at their full strength. Zero visible precipitation restores it.
    const rainEnvelope=()=>{
        const plan=override||current;if(!enabled||scope.disabled||!present||excluded()||nativeLoaded===false||!permits(plan)||!plan?.preset||surfaceTuning.rainIntensity<=0)return 0;
        const profile=weatherProfile(plan.preset,plan.precipitation);if(profile.rain<=0)return 0;
        return Math.max(0,Math.min(1,sampleRain(plan,Date.now()).rain/profile.rain))*smooth((Date.now()-entryAt)/1800);
    };
    const api={
        skyShader:skyboxShader,
        skyUniform(gl:WebGL2RenderingContext){
            const plan=override||current,now=Date.now();
            const darkness=enabled&&!scope.disabled&&present&&!excluded()&&nativeLoaded!==false&&permits(plan)&&plan?skyboxDarkness(weather(plan,now),smooth((now-entryAt)/1800),theme()):0;
            skyUniforms(gl,darkness*graphics.darkness);
        },
        patch(state:typeof patchState){patchState=state;},
        environment(id:string,value:unknown){
            const next=mapTheme(value);if(!next||typeof id!=='string'||!/^[\w:-]{1,140}$/.test(id))return;
            themes.set(id,next);while(themes.size>64)themes.delete(themes.keys().next().value!);
            if(id===battleId)reconcileMap();
        },
        /** Called only inside the validated native map snow-material draw branch. */
        terrainSnow(renderer:unknown,s:RainSchema){
            if(terrainSnow||scope.disabled||!nativeMapCaptured||nativeLoaded===false||excluded())return;
            const gl=nativeObject(nativeObject(renderer)?.[s.gl])?.[s.context] as WebGL2RenderingContext|undefined;
            if(!gl||typeof gl.drawArraysInstanced!=='function'||gl.isContextLost())return;
            if(gl.canvas&&'isConnected' in gl.canvas&&!gl.canvas.isConnected)return;
            const root=document.querySelector(gameDOM.screens.battleCanvas);
            if(root&&gl.canvas&&'nodeType' in gl.canvas&&typeof root.contains==='function'&&!root.contains(gl.canvas as Node))return;
            if(nativeCanvas&&gl.canvas!==nativeCanvas)return;
            if(!document.querySelector(gameDOM.screens.battleHud)&&nativeLoaded!==true&&!nativeBattle())return;
            terrainSnow=true;
            if(battleId&&!seasonPendingId){snowBattles.add(battleId);while(snowBattles.size>64)snowBattles.delete(snowBattles.values().next().value!);}
            reconcileMap();
        },
        treeShader:treeWindShader,
        nativeFogStrength(value:number){return suppressNativeFog(value,rainEnvelope()*graphics.fogRemoval);},
        dropZones(gl:WebGL2RenderingContext){
            const plan=override||current;if(!enabled||scope.disabled||!present||excluded()||nativeLoaded===false||!permits(plan)||!plan?.preset)return;
            const sample=weather(plan,Date.now());
            const water=precipitation()==='rain'&&puddles&&sample.rain*puddleAmount>=.002;
            if(water)return suppressOverlayDepth(gl);
        },
        hull(value:unknown,main:unknown,boxes:unknown,schema:MapSchema){
            if(scope.disabled||!value||typeof value!=='object')return;
            try{hulls.set(value,hullSurface(main,boxes,schema));}catch{hulls.delete(value);}
        },
        map(raw:unknown,schema:MapSchema){if(scope.disabled)return;sunlight.reset();nativeMapCaptured=true;terrainSnow=false;seasonPendingId=true;nativeCanvas=undefined;battleScenes=new WeakSet();sceneCount=0;pendingMap={raw,schema};mapSurface=undefined;mapError=null;splashes.clear();if(enabled||sunlight.enabled())scope.timeout(prepareMap,0);},
        tank(value:unknown,schema:MapSchema){
            if(!enabled||scope.disabled||excluded()||!value||typeof value!=='object')return;
            const get=(v:unknown,key:string)=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,key)?.value:undefined;
            if(get(value,schema.active)!==true){tanks.delete(value);return;}
            const read=(v:unknown):V3=>[get(v,schema.x),get(v,schema.y),get(v,schema.z)];
            const position=read(get(value,schema.position)),size=read(get(value,schema.size));if(![...position,...size].every(Number.isFinite)||size.some(n=>n<=0||n>4000))return;
            const hull=hulls.get(value),matrix=nativeMatrix(get(value,schema.matrix),schema);
            const now=performance.now()/1000,old=tanks.get(value),dt=old?now-old.at:0;
            const velocity=old&&dt>.001&&dt<.25?position.map((n,i)=>(n-old.position[i])/dt) as V3:[0,0,0] as V3;
            if(Math.hypot(...velocity)>10000)velocity.fill(0);
            if(old){old.position=position;old.size=size;old.velocity=velocity;old.at=now;old.hull=hull;old.matrix=matrix;}
            else{if(tanks.size>=64)tanks.delete(tanks.keys().next().value!);tanks.set(value,{position,size,velocity,at:now,hull,matrix});}
        },
        lighting(buffer:unknown){
            sunlight.lighting(buffer);
            nativeLightingReady=true;
            if(buffer instanceof Float32Array&&buffer.length>=11&&[buffer[8],buffer[9],buffer[10]].every(Number.isFinite))sunDirection=[-buffer[8],-buffer[9],-buffer[10]];
            if(!enabled||scope.disabled||!present||excluded()||nativeLoaded===false||!permits(override||current))return;
            const plan=override||current;if(!plan)return;const now=Date.now(),sample=weather(plan,now),fade=smooth((now-entryAt)/1800);
            const strike=strikes.find(s=>now>=s.at&&now<s.at+LIGHTNING.duration*1000),flash=strike?strikeLight((now-strike.at)/1000).flash*graphics.lightningFlash:0;
            const factor=lightAttenuation(sample.storm,sample.rain,fade,flash);
            return attenuateLighting(buffer,Math.max(.05,1-(1-factor)*graphics.darkness));
        },
        /** Temporary console preview. Never enables the setting or rewrites the battle's random plan. */
        force(preset:RainPreset='storm',hold=120){
            sync();
            if(!enabled)return {ok:false,reason:'Enable Random battle weather in settings first'};
            if(excluded())return {ok:false,code:'battle-not-visible',reason:'Return to the battle scene first'};
            if(scope.disabled)return {ok:false,reason:'Weather stopped after an error; reload the game'};
            if(!hookReady)return {ok:false,code:'render-hook-missing',reason:'Weather render hook has not run. Reload the game after updating the extension; check status().patch if it persists'};
            if(!present)return {ok:false,code:'battle-not-present',reason:'No active battle detected'};
            if(nativeLoaded===false)return {ok:false,code:'battle-loading',reason:'Battle loading has not finished'};
            if(!precipitation())return {ok:false,code:'map-weather-unavailable',reason:precipitation()===null?'Weather is disabled on this map':'Wait for native map metadata'};
            if(!current)return {ok:false,code:'battle-loading',reason:'Battle loading has not finished; wait for a valid battle render frame'};
            if(!Object.prototype.hasOwnProperty.call(RAIN_PRESETS,preset)||!Number.isFinite(hold))return {ok:false,reason:'Invalid preset or duration'};
            override={version:1,preset,start:Date.now(),hold:Math.max(15,Math.min(180,hold)),seed:Math.floor(random()*0xffffff),fadeIn:graphics.fadeIn,fadeOut:graphics.fadeOut,precipitation:precipitation()!};
            stopSound();
            return {ok:true,preset,hold:override.hold,fadeIn:override.fadeIn,fadeOut:override.fadeOut};
        },
        clearOverride(){override=undefined;stopSound();},
        battle(value:unknown,schema:Record<string,string>){
            if(!value||typeof value!=='object')return;const v=value as Native;
            const loaded=v[schema.battleLoaded];if(typeof loaded==='boolean')nativeLoaded=loaded;
            if(loaded===false){sunlight.reset();override=undefined;mapName=undefined;nativeFrameAt=-Infinity;terrainSnow=false;seasonPendingId=false;nativeCanvas=undefined;splashes.clear();tanks.clear();for(const r of contexts.values())r.clearReflections();stopSound();return;}
            try{const id=String(v[schema.battleId]);if(/^[\w:-]{1,140}$/.test(id)&&id!=='undefined'&&id!=='null'){
                if(battleId&&battleId!==id){override=undefined;current=episodes.get(id);mapName=undefined;if(!seasonPendingId)terrainSnow=false;stopSound();}
                else if(!battleId)current=episodes.get(id)||current;
                battleId=id;
                seasonPendingId=false;
                if(snowBattles.has(id))terrainSnow=true;
                else if(terrainSnow){snowBattles.add(id);while(snowBattles.size>64)snowBattles.delete(snowBattles.values().next().value!);}
            }}catch{}
            const name=v[schema.mapNameWithoutMode||schema.mapName];
            if(typeof name==='string'&&name.trim()&&name.length<=200){
                mapName=name.trim();
            }
            reconcileMap();
        },
        frame(renderer:unknown,scene:unknown,camera:unknown,s:RainSchema,stage:RainStage='all'){
            hookReady=true;if((!enabled&&!sunlight.enabled())||scope.disabled)return;
            scope.run(()=>{
                if(excluded()){sync();return;}
                if(nativeLoaded===false||!scene||typeof scene!=='object')return;
                const r=nativeObject(renderer),c=nativeObject(camera);if(!r||!c)return;
                const gl=nativeObject(r[s.gl])?.[s.context] as WebGL2RenderingContext|undefined;
                const vp=c[s.vp],p=nativeObject(c[s.camera]);if(!gl||typeof gl.drawArraysInstanced!=='function'||gl.isContextLost()||!(vp instanceof Float32Array)||vp.length!==16||!p)return;
                if(gl.canvas&&'isConnected' in gl.canvas&&!gl.canvas.isConnected)return;
                // WebGL HUDs need no HTML battle wrapper. Require a captured map
                // plus native loaded/tank evidence; an arbitrary canvas is insufficient.
                const hud=!!document.querySelector(gameDOM.screens.battleHud),freshTank=[...tanks.values()].some(t=>performance.now()/1000-t.at<.5);
                const battleRoot=document.querySelector(gameDOM.screens.battleCanvas);
                if(battleRoot&&gl.canvas&&'nodeType' in gl.canvas&&typeof battleRoot.contains==='function'&&!battleRoot.contains(gl.canvas as Node))return;
                if(!battleScenes.has(scene)){
                    if(!hud&&!(nativeMapCaptured&&(freshTank||nativeLoaded===true&&sceneCount===0)))return;
                    battleScenes.add(scene);sceneCount++;
                }
                nativeCanvas=gl.canvas;
                if(nativeMapCaptured&&(nativeLoaded===true||freshTank))nativeFrameAt=performance.now();
                suspended=false;
                if(!present)sync();if(!present)return;
                const cameraPosition=[p[s.x],p[s.y],p[s.z]] as V3;if(!cameraPosition.every(Number.isFinite))return;
                if(stage!=='sky'&&sunlight.enabled()){
                    prepareMap();
                    const plan=enabled?(override||current):undefined,sample=plan?weather(plan,Date.now()):undefined;
                    sunlight.frame(gl,vp,cameraPosition,mapSurface,theme(),sample?Math.min(1,sample.clouds*.55+sample.rain*.5+sample.storm*.6):0,mapName);
                }
                if(!enabled)return;
                const mode=precipitation();if(!mode)return;
                const getRenderer=()=>{
                    let gpu=contexts.get(gl);if(!gpu){
                        if(contexts.size>=2){const oldest=contexts.keys().next().value!;contexts.get(oldest)?.dispose();contexts.delete(oldest);}
                        gpu=createRainRenderer(gl);contexts.set(gl,gpu);
                        scope.listen(gl.canvas,'webglcontextlost',()=>{contexts.get(gl)?.dispose();contexts.delete(gl);});
                        scope.listen(gl.canvas,'webglcontextrestored',()=>{entryAt=Date.now();});
                    }return gpu;
                };
                const now=Date.now();
                // One episode belongs to the battle, not each native render scene.
                // Loading/secondary canvases can render before the statistics ID
                // arrives. They must neither reroll weather nor reset its fade.
                if(!current){
                    const remaining=clock(document.querySelector(gameDOM.presence.timer)?.textContent||'');
                    const cached=battleId?episodes.get(battleId):undefined;
                    current=permits(cached)?cached:planRain(now,remaining,random,{...readWeatherGeneration(localStorage),precipitation:mode},graphics);
                }
                if(battleId&&episodes.get(battleId)!==current){episodes.set(battleId,current);while(episodes.size>24)episodes.delete(episodes.keys().next().value!);save();}
                if(override&&sampleRain(override,now).finished)override=undefined;
                const activePlan=override||current,sample=weather(activePlan,now);
                if(strikePlan!==activePlan){strikePlan=activePlan;strikes=stormStrikes(activePlan,graphics);strikeOrigin=undefined;heard.clear();prepared.clear();}
                lastFrame=performance.now();
                const elapsed=Math.max(0,Math.min(.25,(lastFrame-puddleAt)/1000));puddleAt=lastFrame;
                const allowPuddles=mode==='rain';
                if(!allowPuddles)puddleAmount=0;
                else puddleAmount+=(Number(puddles)-puddleAmount)*(1-Math.exp(-elapsed/PUDDLES.fadeSeconds));
                if(!activePlan.preset||sample.finished){stopSound();for(const r of contexts.values())r.clearReflections();return;}
                const gpu=getRenderer();
                // Compile while an episode is still waiting, rather than stalling at the first drop.
                gpu.warm(puddles&&allowPuddles,puddleDetail,activePlan.precipitation);
                for(const [key,tank]of tanks)if(lastFrame/1000-tank.at>.5)tanks.delete(key);
                prepareMap();
                if(!sample.active)return;
                const fog=rainFog(r,s),fade=smooth((now-entryAt)/1800);
                fog.fog[0]*=1-rainEnvelope()*graphics.fogRemoval;
                const nearby=[...tanks.values()].sort((a,b)=>Math.hypot(a.position[0]-cameraPosition[0],a.position[1]-cameraPosition[1])-Math.hypot(b.position[0]-cameraPosition[0],b.position[1]-cameraPosition[1])).slice(0,12);
                if(!strikeOrigin)strikeOrigin=[cameraPosition[0],cameraPosition[1],0];
                const strike=strikes.find(s=>now>=s.at&&now<s.at+LIGHTNING.duration*1000);
                let lightning:LightningFrame|undefined;
                if(strike){const age=(now-strike.at)/1000,light=strikeLight(age);lightning={strike,age,power:light.power*graphics.lightningBrightness,flash:light.flash*graphics.lightningFlash,origin:strikeOrigin};}
                if(stage!=='sky'){
                    sound(sample.sound*fade,activePlan.seed);
                    for(const s of strikes){const key=String(s.id),owner=audio;if(!owner||now>=s.at||s.at-now>10000||prepared.has(key))continue;
                        prepared.add(key);scope.timeout(()=>{if(audio===owner)owner.prepareThunder(s.seed);},0);
                    }
                    for(const s of strikes){const key=String(s.id);if(now<s.at||now>s.at+s.delay*1000||heard.has(key))continue;
                        if(audio?.thunder(key,s.seed,s.delay-(now-s.at)/1000))heard.add(key);
                    }
                }
                if(activePlan.precipitation==='snow')splashes.clear();
                const splashData=stage!=='sky'&&activePlan.precipitation!=='snow'?splashes.update({time:lastFrame/1000,seed:activePlan.seed,rain:sample.rain,wind:sample.wind,puddles:puddleAmount,camera:cameraPosition,map:mapSurface,tanks:nearby,tuning:surfaceTuning,vp}):undefined;
                gpu.draw({graphics,precipitation:activePlan.precipitation,vp,camera:cameraPosition,time:lastFrame/1000,seed:activePlan.seed,fade,...sample,skyDarkness:skyboxDarkness(sample,fade,theme())*graphics.darkness,cloudTone:cloudTone(theme()),sunDirection,lightning,puddles:puddleAmount,puddleDetail,surfaceTuning,map:mapSurface,splashData,nativeLighting:true,fog:fog.fog,fogColor:fog.color,cloudPalette:activePlan.precipitation==='snow'?SNOW_PALETTES[activePlan.preset]:weatherPalette(activePlan.preset)},stage);draws++;
            });
        },
        status:()=>({enabled,suspended:suspended||excluded(),precipitation:precipitation()??null,nativeFogSuppression:rainEnvelope(),present,hookReady,patch:patchState,nativeLoaded:nativeLoaded??null,nativeBattle:nativeBattle(),environment:{theme:theme()??null,terrainSnow,weatherAllowed:!!precipitation(),cloudTone:cloudTone(theme()),palette:(override||current)?.preset??'storm'},surfaceRevision:PUDDLE_SURFACE_REVISION,battleId:battleId??null,episode:current?{...current}:null,override:override?{...override}:null,
            timing:override||current?rainTiming((override||current)!,Date.now()):null,
            weather:override||current?weather((override||current)!,Date.now()):null,puddles,puddlesAllowed:precipitation()==='rain',puddleBlockedReason:precipitation()==='rain'?null:precipitation()==='snow'?'snowfall':precipitation()===null?'map-excluded':'map-metadata-pending',mapName:mapName??null,foliageAnimation:false,puddleAmount,puddleDetail,surfaceTuning:{...surfaceTuning},graphics:{...graphics},draws,error,audio:audio?.ctx.state??'off',
            sound:audio?.status()??null,strikes:strikes.map(s=>({...s})),
            map:{ready:!!mapSurface,triangles:mapSurface?.triangles??0,pending:!!pendingMap,error:mapError},nativeLightingReady,tanks:tanks.size,tankSurfaces:[...tanks.values()].filter(t=>t.hull?.length&&t.matrix).length,splashes:splashes.status(),
            renderers:[...contexts.values()].map(r=>r.status()),runtime:scope.status()}),
    };
    // Also stop sound when native rendering stops, even if a stale HUD remains mounted.
    scope.interval(()=>{if(audio&&performance.now()-lastFrame>2000)stopSound();},500);
    return api;
}
