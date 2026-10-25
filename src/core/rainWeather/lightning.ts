import { WEATHER } from './schedule';
import type { RainEpisode } from './schedule';

export const LIGHTNING=Object.freeze({firstMin:8,firstMax:18,gapMin:20,gapMax:35,maxStrikes:7,duration:.75,
    radiusMin:85000,radiusMax:125000,unitsPerMetre:100,soundSpeed:343,maxSegments:256});
export type Point=[number,number,number];
export interface Strike {id:number;at:number;seed:number;azimuth:number;radius:number;delay:number;}
export interface LightningFrame {strike:Strike;age:number;power:number;flash:number;origin:Point;}
export function seeded(seed:number){let state=seed>>>0||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
export function stormStrikes(plan:RainEpisode):Strike[]{
    if(plan.preset!=='storm')return[];
    const random=seeded(plan.seed^0x71e64ad9),out:Strike[]=[];
    let seconds=plan.fadeIn+LIGHTNING.firstMin+random()*(LIGHTNING.firstMax-LIGHTNING.firstMin);
    while(seconds<plan.fadeIn+plan.hold-8&&out.length<LIGHTNING.maxStrikes){
        const radius=LIGHTNING.radiusMin+random()*(LIGHTNING.radiusMax-LIGHTNING.radiusMin);
        out.push({id:out.length,at:plan.start+seconds*1000,seed:Math.floor(random()*0xffffff),
            azimuth:random()*Math.PI*2,radius,delay:radius/LIGHTNING.unitsPerMetre/LIGHTNING.soundSpeed});
        seconds+=LIGHTNING.gapMin+random()*(LIGHTNING.gapMax-LIGHTNING.gapMin);
    }
    return out;
}
export function strikeLight(age:number){
    if(age<0||age>LIGHTNING.duration)return {power:0,flash:0};
    const pulse=(start:number,width:number)=>{const t=(age-start)/width;return t<0?0:(1-Math.exp(-t*25))*Math.exp(-t*5);};
    const power=Math.min(1,pulse(0,.32)*1.9+pulse(.14,.25)*1.25+pulse(.31,.25)*.55);
    const flash=Math.min(1,power*.65+Math.exp(-age*6)*(1-Math.exp(-age*80))*.4);
    return {power,flash};
}
/** Real world-space branches, generated once per strike; no camera-facing image. */
export function buildBolt(strike:Strike,origin:Point):Float32Array{
    const random=seeded(strike.seed),segments:number[]=[],base:Point=[origin[0]+Math.cos(strike.azimuth)*strike.radius,origin[1]+Math.sin(strike.azimuth)*strike.radius,0];
    const top:Point=[base[0]+(random()-.5)*2200,base[1]+(random()-.5)*2200,WEATHER.cloudBase+WEATHER.cloudThickness*.9];
    const bottom:Point=[base[0],base[1],250];
    const path=(a:Point,b:Point,levels:number,displacement:number):Point[]=>{
        if(!levels)return[a,b];
        const middle:Point=[(a[0]+b[0])*.5+(random()-.5)*displacement,(a[1]+b[1])*.5+(random()-.5)*displacement,(a[2]+b[2])*.5];
        return [...path(a,middle,levels-1,displacement*.55).slice(0,-1),...path(middle,b,levels-1,displacement*.55)];
    };
    const add=(points:Point[],energy:number,width:number,taper:boolean)=>{
        for(let i=1;i<points.length&&segments.length/8<LIGHTNING.maxSegments;i++){
            const strength=energy*(taper?1-(i/points.length)*.85:1);
            segments.push(...points[i-1],...points[i],strength,width);
        }
    };
    const trunk=path(top,bottom,6,3200);add(trunk,1,1,false);
    for(let branch=0;branch<11;branch++){
        const start=trunk[6+Math.floor(random()*44)],angle=strike.azimuth+(random()-.5)*5,
            length=1800+random()*4800,end:Point=[start[0]+Math.cos(angle)*length,start[1]+Math.sin(angle)*length,Math.max(300,start[2]-length*(.35+random()*.65))];
        add(path(start,end,3,length*.32),.25+random()*.4,.4+random()*.25,true);
    }
    return new Float32Array(segments);
}
