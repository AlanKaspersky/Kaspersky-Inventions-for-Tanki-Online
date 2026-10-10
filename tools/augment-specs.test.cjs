const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const gameDOMModule = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/gameDOM.ts'), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: gameDOMModule });

const source = fs.readFileSync(path.join(__dirname, '../src/modules/augmentSpecs.ts'), 'utf8');
const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;

function fixture(withCard = false) {
    let mutations = 0;
    class Element {
        constructor(tagName) {
            this.tagName = tagName.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.className = '';
            this.style = {};
            this.attributes = {};
            this.dataset = {};
            this.listeners = {};
            this.text = '';
            this.classList = {
                contains: name => this.className.split(/\s+/).includes(name),
                add: name => { if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim(); },
                remove: name => { this.className = this.className.split(/\s+/).filter(value => value !== name).join(' '); },
            };
        }
        get parentElement() { return this.parentNode; }
        get isConnected() { return this === root || !!this.parentNode?.isConnected; }
        addEventListener(name, listener) { this.listeners[name] = listener; }
        querySelector(selector) {
            return descendants(this).find(el => selector.startsWith('.') && el.classList.contains(selector.slice(1))) || null;
        }
        get nextSibling() {
            return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null;
        }
        get nextElementSibling() { return this.nextSibling; }
        get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value) {
            this.children.forEach(child => { child.parentNode = null; });
            this.children = [];
            this.text = String(value);
            mutations++;
        }
        get innerText() { return this.style.display === 'none' ? '' : this.textContent; }
        appendChild(child) { return this.insertBefore(child, null); }
        insertBefore(child, next) {
            child.remove();
            const index = next ? this.children.indexOf(next) : this.children.length;
            assert.ok(index >= 0);
            this.children.splice(index, 0, child);
            child.parentNode = this;
            mutations++;
            return child;
        }
        remove() {
            if (!this.parentNode) return;
            this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
            this.parentNode = null;
            mutations++;
        }
        closest(selector) {
            for (let el = this; el; el = el.parentNode) {
                if (selector === '.custom-live-stat' && el.classList.contains('custom-live-stat')) return el;
            }
            return null;
        }
        getAttribute(name) { return this.attributes[name] ?? null; }
        setAttribute(name, value) { this.attributes[name] = value; }
    }

    const root = new Element('div');
    const labelContainer = new Element('div');
    const label = new Element('span');
    label.textContent = 'Damage';
    labelContainer.appendChild(label);
    root.appendChild(labelContainer);
    let original = new Element('span');
    original.className = 'native-stat';
    original.style.display = 'inline-block';
    original.textContent = '100';
    root.appendChild(original);
    let device = { modifiers: { DAMAGE: 1.5 } };
    const card = new Element('div');
    const image = new Element('img');
    image.className = 'SkinCellStyle-iconCell';
    image.src = 'https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg';
    if (withCard) { root.appendChild(card); card.appendChild(image); }
    const frames = [];
    const descendants = el => el.children.flatMap(child => [child, ...descendants(child)]);
    const document = {
        body: root,
        getElementById: () => ({ style: {} }),
        querySelector: selector => selector === '.DeviceButtonComponentStyle-deviceIcon' ? { src: 'device.svg' } : null,
        querySelectorAll: selector => selector === 'span' ? descendants(root).filter(el => el.tagName === 'SPAN')
            : selector === 'img.SkinCellStyle-iconCell' && withCard ? [image] : [],
        createElement: tag => new Element(tag),
    };
    const module = { exports: {} };
    vm.runInNewContext(code, {
        module, exports: module.exports, document,
        window: { addEventListener() {}, getComputedStyle: () => ({ position: 'relative' }), innerWidth: 1920, innerHeight: 1080 },
        requestAnimationFrame: callback => frames.push(callback),
        queueMicrotask: callback => frames.push(callback),
        require: name => {
            if (name === '../core/state') return { state: { lang: 'EN', currentScreen: 'garage' } };
            if (name === '../core/utils') return { utils: { getSetting: () => true } };
            if (name === '../core/dataLoader') return { DataLoader: { getDevice: () => device, hasDevice: () => false } };
            if (name === '../core/gameDOM') return gameDOMModule.exports;
            if (name === '../core/augmentCatalog') return { AUGMENTS_UPDATED: 'kasp:augments-updated' };
            if (name === '../core/gameAugments') return { isAugmentPreviewUrl: () => false, activeGarageCardSection: () => null };
            throw new Error(`Unexpected import: ${name}`);
        },
    });

    function settle() {
        module.exports.augmentSpecs();
        let iterations = 0;
        while (frames.length) {
            assert.ok(++iterations <= 10, 'DOM updates must settle instead of scheduling themselves indefinitely');
            const before = mutations;
            frames.shift()();
            if (mutations !== before) module.exports.augmentSpecs();
        }
    }
    return {
        root, label, card, image, settle,
        get original() { return original; },
        get replacement() { return root.children.find(el => el.classList.contains('custom-live-stat')); },
        get mutations() { return mutations; },
        setDevice: value => { device = value; },
        replaceOriginal(text) {
            original.remove();
            original = new Element('span');
            original.textContent = text;
            original.style.display = '';
            root.insertBefore(original, labelContainer.nextSibling);
        },
    };
}

test('observer feedback settles and unchanged stats preserve the same nodes', () => {
    const f = fixture();
    f.settle();
    assert.equal(f.replacement.textContent, '150');
    assert.equal(f.original.textContent, '100');
    assert.equal(f.original.innerText, '');
    assert.equal(f.replacement.classList.contains('hidden-by-script'), false);
    const replacement = f.replacement;
    const mutations = f.mutations;
    for (let i = 0; i < 20; i++) f.settle();
    assert.equal(f.replacement, replacement);
    assert.equal(f.mutations, mutations);
});

test('game value and device changes recalculate from the original without compounding', () => {
    const f = fixture();
    f.settle();
    const replacement = f.replacement;
    f.original.textContent = '200';
    f.settle();
    assert.equal(f.replacement.textContent, '300');
    f.setDevice({ modifiers: { DAMAGE: 0.5 } });
    f.settle();
    assert.equal(f.replacement, replacement);
    assert.equal(f.replacement.textContent, '100');
    assert.match(f.replacement.children[0].getAttribute('style'), /#fe6666/);
});

test('missing modifiers restore the original inline display and remove stale nodes', () => {
    const f = fixture();
    f.settle();
    f.setDevice(undefined);
    f.settle();
    assert.equal(f.replacement, undefined);
    assert.equal(f.original.style.display, 'inline-block');
    assert.equal(f.original.classList.contains('hidden-by-script'), false);
    const mutations = f.mutations;
    f.settle();
    assert.equal(f.mutations, mutations);
    f.setDevice({ modifiers: { DAMAGE: 2 } });
    f.settle();
    assert.equal(f.replacement.textContent, '200');
});

test('replaced game rows remove the old augmentation and calculate the new value', () => {
    const f = fixture();
    f.settle();
    const oldReplacement = f.replacement;
    f.replaceOriginal('300');
    f.settle();
    assert.equal(oldReplacement.parentNode, null);
    assert.equal(f.replacement.textContent, '450');
    assert.equal(f.root.children.filter(el => el.classList.contains('custom-live-stat')).length, 1);
});

test('translated labels remain supported and invalid values restore the original', () => {
    const f = fixture();
    f.label.textContent = 'Урон';
    f.original.textContent = '1 000,5';
    f.settle();
    assert.equal(f.replacement.textContent, '1 500.75');
    f.original.textContent = '—';
    f.settle();
    assert.equal(f.replacement, undefined);
    assert.equal(f.original.style.display, 'inline-block');
});

test('hull turning speed uses the available modifier despite the shared Russian turret label', () => {
    const f = fixture();
    f.label.textContent = 'Скорость поворота';
    f.setDevice({ modifiers: { TURN_SPEED: 1.5 } });
    f.settle();
    assert.equal(f.replacement.textContent, '150');
});

test('percentage mass changes always multiply the original value and keep a neutral color', () => {
    const f = fixture();
    f.label.textContent = 'Mass';
    f.setDevice({ modifiers: { WEIGHT: 11 } });
    f.settle();
    assert.equal(f.replacement.textContent, '1 100');
    assert.match(f.replacement.children[0].getAttribute('style'), /#ffffff/);
});

test('card icon changes preserve the specs button and reuse its event listeners', () => {
    const f = fixture(true);
    f.setDevice({ id: '123', modifiers: {} });
    f.settle();
    const button = f.card.querySelector('.custom-card-specs-btn');
    assert.ok(button);
    const listener = button.listeners.mouseenter;
    const mutations = f.mutations;
    for (const url of ['https://s.eu.tankionline.com/preview/image.svg',
        'https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg']) {
        f.image.src = url;
        f.settle();
        assert.equal(f.card.querySelector('.custom-card-specs-btn'), button);
        assert.equal(button.dataset.url, url);
        assert.equal(button.listeners.mouseenter, listener);
    }
    assert.equal(f.mutations, mutations, 'changing icon addresses must not remove or recreate the button');
    f.setDevice({ id: '456', modifiers: {} });
    f.settle();
    assert.equal(f.card.querySelector('.custom-card-specs-btn'), button);
    assert.equal(button.dataset.deviceId, '456');
    f.setDevice(undefined);
    f.settle();
    assert.equal(f.card.querySelector('.custom-card-specs-btn'), null);
});
