const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");

const domModule = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/gameDOM.ts', 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: domModule });
const { gameDOM } = domModule.exports;
const iconsModule = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/turretIcons.ts', 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: iconsModule });
const code = transformSync(fs.readFileSync('src/modules/zeroResists.ts', 'utf8'),
    { loader: 'ts', format: 'cjs' }).code;

function fixture() {
    let writes = 0;
    const styleReads = new Map();
    const operations = [];
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag;
            this.children = [];
            this.parentElement = null;
            this.className = '';
            this.style = {};
            this.dataset = {};
            this.attributes = new Map();
            this.text = '';
            this.computed = { maskImage: '', backgroundColor: '', backgroundImage: '' };
            this.classList = {
                contains: name => this.className.split(/\s+/).includes(name),
                add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].join(' ').trim(); },
            };
        }
        get childNodes() { return this.children; }
        get isConnected() { return this === root || !!this.parentElement?.isConnected; }
        get outerHTML() { return JSON.stringify([this.tagName, this.className, this.text, [...this.attributes], this.children.map(child => child.outerHTML)]); }
        get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(value) { this.text = value; }
        set innerHTML(value) { this.children = []; this.text = value; }
        mutate() { if (this.isConnected) { writes++; operations.push('write'); } }
        appendChild(child) {
            this.mutate();
            if (child.tagName === 'fragment') {
                for (const node of child.children) { node.parentElement = this; this.children.push(node); }
                child.children = [];
            } else { child.parentElement = this; this.children.push(child); }
            return child;
        }
        prepend(child) { this.mutate(); child.parentElement = this; this.children.unshift(child); }
        replaceChildren(...children) {
            this.mutate();
            for (const child of this.children) child.parentElement = null;
            this.children = children;
            for (const child of children) child.parentElement = this;
        }
        remove() {
            if (!this.parentElement) return;
            this.parentElement.mutate();
            this.parentElement.children = this.parentElement.children.filter(child => child !== this);
            this.parentElement = null;
        }
        setAttribute(name, value) { this.attributes.set(name, value); }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        matches(selector) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName === selector; }
        querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
        querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
        closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
        cloneNode(deep) {
            const clone = new Element(this.tagName);
            clone.className = this.className;
            clone.text = this.text;
            clone.computed = { ...this.computed };
            clone.attributes = new Map(this.attributes);
            if (deep) for (const child of this.children) clone.appendChild(child.cloneNode(true));
            return clone;
        }
    }
    const root = new Element();
    const summary = new Element();
    summary.className = gameDOM.classes.flexCenter;
    root.appendChild(summary);
    const cells = [];
    const document = {
        body: root,
        getElementById: () => ({}), // The toggle is already present.
        querySelector: selector => selector === gameDOM.statistics.teams ? root : null,
        querySelectorAll: selector => selector === gameDOM.statistics.resistanceCell ? cells : [],
        createElement: tag => new Element(tag),
        createDocumentFragment: () => new Element('fragment'),
    };
    const module = { exports: {} };
    runFeatureContext(code, {
        module, document, console,
        localStorage: { getItem: () => 'false' },
        chrome: { runtime: { getURL: value => value } },
        window: { getComputedStyle(element) {
            styleReads.set(element, (styleReads.get(element) ?? 0) + 1);
            operations.push('read');
            const snapshot = { ...element.computed };
            return { ...snapshot, getPropertyValue: key => key.includes('mask') ? snapshot.maskImage : '' };
        } },
        require: id => id.endsWith('/turretIcons') ? iconsModule.exports : id.endsWith('/tabExpansion')
            ? { createTabExpansion: () => ({ setExpanded() {} }) }
            : { gameDOM, state: { lang: 'EN' } },
    });
    function label(turret, value, color = 'rgb(0, 0, 0)') {
        const node = new Element();
        node.className = gameDOM.classes.defenceLabel;
        const icon = new Element();
        icon.computed = { maskImage: `url("https://s.eu.tankionline.com/${turret}_resistance.svg")`, backgroundColor: color };
        const amount = new Element('h3');
        amount.textContent = value;
        node.appendChild(icon);
        node.appendChild(amount);
        return node;
    }
    return {
        root, summary, cells, label, operations, styleReads,
        cell(...labels) { const cell = new Element('td'); root.appendChild(cell); for (const node of labels) cell.appendChild(node); cells.push(cell); return cell; },
        sync() { operations.length = 0; module.exports.zeroResists.sync(); },
        writes: () => writes,
    };
}

test('TAB reads each icon once per pass, preserves Spectrum priority and does not rebuild unchanged content', () => {
    const f = fixture();
    const red = f.label('smoky', '30', 'rgb(254, 102, 0)');
    const crit = f.label('crit', '20');
    const spectrum = f.label('all', '40');
    const first = f.cell(red, crit, spectrum);
    const second = f.cell(f.label('crit', '10'));
    f.sync();
    const compact = first.querySelector('.kasp-compact-cell');
    assert.ok(compact.children[0].children[0].classList.contains('kasp-spectrum'));
    assert.equal(compact.children[0].textContent, '40');
    assert.equal(compact.children[1].textContent, '20');
    assert.equal(second.querySelector('.kasp-compact-cell').children[1].textContent, '10');
    for (const reads of f.styleReads.values()) assert.equal(reads, 1);
    // Native cell style reads finish before compact slots are inserted.
    const firstWrite = f.operations.indexOf('write');
    assert.ok(firstWrite > 0);
    assert.ok(!f.operations.slice(firstWrite).includes('read'));
    const writes = f.writes();
    f.sync();
    assert.equal(f.writes(), writes);
    assert.equal(first.querySelector('.kasp-compact-cell'), compact);
});

test('TAB refreshes reused native cells with unchanged counts, including Spectrum values and CSS icon changes', () => {
    const f = fixture();
    const protection = f.label('all', '40');
    const crit = f.label('crit', '20');
    const cell = f.cell(protection, crit);
    f.sync();
    const compact = cell.querySelector('.kasp-compact-cell');
    protection.querySelector('h3').textContent = '50';
    f.sync();
    assert.equal(compact.children[0].textContent, '50');
    // Only computed CSS changes; the original node/markup and counts are unchanged.
    protection.querySelector('div').computed.maskImage = 'url("https://s.eu.tankionline.com/thunder_resistance.svg")';
    f.sync();
    assert.ok(!compact.children[0].children.length);
    assert.equal(compact.children[1].textContent, '20');
    protection.querySelector('div').computed.backgroundColor = 'rgb(254, 102, 0)';
    f.sync();
    assert.equal(compact.children[0].textContent, '50');
    assert.ok(!compact.children[0].children[0].classList.contains('kasp-spectrum'));
});

test('zero summary is inserted as one batch and follows changing native resistance types', () => {
    const f = fixture();
    const before = f.writes();
    f.sync();
    assert.equal(f.writes() - before, 1);
    assert.equal(f.summary.querySelectorAll('.kasp-zero-summary').length, 19);
    const native = f.label('smoky', '2');
    f.summary.appendChild(native);
    f.sync();
    const turrets = () => f.summary.querySelectorAll('.kasp-zero-summary').map(node => node.getAttribute('data-turret'));
    assert.ok(!turrets().includes('smoky'));
    const writes = f.writes();
    f.sync();
    assert.equal(f.writes(), writes);
    native.querySelector('div').computed.maskImage = 'url("https://s.eu.tankionline.com/thunder_resistance.svg")';
    f.sync();
    assert.ok(turrets().includes('smoky'));
    assert.ok(!turrets().includes('thunder'));
    assert.equal(new Set(turrets()).size, turrets().length);
});
