import { seeded } from './lightning';
import type { WeatherVolumes } from './preferences';

export const WEATHER_AUDIO=Object.freeze({rainVolume:.85,bedSeconds:6,bedRms:.14,automationHz:20,
    thunderSeconds:8,thunderRate:16000,thunderPeak:.68});
/** Same intensity that controls visible instance count; storm keeps its old peak. */
export function rainSoundLevel(rain:number):number{
    return Number.isFinite(rain)?Math.max(0,Math.min(1,rain))*.45:0;
}
/** Stationary, seamless noise; no moving panner, camera occlusion or short repeating gust. */
export function rainSamples(rate:number,seed:number):Float32Array{
    const length=Math.round(rate*WEATHER_AUDIO.bedSeconds),overlap=Math.round(rate*.08),raw=new Float32Array(length+overlap),random=seeded(seed);
    let soft=0,low=0;
    for(let i=0;i<raw.length;i++){const white=random()*2-1;soft=soft*.8+white*.2;low=low*.985+white*.015;raw[i]=white*.75+soft*.7+low*.6;}
    const output=raw.slice(0,length);
    for(let i=0;i<overlap;i++){const t=i/overlap;output[i]=raw[length+i]*Math.cos(t*Math.PI*.5)+raw[i]*Math.sin(t*Math.PI*.5);}
    // Long-window loudness normalization removes the loop's apparent swell without
    // an audible compressor pumping the sound in response to gameplay.
    const block=Math.round(rate*.25),gains:number[]=[];
    for(let start=0;start<length;start+=block){let sum=0;const end=Math.min(length,start+block);for(let i=start;i<end;i++)sum+=output[i]*output[i];gains.push(WEATHER_AUDIO.bedRms/Math.sqrt(sum/(end-start)||1));}
    for(let i=0;i<length;i++){const position=i/block-.5,left=Math.floor(position),t=position-left,a=gains[(left+gains.length)%gains.length],b=gains[(left+1+gains.length)%gains.length];output[i]*=a+(b-a)*t;}
    return output;
}
/** Distant rolling thunder: several delayed acoustic arrivals with a low-frequency body. */
export function thunderSamples(rate:number,seed:number):Float32Array{
    const out=new Float32Array(Math.round(rate*WEATHER_AUDIO.thunderSeconds)),random=seeded(seed^0x4e142a93);
    const arrivals=[0,.19+random()*.2,.65+random()*.3,1.3+random()*.5],weights=[1,.7,.45,.28];let low=0,body=0,peak=0;
    for(let i=0;i<out.length;i++){
        const t=i/rate,white=random()*2-1;low=low*.994+white*.006;body=body*.94+white*.06;
        let envelope=0;for(let j=0;j<arrivals.length;j++){const age=t-arrivals[j];if(age>=0)envelope+=weights[j]*(1-Math.exp(-age*28))*Math.exp(-age/(1.2+j*.35));}
        const rumble=Math.sin(t*2*Math.PI*37+low*9)*.1+Math.sin(t*2*Math.PI*53)*.035;
        const tail=Math.min(1,(WEATHER_AUDIO.thunderSeconds-t)/.8);
        out[i]=(low*3.3+body*.7+rumble)*envelope*Math.max(0,tail);peak=Math.max(peak,Math.abs(out[i]));
    }
    const scale=WEATHER_AUDIO.thunderPeak/Math.max(peak,.001);for(let i=0;i<out.length;i++)out[i]*=scale;
    return out;
}
export function createWeatherAudio(ctx:AudioContext,seed:number,initial:WeatherVolumes={rain:1,thunder:1}){
    const bounded=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):1;
    const volumes:WeatherVolumes={rain:bounded(initial.rain),thunder:bounded(initial.thunder)};
    const master=ctx.createGain(),bed=ctx.createGain(),rainGain=ctx.createGain(),thunderGain=ctx.createGain(),source=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter();
    const buffer=ctx.createBuffer(2,Math.round(ctx.sampleRate*WEATHER_AUDIO.bedSeconds),ctx.sampleRate);
    for(let channel=0;channel<2;channel++)buffer.getChannelData(channel).set(rainSamples(ctx.sampleRate,seed+channel*17041));
    source.buffer=buffer;source.loop=true;hp.type='highpass';hp.frequency.value=180;lp.type='lowpass';lp.frequency.value=7500;
    master.gain.value=1;bed.gain.value=0;rainGain.gain.value=volumes.rain;thunderGain.gain.value=volumes.thunder;source.connect(hp);hp.connect(lp);lp.connect(bed);bed.connect(rainGain);rainGain.connect(master);thunderGain.connect(master);master.connect(ctx.destination);source.start();
    let lastLevel=-1,lastAt=-Infinity,stopped=false,thunders=0;
    const played=new Set<string>(),thunderBuffers=new Map<number,AudioBuffer>();
    const prepareThunder=(seed:number)=>{
        if(stopped||thunderBuffers.has(seed))return;
        const samples=thunderSamples(WEATHER_AUDIO.thunderRate,seed),buffer=ctx.createBuffer(1,samples.length,WEATHER_AUDIO.thunderRate);buffer.getChannelData(0).set(samples);thunderBuffers.set(seed,buffer);
    };
    return {
        ctx,
        prepareThunder,
        volumes(next:WeatherVolumes){
            if(stopped)return;
            for(const kind of ['rain','thunder'] as const){
                const value=bounded(next[kind]);
                if(value===volumes[kind])continue;
                const gain=(kind==='rain'?rainGain:thunderGain).gain;
                gain.setTargetAtTime(value,ctx.currentTime,.05);volumes[kind]=value;
            }
        },
        level(value:number){
            if(stopped)return;const target=Math.max(0,Math.min(.5,value))*WEATHER_AUDIO.rainVolume,now=ctx.currentTime;
            if(Math.abs(target-lastLevel)<.0015||now-lastAt<1/WEATHER_AUDIO.automationHz)return;
            bed.gain.setTargetAtTime(target,now,.25);lastLevel=target;lastAt=now;
        },
        thunder(key:string,seed:number,delay:number){
            if(stopped||played.has(key)||ctx.state!=='running')return false;
            played.add(key);prepareThunder(seed);
            const node=ctx.createBufferSource(),filter=ctx.createBiquadFilter();node.buffer=thunderBuffers.get(seed)!;filter.type='lowpass';filter.frequency.value=1250;node.connect(filter);filter.connect(thunderGain);
            node.onended=()=>{node.disconnect();filter.disconnect();};node.start(ctx.currentTime+Math.max(0,delay));thunders++;return true;
        },
        stop(){if(stopped)return;stopped=true;const now=ctx.currentTime;master.gain.cancelScheduledValues(now);master.gain.setTargetAtTime(0,now,.025);},
        status:()=>({level:lastLevel,thunders,stopped,volumes:{...volumes}}),
    };
}
