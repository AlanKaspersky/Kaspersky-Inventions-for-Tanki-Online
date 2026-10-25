import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from '../clientPatches';
import type { PreparedPatchPlan } from '../clientPatches';
export interface RainSchema {
    gl: string; context: string; vp: string; camera: string; x:string;y:string;z:string;
    settings:string; fogEnabled:string; mapFog:string; fogStart:string; fogEnd:string;
    fogColor:string; red:string;green:string;blue:string;alpha:string;
}
export interface RainPlan extends PreparedPatchPlan { format:'ki-rain-v2';status:{ready:boolean;issues:string[]};schema:RainSchema;
    scene?:{capabilities:{map?:boolean;lighting?:boolean;tanks?:boolean;environment?:boolean;treeWind?:boolean;skyTone?:boolean;fogSuppression?:boolean;dropZones?:boolean};issues:string[]}; }
export async function selectRainPlan(code:string,plans:readonly RainPlan[]):Promise<RainPlan|undefined>{
    const supported=plans.filter(p=>p.format==='ki-rain-v2'&&p.status.ready);
    if(supported.some(p=>p.sourceLength===code.length)){
        const hash=await clientSourceHash(code);const exact=supported.find(p=>p.sha256===hash&&validatePatchEdits(code,p));if(exact)return exact;
    }
    for(const plan of [...supported].reverse()){
        const adapted=resolveTemplateEdits(code,plan);if(!adapted)continue;
        const schema={...plan.schema};let valid=true;
        for(const key of Object.keys(schema) as (keyof RainSchema)[]){const value=adapted.roles.get(key);if(!value){valid=false;break;}schema[key]=value;}
        if(!valid)continue;
        const edits=adapted.edits.map(e=>({...e,text:e.text.replace('__KI_RAIN_SCHEMA__',JSON.stringify(schema))}));
        const result={...plan,sourceLength:code.length,edits,schema};if(validatePatchEdits(code,result))return result;
    }
}
