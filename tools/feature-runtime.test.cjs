const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

function fixture() {
    let now = 0, next = 0;
    const timers = new Map(), frames = new Map(), observers = [];
    const page = new EventTarget();
    page.setTimeout = page.setInterval = callback => { const id = ++next; timers.set(id, callback); return id; };
    page.clearTimeout = page.clearInterval = id => timers.delete(id);
    page.requestAnimationFrame = callback => { const id = ++next; frames.set(id, callback); return id; };
    page.cancelAnimationFrame = id => frames.delete(id);
    const storage = new Map();
    const cache = new Map();
    function load(name) {
        if (cache.has(name)) return cache.get(name);
        const module = { exports: {} };
        vm.runInNewContext(transformSync(fs.readFileSync(`src/core/${name}.ts`, 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
            module, window: page, performance: { now: () => now }, queueMicrotask,
            localStorage: { getItem: key => storage.get(key) ?? null },
            MutationObserver: class {
                constructor(callback) { this.callback = callback; this.connected = false; observers.push(this); }
                observe() { this.connected = true; } disconnect() { this.connected = false; }
            }, require: id => load(id.replace('./', '')),
        });
        cache.set(name, module.exports); return module.exports;
    }
    return { ...load('featureRuntime'), load, page, timers, frames, observers, storage,
        advance: milliseconds => { now += milliseconds; } };
}

test('three errors within ten seconds isolate one feature and run its cleanup only once', () => {
    const f = fixture(), broken = f.featureScope('broken'), healthy = f.featureScope('healthy');
    let cleanup = 0, calls = 0;
    broken.onCleanup(() => cleanup++);
    for (let i = 0; i < 3; i++) { broken.run(() => { throw Error('native contract changed'); }); broken.run(() => 1); }
    assert.equal(broken.disabled, true); assert.equal(cleanup, 1);
    broken.dispose(); broken.run(() => calls++); healthy.run(() => calls++);
    assert.equal(cleanup, 1); assert.equal(calls, 1);
    assert.equal(broken.status().failures, 3); assert.equal(healthy.disabled, false);
});

test('isolated old errors expire and async rejection is observed without escaping', async () => {
    const f = fixture(), scope = f.featureScope('async');
    await scope.run(() => Promise.reject(Error('failed fetch')));
    f.advance(10001);
    scope.run(() => { throw Error('one'); }); scope.run(() => { throw Error('two'); });
    assert.equal(scope.disabled, false);
    await scope.run(() => Promise.reject(Error('three')));
    assert.equal(scope.disabled, true);
});

test('disposal cancels timers, frames, listeners and observers; queued work remains inert', async () => {
    const f = fixture(), scope = f.featureScope('resources'), target = new EventTarget();
    let calls = 0;
    scope.listen(target, 'click', () => calls++);
    const cancelled = scope.timeout(() => calls++);
    scope.cancelTimeout(cancelled);
    assert.equal(scope.status().resources, 1);
    scope.timeout(() => calls++); scope.interval(() => calls++, 10); scope.frame(() => calls++);
    scope.microtask(() => calls++);
    const observer = scope.observer(() => calls++); observer.observe({});
    const queued = [...f.timers.values(), ...f.frames.values()];
    scope.dispose(); target.dispatchEvent(new Event('click'));
    queued.forEach(callback => callback()); observer.callback([], observer); await Promise.resolve();
    assert.equal(calls, 0); assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
    assert.equal(observer.connected, false); assert.equal(scope.status().resources, 0);
});

test('a broken cleanup cannot stop cleanup of other resources', () => {
    const f = fixture(), scope = f.featureScope('cleanup'); let restored = false;
    scope.onCleanup(() => { restored = true; }); scope.onCleanup(() => { throw Error('missing mesh'); });
    scope.dispose(); assert.equal(restored, true); assert.equal(scope.status().cleanupErrors, 1);
});

test('repeated slow calls retain results and owned resources while recording timing diagnostics', () => {
    const f = fixture();
    for (const budgetMs of [4, 16]) {
        let scopeTime = 0, cleanup = 0, clicks = 0;
        const scope = f.createFeatureScope(`slow-${budgetMs}`, { now: () => scopeTime, budgetMs });
        const target = new EventTarget();
        scope.onCleanup(() => cleanup++);
        scope.listen(target, 'click', () => clicks++);
        scope.interval(() => {}, 10);
        for (let i = 0; i < 20; i++) {
            assert.equal(scope.run(() => { scopeTime += budgetMs + 1; return i; }), i);
        }
        target.dispatchEvent(new Event('click'));
        assert.equal(clicks, 1);
        assert.equal(cleanup, 0);
        assert.equal(scope.disabled, false);
        assert.equal(scope.status().reason, null);
        assert.equal(scope.status().slowCalls, 20);
        assert.equal(scope.status().maxMs, budgetMs + 1);
        assert.equal(scope.status().lastMs, 0);
        assert.equal(scope.status().resources, 3);
        scope.dispose();
        assert.equal(cleanup, 1);
        assert.equal(scope.status().resources, 0);
    }
});

test('slow calls do not mask recurring errors and manual disposal still stops later work', () => {
    const f = fixture(), scope = f.featureScope('slow-errors');
    let cleanup = 0;
    scope.onCleanup(() => cleanup++);
    for (let i = 0; i < 3; i++) {
        scope.run(() => { f.advance(50); throw Error('broken contract'); });
        scope.run(() => { f.advance(50); });
    }
    assert.equal(scope.disabled, true);
    assert.equal(scope.status().reason, 'repeated-error');
    assert.equal(scope.status().failures, 3);
    assert.equal(cleanup, 1);
    scope.run(() => assert.fail('disabled callback must remain inert'));
    scope.dispose();
    assert.equal(cleanup, 1);
});

test('native settings remove owned presentation immediately and can re-enable healthy hooks', () => {
    const f = fixture();
    const control = f.load('nativeFeature').createNativeFeature(f.page, 'hud', 'enabled');
    const owner = {}; let cleanup = 0, calls = 0;
    control.track(owner, () => cleanup++); control.track(owner, () => cleanup++);
    control.run(() => calls++);
    f.storage.set('enabled', 'false'); f.page.dispatchEvent(new Event('kasp:settings-changed'));
    control.run(() => calls++); assert.equal(cleanup, 1); assert.equal(calls, 1);
    f.storage.set('enabled', 'true'); f.page.dispatchEvent(new Event('kasp:settings-changed'));
    control.run(() => calls++); assert.equal(calls, 2);
    control.release(owner); control.disable(); assert.equal(cleanup, 1);
    assert.equal(control.active(), false);
});

test('initialization failure returns an inert API and releases partially installed resources', () => {
    const f = fixture(), scope = f.featureScope('init');
    const target = new EventTarget(); let calls = 0;
    const api = scope.initialize(() => { scope.listen(target, 'click', () => calls++); throw Error('missing dependency'); }, { tick() {} });
    api.tick(); target.dispatchEvent(new Event('click'));
    assert.equal(calls, 0); assert.equal(scope.status().reason, 'initialization-error');
    assert.equal(scope.status().resources, 0);
});

test('presentation cleanup restores owned properties without overwriting later native changes', () => {
    const f = fixture(), scope = f.featureScope('presentation');
    const values = new Map([['width','10px'],['height','20px']]), classes = new Set(['native']);
    const element = { style: {
        getPropertyValue: key => values.get(key) || '', getPropertyPriority: () => '',
        setProperty: (key,value) => values.set(key,value), removeProperty: key => values.delete(key),
    }, classList: { contains: key => classes.has(key), toggle: (key,on) => on ? classes.add(key) : classes.delete(key) } };
    const commit = scope.preserve(element, ['width','height'], ['custom']);
    values.set('width','30px'); values.set('height','40px'); classes.add('custom'); commit();
    values.set('height','50px'); classes.add('new-native'); scope.dispose();
    assert.equal(values.get('width'),'10px'); assert.equal(values.get('height'),'50px');
    assert.equal(classes.has('custom'),false); assert.equal(classes.has('new-native'),true);
});
