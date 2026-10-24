const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");

const dom = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/gameDOM.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: dom });
const { gameDOM } = dom.exports;
const code = transformSync(fs.readFileSync('src/modules/hideCurrency.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;

function fixture() {
    let enabled = false, nextInterval = 0;
    const spans = [], intervals = new Map(), listeners = new Map();
    const state = { lang: 'RU', currentScreen: 'lobby' };
    const page = {
        addEventListener(name, handler) { listeners.set(name, handler); }, removeEventListener() {},
        setInterval(handler) { intervals.set(++nextInterval, handler); return nextInterval; },
        clearInterval(id) { intervals.delete(id); },
    };
    const module = { exports: {} };
    const context = { module, window: page, document: { querySelectorAll: selector => {
        assert.equal(selector, gameDOM.account.currencyValues);
        return spans.filter(span => span.isConnected);
    } }, require: id => ({
        '../core/gameDOM': { gameDOM }, '../core/state': { state },
        '../core/utils': { utils: { getSetting: () => enabled } },
    }[id]) };
    runFeatureContext(code, context);
    context.require('../core/featureRuntime').installFeatureDiagnostics(page, 'content');
    const sync = module.exports.hideCurrency;
    return {
        sync, state, intervals,
        toggle(value, event = 'kasp:settings-changed') { enabled = value; listeners.get(event)?.({}); },
        tick() { for (const handler of [...intervals.values()]) handler(); },
        disable() { page.__kaspModulesDebug.disable('hideCurrency'); },
        currency(value, custom = false) {
            const classes = new Set(), attributes = new Map();
            const parent = { classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
                getAttribute: name => attributes.get(name) ?? null, setAttribute: (name, text) => attributes.set(name, text),
                removeAttribute: name => attributes.delete(name) };
            let text = value;
            const span = { dataset: {}, parentElement: parent, isConnected: true, writes: 0,
                get textContent() { return text; }, set textContent(value) { text = value; this.writes++; },
                closest(selector) { return selector === '#kasp-tankoin-balance' ? custom ? {} : null : parent; },
            };
            spans.push(span); return span;
        },
    };
}

test('enabling then disabling inside settings restores every native currency and stops queued masking', () => {
    const f = fixture();
    const spans = ['2 925', '32\u00a0030', '0'].map(value => f.currency(value));
    f.sync(); assert.equal(f.intervals.size, 0);
    f.toggle(true);
    assert.deepEqual(spans.map(span => span.textContent), ['Скрыто', 'Скрыто', 'Скрыто']);
    assert.equal(f.intervals.size, 1);
    const queued = [...f.intervals.values()][0];
    f.toggle(false);
    assert.deepEqual(spans.map(span => span.textContent), ['2 925', '32\u00a0030', '0']);
    assert.equal(f.intervals.size, 0);
    queued(); f.sync(); f.tick();
    for (const span of spans) {
        assert.equal(span.dataset.originalValue, undefined);
        assert.equal(span.parentElement.classList.contains('currency-masked'), false);
        assert.equal(span.parentElement.getAttribute('data-tooltip'), null);
        assert.equal(span.writes, 2, 'no text churn after restoring');
    }
    f.toggle(true); f.toggle(false);
    assert.deepEqual(spans.map(span => span.textContent), ['2 925', '32\u00a0030', '0']);
});

test('live balance and language changes retain the latest amount, including a native update just before disabling', () => {
    const f = fixture(), span = f.currency('10');
    span.parentElement.setAttribute('data-tooltip', 'native hint');
    f.sync(); f.toggle(true);
    span.textContent = '25'; f.tick();
    assert.equal(span.dataset.originalValue, '25');
    assert.equal(span.parentElement.getAttribute('data-tooltip'), '25');
    f.state.lang = 'EN'; f.sync();
    assert.equal(span.textContent, 'Hidden');
    f.toggle(false, 'storage');
    assert.equal(span.textContent, '25');
    assert.equal(span.parentElement.getAttribute('data-tooltip'), 'native hint');
    f.toggle(true); span.textContent = '30'; f.toggle(false);
    assert.equal(span.textContent, '30', 'restoration must not overwrite a newer native balance');
});

test('custom Tankoin counter has one privacy owner; native replacements and battle transitions restore cleanly', () => {
    const f = fixture(), custom = f.currency('77', true), old = f.currency('1');
    f.sync(); f.toggle(true);
    assert.equal(custom.textContent, '77'); assert.equal(custom.writes, 0);
    old.isConnected = false;
    const replacement = f.currency('2'); f.tick();
    assert.equal(old.textContent, '1'); assert.equal(old.dataset.originalValue, undefined);
    assert.equal(replacement.textContent, 'Скрыто');
    f.state.currentScreen = 'battle'; f.sync();
    assert.equal(replacement.textContent, '2'); assert.equal(f.intervals.size, 0);
    f.state.currentScreen = 'lobby'; f.sync();
    assert.equal(replacement.textContent, 'Скрыто'); assert.equal(f.intervals.size, 1);
    f.disable();
    assert.equal(replacement.textContent, '2'); assert.equal(f.intervals.size, 0);
});
