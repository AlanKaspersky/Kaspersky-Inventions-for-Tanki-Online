/** Offline generation of guarded native HUD hooks. */
function renderArcadeEdits(c) {
    const optional = (type) => `__kaspEntity.${c.optional}(${c.token ? `${c.token}(${type})` : type})`;
    const show = c.show;
    const remove = c.remove;
    const dispose = (target) => `if(${target}.__kaspArcadeReloadBar){${c.scene}(${target}).${remove}(${target}.__kaspArcadeReloadBar);${target}.__kaspArcadeReloadBar=null}`;
    const notify = `if(window.__kaspArcadeReloadDebug&&window.__kaspArcadeReloadDebug.observe)window.__kaspArcadeReloadDebug.observe({weapon:__kaspShaft?"Shaft":__kaspScorpio?"Scorpio":null,progress:__kaspOwner.__kaspArcadeProgress,barCreated:!!__kaspBar,visible:!!__kaspBar&&__kaspOwner.__kaspArcadeProgress!=null&&!__kaspOwner.__kaspArcadeReloadFailed&&__kaspOwner.__kaspArcadeHudVisible!==false})`;
    const update = `function(){var __kaspOwner=this;try{` +
        `if(__kaspOwner.__kaspArcadeReloadFailed||!__kaspOwner.${c.barField})return;` +
        `var __kaspEntity=${c.localTank}(__kaspOwner.${c.world}()),__kaspBar=__kaspOwner.__kaspArcadeReloadBar;` +
        `var __kaspProgress=null,__kaspShaft=null,__kaspScorpio=null;if(__kaspEntity){` +
        `var __kaspShaft=${optional(c.shaft)},__kaspScorpio=${optional(c.scorpio)};` +
        `if(__kaspScorpio)__kaspProgress=__kaspScorpio.${c.primary};` +
        `else if(__kaspShaft){var __kaspState=__kaspShaft.${c.active};` +
        `if((__kaspShaft.${c.stunned}||__kaspShaft.${c.paused})&&__kaspOwner.__kaspArcadeWeapon===__kaspShaft)__kaspProgress=__kaspOwner.__kaspArcadeProgress;` +
        `else __kaspProgress=__kaspState instanceof ${c.cooldownType}&&${c.compare}(__kaspShaft.${c.clock}(),__kaspState.${c.deadline})<0?` +
        `1-${c.divide}(${c.subtract}(__kaspState.${c.deadline},__kaspShaft.${c.clock}()),__kaspShaft.${c.duration}):1}}` +
        `if(typeof __kaspProgress!=="number"||!Number.isFinite(__kaspProgress)){__kaspOwner.__kaspArcadeWeapon=null;__kaspOwner.__kaspArcadeProgress=null;if(__kaspBar)__kaspBar.${show}(!1);${notify};return}` +
        `__kaspOwner.__kaspArcadeWeapon=__kaspShaft||__kaspScorpio;__kaspOwner.__kaspArcadeProgress=Math.max(0,Math.min(1,__kaspProgress));` +
        `if(!__kaspBar)__kaspBar=__kaspOwner.__kaspArcadeReloadBar=__kaspOwner.__kaspArcadeHudCreate();` +
        `__kaspBar.${show}(__kaspOwner.__kaspArcadeHudVisible!==false);` +
        `__kaspBar.${c.fill}(__kaspOwner.__kaspArcadeProgress);` +
        `__kaspOwner.__kaspArcadeHudSync();${notify}` +
        `}catch(__kaspError){__kaspOwner.__kaspArcadeReloadFailed=!0;try{var __kaspBar=__kaspOwner.__kaspArcadeReloadBar;if(__kaspBar)__kaspBar.${show}(!1);window.__kaspArcadeReloadDebug.reportError(String(__kaspError))}catch(__kaspIgnored){}}}`;
    const sync = `function(){try{var __kaspArcadeMesh=this.__kaspArcadeReloadBar,o=this.${c.barField};if(this.__kaspArcadeReloadFailed||!__kaspArcadeMesh||!o)return;` +
        `__kaspArcadeMesh.${c.setWidth}(o.${c.width}());__kaspArcadeMesh.${c.setHeight}(o.${c.height}());` +
        `__kaspArcadeMesh.${c.place}(o.${c.vector},o.${c.height}());` +
        `__kaspArcadeMesh.${show}(this.__kaspArcadeHudVisible!==false&&this.__kaspArcadeProgress!=null)` +
        `}catch(__kaspArcadeError){this.__kaspArcadeReloadFailed=true;try{if(__kaspArcadeMesh)__kaspArcadeMesh.${show}(false);if(window.__kaspArcadeReloadDebug)window.__kaspArcadeReloadDebug.reportError(String(__kaspArcadeError))}catch(__kaspArcadeIgnored){}}}`;
    const projection = c.projection;
    const project = `__kaspArcadeMesh.${projection.method}=function(__kaspArcadeView,__kaspArcadeRect){try{var base=__kaspOwner.${c.barField};` +
        `base.${projection.method}(__kaspArcadeView,__kaspArcadeRect);__kaspArcadeRect.${projection.y}+=__kaspArcadeRect.${projection.height}` +
        `}catch(__kaspArcadeError){__kaspArcadeRect.${projection.width}=0;__kaspArcadeRect.${projection.height}=0;__kaspOwner.__kaspArcadeReloadFailed=true;` +
        `try{__kaspArcadeMesh.${show}(false);window.__kaspArcadeReloadDebug.reportError(String(__kaspArcadeError))}catch(__kaspArcadeIgnored){}}};`;
    const factoryPatch = `,(function(__kaspOwner){try{${dispose('__kaspOwner')};` +
        `__kaspOwner.__kaspArcadeReloadFailed=false;__kaspOwner.__kaspArcadeProgress=null;__kaspOwner.__kaspArcadeWeapon=null;` +
        `__kaspOwner.__kaspArcadeHudCreate=function(){var __kaspArcadeMesh=${c.factory};${c.layer}(__kaspArcadeMesh,${c.layerArg});${project}__kaspArcadeMesh.${show}(false);${c.scene}(__kaspOwner).${c.add}(__kaspArcadeMesh);return __kaspArcadeMesh};` +
        `__kaspOwner.__kaspArcadeHudSync=${sync};__kaspOwner.__kaspArcadeHudUpdate=${update};__kaspOwner.__kaspArcadeHudUpdate()` +
        `}catch(__kaspArcadeError){if(window.__kaspArcadeReloadDebug)window.__kaspArcadeReloadDebug.reportError(String(__kaspArcadeError))}})(${c.createOwner})`;
    const edits = [
        { start: c.createAt, end: c.createAt, text: factoryPatch },
        { start: c.frameAt, end: c.frameAt, text: `,(${c.frameOwner}.__kaspArcadeHudUpdate&&${c.frameOwner}.__kaspArcadeHudUpdate())` },
        { start: c.visibleAt, end: c.visibleAt, text: `,${c.visibleOwner}.__kaspArcadeHudVisible=!!${c.visibleArg},(${c.visibleOwner}.__kaspArcadeHudSync&&${c.visibleOwner}.__kaspArcadeHudSync())` },
        { start: c.cleanupEnd - 1, end: c.cleanupEnd - 1, text: `;try{${dispose('this')};this.__kaspArcadeHudCreate=null;this.__kaspArcadeHudUpdate=null;this.__kaspArcadeHudSync=null;this.__kaspArcadeWeapon=null;this.__kaspArcadeProgress=null}catch(__kaspArcadeError){}` }
    ];
    if (c.supplies) {
        const s = c.supplies;
        const hudToken = s.token ? `${s.token}(${c.hudType})` : c.hudType;
        const shift = `(function(__kaspSupplyOwner){try{if(!__kaspSupplyOwner.${s.centered})return 0;var hud=__kaspSupplyOwner.${s.entity}().${s.optional}(${hudToken}),bar=hud&&hud.__kaspArcadeReloadBar;return bar&&hud.__kaspArcadeWeapon&&hud.__kaspArcadeProgress!=null&&!hud.__kaspArcadeReloadFailed&&hud.__kaspArcadeHudVisible!==false?bar.${c.height}():0}catch(__kaspArcadeError){return 0}})(this)`;
        edits.push({ start:s.offset.start,end:s.offset.end,text: `(${s.offset.text}+${shift})` });
    }
    for (const method of c.syncMethods) edits.push({start:method.end-1,end:method.end-1,text:';if(this.__kaspArcadeHudSync)this.__kaspArcadeHudSync()'});
    return edits;
}
module.exports = { renderArcadeEdits };
