import { featureScope } from './featureRuntime';
import { gameDOM } from './gameDOM';
import { utils } from './utils';
import { renderGraphicsSettings,bindGraphicsSettings } from './graphicsSettings';

const instances=new WeakMap<Window,ReturnType<typeof createBattleGraphics>>();
export function setupBattleGraphics(page:Window){
    let instance=instances.get(page);
    if(!instance){instance=createBattleGraphics(page);instances.set(page,instance);}
    return instance;
}
function createBattleGraphics(page:Window){
    const scope=featureScope('battleGraphics');
    let panel:HTMLElement|undefined,unbind:(()=>void)|undefined;
    let returnFocus:HTMLElement|undefined,language:'RU'|'EN'|undefined;
    const heldOutside=new Set<string>(),blockedUps=new Set<string>();
    const battle=()=>!!document.querySelector(gameDOM.screens.battleHud)&&
        !document.querySelector([gameDOM.screens.weatherExcluded,gameDOM.screens.loader,gameDOM.settings.root,gameDOM.results.status].join(','));
    const words=()=>utils.getLang()==='RU'?{title:'Графические настройки',close:'Закрыть',hint:'Ctrl+Alt+G — открыть / закрыть · Esc — закрыть'}:
        {title:'Graphics settings',close:'Close',hint:'Ctrl+Alt+G — open / close · Esc — close'};
    function close(restoreFocus=true){
        unbind?.();unbind=undefined;panel?.remove();panel=undefined;language=undefined;
        if(restoreFocus&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});
        returnFocus=undefined;
    }
    function open(){
        if(scope.disabled||!battle()||!document.body)return false;
        if(panel?.isConnected)return true;
        close(false);returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;
        const d=words(),lang=utils.getLang(),root=document.createElement('section');root.id='kasp-battle-graphics';
        root.setAttribute('role','dialog');root.setAttribute('aria-modal','false');root.setAttribute('aria-labelledby','kasp-battle-graphics-title');
        root.innerHTML='<header class="kasp-battle-gfx-header"><div><h2 id="kasp-battle-graphics-title"></h2><p></p></div><button type="button" class="kasp-battle-gfx-close">×</button></header><div class="kasp-battle-gfx-scroll"></div>';
        root.querySelector('h2')!.textContent=d.title;root.querySelector('p')!.textContent=d.hint;
        const dismiss=root.querySelector<HTMLButtonElement>('.kasp-battle-gfx-close')!;dismiss.setAttribute('aria-label',d.close);dismiss.onclick=()=>close();
        root.querySelector('.kasp-battle-gfx-scroll')!.innerHTML=renderGraphicsSettings(lang,'kasp-battle-gfx');
        // Let controls and scrolling handle their default actions, without bubbling into the game.
        for(const type of ['mousedown','pointerdown','click'])root.addEventListener(type,event=>event.stopPropagation());
        root.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
        document.body.append(root);panel=root;language=lang;unbind=bindGraphicsSettings(root,lang);
        try{document.exitPointerLock?.();}catch{}
        dismiss.focus({preventScroll:true});return true;
    }
    function sync(){
        if(scope.disabled)return;
        if(!battle()||!document.body){close(false);return;}
        if(panel&&(!panel.isConnected||language!==utils.getLang()))close(false);
    }
    const inside=(target:EventTarget|null)=>!!panel&&target instanceof Node&&panel.contains(target);
    const consume=(event:KeyboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();};
    scope.listen(page,'keydown',event=>{
        const target=event.target instanceof Element?event.target:document.activeElement;
        const typing=!!target?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
        if(event.code==='KeyG'&&event.ctrlKey&&event.altKey&&!event.metaKey&&!event.shiftKey&&battle()&&(!typing||inside(target))){
            consume(event);blockedUps.add('KeyG');if(!event.repeat){if(panel)close();else open();}return;
        }
        if(!panel){if(event.code&&heldOutside.size<64)heldOutside.add(event.code);return;}
        if(!battle()){close(false);return;}
        if(event.key==='Escape'){consume(event);blockedUps.add(event.code);close();return;}
        if(!inside(target)){if(event.code&&heldOutside.size<64)heldOutside.add(event.code);return;}
        // The panel is nonmodal: outside clicks can return control to the battlefield.
        // Inputs keep normal browser typing while game key listeners receive no keydown.
        if(event.key==='Tab'){
            const focusable=[...panel.querySelectorAll<HTMLElement>('button,input:not([type="file"]),select,summary')].filter(n=>n.getClientRects().length&&!n.hasAttribute('disabled'));
            const index=focusable.indexOf(document.activeElement as HTMLElement);
            if(focusable.length&&(event.shiftKey?index<=0:index===focusable.length-1)){event.preventDefault();focusable[event.shiftKey?focusable.length-1:0].focus();}
        }
        event.stopImmediatePropagation();
    },true);
    scope.listen(page,'keyup',event=>{
        if(blockedUps.delete(event.code)){consume(event);return;}
        // Always deliver release for keys held before entering the panel (no stuck tank movement).
        if(heldOutside.delete(event.code))return;
        if(inside(event.target))event.stopImmediatePropagation();
    },true);
    scope.listen(page,'keypress',event=>{if(inside(event.target))event.stopImmediatePropagation();},true);
    scope.listen(page,'pagehide',()=>{close(false);heldOutside.clear();blockedUps.clear();});
    scope.listen(document,'visibilitychange',sync);
    scope.onCleanup(()=>{close(false);heldOutside.clear();blockedUps.clear();});
    scope.interval(sync,500);sync();
    return {open,close,sync,isOpen:()=>!!panel?.isConnected};
}
