const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const compile = file => transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code;
const domModule = { exports: {} };
runFeatureContext(compile('src/core/gameDOM.ts'), { module: domModule });
const dom = domModule.exports.gameDOM.battleCreate;
const nativeModule = { exports: {} };
runFeatureContext(compile('src/core/cybersportNative.ts'), { module: nativeModule, require: () => domModule.exports });
const code = compile('src/modules/cybersportSettings.ts');

function fixture({ language = 'RU', rank = 'Маршал', delayedMenu = false, privateLabel } = {}) {
    let now = 0, scheduled = false, nextTimer = 0;
    const timers = new Map(), observers = [];
    class Node {
        constructor() { this.parent = null; this.isConnected = true; this.queries = new Map(); this.listeners = new Map(); this.attributes = new Map(); }
        hasAttribute(key) { return this.attributes.has(key); }
        setAttribute(key, value) { this.attributes.set(key, value); }
        removeAttribute(key) { this.attributes.delete(key); }
        contains(node) { return node === this || (node.parent && this.contains(node.parent)); }
        querySelector(selector) { return this.queries.get(selector) || null; }
        querySelectorAll(selector) { return this.queries.get(selector) || []; }
        addEventListener(type, fn) { this.listeners.set(type, fn); }
        removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
        dispatchEvent(event) {
            event.target = this;
            for (let node = this; node; node = node.parent) node.listeners.get(event.type)?.(event);
            if (!event.stopped) this.onEvent?.(event);
            return !event.defaultPrevented;
        }
    }
    class Input extends Node {
        constructor(value) {
            super(); this.raw = this.tracked = value; this.type = 'text'; this.disabled = this.readOnly = false;
            // React's own value descriptor would swallow a change if used directly.
            Object.defineProperty(this, 'value', { get: () => this.raw,
                set: value => { this.raw = this.tracked = value; } });
        }
        get value() { return this.raw; }
        set value(value) { this.raw = value; }
        click() { if (!this.disabled) { this.checked = !this.checked; this.onClick?.(); } }
    }
    class Event {
        constructor(type) { this.type = type; this.defaultPrevented = this.stopped = false; }
        preventDefault() { this.defaultPrevented = true; }
        stopPropagation() { this.stopped = true; }
    }
    const root = new Node(), panel = new Node(); panel.parent = root; root.queries.set(dom.options, panel);
    const values = { players: '8', minutes: '30', score: '∞', private: false, rank };
    const fields = [new Input('8'), new Input('30'), new Input('∞')];
    let numericChanges = 0;
    fields.forEach((input, index) => {
        input.parent = panel;
        input.onEvent = event => {
            if (event.type === 'input' && input.tracked !== input.value) {
                input.tracked = input.value;
                values[['players', 'minutes', 'score'][index]] = input.value; numericChanges++;
            }
        };
    });
    panel.queries.set(dom.parameterInputs, fields);
    const row = new Node(), checkbox = new Input(''); checkbox.type = 'checkbox'; checkbox.checked = false;
    row.parent = panel; checkbox.parent = row;
    checkbox.onClick = () => { values.private = checkbox.checked; };
    row.queries.set('label[for]', { textContent: privateLabel || (language === 'RU' ? 'ЗАКРЫТАЯ БИТВА' : 'PRIVATE') });
    row.queries.set('input[type="checkbox"]', checkbox); panel.queries.set(dom.optionRows, [row]);
    const dropdown = new Node(), maximum = new Node(), control = new Node(), menu = new Node(), first = new Node();
    dropdown.parent = panel; maximum.parent = panel; control.parent = dropdown; menu.parent = dropdown;
    first.parent = menu;
    const placeholder = { textContent: rank, querySelector: () => ({ src: 'https://s.eu.tankionline.com/static/images/27.hash.webp' }) };
    const firstImage = { src: 'https://s.eu.tankionline.com/static/images/9.hash.webp', parentElement: first };
    first.queries.set('img', firstImage); menu.queries.set(`${dom.dropdownItems} img`, firstImage);
    dropdown.queries.set(dom.dropdownControl, control); dropdown.queries.set(dom.dropdownPlaceholder, placeholder);
    panel.queries.set(dom.rankDropdowns, dropdown);
    let opens = 0, selections = 0;
    function mountMenu() { dropdown.queries.set(dom.dropdownMenu, menu); }
    control.onEvent = event => {
        if (event.type !== 'mousedown') return;
        if (dropdown.querySelector(dom.dropdownMenu)) dropdown.queries.delete(dom.dropdownMenu);
        else { opens++; if (!delayedMenu) mountMenu(); }
    };
    first.click = () => {
        selections++;
        values.rank = language === 'RU' ? 'Первый сержант' : 'First Sergeant';
        placeholder.textContent = values.rank; placeholder.querySelector = () => firstImage;
        dropdown.queries.delete(dom.dropdownMenu);
    };
    const module = { exports: {} };
    runFeatureContext(code, { module, require: id => id.includes('cybersportNative') ? nativeModule.exports : domModule.exports, Node,
        document: { dispatchEvent() {} },
        HTMLInputElement: Input, Event, MouseEvent: Event, URL,
        location: { href: 'https://tankionline.com/play/' }, Date: { now: () => now },
        setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, at: now + delay }); return nextTimer; },
        clearTimeout: id => timers.delete(id),
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); }
            observe(node) { this.node = node; this.active = true; } disconnect() { this.active = false; } },
    });
    const settings = module.exports.createCybersportSettings(() => { scheduled = true; });
    let closeClicks = 0;
    function expand({ delayedClose = false } = {}) {
        panel.queries.delete(dom.parameterInputs); panel.queries.delete(dom.rankDropdowns);
        const closeButton = new Node(); closeButton.parent = panel;
        closeButton.textContent = language === 'RU' ? 'Закрыть' : 'Close';
        panel.queries.set(dom.advancedClose, [closeButton]);
        function restore() {
            panel.queries.set(dom.parameterInputs, fields); panel.queries.set(dom.rankDropdowns, dropdown);
            panel.queries.delete(dom.advancedClose);
            scheduled = true;
        }
        closeButton.click = () => { closeClicks++; if (!delayedClose) restore(); };
        return restore;
    }
    function flush() { if (scheduled) { scheduled = false; settings.sync(root); } }
    return { settings, root, panel, fields, checkbox, dropdown, maximum, control, values, timers, observers,
        mountMenu, flush, expand, Event, get closeClicks() { return closeClicks; },
        get opens() { return opens; }, get selections() { return selections; },
        get numericChanges() { return numericChanges; },
        advance(ms) { now += ms; for (const [id, task] of [...timers]) if (task.at <= now) {
            timers.delete(id); task.fn(); } flush(); },
    };
}

test('native callbacks receive settings, including the state used for creation, while score is untouched', () => {
    const f = fixture(); f.settings.sync(f.root);
    assert.deepEqual(f.values, { players: '6', minutes: '12', score: '∞', private: true, rank: 'Первый сержант' });
    assert.equal(f.opens, 1); assert.equal(f.selections, 1);
    assert.equal(f.numericChanges, 2);
    f.advance(100); f.settings.sync(f.root);
    assert.equal(f.opens, 1); assert.equal(f.selections, 1); assert.equal(f.numericChanges, 2);
    assert.equal(f.fields[2].readOnly, false);
});

test('English controls work and an already selected First Sergeant does not open the dropdown', () => {
    const f = fixture({ language: 'EN', rank: 'First Sergeant' }); f.settings.sync(f.root);
    assert.equal(f.values.private, true); assert.equal(f.values.minutes, '12'); assert.equal(f.opens, 0);
});

test('both the real PRIVATE label and the longer English label enable the native checkbox', () => {
    for (const privateLabel of ['PRIVATE', 'PRIVATE BATTLE', 'Closed battle']) {
        const f = fixture({ language: 'EN', privateLabel }); f.settings.sync(f.root);
        assert.equal(f.values.private, true); assert.equal(f.checkbox.checked, true);
    }
});

test('expanded RU/EN settings close through the native action and restore the preset/preview layout', () => {
    for (const language of ['RU', 'EN']) {
        const f = fixture({ language }); f.expand(); f.settings.sync(f.root);
        assert.equal(f.values.private, true); assert.equal(f.closeClicks, 1);
        f.flush();
        assert.equal(f.values.minutes, '12'); assert.equal(f.values.players, '6');
        assert.equal(f.selections, 1); assert.equal(f.panel.querySelectorAll(dom.advancedClose).length, 0);
        f.settings.sync(f.root); assert.equal(f.closeClicks, 1);
        f.expand(); f.settings.sync(f.root); assert.equal(f.closeClicks, 2);
    }
});

test('delayed native closing is clicked once and ordinary formats never close the panel', () => {
    const f = fixture(); const restore = f.expand({ delayedClose: true });
    f.settings.sync(null); assert.equal(f.closeClicks, 0);
    f.settings.sync(f.root); f.flush(); f.settings.sync(f.root);
    assert.equal(f.closeClicks, 1);
    restore(); f.flush(); assert.equal(f.values.minutes, '12'); assert.equal(f.values.players, '6');
});

test('fixed minimum rank keeps Tab/Escape navigation and the maximum-rank control available', () => {
    const f = fixture({ rank: 'First Sergeant' }); f.settings.sync(f.root);
    const click = new f.Event('mousedown'); f.control.dispatchEvent(click);
    assert.equal(click.defaultPrevented, true);
    for (const key of ['Tab', 'Escape']) {
        const event = new f.Event('keydown'); event.key = key; f.control.dispatchEvent(event);
        assert.equal(event.defaultPrevented, false);
    }
    const event = new f.Event('mousedown'); f.maximum.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
});

test('map/default resets are corrected in native state rather than just the displayed inputs', () => {
    const f = fixture(); f.settings.sync(f.root); f.advance(100);
    f.fields[0].value = f.values.players = '12'; f.fields[1].value = f.values.minutes = '30';
    f.checkbox.checked = f.values.private = false;
    f.settings.sync(f.root);
    assert.equal(f.values.players, '6'); assert.equal(f.values.minutes, '12'); assert.equal(f.values.private, true);
});

test('a delayed minimum-rank menu is consumed once and its retry is removed when done', () => {
    const f = fixture({ delayedMenu: true }); f.settings.sync(f.root);
    assert.equal(f.selections, 0); assert.equal(f.timers.size, 1);
    f.mountMenu(); f.advance(100); assert.equal(f.selections, 1);
    f.advance(100); assert.equal(f.timers.size, 0); assert.equal(f.opens, 1);
});

test('a missing dropdown menu does not trigger an endless stream of attempts', () => {
    const f = fixture({ delayedMenu: true }); f.settings.sync(f.root); f.advance(2001);
    f.settings.sync(f.root); assert.equal(f.opens, 1); assert.equal(f.timers.size, 0);
    // The native control remains usable after a failed attempt.
    const event = new f.Event('mousedown'); f.control.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
});

test('ordinary formats release locks and cancel pending rank work without disabling other controls', () => {
    const f = fixture({ delayedMenu: true }); f.settings.sync(f.root);
    assert.equal(f.fields[0].readOnly, true); assert.equal(f.checkbox.disabled, true);
    f.settings.sync(null);
    assert.equal(f.fields[0].readOnly, false); assert.equal(f.fields[1].readOnly, false);
    assert.equal(f.checkbox.disabled, false); assert.equal(f.timers.size, 0);
    assert.ok(f.observers.every(observer => !observer.active)); assert.equal(f.panel.listeners.size, 0);
    f.advance(3000); assert.equal(f.selections, 0);
});
