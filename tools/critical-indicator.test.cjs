const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const patches = require('./test-client-patches.cjs');
const { analyzeCritical } = require('./critical-ast.cjs');
const devicesModule = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/criticalDevices.ts','utf8'), {loader:'ts',format:'cjs'}).code, {module:devicesModule});
const compiled = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/criticalIndicator.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: compiled, crypto: webcrypto, TextEncoder, require: id => id === './criticalDevices' ? devicesModule.exports : patches });
const api = compiled.exports;
const arcadeFixture = fs.readFileSync(path.join(__dirname, 'arcade-reload.test.cjs'), 'utf8').match(/const source = `([\s\S]*?)`;/)[1];
const fixture = `
function NativeEntity(){}
proto(NativeEntity).emit=function(event){var cb=this.callbacks.get(event.constructor);if(cb)cb(event)};
function Shot(muzzle,power,valid){this.muzzle=muzzle;this.power=power;this.valid=valid}
function Life(state,time){this.lifeState=state;this.time=time}
function isAlive(state){return state==='ACTIVE'}
function ShotSfx1(){}function ShotSfx2(){}
proto(ShotSfx1).init=function(){missing('weaponAssetsComponent');var cb=function(){};cb.callableName='onShot';this.entity().on(token(Shot),0,false,cb)};
proto(ShotSfx2).init=function(){missing('weaponAssetsComponent');var cb=function(){};cb.callableName='onShot';this.entity().on(token(Shot),0,false,cb)};
const damageKindValue={equals(other){return other===this},toString(){return 'DAMAGE'}};
function damageKind(){return damageKindValue}
function Damage(critical,kind){this.critical=critical;this.kind=kind}
proto(Damage).toString=function(){var text='TargetTankDamage [';return (text=text+'critical = '+this.critical+' ',text=text+'damageIndicatorType = '+this.kind.toString()+' ',text+']')};
function DamageWire(){}function DamageModel(){}
proto(DamageWire).decode=function(id,packet){if(id==='damage'){var rows=function(t){var c=t.codec;if(c!=null)return c;missing('_showDamageForShooter_damagesCodec')}(this).read(packet);this.reportDamage(rows)}};
proto(DamageModel).reportDamage=function(rows){var count=rows.size(),valid=false;for(var i=0;i<count;i++){var row=rows.item(i);if(row.kind.equals(damageKind())){recordCritical(row.critical);valid=true}}if(valid){var entity=this.entity(token(Info));recordDamage(entity)}};
function NextReady(flag){this.prepared=flag}function StopWeapon(){}
function Wire(){}function Model(){}function Marker(){}
proto(Wire).decode=function(id,packet){var value=function(t){var c=t.codec;if(c!=null)return c;missing('_nextShotCriticalStatePerpared_criticalCodec')}(this).read(packet);this.prepareFlag(value)};
proto(Model).prepareFlag=function(flag){var entity=this.entity(token(Info));if(entity)entity.emit(new NextReady(flag))};
proto(Marker).init=function(){var e=this.entity(),callback=function(actor){return function(event){return actor.nextCritical=event.prepared,actor.active&&refresh(actor),true}}(this);e.on(token(NextReady),0,false,callback);var e2=this.entity(),stop=function(actor){return function(event){return actor.active=false,true}}(this);e2.on(token(StopWeapon),0,false,stop)};
proto(Marker).dispose=function(){this.world().unregister(this)};
function KillWire(){}function KillModel(){}
proto(KillWire).decode=function(packet){var flag=function(t){var c=t.codec;if(c!=null)return c;missing('_kill_isCriticalCodec')}(this).read(packet);this.kill(1,2,3,flag)};
proto(KillModel).kill=function(killer,incarnation,damage,critical){var entity=this.entity(token(Info));entity.kill(critical)};
function Info(weapon,device){this.weaponId=weapon;this.deviceId=device}
proto(Info).toString=function(){var text='TankInfoCC [';return (text=text+'weaponBaseId = '+this.weaponId.toString()+' ',text=text+'weaponDeviceId = '+this.deviceId.toString()+' ',text+']')};
function equipmentScene(owner,info){var id=info==null?null:info.deviceId,local=localTank(owner.world());drawEquipment(owner,id,local)}
function SuperchargeCC(active){this.enabled=active}
proto(SuperchargeCC).toString=function(){var text='TankSuperchargeCC [';return(text=text+'superchargeEnabled = '+this.enabled+' ')+']'};
const chargeOn={},chargeOff={};
function SuperchargeModel(){}
function SuperchargeWire(){}
proto(SuperchargeWire).decode=function(id,packet){if(id==='enable')this.enable();else if(id==='disable')this.disable()};
proto(SuperchargeModel).load=function(entity,unused,unused2){this.bind(token(Info),entity);this.cc().enabled&&this.enable()};
proto(SuperchargeModel).enable=function(){var entity=this.entity(token(Info));if(entity)entity.emit(chargeOn)};
proto(SuperchargeModel).disable=function(){var entity=this.entity(token(Info));if(entity)entity.emit(chargeOff)};
`;
const source = arcadeFixture.replace("cb.callableName='configureBars'}", "cb.callableName='configureBars';var gate=function(t){return function(n){return t.counter.toggle(1,!isAlive(n.lifeState)),true}}(this)}") + '\n' + fixture;
function setup(code = source, plan = analyzeCritical(code), otherPlans = []) {
    assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const devices = new Map([
        ['100', { id: '100', name: 'Strict Ammunition Load', baseItemId: '10' }],
        ['200', { id: '200', name: 'Sorted Ammunition', baseItemId: '20' }],
        ['300', { id: '300', name: 'Revolver', baseItemId: '30' }],
        ['400', { id: '400', name: 'Another device', baseItemId: '40' }],
    ]);
    const engine = api.createCriticalIndicator(id => devices.get(id) ?? null);
    const entity = () => ({ callbacks: new Map(), optional: () => null,
        kill() { this.ghost = true; this.nicknameVisible = false; },
        on(type, priority, once, callback) { this.callbacks.set(type, callback); },
        emit(event) { context.NativeEntity.prototype.emit.call(this,event); } });
    const local = entity(), remote = entity(); let current = local, refreshes = 0;
    const scene = { add() {}, remove() {} };
    const world = { ...scene, scene, find: () => current, unregister() {} };
    const context = { window: { __kaspCriticalBridge: engine.bridge, __kaspArcadeReloadDebug: { observe() {}, reportError() {} } },
        recordCritical() {}, refresh: () => refreshes++, drawEquipment() {}, color: value => ({ value }), allocate() {}, Event: { progress: .5 },
        rectangle: () => ({ layer: () => 'native', width: () => 100, height: () => 4 }) };
    const patched = otherPlans.length ? patches.mergeClientPatchPlans(code, [...otherPlans, plan]).code : api.patchCriticalIndicator(code, undefined, plan);
    vm.runInNewContext(patched, context);
    const hud = new context.LocalHud(); hud.world = () => world; hud.init(); hud.create();
    const createMarker = target => { const marker = new context.Marker(); marker.entity = () => target; marker.world = () => world; marker.active = true; marker.nextCritical = false; marker.init(); return marker; };
    const marker = createMarker(local), remoteMarker = createMarker(remote);
    const model = new context.Model(); model.entity = () => local;
    const remoteModel = new context.Model(); remoteModel.entity = () => remote;
    const killModel = new context.KillModel(); killModel.entity = () => local;
    const damageModel = new context.DamageModel(); damageModel.entity = () => local;
    context.recordDamage = () => {};
    const original = hud.weaponBar.material[plan.schema.foregroundField];
    context.equipmentScene({ world: () => world }, new context.Info('10', '100'));
    return { engine, devices, context, hud, marker, model, killModel, damageModel, remoteModel, remoteMarker, local, remote, original,
        frame: () => hud.receive(), setLocal: value => { current = value; }, refreshes: () => refreshes };
}

test('server flags paint only the native local reload material for all three devices', () => {
    const f = setup(); f.frame(); assert.equal(f.engine.status().ready, null); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    for (const [weapon, device, name] of [['10', '100', 'Thunder'], ['20', '200', 'Smoky'], ['30', '300', 'Hammer']]) {
        f.context.equipmentScene({ world: () => ({ find: () => f.local }) }, new f.context.Info(weapon, device));
        f.model.prepareFlag(true); f.frame();
        assert.equal(f.engine.status().weapon, name); assert.equal(f.engine.status().ready, true);
        assert.equal(f.hud.weaponBar.material.foreground.rgb, 16711680);
        f.model.prepareFlag(false); f.frame(); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    }
    assert.equal(f.refreshes(), 6, 'native event callbacks still execute once');
});

test('remote tanks, duplicate packets and rapid server updates cannot shift a local shot counter', () => {
    const f = setup(); f.remoteModel.prepareFlag(true); f.frame();
    assert.equal(f.engine.status().ready, null); assert.equal(f.engine.status().updates, 0); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    f.model.prepareFlag(true); f.model.prepareFlag(true); f.frame(); assert.equal(f.engine.status().ready, true);
    f.model.prepareFlag(false); f.model.prepareFlag(true); f.model.prepareFlag(false); f.frame();
    assert.equal(f.engine.status().ready, false); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    assert.equal(f.engine.status().updates, 5);
});

test('critical updates preserve native ghost spawn visibility for every supported weapon', () => {
    const f = setup();
    for (const [weapon, device] of [['10', '100'], ['20', '200'], ['30', '300']]) {
        f.context.equipmentScene({ world: () => ({ find: () => f.local }) }, new f.context.Info(weapon, device));
        f.killModel.kill(1, 2, 3, false);
        f.marker.active = false;
        f.hud.setVisible(false);
        const callbacks = [...f.local.callbacks.entries()];
        f.model.prepareFlag(true); f.frame();
        assert.equal(f.local.ghost, true);
        assert.equal(f.local.nicknameVisible, false);
        assert.equal(f.marker.active, false, 'critical observation never activates a native marker');
        assert.equal(f.hud.weaponBar.shown, false, 'native HUD remains hidden');
        assert.deepEqual([...f.local.callbacks.entries()], callbacks, 'native subscriptions are untouched');
        // The native exit from ghost mode retains sole control over visibility.
        f.local.ghost = false; f.local.nicknameVisible = true; f.hud.setVisible(true);
        f.model.prepareFlag(false); f.frame();
        assert.equal(f.local.nicknameVisible, true); assert.equal(f.hud.weaponBar.shown, true);
    }
});

test('server critical telemetry works without an aiming marker component', () => {
    const f = setup();
    f.local.callbacks.clear();
    f.model.prepareFlag(true); f.frame();
    assert.equal(f.engine.status().ready, true);
    assert.equal(f.hud.weaponBar.material.foreground.rgb, 16711680);
    f.killModel.kill(1, 2, 3, false); f.frame();
    assert.equal(f.engine.status().ready, null);
    assert.equal(f.hud.weaponBar.material.foreground, f.original);
});

const equipKnown = (f, weapon, device) => f.context.equipmentScene({ world: () => ({ find: () => f.local }) }, new f.context.Info(weapon, device));
const life = (f, state, target = f.local) => target.emit(new f.context.Life(state, 0));
const shot = (f, target = f.local) => target.emit(new f.context.Shot(0, 1, true));
const hit = (f, critical, rows) => {
    const values = rows ?? [new f.context.Damage(critical, f.context.damageKind())];
    f.damageModel.reportDamage({ size: () => values.length, item: i => values[i] });
};
const supercharge = (f, target = f.local) => {
    const model = new f.context.SuperchargeModel();
    model.bind = (_type, entity) => { model.entity = () => entity; };
    model.cc = () => new f.context.SuperchargeCC(true);
    model.load(target, null, null);
    return model;
};

test('native supercharge overrides every weapon and an unknown device, including team effects and battle entry', () => {
    const f = setup();
    equipKnown(f, '40', '400'); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE');
    const remote = supercharge(f, f.remote); f.frame();
    assert.equal(f.engine.status().supercharge, false);
    const model = supercharge(f); f.frame();
    assert.equal(f.engine.status().supercharge, true); assert.equal(f.engine.status().source, 'supercharge');
    assert.equal(f.engine.status().ready, true); assert.equal(f.hud.weaponBar.material.foreground.rgb, 16711680);
    remote.disable(); f.frame(); assert.equal(f.engine.status().ready, true);
    model.disable(); f.frame(); assert.equal(f.engine.status().ready, null); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    model.enable(); life(f, 'DEAD'); f.frame(); assert.equal(f.engine.status().ready, null);
    life(f, 'SEMI_ACTIVE'); model.enable(); f.frame(); assert.equal(f.engine.status().ready, null, 'no indication during transparent spawn');
    life(f, 'ACTIVE'); f.frame(); assert.equal(f.engine.status().ready, true);
    f.killModel.kill(1,2,3,false); f.frame(); assert.equal(f.engine.status().supercharge, false);
});

test('supercharge starts the observed fourth/fifth-shot phase and ignores forced damage arriving after it ends', () => {
    const f = setup();
    for (const [weapon, device, firstCritical, ordinaryShots, spawnCritical] of [
        ['920009631123', '1931009774129', 4, 2, true], ['920009630969', '921009712832', 5, 3, true],
        ['920009631046', '1931009803197', 4, 2, false],
    ]) {
        equipKnown(f, weapon, device); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE');
        const model = supercharge(f); shot(f); hit(f, true); f.frame(); assert.equal(f.engine.status().source, 'supercharge');
        model.disable(); hit(f, true); f.frame();
        assert.equal(f.engine.status().ready, false); assert.equal(f.engine.status().awaitingPostSuperchargeCritical, true);
        for (let n = 1; n <= firstCritical; n++) {
            f.frame(); assert.equal(f.engine.status().ready, n === firstCritical, 'red indicates the next shot, including misses');
            shot(f);
            model.disable(); // A duplicate inactive packet must not restart the countdown.
        }
        hit(f, true); f.frame(); assert.equal(f.engine.status().ready, false);
        assert.equal(f.engine.status().awaitingPostSuperchargeCritical, false);
        for (let n = 0; n < ordinaryShots; n++) shot(f);
        f.frame(); assert.equal(f.engine.status().ready, true, 'subsequent critical shots use the regular device interval');
        model.enable(); shot(f); model.disable(); life(f, 'DEAD'); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE'); f.frame();
        assert.equal(f.engine.status().ready, spawnCritical); assert.equal(f.engine.status().awaitingPostSuperchargeCritical, false);
    }
});

test('the first confirmed post-supercharge critical corrects an early or late prediction', () => {
    for (const actualFirst of [3, 5]) {
        const f = setup(); equipKnown(f, '920009631123', '1931009774129'); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE');
        supercharge(f).disable();
        for (let n = 1; n <= actualFirst; n++) { shot(f); hit(f, n === actualFirst); }
        f.frame(); assert.equal(f.engine.status().awaitingPostSuperchargeCritical, false);
        assert.equal(f.engine.status().ready, false);
        shot(f); f.frame(); assert.equal(f.engine.status().ready, false);
        shot(f); f.frame(); assert.equal(f.engine.status().ready, true, 'confirmed critical determines the next regular cycle');
    }
});

test('confirming the first critical preserves subsequent misses while its packet was in flight', () => {
    const f = setup(); equipKnown(f, '920009630969', '921009712832'); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE');
    supercharge(f).disable();
    for (let n = 0; n < 5; n++) shot(f);
    shot(f); shot(f); hit(f, true); f.frame();
    assert.equal(f.engine.status().ready, false); assert.equal(f.engine.status().awaitingPostSuperchargeCritical, false);
    shot(f); f.frame(); assert.equal(f.engine.status().ready, true);
    hit(f, true); f.frame(); assert.equal(f.engine.status().ready, true, 'a repeated or late packet cannot rewind the confirmed cycle');
});

test('supercharge observation preserves native initialization and dispatch when the observer fails', () => {
    const f = setup(); life(f, 'ACTIVE');
    const model = supercharge(f); let reads = 0, dispatches = 0;
    f.local.emit = () => { dispatches++; };
    model.cc = () => { reads++; return new f.context.SuperchargeCC(false); };
    model.load(f.local, null, null); f.frame();
    assert.equal(reads, 1); assert.equal(dispatches, 0); assert.equal(f.engine.status().supercharge, false);
    f.context.window.__kaspCriticalBridge.supercharge = () => { throw Error('observer failed'); };
    model.cc = () => { reads++; return new f.context.SuperchargeCC(true); };
    assert.doesNotThrow(() => model.load(f.local, null, null));
    assert.equal(reads, 2); assert.equal(dispatches, 1);
    assert.doesNotThrow(() => model.disable()); assert.equal(dispatches, 2);
});

test('direct battle entry identifies the three real devices without visiting the garage', () => {
    const f = setup();
    for (const [weapon, device, name, initial] of [
        ['920009631123', '1931009774129', 'Thunder', true],
        ['920009630969', '921009712832', 'Smoky', true],
        ['920009631046', '1931009803197', 'Hammer', false],
    ]) {
        equipKnown(f, weapon, device); life(f, 'SEMI_ACTIVE'); f.frame();
        assert.equal(f.engine.status().deviceName, devicesModule.exports.knownCriticalDevice(device).name);
        assert.equal(f.engine.status().ready, null, 'ghost spawn never activates the indicator');
        life(f, 'ACTIVE'); f.frame();
        assert.equal(f.engine.status().weapon, name); assert.equal(f.engine.status().ready, initial);
        assert.equal(f.engine.status().source, 'device-cycle');
    }
});

test('Thunder and Smoky count every native shot, including misses, and ignore delayed hit acknowledgements', () => {
    const f = setup();
    for (const [weapon, device, normalHits] of [['920009631123', '1931009774129', 2], ['920009630969', '921009712832', 3]]) {
        equipKnown(f, weapon, device); life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE'); f.frame(); assert.equal(f.engine.status().ready, true);
        shot(f); f.frame(); assert.equal(f.engine.status().ready, false);
        hit(f, true); f.frame(); assert.equal(f.engine.status().ready, false);
        for (let i = 0; i < normalHits; i++) {
            shot(f, f.remote); f.frame(); assert.equal(f.engine.status().ready, false);
            shot(f); f.frame(); assert.equal(f.engine.status().ready, i === normalHits - 1);
            hit(f, false); f.frame(); assert.equal(f.engine.status().ready, i === normalHits - 1);
        }
        const before = f.engine.status().hitEvents;
        hit(f, false, [new f.context.Damage(false, { equals: () => true })]);
        f.frame(); assert.equal(f.engine.status().hitEvents, before); assert.equal(f.engine.status().ready, true);
    }
});

test('Hammer revolver counts native shots, including misses, without a clock-based deduplication', () => {
    const f = setup(); equipKnown(f, '920009631046', '1931009803197');
    life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE'); f.frame();
    for (const next of [false, true, false, false, true, false]) {
        shot(f); f.frame(); assert.equal(f.engine.status().ready, next);
    }
    life(f, 'DEAD'); f.frame(); assert.equal(f.engine.status().ready, null);
    life(f, 'SEMI_ACTIVE'); f.frame(); assert.equal(f.engine.status().ready, null);
    life(f, 'ACTIVE'); f.frame(); assert.equal(f.engine.status().ready, false);
});

test('joining an ongoing life waits for calibration; a critical damage packet synchronizes the cycle', () => {
    const f = setup(); equipKnown(f, '920009631123', '1931009774129'); life(f, 'ACTIVE');
    hit(f, false); f.frame(); assert.equal(f.engine.status().ready, null);
    hit(f, true); f.frame(); assert.equal(f.engine.status().ready, false);
    shot(f); shot(f); f.frame(); assert.equal(f.engine.status().ready, true);
    hit(f, false, [new f.context.Damage(false, f.context.damageKind()), new f.context.Damage(true, f.context.damageKind())]);
    f.frame(); assert.equal(f.engine.status().ready, true, 'late packets cannot replace the tracked shot cycle');
});

test('remote lifecycle cannot reset local progress and live device balance overrides the bundled snapshot', () => {
    const f = setup(); equipKnown(f, '920009631123', '1931009774129');
    const profile = devicesModule.exports.knownCriticalDevice('1931009774129');
    profile.properties.find(p => p.property === 'AFTER_CRIT_CRITICAL_HIT_CHANCE').value = -2;
    f.devices.set(profile.id, profile);
    life(f, 'SEMI_ACTIVE'); life(f, 'ACTIVE'); shot(f); shot(f); shot(f);
    life(f, 'DEAD', f.remote); f.frame(); assert.equal(f.engine.status().ready, false);
    shot(f); f.frame(); assert.equal(f.engine.status().ready, true);
});

test('death, respawn, equipment changes, missing local tank and HUD disposal restore the exact native color', () => {
    const f = setup(); f.model.prepareFlag(true); f.frame();
    f.killModel.kill(1,2,3,false); f.frame(); assert.equal(f.engine.status().ready, null); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    f.marker.active = true; f.frame(); assert.equal(f.engine.status().ready, null, 'respawn never guesses the first critical');
    f.model.prepareFlag(true); f.frame(); assert.equal(f.engine.status().ready, true);
    f.context.equipmentScene({ world: () => ({ find: () => f.local }) }, new f.context.Info('20', '200'));
    f.frame(); assert.equal(f.engine.status().weapon, 'Smoky'); assert.equal(f.engine.status().ready, null);
    f.model.prepareFlag(true); f.frame(); f.setLocal(null); f.frame(); assert.equal(f.hud.weaponBar.material.foreground, f.original);
    f.setLocal(f.local); f.model.prepareFlag(true); f.frame(); f.killModel.kill(1,2,3,false); f.frame(); assert.equal(f.engine.status().ready, null);
    f.model.prepareFlag(true); f.frame(); f.hud.dispose(); assert.equal(f.hud.weaponBar.material.foreground, f.original); assert.equal(f.engine.status().reason, 'hud-detached');
});

test('late metadata activates the right device; unsupported or mismatched devices retain the original color', () => {
    const f = setup(); const data = f.devices.get('100'); f.devices.delete('100');
    f.model.prepareFlag(true); f.frame(); assert.equal(f.engine.status().reason, 'waiting-device-metadata');
    f.devices.set('100', { ...data, name: 'Строгая погрузка боеприпасов' }); f.frame(); assert.equal(f.engine.status().weapon, 'Thunder'); assert.equal(f.engine.status().painted, true);
    f.devices.set('100', { ...data, baseItemId: 'another-weapon' }); f.frame(); assert.equal(f.engine.status().painted, false);
    f.devices.set('100', { ...data, name: 'Phoenix' }); f.frame(); assert.equal(f.engine.status().painted, false);
    const newNativeColor = { value: 123 }; f.hud.weaponBar.material.foreground = newNativeColor;
    f.devices.set('100', data); f.frame(); assert.equal(f.engine.status().painted, true);
    f.model.prepareFlag(false); f.frame(); assert.equal(f.hud.weaponBar.material.foreground, newNativeColor);
});

test('native accessors and observer failures never interrupt original state updates or frame rendering', () => {
    const f = setup(); const descriptor = Object.getOwnPropertyDescriptor(f.marker, 'nextCritical');
    Object.defineProperty(f.marker, 'nextCritical', { configurable: true, get() { throw Error('native getter must not execute'); } });
    assert.doesNotThrow(() => f.frame()); assert.equal(f.engine.status().painted, false);
    Object.defineProperty(f.marker, 'nextCritical', descriptor);
    f.context.window.__kaspCriticalBridge.ready = () => { throw Error('observer failed'); };
    assert.doesNotThrow(() => f.model.prepareFlag(true)); assert.equal(f.marker.nextCritical, true); assert.equal(f.refreshes(), 1);
    f.context.window.__kaspCriticalBridge.frame = () => { throw Error('renderer failed'); };
    assert.doesNotThrow(() => f.frame()); assert.equal(f.hud.weaponBar.progressValue, .5);
});

test('AST templates adapt native names and whitespace while preserving global strict mode', async () => {
    const strict = '"use strict";\n' + source + '\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeCritical(strict); assert.equal(plan.status.ready, true);
    const changed = strict.replace(/\bnextCritical\b/g, 'newCriticalField').replace(/\bactive\b/g, 'newActiveField')
        .replace(/\bweaponId\b/g, 'weaponKey').replace(/\bdeviceId\b/g, 'deviceKey').replace(/\bforeground\b/g, 'frontColor') + '\nvar _kaspCriticalResult=42;';
    const adapted = await api.selectCriticalPlan(changed, [plan]); assert.ok(adapted); assert.equal(adapted.status.strategy, 'ast-template');
    const f = setup(changed, adapted); f.model.prepareFlag(true); f.frame();
    assert.equal(f.engine.status().ready, true); assert.equal(f.hud.weaponBar.material.frontColor.rgb, 16711680);
    assert.equal((0, f.context.nativeStrict)(), true); assert.equal(f.context._kaspCriticalResult, 42);
});

test('unsupported or ambiguous contracts and stale plans skip the whole indicator', async () => {
    const plan = analyzeCritical(source);
    for (const changed of [source.replace('_nextShotCriticalStatePerpared_criticalCodec', 'another-codec'),
        source.replace('weaponDeviceId = ', 'anotherId = '), source.replace('_kill_isCriticalCodec', 'another-kill-codec')]) {
        assert.equal(analyzeCritical(changed).status.ready, false);
        assert.equal(await api.selectCriticalPlan(changed, [plan]), undefined);
        assert.equal(api.patchCriticalIndicator(changed), changed);
    }
    const stale = { ...plan, sourceLength: source.length + 1 }; assert.equal(api.patchCriticalIndicator(source, undefined, stale), source);
});

test('extension callback names remain fixed when native fields use ready, equipment or frame', async () => {
    const base = source.replace(/\bnextCritical\b/g, 'ready').replace(/\bdeviceId\b/g, 'equipment').replace(/\breceive\b/g, 'frame');
    const plan = analyzeCritical(base); assert.equal(plan.status.ready, true);
    const changed = base.replace(/\bready\b/g, 'renamedReady').replace(/\bequipment\b/g, 'renamedEquipment').replace(/\bframe\b/g, 'renamedFrame');
    const adapted = await api.selectCriticalPlan(changed, [plan]); assert.ok(adapted);
    const f = setup(changed, adapted); f.model.prepareFlag(true); f.hud.renamedFrame();
    assert.equal(f.engine.status().ready, true); assert.equal(f.hud.weaponBar.material.foreground.rgb, 16711680);
});

test('critical and arcade hooks merge at shared boundaries without changing health or added meshes', () => {
    const arcade = require('./arcade-ast.cjs').analyzeArcade(source), critical = analyzeCritical(source);
    const merged = patches.mergeClientPatchPlans(source, [arcade, critical]); assert.equal(merged.rejected.length, 0); new vm.Script(merged.code);
    const f = setup(source, critical, [arcade]); f.model.prepareFlag(true); f.frame();
    assert.equal(f.hud.weaponBar.material.foreground.rgb, 16711680); assert.equal(f.hud.__kaspArcadeReloadBar, undefined);
    const titles = new f.context.Title(); titles.init(); assert.equal(titles.healthBar, 'health');
});

test('critical preparation is offline and keeps prior plans when a new bundle cannot be mapped', () => {
    const os = require('node:os'), { spawnSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-critical-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-critical.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        fs.writeFileSync(input, 'throw Error("DO_NOT_EXECUTE");\n' + source);
        const result = run(); assert.equal(result.status, 0, result.stderr); const previous = fs.readFileSync(output, 'utf8');
        fs.writeFileSync(input, source.replace('weaponDeviceId = ', 'anotherId = '));
        assert.equal(run().status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const f of [input, output]) if (fs.existsSync(f)) fs.unlinkSync(f); fs.rmdirSync(dir); }
});
