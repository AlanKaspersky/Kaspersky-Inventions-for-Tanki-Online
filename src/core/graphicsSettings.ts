import { GRAPHICS_CONTROLS, GRAPHICS_FLAGS, defaultGraphicsProfile, parseGraphicsProfile,
    readGraphicsProfile, saveGraphicsProfile, applySunLook } from './graphicsPreferences';
import type { GraphicsLanguage, GraphicsProfile, GraphicsGroup } from './graphicsPreferences';
import { SURFACE_CONTROLS } from './rainWeather/tuning';
import { invalidateSetting } from './settings';

const labels = {
    RU: {
        intro:'Графика под тебя', introHint:'Настройки сохраняются автоматически. В битве: Ctrl+Alt+G.',
        export:'Экспорт', import:'Импорт', reset:'Сбросить всё', resetCard:'Стандартные значения',
        details:'Настроить', enable:'Включено', disable:'Выключено',
        boxes:'Подбор коробок', boxesHint:'Осколки, вспышка и движение', sun:'Шейдер освещения', sunHint:'Готовое оформление света, неба и атмосферы',
        weather:'Случайная погода', weatherHint:'Дождь на обычных картах, снег на зимних',
        puddles:'Лужи', puddlesHint:'Только во время дождя, без покрытия танков и коробок',
        schedule:'Расписание осадков', weatherMotion:'Переходы и атмосфера', rain:'Капли дождя', snow:'Снег и метель',
        clouds:'Облака', lightning:'Молнии и звук', water:'Волны и рябь', reflections:'Отражения и края', splashes:'Брызги',
        light:'Свет и яркость', quality:'Качество расчёта', fragments:'Осколки и движение', fading:'Вспышка и исчезновение',
        atmosphere:'Дымка и цвет', finishing:'Свечение и тени', sunLook:'Оформление света', cinematicLook:'Кинематографичный', originalLook:'Исходное', warmLook:'Тёплый вечер',
        sunLookDone:'Оформление применено. Для отображения включи «Шейдер освещения».',
        chance:'Шанс осадков', duration:'Часть битвы с осадками', preset:'Пресет погоды', rainVolume:'Громкость дождя', thunderVolume:'Громкость грома',
        intensity:'Интенсивность осадков', sunIntensity:'Сила солнечного света',
        policy:'В космосе погоды нет; на «Бойне» нет дождя. При снегопаде лужи отключены. Эти правила сохраняются при импорте.',
        timing:'Шанс, продолжительность, пресет и время переходов применяются со следующей битвы. Остальные параметры меняются без перезагрузки; объекты, уже запущенные в анимацию, могут сохранить прежний вид до её конца.',
        sunNote:'Для новых настроек уже подобрано кинематографичное оформление. Сохранённые значения не перезаписываются. Положение солнца и запечённые тени остаются родными; сила света не ограничена сверху.',
        importDone:'Настройки импортированы.', exported:'JSON сохранён. Его можно отправить другому игроку.', resetDone:'Графические настройки сброшены, функции выключены.',
        resetCardDone:'Параметры функции восстановлены.', invalid:'Не удалось импортировать: проверь формат, версию и диапазоны значений JSON.',
        storageError:'Не удалось сохранить настройки. Проверь доступ к хранилищу браузера.', loading:'Чтение файла…', tooLarge:'Файл слишком большой (максимум 256 КБ).',
        presets:{random:'Случайный',sunny:'Ясно',overcast:'Облачно',drizzle:'Лёгкие осадки',sunshower:'Осадки при солнце',storm:'Шторм / метель'},
    },
    EN: {
        intro:'Make it your atmosphere', introHint:'Changes save automatically. In battle: Ctrl+Alt+G.',
        export:'Export', import:'Import', reset:'Reset all', resetCard:'Restore defaults',
        details:'Configure', enable:'Enabled', disable:'Disabled',
        boxes:'Box pickup', boxesHint:'Fragments, flashes and motion', sun:'Lighting shader', sunHint:'Ready-made lighting, sky and atmosphere',
        weather:'Random weather', weatherHint:'Rain on regular maps, snow on winter maps',
        puddles:'Puddles', puddlesHint:'Only during rain; never on tanks or supply boxes',
        schedule:'Precipitation schedule', weatherMotion:'Transitions and atmosphere', rain:'Raindrops', snow:'Snow and blizzard',
        clouds:'Clouds', lightning:'Lightning and audio', water:'Waves and ripples', reflections:'Reflections and edges', splashes:'Splashes',
        light:'Light and brightness', quality:'Rendering quality', fragments:'Fragments and motion', fading:'Flash and fading',
        atmosphere:'Haze and colour', finishing:'Glow and shadows', sunLook:'Lighting look', cinematicLook:'Cinematic', originalLook:'Original', warmLook:'Warm evening',
        sunLookDone:'Lighting look applied. Enable Lighting shader to see it.',
        chance:'Precipitation chance', duration:'Share of battle with precipitation', preset:'Weather preset', rainVolume:'Rain volume', thunderVolume:'Thunder volume',
        intensity:'Precipitation intensity', sunIntensity:'Sunlight strength',
        policy:'No weather in space; no rain on Massacre. Snowfall never produces puddles. Importing a profile preserves these rules.',
        timing:'Chance, duration, preset and transition times apply from the next battle. Other controls apply without reloading; animations already in progress may retain their previous appearance until they finish.',
        sunNote:'New settings start with a cinematic look. Saved values are preserved. The native sun direction and baked shadows remain; sunlight strength has no upper limit.',
        importDone:'Settings imported.', exported:'JSON saved. You can share it with other players.', resetDone:'Graphics settings reset; features disabled.',
        resetCardDone:'Feature parameters restored.', invalid:'Could not import: check the JSON format, version and value ranges.',
        storageError:'Could not save settings. Check browser storage access.', loading:'Reading file…', tooLarge:'File too large (maximum 256 KB).',
        presets:{random:'Random',sunny:'Clear',overcast:'Overcast',drizzle:'Light precipitation',sunshower:'Sunlit precipitation',storm:'Storm / Blizzard'},
    },
};
const surfaceLabels:Record<typeof SURFACE_CONTROLS[number]['key'],[string,string]> = {
    rainIntensity:['Интенсивность осадков','Precipitation intensity'], edgeInset:['Отступ от обрывов (см)','Drop-off inset (cm)'],
    rippleSizeReduction:['Уменьшение кругов от капель','Rain ripple size reduction'], rippleDensity:['Количество кругов','Ripple density'],
    rippleSpeed:['Скорость кругов','Ripple speed'],rippleStrength:['Сила кругов','Ripple strength'],
    waveSizeReduction:['Уменьшение волн','Wave size reduction'],waveSpeed:['Скорость волн','Wave speed'],waveStrength:['Сила волн','Wave strength'],
    reflectionStrength:['Сила отражений','Reflection strength'],reflectionDistance:['Дальность отражений (см)','Reflection distance (cm)'],
    reflectionRoughness:['Шероховатость воды','Water roughness'],refractionStrength:['Преломление','Refraction strength'],
    groundSplashDensity:['Брызги от земли','Ground splash density'],tankSplashDensity:['Брызги от капель на танке','Raindrop splashes on tanks'],
    splashSpeed:['Скорость брызг','Splash speed'],splashSize:['Размер брызг','Splash size'],splashLifetime:['Время жизни брызг (с)','Splash lifetime (s)'],splashGravity:['Гравитация брызг','Splash gravity'],
};
type Numeric = {field:string;label:string;min:number;max:number;step:number;value:number;unit?:string;scale?:number;options?:readonly number[];unlimited?:boolean};
const text = (v:string) => v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const round = (n:number) => Number(n.toFixed(5));
function controls(profile:GraphicsProfile,lang:GraphicsLanguage):Numeric[] {
    const d=labels[lang],s=profile.settings;
    return [
        ...GRAPHICS_CONTROLS.map(c=>({...c,field:`tuning.${c.key}`,label:c.label[lang],value:s.tuning[c.key]})),
        ...SURFACE_CONTROLS.map(c=>({...c,field:`surface.${c.key}`,label:surfaceLabels[c.key][lang==='RU'?0:1],value:s.surface[c.key]})),
        {field:'generation.chance',label:d.chance,min:0,max:100,step:1,value:s.generation.chance*100,scale:100,unit:'%'},
        {field:'generation.duration',label:d.duration,min:0,max:100,step:1,value:s.generation.duration*100,scale:100,unit:'%'},
        {field:'volumes.rain',label:d.rainVolume,min:0,max:100,step:1,value:s.volumes.rain*100,scale:100,unit:'%'},
        {field:'volumes.thunder',label:d.thunderVolume,min:0,max:100,step:1,value:s.volumes.thunder*100,scale:100,unit:'%'},
        {field:'sunIntensity',label:d.sunIntensity,min:0,max:Math.max(40,s.sunIntensity),step:.1,value:s.sunIntensity,unlimited:true},
    ];
}
function numeric(c:Numeric,lang:GraphicsLanguage,namespace:string) {
    const unit=c.unit==='s'?(lang==='RU'?'с':'s'):c.unit==='m'?(lang==='RU'?'м':'m'):c.unit||'';
    const attr=`data-graphics-field="${c.field}" aria-label="${text(c.label)}"`;
    if(c.options)return `<label class="kasp-gfx-control"><span>${text(c.label)}</span><select ${attr}>${c.options.map(v=>`<option value="${v}" ${v===c.value?'selected':''}>${v} ${unit}</option>`).join('')}</select></label>`;
    return `<div class="kasp-gfx-control"><div class="kasp-gfx-control-heading"><label for="${namespace}-${c.field}">${text(c.label)}</label>
        <span class="kasp-gfx-value"><input id="${namespace}-${c.field}" type="number" min="${c.min}" ${c.unlimited?'':`max="${c.max}"`} step="${c.step}" value="${round(c.value)}" ${attr}><span>${unit}</span></span></div>
        <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${round(c.value)}" ${attr}></div>`;
}
export function renderGraphicsSettings(lang:GraphicsLanguage,namespace='kasp-gfx'):string {
    const d=labels[lang],profile=readGraphicsProfile(localStorage),all=controls(profile,lang);
    const cols=(left:string,right:string)=>`<div class="kasp-gfx-columns"><div class="kasp-gfx-col">${left}</div><div class="kasp-gfx-col">${right}</div></div>`;
    const group=(name:string,fields:string[],extra='')=>`<details class="kasp-gfx-group"><summary><span>${name}</span><span class="kasp-gfx-group-count">${fields.length}${extra?'+':''}</span></summary><div class="kasp-gfx-fields">${fields.map(field=>numeric(all.find(c=>c.field===field)!,lang,namespace)).join('')}${extra}</div></details>`;
    const keys=(name:GraphicsGroup)=>GRAPHICS_CONTROLS.filter(c=>c.group===name).map(c=>`tuning.${c.key}`);
    const surface=(names:string[])=>names.map(n=>`surface.${n}`);
    const toggle=(key:keyof typeof GRAPHICS_FLAGS,title:string)=>`<label class="kasp-gfx-toggle" data-id="${GRAPHICS_FLAGS[key]}"><input type="checkbox" class="kasp-toggle-switch" role="switch" data-graphics-enabled="${key}" aria-label="${title}" ${profile.settings.enabled[key]?'checked':''}><span data-graphics-status="${key}">${profile.settings.enabled[key]?d.enable:d.disable}</span></label>`;
    const card=(id:keyof typeof GRAPHICS_FLAGS,number:string,title:string,hint:string,body:string)=>`<article class="kasp-gfx-card kasp-gfx-${id}"><header><span class="kasp-gfx-index">${number}</span><div><h4>${title}</h4><p>${hint}</p></div>${toggle(id,title)}</header>
        <details class="kasp-gfx-config"><summary>${d.details}<span aria-hidden="true">⌄</span></summary><div class="kasp-gfx-config-body">${body}<button type="button" class="kasp-gfx-reset-card" data-graphics-reset="${id}">${d.resetCard}</button></div></details></article>`;
    const preset=`<label class="kasp-gfx-control kasp-gfx-wide"><span>${d.preset}</span><select data-graphics-preset aria-label="${d.preset}">${Object.entries(d.presets).map(([key,label])=>`<option value="${key}" ${profile.settings.generation.preset===key?'selected':''}>${label}</option>`).join('')}</select></label>`;
    const atmosphere=['sunHaze','sunHazeTemperature','sunHazeStart','sunHazeDistance','sunSkyWarmth','sunExposure','sunContrast','sunSaturation'].map(k=>'tuning.'+k);
    const quality=['tuning.sunSteps','tuning.sunResolution','tuning.sunShadow'];
    const finishing=['sunBloom','sunBloomThreshold','sunBloomRadius','sunShadowSoftness','sunShadowFill','sunToneCurve'].map(k=>'tuning.'+k);
    return `<div class="kasp-graphics-editor"><div class="kasp-gfx-toolbar"><div><h4>${d.intro}</h4><p>${d.introHint}</p></div><div class="kasp-gfx-actions">
        <button type="button" data-graphics-action="export">${d.export}</button><button type="button" data-graphics-action="import">${d.import}</button><button type="button" data-graphics-action="reset">${d.reset}</button></div></div>
        <input type="file" accept=".json,application/json" data-graphics-file hidden><p class="kasp-gfx-message" role="status" aria-live="polite"></p><div class="kasp-gfx-cards">
        ${card('weather','01',d.weather,d.weatherHint,
            `<p class="kasp-gfx-note">${d.policy}</p>`+group(d.schedule,['generation.chance','generation.duration'],preset)+`<p class="kasp-gfx-note">${d.timing}</p>`+
            cols(
                group(d.weatherMotion,['surface.rainIntensity',...keys('weather')])+group(d.snow,keys('snow'))+group(d.lightning,[...keys('lightning'),'volumes.thunder','volumes.rain']),
                group(d.rain,keys('rain'))+group(d.clouds,keys('clouds'))
            ))}
        ${card('puddles','02',d.puddles,d.puddlesHint,
            cols(
                group(d.water,surface(['rippleSizeReduction','rippleDensity','rippleSpeed','rippleStrength','waveSizeReduction','waveSpeed','waveStrength']))+group(d.splashes,surface(['groundSplashDensity','tankSplashDensity','splashSpeed','splashSize','splashLifetime','splashGravity'])),
                group(d.reflections,surface(['edgeInset','reflectionStrength','reflectionDistance','reflectionRoughness','refractionStrength']))
            ))}
        ${card('sunlight','03',d.sun,d.sunHint,`<p class="kasp-gfx-note">${d.sunNote}</p>`+
            `<div class="kasp-gfx-look"><span>${d.sunLook}</span><div class="kasp-gfx-actions"><button type="button" data-graphics-sun-look="cinematic">${d.cinematicLook}</button><button type="button" data-graphics-sun-look="original">${d.originalLook}</button><button type="button" data-graphics-sun-look="warm-evening">${d.warmLook}</button></div></div>`+
            cols(
                group(d.light,['sunIntensity',...keys('sun').filter(k=>![...quality,...atmosphere,...finishing].includes(k))])+group(d.finishing,finishing),
                group(d.atmosphere,atmosphere)+group(d.quality,quality)
            ))}
        ${card('boxes','04',d.boxes,d.boxesHint,
            cols(
                group(d.fragments,keys('boxes').filter(k=>!['tuning.boxFadeStart','tuning.boxFadeDuration','tuning.boxFlash','tuning.boxGlow'].includes(k))),
                group(d.fading,['tuning.boxFlash','tuning.boxGlow','tuning.boxFadeStart','tuning.boxFadeDuration'])
            ))}
        </div></div>`;
}

function animateAccordion(details:HTMLDetailsElement) {
    const summary=details.querySelector('summary');
    const content=details.querySelector<HTMLElement>(':scope > :not(summary)');
    if(!summary||!content)return;
    if(typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        details.open=!details.open;
        return;
    }
    const state=details.getAttribute('data-state');
    const isOpening=state==='closing'?true:(state==='opening'?false:!details.open);
    const existing=(details as unknown as {_anim?:Animation|null})._anim;
    if(existing){existing.cancel();(details as unknown as {_anim?:Animation|null})._anim=null;}
    const comp=window.getComputedStyle(content);
    const pt=comp.paddingTop,pb=comp.paddingBottom,currentH=content.getBoundingClientRect().height;
    if(isOpening){
        details.open=true;
        details.setAttribute('data-state','opening');
        const targetH=content.getBoundingClientRect().height;
        const startH=state==='closing'?currentH:0;
        const startPt=state==='closing'?comp.paddingTop:'0px';
        const startPb=state==='closing'?comp.paddingBottom:'0px';
        const anim=content.animate([
            {height:`${startH}px`,paddingTop:startPt,paddingBottom:startPb,opacity:'0',transform:'translateY(-6px)',overflow:'hidden'},
            {height:`${targetH}px`,paddingTop:pt,paddingBottom:pb,opacity:'1',transform:'translateY(0)',overflow:'hidden'}
        ],{duration:280,easing:'cubic-bezier(0.2, 0, 0.2, 1)'});
        (details as unknown as {_anim?:Animation|null})._anim=anim;
        const cleanup=()=>{
            (details as unknown as {_anim?:Animation|null})._anim=null;
            details.removeAttribute('data-state');
            content.style.height='';content.style.paddingTop='';content.style.paddingBottom='';
            content.style.overflow='';content.style.opacity='';content.style.transform='';
        };
        anim.onfinish=cleanup;anim.oncancel=cleanup;
    }else{
        details.setAttribute('data-state','closing');
        const anim=content.animate([
            {height:`${currentH}px`,paddingTop:pt,paddingBottom:pb,opacity:'1',transform:'translateY(0)',overflow:'hidden'},
            {height:'0px',paddingTop:'0px',paddingBottom:'0px',opacity:'0',transform:'translateY(-6px)',overflow:'hidden'}
        ],{duration:250,easing:'cubic-bezier(0.2, 0, 0.2, 1)'});
        (details as unknown as {_anim?:Animation|null})._anim=anim;
        const cleanup=(closed:boolean)=>{
            (details as unknown as {_anim?:Animation|null})._anim=null;
            details.removeAttribute('data-state');
            content.style.height='';content.style.paddingTop='';content.style.paddingBottom='';
            content.style.overflow='';content.style.opacity='';content.style.transform='';
            if(closed)details.open=false;
        };
        anim.onfinish=()=>cleanup(true);anim.oncancel=()=>cleanup(false);
    }
}

/** One delegated binding per editor: controls keep focus while values/imports update. */
export function bindGraphicsSettings(root:HTMLElement,lang:GraphicsLanguage):()=>void {
    const d=labels[lang],editor=root.querySelector<HTMLElement>('.kasp-graphics-editor');if(!editor)return()=>{};
    let profile=readGraphicsProfile(localStorage),alive=true;
    const message=(value:string,error=false)=>{const node=editor.querySelector<HTMLElement>('.kasp-gfx-message')!;node.textContent=value;node.classList.toggle('kasp-gfx-error',error);};
    function refresh(){
        const all=controls(profile,lang);
        for(const input of editor!.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-graphics-field]')){
            const c=all.find(c=>c.field===input.dataset.graphicsField)!;
            if(c.unlimited&&input instanceof HTMLInputElement&&input.type==='range')input.max=String(c.max);
            input.value=String(round(c.value));
        }
        editor!.querySelector<HTMLSelectElement>('[data-graphics-preset]')!.value=profile.settings.generation.preset;
        for(const input of editor!.querySelectorAll<HTMLInputElement>('[data-graphics-enabled]')){
            const key=input.dataset.graphicsEnabled as keyof typeof GRAPHICS_FLAGS;input.checked=profile.settings.enabled[key];
            const status=editor!.querySelector(`[data-graphics-status="${key}"]`)!,value=input.checked?d.enable:d.disable;
            if(status.textContent!==value)status.textContent=value;
        }
    }
    function save(next:GraphicsProfile):boolean {
        try{saveGraphicsProfile(next,localStorage);profile=next;for(const key of Object.values(GRAPHICS_FLAGS))invalidateSetting(key);window.dispatchEvent(new Event('kasp:settings-changed'));refresh();message('');return true;}
        catch{profile=readGraphicsProfile(localStorage);refresh();message(d.storageError,true);return false;}
    }
    const onInput=(event:Event)=>{
        const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement))return;
        const field=input.dataset.graphicsField;if(!field)return;
        const c=controls(profile,lang).find(c=>c.field===field);if(!c)return;
        if(input.value.trim()===''||!Number.isFinite(Number(input.value)))return;
        const raw=Number(input.value);if(raw<c.min||!c.unlimited&&raw>c.max){input.setCustomValidity(lang==='RU'?'Значение вне диапазона':'Value outside range');return;}
        if(input instanceof HTMLInputElement&&input.validity.stepMismatch)return;
        input.setCustomValidity('');
        const next=structuredClone(profile),value=round(raw)/(c.scale||1);
        if(field==='sunIntensity')next.settings.sunIntensity=value;
        else{const [section,key]=field.split('.');(next.settings[section as 'tuning'] as unknown as Record<string,number>)[key]=value;}
        save(next);
    };
    const onChange=(event:Event)=>{
        const input=event.target;if(!(input instanceof HTMLInputElement||input instanceof HTMLSelectElement))return;
        if(input.dataset.graphicsField){if(!input.checkValidity()){refresh();input.setCustomValidity('');}else onInput(event);return;}
        if(input.dataset.graphicsEnabled){const next=structuredClone(profile);next.settings.enabled[input.dataset.graphicsEnabled as keyof typeof GRAPHICS_FLAGS]=(input as HTMLInputElement).checked;save(next);return;}
        if(input.hasAttribute('data-graphics-preset')){const next=structuredClone(profile);next.settings.generation.preset=input.value as typeof next.settings.generation.preset;save(next);return;}
        if(input.hasAttribute('data-graphics-file'))void (async()=>{
            const file=(input as HTMLInputElement).files?.[0];if(!file)return;
            try{if(file.size>262144){message(d.tooLarge,true);return;}message(d.loading);const raw=await file.text();if(!alive)return;
                const next=parseGraphicsProfile(raw,localStorage);if(save(next))message(d.importDone);
            }catch{if(alive)message(d.invalid,true);}finally{(input as HTMLInputElement).value='';}
        })();
    };
    const onClick=(event:Event)=>{
        const summary=(event.target as Element).closest('summary');
        if(summary&&editor.contains(summary)){
            const details=summary.parentElement;
            if(details instanceof HTMLDetailsElement){
                event.preventDefault();
                animateAccordion(details);
                return;
            }
        }
        const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||!editor.contains(button))return;
        const action=button.dataset.graphicsAction;
        if(action==='import'){editor.querySelector<HTMLInputElement>('[data-graphics-file]')!.click();return;}
        if(action==='export'){
            const url=URL.createObjectURL(new Blob([JSON.stringify(readGraphicsProfile(localStorage),null,2)+'\n'],{type:'application/json'}));
            const link=document.createElement('a');link.href=url;link.download='KI-graphics-settings.json';link.click();
            window.setTimeout(()=>URL.revokeObjectURL(url),1000);message(d.exported);return;
        }
        if(action==='reset'){if(save(defaultGraphicsProfile()))message(d.resetDone);return;}
        const look=button.dataset.graphicsSunLook;
        if(look==='original'||look==='cinematic'||look==='warm-evening'){if(save(applySunLook(profile,look)))message(d.sunLookDone);return;}
        const card=button.dataset.graphicsReset;if(!card)return;
        const next=structuredClone(profile),defaults=defaultGraphicsProfile().settings;
        const groups:Record<string,GraphicsGroup[]>={weather:['weather','rain','snow','clouds','lightning'],sunlight:['sun'],boxes:['boxes'],puddles:[]};
        for(const c of GRAPHICS_CONTROLS)if(groups[card]?.includes(c.group))next.settings.tuning[c.key]=c.value;
        if(card==='weather'){next.settings.generation=defaults.generation;next.settings.volumes=defaults.volumes;next.settings.surface.rainIntensity=defaults.surface.rainIntensity;}
        if(card==='puddles')for(const c of SURFACE_CONTROLS)if(c.key!=='rainIntensity')next.settings.surface[c.key]=c.value;
        if(card==='sunlight')next.settings.sunIntensity=defaults.sunIntensity;
        if(save(next))message(d.resetCardDone);
    };
    editor.addEventListener('input',onInput);editor.addEventListener('change',onChange);editor.addEventListener('click',onClick);
    const external=()=>{profile=readGraphicsProfile(localStorage);refresh();};window.addEventListener('storage',external);window.addEventListener('kasp:settings-changed',external);
    return()=>{alive=false;editor.removeEventListener('input',onInput);editor.removeEventListener('change',onChange);editor.removeEventListener('click',onClick);window.removeEventListener('storage',external);window.removeEventListener('kasp:settings-changed',external);};
}
