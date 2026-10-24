import { featureScope } from '../featureRuntime';
import { gameDOM } from '../gameDOM';
import { createRainRenderer } from './renderer';
import type { RainStage } from './renderer';
import { planRain, RAIN_PRESETS, sampleRain, smooth, validEpisode, WEATHER } from './schedule';
import type { RainEpisode, RainPreset } from './schedule';
import type { RainSchema } from './patch';
import { createWeatherAudio } from './audio';
import { readWeatherVolumes } from './preferences';
import { stormStrikes, strikeLight, LIGHTNING } from './lightning';
import type { Strike, LightningFrame, Point } from './lightning';
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
    const episodes=new Map<string,RainEpisode>(),scenes=new WeakMap<object,{id?:string;plan:RainEpisode}>();
    const contexts=new Map<WebGL2RenderingContext,ReturnType<typeof createRainRenderer>>();
    let enabled=false,present=false,battleId:string|undefined,nativeLoaded:boolean|undefined;
    let entryAt=0,lastFrame=0,current:RainEpisode|undefined,hookReady=false,error:string|null=null;
    let override:RainEpisode|undefined;
    let draws=0;
    let audio:ReturnType<typeof createWeatherAudio>|null=null;
    let strikePlan:RainEpisode|undefined,strikes:Strike[]=[],strikeOrigin:Point|undefined;
    const heard=new Set<string>(),prepared=new Set<string>();
    try{const data=JSON.parse(sessionStorage.getItem(STORE)||'[]');if(Array.isArray(data))for(const [id,p]of data.slice(-24))
        if(typeof id==='string'&&id.length<150&&validEpisode(p)&&Date.now()-p.start<86400000)episodes.set(id,p);}catch{}
    const save=()=>{try{sessionStorage.setItem(STORE,JSON.stringify([...episodes].slice(-24)));}catch{}};
    const stopSound=()=>{
        const old=audio;audio=null;if(!old)return;
        try{old.stop();
            page.setTimeout(()=>{old.ctx.close().catch(()=>{});},130);}catch{old.ctx.close().catch(()=>{});}
    };
    const dropContexts=()=>{for(const r of contexts.values())r.dispose();contexts.clear();};
    const leave=()=>{present=false;entryAt=0;lastFrame=0;current=undefined;override=undefined;battleId=undefined;nativeLoaded=undefined;strikePlan=undefined;strikeOrigin=undefined;strikes=[];heard.clear();stopSound();};
    const sync=()=>{
        let next=false;try{next=localStorage.getItem('k_rain_weather')==='true';}catch{}
        if(enabled&&!next){override=undefined;stopSound();dropContexts();}enabled=next;
        audio?.volumes(readWeatherVolumes(localStorage));
        const visible=!!document.querySelector(gameDOM.screens.battleHud);
        if(!visible&&present)leave();
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
    const api={
        /** Temporary console preview. Never enables the setting or rewrites the battle's random plan. */
        force(preset:RainPreset='storm',hold=120){
            sync();
            if(!enabled)return {ok:false,reason:'Enable Random battle weather in settings first'};
            if(scope.disabled)return {ok:false,reason:'Weather stopped after an error; reload the game'};
            if(!present||nativeLoaded===false||!current)return {ok:false,reason:'Enter a battle and wait for its first rendered frame'};
            if(!Object.prototype.hasOwnProperty.call(RAIN_PRESETS,preset)||!Number.isFinite(hold))return {ok:false,reason:'Invalid preset or duration'};
            override={version:1,preset,start:Date.now(),hold:Math.max(15,Math.min(180,hold)),seed:Math.floor(random()*0xffffff),fadeIn:WEATHER.fadeIn,fadeOut:WEATHER.fadeOut};
            stopSound();
            return {ok:true,preset,hold:override.hold,fadeIn:override.fadeIn,fadeOut:override.fadeOut};
        },
        clearOverride(){override=undefined;stopSound();},
        battle(value:unknown,schema:Record<string,string>){
            if(!value||typeof value!=='object')return;const v=value as Native;
            const loaded=v[schema.battleLoaded];if(typeof loaded==='boolean')nativeLoaded=loaded;
            if(loaded===false){override=undefined;stopSound();return;}
            try{const id=String(v[schema.battleId]);if(/^[\w:-]{1,140}$/.test(id)&&id!=='undefined'&&id!=='null'){
                if(battleId&&battleId!==id){override=undefined;stopSound();}
                battleId=id;
            }}catch{}
        },
        frame(renderer:unknown,scene:unknown,camera:unknown,s:RainSchema,stage:RainStage='all'){
            hookReady=true;if(!enabled||scope.disabled)return;
            scope.run(()=>{
                if(!present)sync();if(!present||nativeLoaded===false||!scene||typeof scene!=='object')return;
                const r=nativeObject(renderer),c=nativeObject(camera);if(!r||!c)return;
                const gl=nativeObject(r[s.gl])?.[s.context] as WebGL2RenderingContext|undefined;
                const vp=c[s.vp],p=nativeObject(c[s.camera]);if(!gl||typeof gl.drawArraysInstanced!=='function'||gl.isContextLost()||!(vp instanceof Float32Array)||vp.length!==16||!p)return;
                const now=Date.now();let record=scenes.get(scene);
                if(!record||battleId&&record.id&&record.id!==battleId){
                    const remaining=clock(document.querySelector(gameDOM.presence.timer)?.textContent||'');
                    record={id:battleId,plan:battleId&&episodes.get(battleId)||planRain(now,remaining,random)};scenes.set(scene,record);
                }
                if(battleId&&!record.id){record.id=battleId;record.plan=episodes.get(battleId)||record.plan;}
                if(battleId&&!episodes.has(battleId)){episodes.set(battleId,record.plan);while(episodes.size>24)episodes.delete(episodes.keys().next().value!);save();}
                current=record.plan;
                if(override&&sampleRain(override,now).finished)override=undefined;
                const activePlan=override||current,sample=sampleRain(activePlan,now);
                if(strikePlan!==activePlan){strikePlan=activePlan;strikes=stormStrikes(activePlan);strikeOrigin=undefined;heard.clear();prepared.clear();}
                lastFrame=performance.now();if(!activePlan.preset||sample.finished){stopSound();return;}
                let gpu=contexts.get(gl);if(!gpu){
                    if(contexts.size>=2){const oldest=contexts.keys().next().value!;contexts.get(oldest)?.dispose();contexts.delete(oldest);}
                    gpu=createRainRenderer(gl);contexts.set(gl,gpu);
                    scope.listen(gl.canvas,'webglcontextlost',()=>{contexts.get(gl)?.dispose();contexts.delete(gl);});
                    scope.listen(gl.canvas,'webglcontextrestored',()=>{entryAt=Date.now();});
                }
                // Compile while an episode is still waiting, rather than stalling at the first drop.
                gpu.warm();if(!sample.active)return;
                const fog=rainFog(r,s),fade=smooth((now-entryAt)/1800);
                const cameraPosition=[p[s.x],p[s.y],p[s.z]] as [number,number,number];
                if(!cameraPosition.every(Number.isFinite))return;
                if(!strikeOrigin)strikeOrigin=[cameraPosition[0],cameraPosition[1],0];
                const strike=strikes.find(s=>now>=s.at&&now<s.at+LIGHTNING.duration*1000);
                let lightning:LightningFrame|undefined;
                if(strike){const age=(now-strike.at)/1000;lightning={strike,age,...strikeLight(age),origin:strikeOrigin};}
                if(stage!=='sky'){
                    sound(sample.sound*fade,activePlan.seed);
                    for(const s of strikes){const key=String(s.id),owner=audio;if(!owner||now>=s.at||s.at-now>10000||prepared.has(key))continue;
                        prepared.add(key);scope.timeout(()=>{if(audio===owner)owner.prepareThunder(s.seed);},0);
                    }
                    for(const s of strikes){const key=String(s.id);if(now<s.at||now>s.at+s.delay*1000||heard.has(key))continue;
                        if(audio?.thunder(key,s.seed,s.delay-(now-s.at)/1000))heard.add(key);
                    }
                }
                gpu.draw({vp,camera:cameraPosition,time:lastFrame/1000,seed:activePlan.seed,fade,...sample,lightning,fog:fog.fog,fogColor:fog.color},stage);draws++;
            });
        },
        status:()=>({enabled,present,hookReady,battleId:battleId??null,episode:current?{...current}:null,override:override?{...override}:null,
            weather:override||current?sampleRain((override||current)!,Date.now()):null,draws,error,audio:audio?.ctx.state??'off',
            sound:audio?.status()??null,strikes:strikes.map(s=>({...s})),
            renderers:[...contexts.values()].map(r=>r.status()),runtime:scope.status()}),
    };
    // Also stop sound when native rendering stops, even if a stale HUD remains mounted.
    scope.interval(()=>{if(audio&&performance.now()-lastFrame>2000)stopSound();},500);
    return api;
}
