const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");
function load(file) {
    const module = { exports: {} };
    runFeatureContext(transformSync(fs.readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module });
    return module.exports;
}
const { gameDOM } = load('src/core/gameDOM.ts');
const icons = load('src/core/turretIcons.ts');
const code = transformSync(fs.readFileSync('src/modules/enemyWeapons.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;

function fixture() {
    let writes = 0, nextInterval = 0;
    const intervals = new Map(), listeners = new Map(), state = { lang: 'RU' };
    const anchor = { left: 650, top: 460, width: 36, bottom: 496 };
    class Element {
        constructor(tag = 'div') { this.tagName = tag; }
        children = []; parentElement = null; className = ''; id = ''; style = {}; attributes = new Map(); text = ''; visible = true;
        computed = { maskImage: '', webkitMaskImage: '', backgroundImage: '' };
        classList = { contains: name => this.className.split(/\s+/).includes(name) };
        get firstElementChild() { return this.children[0] || null; }
        get isConnected() { return this === body || !!this.parentElement?.isConnected; }
        get offsetWidth() { return 240; } get offsetHeight() { return 180; }
        get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value) { this.text = value; this.children = []; writes++; }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); writes++; return child; }
        remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
        replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...children); }
        setAttribute(name, value) { this.attributes.set(name, value); }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        contains(node) { for (; node; node = node.parentElement) if (node === this) return true; return false; }
        matches(selector) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : selector.startsWith('#') ? this.id === selector.slice(1) : this.tagName === selector; }
        querySelectorAll(selector) {
            const matches = element => selector.split(',').some(part => {
                const pieces = part.trim().split(/\s+/); if (!element.matches(pieces.pop())) return false;
                let ancestor = element.parentElement;
                while (pieces.length) {
                    const piece = pieces.pop();
                    while (ancestor && !ancestor.matches(piece)) ancestor = ancestor.parentElement;
                    if (!ancestor) return false; ancestor = ancestor.parentElement;
                }
                return true;
            });
            const all = node => node.children.flatMap(child => [child, ...all(child)]);
            return all(this).filter(matches);
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        getClientRects() { return this.isConnected && this.visible ? [{}] : []; }
        getBoundingClientRect() { return { ...anchor }; }
    }
    const body = new Element('body');
    const node = (selector, parent = body, tag = 'div') => {
        const e = new Element(tag); if (selector.startsWith('.')) e.className = selector.slice(1); else e.id = selector.slice(1);
        parent.appendChild(e); return e;
    };
    const tab = node(gameDOM.statistics.teams.split(',')[0].trim());
    const summary = node('.summary', tab), toggle = node('#kasp-tab-toggle-btn', summary);
    const team = selector => { const group = node(selector, tab); const table = new Element('table'), tbody = new Element('tbody'); group.append(table); table.append(tbody); return { group, tbody }; };
    const blue = team(gameDOM.statistics.blueTeam), red = team(gameDOM.statistics.redTeam);
    const document = { body, hidden: false, createElement: tag => new Element(tag), querySelector: selector => body.querySelector(selector),
        addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener() {} };
    const page = { innerWidth: 800, innerHeight: 600, addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener() {},
        setInterval: handler => { intervals.set(++nextInterval, handler); return nextInterval; }, clearInterval: id => intervals.delete(id) };
    const module = { exports: {} }, context = { module, document, window: page, Element, Node: Element,
        getComputedStyle: element => element.computed, require: name => ({ '../core/gameDOM': { gameDOM }, '../core/state': { state }, '../core/turretIcons': icons }[name]) };
    runFeatureContext(code, context);
    context.require('../core/featureRuntime').installFeatureDiagnostics(page, 'content');
    const row = (group, weapon, self = false, options = {}) => {
        const tr = new Element('tr'); group.tbody.append(tr); if (self) tr.className = gameDOM.statistics.selectedRow.slice(1);
        node(gameDOM.statistics.nickname, tr, 'td').textContent = 'Player';
        const cell = node(gameDOM.statistics.deviceCell, tr, 'td'), block = node(gameDOM.statistics.equipment, cell);
        if (weapon) {
            const icon = new Element(options.img ? 'img' : 'div'); block.append(icon);
            const url = `${options.foreign ? 'https://example.test' : 'https://s.eu.tankionline.com'}/static/images/${weapon}.123abc.svg`;
            if (options.img) icon.setAttribute('src', url);
            else (options.css ? icon.computed : icon.style).maskImage = `url("${url}")`;
        }
        const device = new Element(); device.style.maskImage = 'url("https://s.eu.tankionline.com/static/images/Thunder.123.svg")'; block.append(device);
        return tr;
    };
    return { tab, blue, red, row, team, toggle, summary, state, document, intervals, anchor,
        read: () => module.exports.readEnemyWeapons(tab), sync: module.exports.enemyWeapons.sync,
        button: () => body.querySelector('#kasp-enemy-weapons-btn'), popup: () => body.querySelector('#kasp-enemy-weapons-tooltip'),
        emit(name, event = {}) { listeners.get(name)?.(event); }, tick() { for (const handler of [...intervals.values()]) handler(); },
        writes: () => writes, disable: () => page.__kaspModulesDebug.disable('enemyWeapons'),
    };
}

test('counts the opposite team from weapon icons, combines aliases and ignores augment icons and spectators', () => {
    const f = fixture(); f.row(f.blue, 'Hammer', true); f.row(f.blue, 'Gauss');
    f.row(f.red, 'Smoky'); f.row(f.red, 'smoky_resistance', false, { css: true });
    f.row(f.red, 'Striker', false, { img: true }); f.row(f.red, 'Jugger');
    f.row(f.red, 'NewWeapon'); f.row(f.red, 'Gauss', false, { foreign: true });
    const spectators = f.team('.spectators'); f.row(spectators, 'Smoky');
    const data = JSON.parse(JSON.stringify(f.read()));
    assert.deepEqual(data.map(e => [e.key, e.count]), [['smoky', 2], ['unknown', 2], ['rocket_launcher', 1], ['terminator', 1]]);
    assert.equal(data[0].icon, icons.RESISTANCE_ICONS.smoky);
    assert.equal(data[2].icon, icons.RESISTANCE_ICONS.rocket_launcher);
    assert.match(data[3].icon, /Jugger/);
});

test('own red team selects blue opponents, DM excludes self, and an unrecognized local team is never guessed', () => {
    const f = fixture(); const self = f.row(f.red, 'Hammer', true); f.row(f.blue, 'Gauss');
    assert.equal(f.read()[0].key, 'gauss');
    self.className = ''; assert.equal(f.read(), null);
    f.blue.group.remove(); f.red.group.remove();
    const dm = f.team(gameDOM.statistics.dmTeam);
    f.row(dm, 'Smoky', true); f.row(dm, 'Isida'); f.row(dm, 'Magnum'); f.row(dm, 'Scorpion');
    assert.deepEqual(Array.from(f.read(), e => e.key), ['artillery', 'isis', 'scorpio']);
});

test('hover anchors the popup above the button regardless of cursor position and updates live counts', () => {
    const f = fixture(); f.row(f.blue, 'Hammer', true); f.row(f.red, 'Smoky');
    f.sync(); const button = f.button(); assert.ok(button); assert.equal(button.parentElement, f.toggle.parentElement);
    f.sync(); assert.equal(f.button(), button, 'no duplicate controls');
    f.emit('mouseover', { target: button, clientX: 790, clientY: 590 });
    assert.match(f.popup().textContent, /Смоки×1/);
    assert.equal(f.popup().style.left, '548px'); assert.equal(f.popup().style.top, '270px');
    assert.equal(f.intervals.size, 1); const writes = f.writes(); f.tick(); assert.equal(f.writes(), writes);
    f.row(f.red, 'Smoky'); f.sync(); assert.match(f.popup().textContent, /Смоки×2/);
    f.state.lang = 'EN'; f.tick(); assert.equal(f.popup().textContent, 'Smoky×2');
    f.emit('mousemove', { clientX: 10, clientY: 20 }); assert.equal(f.popup().style.left, '548px');
    f.anchor.left = 780; f.emit('resize'); assert.equal(f.popup().style.left, '552px');
    f.emit('mouseout', { target: button, relatedTarget: null });
    assert.equal(f.popup(), null); assert.equal(f.intervals.size, 0);
    assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('nine weapon types use one column; ten and seventeen split into two balanced columns', () => {
    const f = fixture(); f.row(f.blue, 'Hammer', true);
    const names = ['Firebird', 'Freeze', 'Isida', 'Tesla', 'Hammer', 'Twins', 'Ricochet', 'Vulcan', 'Smoky',
        'Striker', 'Thunder', 'Tsunami', 'Scorpion', 'Magnum', 'Railgun', 'Gauss', 'Shaft'];
    for (const weapon of names.slice(0, 9)) f.row(f.red, weapon);
    f.sync(); f.emit('mouseover', { target: f.button() });
    let list = f.popup().querySelector('.kasp-enemy-weapons-list');
    assert.equal(list.children.length, 9); assert.equal(list.classList.contains('kasp-enemy-weapons-two-columns'), false);
    f.row(f.red, names[9]); f.tick(); list = f.popup().querySelector('.kasp-enemy-weapons-list');
    assert.equal(list.children.length, 10); assert.equal(list.style.gridTemplateRows, 'repeat(5, auto)');
    assert.equal(list.classList.contains('kasp-enemy-weapons-two-columns'), true);
    for (const weapon of names.slice(10)) f.row(f.red, weapon);
    f.tick(); list = f.popup().querySelector('.kasp-enemy-weapons-list');
    assert.equal(list.children.length, 17); assert.equal(list.style.gridTemplateRows, 'repeat(9, auto)');
});

test('mouse clicks do not focus the hover button or propagate into native TAB controls', () => {
    const f = fixture(); f.sync(); f.emit('mouseover', { target: f.button() });
    for (const type of ['mousedown', 'click']) {
        let prevented = false, stopped = false;
        f.emit(type, { target: f.button().firstElementChild, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
        assert.equal(prevented, true); assert.equal(stopped, true); assert.ok(f.popup());
    }
    f.emit('mouseout', { target: f.button(), relatedTarget: null });
    assert.equal(f.popup(), null, 'clicking must not latch the popup open through mouse focus');
});

test('keyboard focus, Escape, hidden TAB, window blur and feature cleanup release the popup and timer', () => {
    const f = fixture(); f.sync(); const button = f.button();
    f.emit('focusin', { target: button }); assert.ok(f.popup());
    assert.match(f.popup().textContent, /Не удалось определить вашу команду/);
    f.emit('keydown', { key: 'Escape' }); assert.equal(f.popup(), null);
    f.emit('focusin', { target: button }); button.visible = false; f.tick(); assert.equal(f.popup(), null);
    button.visible = true; f.emit('focusin', { target: button }); f.emit('blur'); assert.equal(f.popup(), null);
    f.emit('focusin', { target: button }); f.disable();
    assert.equal(f.popup(), null); assert.equal(f.button(), null); assert.equal(f.intervals.size, 0);
});
