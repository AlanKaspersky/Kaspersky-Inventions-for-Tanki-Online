const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const runFeatureContext = require('./test-feature-context.cjs');
const patches = require('./test-client-patches.cjs');
const bonusModule = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/bonusPickup.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: bonusModule, require: () => patches });
const code = transformSync(fs.readFileSync('src/core/overdriveDirection.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;
function load(globals = {}) {
    const module = { exports: {} };
    runFeatureContext(code, { module, crypto: webcrypto, TextEncoder, ...globals,
        require: id => id === './bonusPickup' ? bonusModule.exports : patches });
    return module.exports;
}
const api = load();
const { analyzeOverdriveDirection } = require('./overdrive-direction-ast.cjs');
const source = `(function(){
 function Vector(x,y,z){this.x=x;this.y=y;this.z=z}
 Vector.prototype.toString=function(){return 'Vector3 ('+this.x+', '+this.y+', '+this.z+')'};
 Vector.prototype.copy=function(v){this.x=v.x;this.y=v.y;this.z=v.z};
 function physicsOf(t){var p=t.physics;if(p)return p;missing('tankPhysics')}
 function Follow(){};Follow.prototype.init=function(){this.physics=this.entity().optional(token(Physics))};
 function Physics(){};
 Physics.prototype.body=function(){var b=this.native;if(b)return b;missing('body')};
 Physics.prototype.init=function(){this.listener=function(e){this.body().state.position.copy(e.position)};this.listener.callableName='onSpawn'};
 function Controller(){};
 Controller.prototype.init=function(){on('handleCameraPointerEvent');on('handleMouseWheel')};
 Controller.prototype.start=function(){follow(this.world().camera.rotation.z)};
 function local(world){return world.tank}
 function token(type){return type}
 function Hud(){};
 Hud.prototype.frame=function(){this.bar.fill(1)};
 Hud.prototype.destroy=function(){this.bar.destroy()};
 window.fixture={Hud,Physics,Vector};
})();`;
const contract = { frameAt: source.indexOf('this.bar.fill(1)') + 'this.bar.fill(1)'.length, frameOwner: 'this',
    cleanupEnd: source.indexOf('this.bar.destroy()}') + 'this.bar.destroy()}'.length,
    localTank: 'local', world: 'world', optional: 'optional', token: 'token', barField: 'bar' };

test('direction is relative to camera yaw, with front/right/back/left and near-point suppression', () => {
    const pose = { position: { x: 0, y: 0, z: 75 }, yaw: 0 };
    const angle = (x, y, yaw = 0) => api.overdriveBearing({ x, y, z: 5000 }, { ...pose, yaw });
    assert.equal(angle(0, 1000), 0); assert.equal(angle(1000, 0), 90);
    assert.equal(angle(0, -1000), 180); assert.equal(angle(-1000, 0), -90);
    assert.ok(Math.abs(angle(-1000, 0, Math.PI / 2)) < 1e-8);
    assert.equal(angle(0, 0), null); assert.equal(angle(Infinity, 1), null);
    assert.equal(api.continuousBearing(179, -179), 181);
    assert.equal(api.continuousBearing(-179, 179), -181);
});

test('direction AST observes local physics and actual camera rotation without changing native results', async () => {
    const plan = analyzeOverdriveDirection(source, contract);
    assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    assert.equal(api.directionPlanValid(source, plan), true);
    let patched = source;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    const samples = [], window = { __kaspOverdriveDirection: { wanted: () => true, capture: (...args) => samples.push(args) } };
    vm.runInNewContext(patched, { window });
    const { Hud, Physics, Vector } = window.fixture;
    const position = new Vector(10, 20, 30), rotation = new Vector(1, 2, 3), physics = new Physics();
    physics.native = { state: { position } };
    const world = { camera: { rotation }, tank: { optional: () => physics } };
    const hud = new Hud(); let fills = 0;
    hud.world = () => world; hud.bar = { fill() { fills++; }, destroy() {} };
    hud.frame(); assert.equal(fills, 1); assert.equal(samples[0][0], position); assert.equal(samples[0][1], rotation);
    window.__kaspOverdriveDirection.wanted = () => false;
    hud.frame(); assert.equal(fills, 2); assert.equal(samples.length, 1);
    window.__kaspOverdriveDirection.wanted = () => true;
    world.tank = null; hud.frame(); assert.equal(samples.at(-1)[0], null);
    hud.destroy(); assert.equal(samples.at(-1)[1], null);
    window.__kaspOverdriveDirection.capture = () => { throw Error('observer failure'); };
    assert.doesNotThrow(() => hud.frame()); assert.equal(fills, 4);
    const adapted = await api.selectDirectionPlan('/* unrelated update */' + source, [plan]);
    assert.ok(adapted, 'templates must work after unrelated bundle changes');
    assert.equal(adapted.status.strategy, 'ast-template');
});

test('direction rejects missing camera/physics evidence and invalid edits without partial mapping', () => {
    const missing = analyzeOverdriveDirection(source.replace('handleCameraPointerEvent', 'other'), contract);
    assert.equal(missing.status.ready, false); assert.equal(missing.edits.length, 0);
    const plan = analyzeOverdriveDirection(source, contract);
    assert.equal(api.directionPlanValid(source + ' ', plan), false);
});

test('page direction telemetry defaults off, throttles enabled samples and clears on disable', () => {
    let enabled = false, time = 0;
    const events = [], listeners = {};
    const page = { location: { origin: 'https://tankionline.com' },
        postMessage: event => events.push(event), addEventListener: (name, handler) => { listeners[name] = handler; } };
    const { installOverdriveDirection } = load({ window: page, document: { visibilityState: 'visible' },
        localStorage: { getItem: () => enabled ? 'true' : null }, performance: { now: () => time } });
    installOverdriveDirection(page);
    assert.equal(page.__kaspOverdriveDirection.wanted(), false);
    enabled = true; listeners['kasp:settings-changed']();
    assert.equal(page.__kaspOverdriveDirection.wanted(), true);
    assert.equal(page.__kaspOverdriveDirection.wanted(), false);
    const point = { x: 1, y: 2, z: 3 };
    page.__kaspOverdriveDirection.capture(point, { x: 0, y: 0, z: Math.PI });
    assert.equal(events.length, 1); assert.equal(events[0].pose.yaw, Math.PI);
    time += 80; assert.equal(page.__kaspOverdriveDirection.wanted(), true);
    enabled = false; listeners['kasp:settings-changed']();
    assert.equal(events.at(-1).pose, null); assert.equal(page.__kaspOverdriveDirection.wanted(), false);
});
