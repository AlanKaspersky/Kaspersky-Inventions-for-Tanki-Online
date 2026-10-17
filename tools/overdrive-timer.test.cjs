const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

function load(file, dependencies = {}, globals = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    runFeatureContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, {
        ...globals, module, require: id => {
            if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`);
            return dependencies[id];
        },
    });
    return module.exports;
}
const runtime = load('src/core/bonusPickup.ts', { './clientPatches': require('./test-client-patches.cjs') });
const { analyzeOverdrive } = require('./overdrive-ast.cjs');
// Tests generate plans in Node, matching the offline preparation step; the page receives only edits.
const bonus = { ...runtime, patchBonusPickups: (source, report) => runtime.patchBonusPickups(source, report, analyzeOverdrive(source)) };
const timer = load('src/modules/overdriveTimer.ts', {
    '../core/bonusPickup': bonus, '../core/gameDOM': {}, '../core/state': {}, '../core/utils': {},
});
function gameId(id) {
    const result = { low: 123, high: 456 };
    Object.setPrototypeOf(result, { toString() { return id; } });
    return result;
}

const vectorPrototype = {
    toString() { return "Vector3 (" + this.f20_1 + ", " + this.g20_1 + ", " + this.h20_1 + ")"; }
};
bonus.registerBonusType(vectorPrototype, 'vector', { x: 'f20_1', y: 'g20_1', z: 'h20_1' });
function gameVector(x, y, z) {
    return Object.assign(Object.create(vectorPrototype), { f20_1: x, g20_1: y, h20_1: z });
}

test('mapped coordinates follow Vector3 semantics after renaming and field reordering without executing diagnostics or getters', () => {
    const prototype = {
        toString() { throw Error('must not execute'); return 'Vector3 (' + this.$east + ', ' + this['north'] + ', ' + this["altitude"] + ')'; }
    };
    const position = Object.assign(Object.create(prototype), { altitude: 3, unrelated: 123, north: 2, $east: 1 });
    bonus.registerBonusType(prototype, 'vector', { x: '$east', y: 'north', z: 'altitude' });
    assert.deepEqual({ ...bonus.readBonusPosition(position) }, { x: 1, y: 2, z: 3 });
    position.$east = 4;
    assert.equal(bonus.readBonusPosition(position).x, 4);
    assert.deepEqual({ ...bonus.readBonusPosition(gameVector(5, 6, 7)) }, { x: 5, y: 6, z: 7 });
    assert.equal(bonus.readBonusPosition({ a: 1, b: 2, c: 3 }), null);
    assert.equal(bonus.readBonusPosition({ f20_1: 1, g20_1: 2, h20_1: 3 }), null);
    position.north = Infinity;
    assert.equal(bonus.readBonusPosition(position), null);
    Object.defineProperty(position, 'north', { get() { throw Error('must not execute'); } });
    assert.equal(bonus.readBonusPosition(position), null);
    const duplicate = Object.assign(Object.create({ toString() { return 'Vector3 (' + this.a + ', ' + this.a + ', ' + this.c + ')'; } }), { a: 1, c: 3 });
    assert.equal(bonus.readBonusPosition(duplicate), null);
});

test('renamed BattleBonusData fields identify the box independently of resource order and shared sounds', () => {
    const events = [];
    const bridge = bonus.createBonusPickupBridge((model, position) => events.push({ model, position }));
    const prototype = {
        toString() { throw Error('must not execute'); return 'BattleBonusData(box=' + this['$mesh'] + ', pickupSound=' + this.$audio + ', dropSound=' + this.other + ')'; }
    };
    bonus.registerBonusType(prototype, 'bonus', { box: '$mesh', pickupSound: '$audio' });
    const sound = { id: gameId('118254') };
    const resource = model => Object.assign(Object.create(prototype), {
        metadata: gameId('9876543210'), other: { id: gameId('1111111111') }, $audio: sound, $mesh: { id: gameId(model) }
    });
    const overdrive = resource(bonus.OVERDRIVE_BOX_MODEL);
    const speed = resource('1647333199408');
    const instance = {};
    bridge.register(overdrive, 'first', gameVector(1, 2, 3), undefined, undefined, instance);
    bridge.register(speed, 'second', gameVector(4, 5, 6), undefined, undefined, {});
    assert.equal(bridge.prepare(overdrive, '$audio', instance), sound);
    bridge.context(sound, gameVector(7000, 8000, 9));
    assert.equal(events[0].model, bonus.OVERDRIVE_BOX_MODEL);
    assert.deepEqual({ ...events[0].position }, { x: 1, y: 2, z: 3 });
    bridge.prepare(speed, '$audio');
    bridge.context(sound, gameVector(4, 5, 6));
    assert.equal(events[1].model, '1647333199408');
    bridge.context(sound, gameVector(1, 2, 3));
    assert.equal(events.length, 2);
});

test('bundle hooks adapt to renamed symbols and formatting at every pickup call while preserving native returns', () => {
    const source = `
        X$.prototype.take$ = function (audio$, position$) {
            return play$(this, this.audio$, audio$, position$, 'bonus pickup');
        };
        X$.prototype.spawn$ = function (id$, data$, position$, rotation$, falling$) {
            var instance$ = this.pool$.get$();
            instance$.init$(id$, data$);
            var callback$ = 'onBonusCollision'; instance$.place$(position$, rotation$, falling$);
        };
        function picked$(instance$, position$) {
            return receiver.take$(get$(instance$).sound$, position$);
        }
        function otherPlayer$(instance$, position$) {
            return receiver.take$(get$(instance$).sound$, position$);
        }
    `;
    const events = [], order = [], reports = [];
    const bridge = bonus.createBonusPickupBridge((model, position) => events.push({ model, position }));
    function X$() {}
    const instance = { init$(_id, data) { this.data = data; order.push('init'); }, place$() { order.push('place'); } };
    const receiver = new X$();
    receiver.pool$ = { get$: () => instance };
    const context = { X$, receiver, window: {
        __kaspBonusRegister: (...args) => { order.push('observe'); bridge.register(...args); },
        __kaspBonusPrepare: bridge.prepare, __kaspBonusContext: bridge.context
    }, get$: item => { order.push('resource'); return item.data; },
    play$: (...args) => { order.push('play'); assert.equal(args[2], 42); return 123; } };
    const patched = bonus.patchBonusPickups(source, record => reports.push(record));
    assert.equal(reports[0].pickupCalls, 2);
    assert.equal(reports[0].registrationHooks, 1);
    assert.equal(reports[0].issues.length, 0);
    runFeatureContext(patched, context);
    const resource = { box: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) }, sound$: 42 };
    const origin = gameVector(1, 2, 3);
    receiver.spawn$('one', resource, origin, 0, false);
    origin.f20_1 = 999;
    assert.equal(context.picked$(instance, gameVector(10000, 20000, 3)), 123);
    assert.equal(context.otherPlayer$(instance, gameVector(30000, 40000, 3)), 123);
    assert.deepEqual(order, ['init', 'observe', 'place', 'resource', 'play', 'resource', 'play']);
    assert.equal(events.length, 2);
    assert.equal(events[0].position.x, 1);
    assert.equal(events[1].position.x, 1);
    assert.equal(bonus.patchBonusPickups(patched), patched);
});

test('unsupported or ambiguous pickup methods are diagnosed instead of guessed; partial patching is idempotent', () => {
    const method = 'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};';
    const check = source => {
        let report;
        const code = bonus.patchBonusPickups(source, value => { report = value; });
        return { code, report };
    };
    const absent = check('console.log("hello")');
    assert.equal(absent.code, 'console.log("hello")');
    assert.ok(absent.report.issues.includes('pickup-method-missing'));
    const ambiguous = check(method + method.replace('take=', 'other='));
    assert.ok(ambiguous.report.issues.includes('pickup-method-ambiguous'));
    assert.equal(ambiguous.code.includes('__kaspBonusContext'), false);
    const partial = check(method);
    assert.ok(partial.report.issues.includes('pickup-call-missing'));
    assert.ok(partial.report.issues.includes('registration-missing'));
    const repeated = check(partial.code);
    assert.equal(repeated.code, partial.code);
    assert.deepEqual([...repeated.report.issues], [...partial.report.issues]);
});

test('matching pickups start and restart exactly 85 seconds; other bonuses do not change the deadline', () => {
    let now = 1_000;
    const clock = timer.createOverdriveCountdown(() => now);
    assert.equal(clock.remaining(), null);
    assert.equal(clock.pickup('123456789'), false);
    assert.equal(clock.remaining(), null);
    assert.equal(clock.pickup(bonus.OVERDRIVE_BOX_MODEL), true);
    assert.equal(clock.remaining(), 85);
    now += 30_000;
    assert.equal(clock.remaining(), 55);
    clock.pickup('123456789');
    assert.equal(clock.remaining(), 55);
    clock.pickup(bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(clock.remaining(), 85);
    now += 84_999;
    assert.equal(clock.remaining(), 1);
    now += 1;
    assert.equal(clock.remaining(), 0);
    now += 60_000;
    assert.equal(clock.remaining(), 0);
    clock.reset();
    assert.equal(clock.remaining(), null);
});

test('bonus bridge resolves direct model and registered sound IDs without changing game objects', () => {
    const received = [];
    const bridge = bonus.createBonusPickupBridge(id => received.push(id));
    const box = gameId(bonus.OVERDRIVE_BOX_MODEL);
    const sound = gameId('1234567890');
    bridge.register({ box: { id: box }, sound: { id: sound } });
    const direct = { model: { id: box } };
    assert.equal(bridge.pickup(direct), direct);
    const bySound = { sound: { id: sound } };
    assert.equal(bridge.pickup(bySound), bySound);
    assert.deepEqual(received, [bonus.OVERDRIVE_BOX_MODEL, bonus.OVERDRIVE_BOX_MODEL]);
    const cycle = {}; cycle.self = cycle;
    assert.equal(bridge.pickup(cycle), cycle);
    const inaccessible = Object.defineProperty({}, 'field', { enumerable: true, get() { throw Error('getter'); } });
    assert.equal(bridge.pickup(inaccessible), inaccessible);
    assert.equal(bridge.pickup(null), null);
});


test('patched game pickup emits the model and preserves the original call arguments', () => {
    const source = 'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};' +
        'receiver.take(getBonus(X).sound,7);';
    const events = [];
    const original = { sound: 42, model: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) } };
    const bridge = bonus.createBonusPickupBridge(id => events.push(id));
    const calls = [];
    const receiver = {};
    runFeatureContext(bonus.patchBonusPickups(source), {
        window: { __kaspBonusPrepare: bridge.prepare, __kaspBonusContext: bridge.context }, X: {}, proto: () => receiver,
        receiver, getBonus: () => original, play: (...args) => calls.push(args),
    });
    assert.deepEqual(events, [bonus.OVERDRIVE_BOX_MODEL]);
    assert.equal(calls[0][2], 42);
    assert.equal(calls[0][3], 7);
    assert.equal(calls[0][4], 'bonus pickup');
});

test('registration patch selects the collision constructor, and unrelated bundles are unchanged', () => {
    const source = 'proto(X).register=function(a,b,c,d,e,f){var g,h,i=this.pool.get();onBonusCollision(b)}';
    const registrations = [];
    const receiver = {};
    runFeatureContext(bonus.patchBonusPickups(source), {
        window: { __kaspBonusRegister: (...args) => registrations.push(args) },
        X: {}, proto: () => receiver, onBonusCollision() {},
    });
    receiver.pool = { get() {} };
    const data = {};
    receiver.register(1, data, 3, 4, 5, 6);
    assert.equal(registrations[0][0], data);
    assert.deepEqual(registrations[0].slice(1), [1, 3, 4, 5]);
    assert.equal(bonus.patchBonusPickups('console.log("hello");'), 'console.log("hello");');
});

test('pooled game bonuses use their registered origin when another player picks up a displaced box', () => {
    let now = 0;
    const locations = timer.createOverdriveLocations(() => now);
    const events = [];
    const bridge = bonus.createBonusPickupBridge((model, position) => {
        events.push({ model, position });
        locations.pickup(model, position);
    });
    const resource = { box: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) }, sound: { id: gameId('118254') } };
    const spawn = gameVector(2000, -4000, 5000);
    const landing = gameVector(2100, -4050, 75);
    const plays = [];
    const instance = { init(id, data) { this.id = id; this.data = data; }, place(...args) { this.placement = args; } };
    const manager = { pool: { get: () => instance }, light: {}, sound: {}, items: { put() {} } };
    const source = 'proto(X).register=function(a,b,c,d,e){var u=this.pool.get();u.init(a,b);' +
        'var s,o,_=this.light;u.place(c,d,_,(s=this,o=function(t,n){return t},o.callableName="onBonusCollision",o),e),this.items.put(a,u)};' +
        'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};' +
        'function picked(t,n){manager.take(getBonus(t).sound,n)}';
    const hooks = [];
    const patched = bonus.patchBonusPickups(source, record => hooks.push(record));
    const context = { window: { __kaspBonusRegister: bridge.register, __kaspBonusPrepare: bridge.prepare,
        __kaspBonusContext: bridge.context }, X: {}, proto: () => manager, manager,
        getBonus: object => object.data, play: (...args) => plays.push(args) };
    runFeatureContext(patched, context);
    assert.equal(hooks[0].registrationHooks, 1);
    assert.equal(bonus.patchBonusPickups(patched), patched);
    manager.register('box-1', resource, spawn, 0, false);
    context.picked(instance, landing);
    assert.equal(events[0].position.x, 2000);
    assert.equal(plays[0][2], resource.sound);
    assert.equal(plays[0][3], landing);
    spawn.f20_1 = 90000;
    assert.equal(events[0].position.x, 2000);
    now += 85000;
    manager.register('box-2', resource, gameVector(2000, -4000, 5000), 0, false);
    context.picked(instance, gameVector(5000, -6500, 75));
    assert.equal(locations.timers[0].countdown.remaining(), 85);
    assert.equal(locations.timers[1].countdown.remaining(), null);
    now += 20000;
    manager.register('box-3', resource, gameVector(-1600, -7500, 5000), 0, false);
    context.picked(instance, landing);
    assert.equal(locations.timers[0].countdown.remaining(), 65);
    assert.equal(locations.timers[1].countdown.remaining(), 85);
    manager.register('box-4', resource, {}, 0, false);
    context.picked(instance, landing);
    assert.equal(events.at(-1).position.x, landing.f20_1);
});

test('registration observation failures leave native initialization and placement intact', () => {
    const instance = { init() { this.initialized = true; }, place() { this.placed = true; } };
    const receiver = { pool: { get: () => instance } };
    const source = 'proto(X).register=function(a,b,c,d,e){var u=this.pool.get();u.init(a,b);' +
        'var handler="onBonusCollision";u.place(c,d,e)};receiver.register(1,{}, {},0,false);';
    for (const window of [{}, { __kaspBonusRegister() { throw Error('observer failure'); } }]) {
        instance.initialized = instance.placed = false;
        runFeatureContext(bonus.patchBonusPickups(source), { window, X: {}, proto: () => receiver, receiver });
        assert.equal(instance.initialized, true);
        assert.equal(instance.placed, true);
    }
});

test('diagnostics capture registration IDs and coordinates plus actual pickup arguments without changing game execution', () => {
    const records = [];
    const events = [];
    const debug = bonus.createBonusDiagnostics(record => records.push(record), true, () => 123);
    const bridge = bonus.createBonusPickupBridge(id => events.push(id), debug.record);
    const data = { model: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) }, sound: { id: gameId('1234567890') } };
    const receiver = { pool: { get() {} } };
    const position = gameVector(100, 200, 300);
    const original = { ...data, sound: gameId('1234567890') };
    let reads = 0;
    const calls = [];
    const source = 'proto(X).register=function(a,b,c,d,e,f){var g,h,i=this.pool.get();onBonusCollision(b)};' +
        'receiver.register("box-7",data,100,200,300,0);' +
        'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};' +
        'receiver.take(getBonus(X).sound,position);';
    runFeatureContext(bonus.patchBonusPickups(source, debug.record), {
        window: { __kaspBonusRegister: bridge.register, __kaspBonusPrepare: bridge.prepare, __kaspBonusContext: bridge.context },
        X: {}, proto: () => receiver, receiver, data, position,
        getBonus: () => { reads++; return original; },
        onBonusCollision() {}, play: (...args) => calls.push(args),
    });
    assert.equal(reads, 1);
    assert.equal(calls[0][2], original.sound);
    assert.equal(calls[0][3], position);
    assert.deepEqual(events, [bonus.OVERDRIVE_BOX_MODEL]);
    const journal = JSON.parse(debug.export());
    assert.equal(journal[0].kind, 'hooks');
    assert.equal(journal[0].registrationHooks, 1);
    assert.equal(journal[0].pickupHook, true);
    const registration = journal.find(record => record.kind === 'register');
    assert.equal(registration.instanceId, 'box-7');
    assert.deepEqual(registration.position, { x: 100, y: 200, z: 300 });
    const context = journal.find(record => record.kind === 'pickup-context');
    assert.equal(context.model, bonus.OVERDRIVE_BOX_MODEL);
    assert.deepEqual(context.argument2, { ...position });
    position.f20_1 = 999;
    assert.equal(context.argument2.f20_1, 100);
});

test('diagnostics are opt-in and bounded; broken logging cannot interrupt pickup playback', () => {
    const debug = bonus.createBonusDiagnostics(() => { throw Error('console failure'); });
    debug.record({ kind: 'ignored' });
    assert.equal(debug.export(), '[]');
    debug.enable();
    for (let i = 0; i < 210; i++) debug.record({ kind: 'event', index: i });
    const journal = JSON.parse(debug.export());
    assert.equal(journal.length, 200);
    assert.equal(journal[0].index, 10);
    debug.clear();
    assert.equal(debug.export(), '[]');
    const cycle = {}; cycle.self = cycle;
    assert.match(JSON.stringify(bonus.snapshotBonusArgument(cycle)), /cycle/);
    const receiver = {};
    let plays = 0;
    const source = 'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};receiver.take(1,2);';
    runFeatureContext(bonus.patchBonusPickups(source), {
        window: { __kaspBonusContext() { throw Error('debug failure'); } },
        X: {}, proto: () => receiver, receiver, play: () => { plays++; },
    });
    assert.equal(plays, 1);
});

test('shared sounds cannot change the paired pickup model; a sound without a paired resource emits nothing', async () => {
    const events = [];
    const bridge = bonus.createBonusPickupBridge((model, position) => events.push({ model, position }));
    const sound = { resource: gameId('118254') };
    const overdrive = { box: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) }, sound };
    const speed = { box: { id: gameId('1647333199408') }, sound };
    bridge.register(overdrive);
    bridge.register(speed);
    const first = gameVector(2041.02294921875, -3980.24560546875, 74.99999670411762);
    const second = gameVector(-1525.3227160330612, -7486.826622686282, 205.0628024940404);
    bridge.prepare(overdrive, 'sound');
    bridge.context(sound, first);
    bridge.prepare(overdrive, 'sound');
    bridge.context(sound, second);
    assert.equal(events.length, 2);
    assert.equal(events[0].model, bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(events[1].model, bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(events[0].position.x, first.f20_1);
    assert.equal(events[1].position.x, second.f20_1);
    bridge.context(sound, first);
    assert.equal(events.length, 2);
    bridge.prepare(speed, 'sound');
    bridge.context(sound, first);
    assert.equal(events[2].model, '1647333199408');
    bridge.prepare(overdrive, 'sound');
    bridge.prepare(speed, 'sound');
    bridge.context(sound, first);
    bridge.context(sound, second);
    assert.equal(events[3].model, '1647333199408');
    assert.equal(events[4].model, bonus.OVERDRIVE_BOX_MODEL);
    bridge.prepare(overdrive, 'sound');
    await Promise.resolve();
    bridge.context(sound, first);
    assert.equal(events.length, 5);
});

test('pickup preparation evaluates the sound getter once and preserves original evaluation order', () => {
    const order = [];
    const bridge = bonus.createBonusPickupBridge(() => {});
    const receiver = {};
    const data = { model: { id: gameId(bonus.OVERDRIVE_BOX_MODEL) } };
    Object.defineProperty(data, 'sound', { enumerable: true, get() { order.push('sound'); return 42; } });
    const source = 'proto(X).take=function(a,b){play(this,this.sound,a,b,"bonus pickup")};' +
        'receiver.take(getBonus(X).sound,getPosition());';
    runFeatureContext(bonus.patchBonusPickups(source), {
        window: { __kaspBonusPrepare: bridge.prepare, __kaspBonusContext: bridge.context },
        X: {}, proto: () => receiver, receiver,
        getBonus: () => { order.push('data'); return data; },
        getPosition: () => { order.push('position'); return {}; },
        play: () => order.push('play'),
    });
    assert.deepEqual(order, ['data', 'sound', 'position', 'play']);
});

test('locations are learned from current pickups, stay independent and are relearned on another map', () => {
    let now = 0;
    const points = timer.createOverdriveLocations(() => now);
    const first = { x: 2041, y: -3980, z: 75 };
    const second = { x: -1525, y: -7487, z: 205 };
    const remaining = () => points.timers.map(point => point.countdown.remaining());
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, first);
    assert.equal(remaining()[0], 85);
    assert.equal(remaining()[1], null);
    now += 20_000;
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, second);
    assert.equal(remaining()[0], 65);
    assert.equal(remaining()[1], 85);
    now += 10_000;
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, { ...first, x: first.x + 100 });
    assert.equal(remaining()[0], 85);
    assert.equal(remaining()[1], 75);
    assert.equal(points.pickup(bonus.OVERDRIVE_BOX_MODEL), false);
    assert.equal(points.pickup('1647333199408', first), false);
    assert.equal(points.pickup(bonus.OVERDRIVE_BOX_MODEL, { x: 50000, y: 50000, z: 0 }), false);
    points.reset();
    assert.equal(remaining()[0], null);
    assert.equal(remaining()[1], null);
    const newMap = { x: -30000, y: 20000, z: 500 };
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, newMap);
    assert.equal(points.timers[0].position.x, newMap.x);
    assert.equal(points.timers[1].position, null);
    assert.equal(bonus.readBonusPosition({ x: NaN, y: 0, z: 0 }), null);
    assert.equal(bonus.readBonusPosition({ x: Infinity, y: 0, z: 0 }), null);
});

test('landing drift and vertical offsets at one overdrive point do not create a second timer', () => {
    let now = 0;
    const points = timer.createOverdriveLocations(() => now);
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, { x: 2000, y: -4000, z: 75 });
    now += 85000;
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, { x: 2600, y: -4500, z: 2000 });
    assert.equal(points.timers[0].countdown.remaining(), 85);
    assert.equal(points.timers[1].countdown.remaining(), null);
    now += 20000;
    points.pickup(bonus.OVERDRIVE_BOX_MODEL, { x: -1600, y: -7500, z: 205 });
    assert.equal(points.timers[0].countdown.remaining(), 65);
    assert.equal(points.timers[1].countdown.remaining(), 85);
});

test('battle overlay ignores foreign messages, resets between battles and removes itself when disabled', () => {
    let now = 1000;
    let enabled = true;
    let canvas = {};
    let results = false;
    let previewVisible = false;
    let lobby = false;
    let sectionContainer = null;
    const listeners = {};
    const elements = [];
    const state = { lang: 'EN' };
    let intervalCount = 0;
    let stoppedIntervals = 0, observerDisconnects = 0, observerStarts = 0;
    let previewCallback;
    class Element {
        isConnected = false;
        textContent = '';
        children = [];
        classes = new Set();
        classList = { toggle: (name, force) => force ? this.classes.add(name) : this.classes.delete(name) };
        append(...children) { this.children.push(...children); }
        remove() { this.isConnected = false; }
    }
    const window = {
        location: { origin: 'https://tankionline.com' },
        addEventListener: (name, handler) => { listeners[name] = handler; },
        setInterval: () => ++intervalCount,
        clearInterval: () => { stoppedIntervals++; },
    };
    const document = {
        querySelectorAll: () => sectionContainer ? [sectionContainer] : [],
        querySelector: selector => {
            if (selector === 'canvas') return canvas;
            if (selector === 'results') return results ? {} : null;
            if (selector === 'preview') return previewVisible ? {} : null;
            if (selector === 'lobby') return lobby ? {} : null;
            return null;
        },
        createElement: () => new Element(),
        body: { appendChild(element) { element.isConnected = true; elements.push(element); } },
        addEventListener: (name, handler) => { listeners[name] = handler; },
    };
    const { overdriveTimer } = load('src/modules/overdriveTimer.ts', {
        '../core/bonusPickup': bonus,
        '../core/gameDOM': { gameDOM: { screens: { battleCanvas: 'canvas', visibleTankPreview: 'preview' },
            common: { container: 'container' }, results: { status: 'results' }, play: { mainMenu: 'lobby' } } },
        '../core/state': { state },
        '../core/utils': { utils: { getSetting: () => enabled } },
    }, { window, document, Date: { now: () => now }, getComputedStyle: element => element.style,
        MutationObserver: class { constructor(callback) { previewCallback = callback; } observe() { observerStarts++; } disconnect() { observerDisconnects++; } } });
    const send = (detail, source = window) => listeners.message({ origin: 'https://tankionline.com', source, data: { type: bonus.BONUS_PICKUP_MESSAGE, detail } });
    const activePanel = (id = 'kasp-overdrive-timer') => elements.find(element => element.isConnected && element.id === id);
    const displayed = (id) => activePanel(id)?.children[0].textContent;
    overdriveTimer.setup(); overdriveTimer.setup();
    assert.equal(intervalCount, 1);
    assert.equal(displayed(), '0:00');
    send(bonus.OVERDRIVE_BOX_MODEL, {});
    send({ malicious: true });
    send('123456789');
    send('1647333199408');
    assert.equal(displayed(), '0:00');
    send(bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(displayed(), '1:25');
    now += 30_000; overdriveTimer.sync();
    assert.equal(displayed(), '0:55');
    send(bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(displayed(), '1:25');
    now += 74_000; overdriveTimer.sync();
    assert.equal(displayed(), '0:11');
    assert.equal(elements.at(-1).classes.has('kasp-overdrive-soon'), false);
    now += 1_000; overdriveTimer.sync();
    assert.equal(displayed(), '0:10');
    assert.equal(elements.at(-1).classes.has('kasp-overdrive-soon'), true);
    now += 10_000; overdriveTimer.sync();
    assert.equal(displayed(), '0:00');
    assert.equal(elements.at(-1).classes.has('kasp-overdrive-soon'), false);
    assert.equal(elements.at(-1).classes.has('kasp-overdrive-ready'), true);
    state.lang = 'RU'; overdriveTimer.sync();
    assert.equal(displayed(), '0:00');
    send(bonus.OVERDRIVE_BOX_MODEL);
    assert.equal(displayed(), '1:25');
    assert.equal(elements.at(-1).classes.has('kasp-overdrive-ready'), false);
    const at = position => send({ model: bonus.OVERDRIVE_BOX_MODEL, position });
    at({ x: 2041, y: -3980, z: 75 });
    now += 10_000; overdriveTimer.sync();
    at({ x: -1525, y: -7487, z: 205 });
    const secondaryId = 'kasp-overdrive-timer-secondary';
    assert.equal(displayed(), '1:15');
    assert.equal(displayed(secondaryId), '1:25');
    now += 5_000; overdriveTimer.sync();
    at({ x: 2050, y: -3990, z: 75 });
    assert.equal(displayed(), '1:25');
    assert.equal(displayed(secondaryId), '1:20');
    sectionContainer = { getClientRects: () => [{}], style: { display: 'block', visibility: 'visible', opacity: '1' } };
    previewCallback([{ type: 'childList', addedNodes: [{ matches: () => true }], removedNodes: [] }]);
    assert.equal(displayed(), undefined);
    assert.equal(displayed(secondaryId), undefined);
    now += 5_000;
    sectionContainer.style.display = 'none';
    previewCallback([{ type: 'attributes', target: { matches: () => true } }]);
    assert.equal(displayed(), '1:20');
    assert.equal(displayed(secondaryId), '1:15');
    sectionContainer = null;
    previewVisible = true;
    previewCallback([{ target: { matches: () => true } }]);
    assert.equal(displayed(), undefined);
    assert.equal(displayed(secondaryId), undefined);
    canvas = null;
    now += 10_000; overdriveTimer.sync();
    at({ x: -1525, y: -7487, z: 205 });
    assert.equal(displayed(secondaryId), undefined);
    previewVisible = false; overdriveTimer.sync();
    assert.equal(displayed(), '1:10');
    canvas = {}; overdriveTimer.sync();
    assert.equal(displayed(), '1:10');
    assert.equal(displayed(secondaryId), '1:25');
    canvas = {}; overdriveTimer.sync();
    assert.equal(displayed(), '0:00');
    assert.equal(displayed(secondaryId), undefined);
    send(bonus.OVERDRIVE_BOX_MODEL);
    listeners['kasp:battle:id']();
    assert.equal(displayed(), '0:00');
    enabled = false; listeners['kasp:settings-changed']();
    assert.equal(displayed(), undefined);
    assert.equal(stoppedIntervals, 1);
    assert.ok(observerDisconnects > 0);
    const startedWhileDisabled = intervalCount;
    overdriveTimer.sync();
    assert.equal(intervalCount, startedWhileDisabled);
    send(bonus.OVERDRIVE_BOX_MODEL);
    enabled = true; listeners['kasp:settings-changed']();
    assert.equal(intervalCount, 2);
    assert.equal(observerStarts, 2);
    assert.equal(displayed(), '0:00');
    send(bonus.OVERDRIVE_BOX_MODEL);
    results = true; overdriveTimer.sync();
    assert.equal(displayed(), undefined);
    results = false; canvas = null; overdriveTimer.sync();
    send(bonus.OVERDRIVE_BOX_MODEL);
    canvas = {}; overdriveTimer.sync();
    assert.equal(displayed(), '0:00');
    send(bonus.OVERDRIVE_BOX_MODEL);
    previewVisible = true; overdriveTimer.sync();
    lobby = true; canvas = null; overdriveTimer.sync();
    previewVisible = lobby = false; canvas = {}; overdriveTimer.sync();
    assert.equal(displayed(), '0:00');
});
