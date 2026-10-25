const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

function fixture(presentAtBoot = false, screen = 'lobby') {
    const calls = [], observers = [], frames = [], timers = [];
    let present = presentAtBoot, now = 1000;
    const dom = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync('src/core/gameDOM.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: dom });
    const { gameDOM } = dom.exports;
    const state = { lang: 'EN', currentScreen: screen, friendsMenuOpen: false, settingsOpen: false };
    const design = ['customPlayButton', 'lobbyNavigation', 'lobbyPasses'];
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    const modules = new Proxy({}, { get: (_target, key) => design.includes(key)
        ? () => calls.push(key) : key === 'customGarageSkins' ? () => calls.push('heavy') : noop });
    const module = { exports: {} };
    const document = {
        documentElement: { lang: 'en' }, getElementById: () => null,
        querySelector(selector) {
            if (!present) return null;
            return selector === gameDOM.play.mainMenu || selector.split(', ').includes(gameDOM.lobbyNavigation.root) ? {} : null;
        },
    };
    vm.runInNewContext(transformSync(fs.readFileSync('src/boot.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, document, performance: { now: () => now },
        window: { addEventListener() {}, setInterval() {}, setTimeout: callback => timers.push(callback) },
        requestAnimationFrame: callback => frames.push(callback),
        MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
        require: name => ({ './core/featureRuntime': { featureScope: () => ({ run: fn => fn() }) },
            './core/gameDOM': { gameDOM }, './core/state': { state }, './core/utils': { utils: { getLang: () => 'EN' } },
            './core/coreSettings': { coreSettings: {} }, './modules': { modules } }[name]),
    });
    module.exports.startBoot();
    return { calls, frames, timers, state,
        mount(value) { present = value; }, mutate() { observers[0]([]); },
        tick(ms = 0) { now += ms; frames.shift()?.(); },
    };
}

test('lobby presentation mounts synchronously at boot, without a frame or heavy timer', () => {
    const f = fixture(true);
    assert.deepEqual(f.calls, ['customPlayButton', 'lobbyNavigation', 'lobbyPasses']);
    assert.equal(f.frames.length, 0);
    assert.equal(f.timers.length, 0);
});

test('returning and staged lobby mounts are decorated before RAF even inside the 150 ms throttle', () => {
    const f = fixture();
    f.mutate(); f.tick(); // A heavy pass just ran; screen classification remains lobby.
    f.calls.length = 0;
    f.mount(true); f.mutate();
    assert.deepEqual(f.calls, ['customPlayButton', 'lobbyNavigation', 'lobbyPasses']);
    f.tick(1);
    assert.equal(f.timers.length, 1, 'unrelated modules retain the shared delay');
    f.calls.length = 0;
    f.mutate(); // Another native card arrives while the same root and screen remain mounted.
    assert.deepEqual(f.calls, ['customPlayButton', 'lobbyNavigation', 'lobbyPasses']);
    f.calls.length = 0;
    f.timers.shift()();
    assert.deepEqual(f.calls, ['heavy'], 'the delayed heavy pass does not repeat lobby presentation');
});

test('leaving releases detached lobby sources once; unrelated screens do not run lobby adapters', () => {
    const f = fixture(true);
    f.calls.length = 0; f.mount(false); f.mutate();
    assert.deepEqual(f.calls, ['lobbyNavigation', 'lobbyPasses']);
    f.calls.length = 0; f.mutate();
    assert.deepEqual(f.calls, []);
});

test('return from battle retries the play adapter with the refreshed lobby screen state', () => {
    const f = fixture(false, 'battle');
    f.mount(true); f.mutate();
    assert.equal(f.state.currentScreen, 'battle');
    f.calls.length = 0; f.tick();
    assert.equal(f.state.currentScreen, 'lobby');
    assert.deepEqual(f.calls.filter(name => name !== 'heavy'), ['customPlayButton', 'lobbyNavigation', 'lobbyPasses']);
});
