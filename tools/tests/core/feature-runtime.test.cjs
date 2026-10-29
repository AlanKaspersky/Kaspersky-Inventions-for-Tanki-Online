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

function styledNode() {
    const node = new EventTarget(), values = new Map(), priorities = new Map(), classes = new Set();
    node.isConnected = true;
    node.style = {
        getPropertyValue: key => values.get(key) || '', getPropertyPriority: key => priorities.get(key) || '',
        setProperty: (key, value, priority = '') => { values.set(key, value); priorities.set(key, priority); },
        removeProperty: key => { values.delete(key); priorities.delete(key); },
    };
    node.classList = { contains: key => classes.has(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) };
    return node;
}

function sweepTimers(f) {
    // Like a browser timeout, remove the fired handle before the callback reschedules.
    for (const [id, callback] of [...f.timers]) { f.timers.delete(id); callback(); }
}

test('detached presentation nodes are released without any subsequent feature tick', () => {
    const f = fixture(), scope = f.featureScope('screen');
    for (let cycle = 0; cycle < 5; cycle++) {
        const nodes = Array.from({ length: 1000 }, styledNode);
        for (const node of nodes) {
            node.style.setProperty('display', 'grid');
            const commit = scope.preserve(node, ['display']);
            node.style.setProperty('display', 'none'); commit();
            node.isConnected = false;
        }
        assert.equal(scope.status().domNodes, 1000);
        assert.equal(scope.status().resources, 1, 'one cleanup registry per scope, not one callback per node');
        assert.equal(f.timers.size, 1);
        sweepTimers(f); f.advance(1001); sweepTimers(f);
        assert.equal(scope.status().domNodes, 0);
        assert.equal(scope.status().resources, 0);
        assert.equal(f.timers.size, 0, 'idle scopes do not keep a sweeping timer');
        assert.ok(nodes.every(node => node.style.getPropertyValue('display') === 'grid'));
    }
});

test('temporary DOM reparenting retains ownership and later native styles are restored', () => {
    const f = fixture(), scope = f.featureScope('reparent'), node = styledNode();
    node.style.setProperty('display', 'grid');
    let commit = scope.preserve(node, ['display']); node.style.setProperty('display', 'none'); commit();
    node.isConnected = false; scope.pruneDOM(); f.advance(500);
    node.isConnected = true; scope.pruneDOM();
    assert.equal(scope.status().domNodes, 1);
    node.style.setProperty('display', 'flex', 'important');
    commit = scope.preserve(node, ['display']); node.style.setProperty('display', 'none'); commit();
    scope.dispose();
    assert.equal(node.style.getPropertyValue('display'), 'flex');
    assert.equal(node.style.getPropertyPriority('display'), 'important');
    assert.equal(f.timers.size, 0);
});

test('an old presentation commit cannot claim a released or disposed node again', () => {
    const f = fixture(), scope = f.featureScope('stale'), node = styledNode();
    const commit = scope.preserve(node, ['display']); node.style.setProperty('display', 'none'); commit();
    scope.releaseDOM(node); node.style.setProperty('display', 'flex'); commit();
    scope.dispose(); scope.preserve(node, ['display'])();
    assert.equal(scope.status().domNodes, 0); assert.equal(scope.status().resources, 0);
    assert.equal(node.style.getPropertyValue('display'), 'flex');
});

test('DOM cleanup deduplicates callbacks, tolerates failures and releases external caches', () => {
    const f = fixture(), scope = f.featureScope('cache'), node = styledNode(), cache = new Map([[node, 1]]);
    let restores = 0;
    const restore = element => { cache.delete(element); restores++; };
    scope.ownDOM(node, () => { throw Error('broken cleanup'); });
    scope.ownDOM(node, restore); scope.ownDOM(node, restore);
    node.isConnected = false; scope.pruneDOM(); f.advance(1000); scope.pruneDOM();
    assert.equal(cache.size, 0); assert.equal(restores, 1); assert.equal(scope.status().cleanupErrors, 1);
    assert.equal(scope.status().resources, 0); assert.equal(scope.status().domNodes, 0);
});

test('one shared timer sweeps multiple scopes and stops when the last owner is released', () => {
    const f = fixture(), first = f.featureScope('first'), second = f.featureScope('second');
    first.ownDOM(styledNode(), () => {}); second.ownDOM(styledNode(), () => {});
    assert.equal(f.timers.size, 1);
    first.dispose(); assert.equal(f.timers.size, 1);
    second.dispose(); assert.equal(f.timers.size, 0);
});

test('expired detached listeners are removed from the target and both registries', () => {
    const f = fixture(), scope = f.featureScope('listeners'), node = styledNode(); let calls = 0;
    const callback = () => calls++;
    scope.listen(node, 'click', callback); scope.listen(node, 'click', callback);
    node.dispatchEvent(new Event('click')); assert.equal(calls, 1, 'duplicate registration is idempotent');
    node.isConnected = false; sweepTimers(f); f.advance(1001); sweepTimers(f);
    assert.equal(scope.status().listeners, 0); assert.equal(scope.status().resources, 0); assert.equal(f.timers.size, 0);
    node.isConnected = true; node.dispatchEvent(new Event('click')); assert.equal(calls, 1);
    scope.unlisten(node, 'click', callback); node.dispatchEvent(new Event('click')); assert.equal(calls, 1);
    scope.listen(node, 'click', callback); node.dispatchEvent(new Event('click')); assert.equal(calls, 2);
    scope.listen(node, 'click', callback); node.isConnected = false;
    scope.pruneDOM(); f.advance(1001); scope.pruneDOM(); scope.dispose();
    node.isConnected = true; node.dispatchEvent(new Event('click')); assert.equal(calls, 2);
});

test('three detach/rebind cycles on the same button do not leave ghost handlers', () => {
    const f = fixture(), scope = f.featureScope('rebind'), node = styledNode();
    let calls = 0, nativeCalls = 0, removals = 0;
    node.addEventListener('click', () => nativeCalls++);
    const remove = node.removeEventListener.bind(node);
    node.removeEventListener = (...args) => { removals++; remove(...args); };
    for (let cycle = 0; cycle < 3; cycle++) {
        node.isConnected = true;
        scope.listen(node, 'click', () => calls++);
        node.isConnected = false; scope.pruneDOM(); f.advance(1001); scope.pruneDOM();
        assert.equal(scope.status().listeners, 0); assert.equal(scope.status().resources, 0);
        node.isConnected = true; node.dispatchEvent(new Event('click'));
        assert.equal(calls, 0, 'an expired wrapper must not remain on the node');
    }
    assert.equal(removals, 3, 'removeEventListener really ran for each wrapper');
    assert.equal(nativeCalls, 3, 'native game listeners remain untouched');
    scope.listen(node, 'click', () => calls++);
    node.dispatchEvent(new Event('click')); assert.equal(calls, 1);
    scope.dispose(); assert.equal(removals, 4);
    node.dispatchEvent(new Event('click')); assert.equal(calls, 1);
});

test('brief detachment preserves handlers and capture registrations are cleaned separately', () => {
    const f = fixture(), scope = f.featureScope('capture'), node = styledNode(); let calls = 0;
    const callback = () => calls++;
    scope.listen(node, 'click', callback, { capture: true });
    scope.listen(node, 'click', callback, false);
    node.isConnected = false; scope.pruneDOM(); f.advance(500);
    node.isConnected = true; scope.pruneDOM(); node.dispatchEvent(new Event('click'));
    assert.equal(calls, 2); assert.equal(scope.status().listeners, 2);
    node.isConnected = false; scope.pruneDOM(); f.advance(1001); scope.pruneDOM();
    node.isConnected = true; node.dispatchEvent(new Event('click'));
    assert.equal(calls, 2); assert.equal(scope.status().listeners, 0);
});

test('once listeners and window listeners still obey their lifetimes', () => {
    const f = fixture(), scope = f.featureScope('once'), node = styledNode(); let calls = 0;
    scope.listen(node, 'click', () => calls++, { once: true });
    scope.listen(f.page, 'click', () => calls++);
    node.dispatchEvent(new Event('click')); node.dispatchEvent(new Event('click'));
    assert.equal(calls, 1);
    node.isConnected = false; scope.pruneDOM(); f.advance(1001); scope.pruneDOM();
    assert.equal(scope.status().listeners, 1, 'window listeners must remain registered');
    node.isConnected = true; node.dispatchEvent(new Event('click')); node.dispatchEvent(new Event('click'));
    f.page.dispatchEvent(new Event('click')); assert.equal(calls, 2);
    scope.dispose(); f.page.dispatchEvent(new Event('click')); assert.equal(calls, 2);
});
