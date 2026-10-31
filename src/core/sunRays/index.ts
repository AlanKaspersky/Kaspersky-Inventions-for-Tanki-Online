import { featureScope } from '../featureRuntime';
import { createRainRenderer } from '../rainWeather/renderer';
import type { CollisionSurface, V3 } from '../rainWeather/mapSurface';
import type { MapTheme } from '../rainWeather/environment';
import { readSunIntensity, mapAllowsSun } from './config';
import { readGraphicsTuning } from '../graphicsPreferences';

/** Uses the existing native battle/map/light hooks; no extra bundle loader or render interception. */
export function installSunRays(page: Window) {
    const scope=featureScope('sunRays',{budgetMs:12});
    const contexts=new Map<WebGL2RenderingContext,ReturnType<typeof createRainRenderer>>();
    let enabled=false,intensity=1,started=performance.now(),frames=0,reason:string|null='disabled';
    let light:{direction:V3;colour:V3}|undefined;
    let observedTheme:MapTheme|undefined;
    let graphics=readGraphicsTuning(localStorage);
    function reset(){for(const renderer of contexts.values())renderer.dispose();contexts.clear();started=performance.now();}
    function sync(){
        const nextGraphics=readGraphicsTuning(localStorage);
        if(nextGraphics.sunShadow!==graphics.sunShadow)reset();
        graphics=nextGraphics;
        let next=false;try{next=localStorage.getItem('k_sun_rays')==='true';}catch{}
        if(next!==enabled){reset();enabled=next;}
        intensity=readSunIntensity(localStorage);if(!enabled)reason='disabled';
    }
    function lighting(buffer:unknown){
        if(!(buffer instanceof Float32Array)||buffer.length<12||![4,5,6,8,9,10].every(i=>Number.isFinite(buffer[i])))return;
        const vector=[-buffer[8],-buffer[9],-buffer[10]] as V3,length=Math.hypot(...vector);
        if(length<.001){light=undefined;return;}
        const direction=vector.map(v=>v/length) as V3;
        const colour=[4,5,6].map(i=>Math.max(0,Math.min(2,buffer[i]))) as V3;
        light={direction,colour};
    }
    function frame(gl:WebGL2RenderingContext,vp:Float32Array,camera:V3,map:CollisionSurface|undefined,theme:MapTheme|undefined,cover=0,name?:string){
        if(!enabled||scope.disabled)return;
        observedTheme=theme;
        if(!mapAllowsSun(theme,name)){reason='night-or-space';return;}
        if(!light||light.direction[2]<.06||Math.max(...light.colour)<.01){reason='native-sun-unavailable';return;}
        if(!map?.supportVertices?.length){reason='map-pending';return;}
        if(intensity<=0||cover>=.999){reason=intensity<=0?'zero-intensity':'overcast';return;}
        scope.run(()=>{
            let renderer=contexts.get(gl);
            if(!renderer){
                if(contexts.size>=2){const oldest=contexts.keys().next().value!;contexts.get(oldest)?.dispose();contexts.delete(oldest);}
                renderer=createRainRenderer(gl);contexts.set(gl,renderer);started=performance.now();
            }
            const age=Math.max(0,Math.min(1,(performance.now()-started)/(graphics.sunFade*1000)));
            renderer.drawSun({vp,camera,map,direction:light!.direction,colour:light!.colour,time:performance.now()/1000,
                fade:age*age*(3-2*age)*(1-Math.max(0,Math.min(1,cover))),intensity,graphics});
            const status=renderer.status();reason=status.sunError||status.sunSkip;frames++;
        });
    }
    const api={
        setEnabled(value:boolean){localStorage.setItem('k_sun_rays',String(value));sync();},
        setIntensity(value:number){if(!Number.isFinite(value))return;localStorage.setItem('k_sun_rays_intensity',String(Math.max(0,value)));sync();},
        status:()=>({prototype:'world-sunlight-v2',enabled,intensity,reason,theme:observedTheme??null,
            nativeLight:light?{direction:[...light.direction],colour:[...light.colour]}:null,frames,
            renderers:[...contexts.values()].map(renderer=>({sunlight:renderer.status().sunlight,error:renderer.status().sunError,skip:renderer.status().sunSkip})),runtime:scope.status()}),
    };
    scope.listen(page,'webglcontextlost',reset,true);
    scope.listen(page,'pagehide',reset);scope.onCleanup(reset);sync();
    page.__kaspSunRays=api;
    return {api,sync,lighting,frame,reset,enabled:()=>enabled&&!scope.disabled};
}
