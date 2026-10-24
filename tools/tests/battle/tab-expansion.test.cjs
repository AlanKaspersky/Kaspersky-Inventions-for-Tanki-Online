const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");

function fixture(initial = false, count = 2) {
    const classes = new Set(initial ? ['kasp-tab-expanded'] : []);
    const timers = new Map(), listeners = new Map(), cleanups = [];
    let id = 0, reads = 0, broken = false;
    const body = { classList: {
        contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value),
        toggle(value, on) { if (on) classes.add(value); else classes.delete(value); },
    } };
    const expanded = () => classes.has('kasp-tab-expanded');
    function pane() {
        const values = new Map([['color', 'red']]);
        const attributes = new Set();
        const columns = [100, 40, 50, 20, 20, 30, 30, 10];
        const row = { getBoundingClientRect: () => ({ width: expanded() ? 550 : 400 }), children: columns.map((width, index) => ({ getBoundingClientRect() {
            return { width: width + (expanded() ? index === 1 ? 50 : 2 : 0) };
        } })) };
        return { attributes, values,
            style: { [Symbol.iterator]: () => values.keys(), setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) },
            setAttribute: key => attributes.add(key), removeAttribute: key => attributes.delete(key),
            querySelectorAll: () => [{ children: [] }, row],
        };
    }
    const panes = Array.from({ length: count }, pane);
    const module = { exports: {} };
    runFeatureContext(transformSync(fs.readFileSync('src/modules/tabExpansion.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, document: { body, querySelectorAll: () => panes }, window: { getComputedStyle() {
            reads++; if (broken) throw Error('detached layout'); return { width: expanded() ? '550px' : '400px' };
        } }, require: () => ({ gameDOM: { statistics: { teams: 'panes' } } }),
    });
    const api = module.exports.createTabExpansion({
        timeout: fn => { timers.set(++id, fn); return id; }, cancelTimeout: key => timers.delete(key),
        listen: (target, type, callback) => listeners.set(type, callback), onCleanup: callback => cleanups.push(callback),
    });
    return { ...api, panes, timers, expanded, reads: () => reads,
        finish() { for (const callback of [...timers.values()]) callback(); },
        resize: () => listeners.get('resize')(), cleanup: () => cleanups.forEach(callback => callback()),
        breakLayout() { broken = true; },
    };
}

test('button expansion snapshots both layouts and keeps every pane on one shared progress', () => {
    const f = fixture(); f.setExpanded(true);
    assert.equal(f.expanded(), true);
    assert.equal(f.timers.size, 1);
    for (const pane of f.panes) {
        assert.equal(pane.attributes.has('data-kasp-tab-animating'), true);
        assert.equal(pane.attributes.has('data-kasp-tab-measuring'), false);
        assert.equal(pane.values.get('--kasp-tab-from'), '400px');
        assert.equal(pane.values.get('--kasp-tab-to'), '550px');
        assert.equal(pane.values.get('--kasp-tab-body-row-from'), '400px');
        assert.equal(pane.values.get('--kasp-tab-body-row-to'), '550px');
        assert.equal(pane.values.get('--kasp-tab-body-1-from'), '40px');
        assert.equal(pane.values.get('--kasp-tab-body-1-to'), '90px');
        assert.equal(pane.values.has('--kasp-tab-progress'), false, 'CSS owns the common target after measuring');
    }
    f.finish();
    assert.equal(f.expanded(), true);
    assert.equal(f.timers.size, 0);
    for (const pane of f.panes) {
        assert.equal(pane.attributes.size, 0);
        assert.deepEqual([...pane.values], [['color', 'red']]);
    }
});

test('rapid reversal reuses the current animation instead of snapping or measuring again', () => {
    const f = fixture(); f.setExpanded(true); const reads = f.reads();
    f.setExpanded(false); f.setExpanded(true); f.setExpanded(false);
    assert.equal(f.reads(), reads);
    assert.equal(f.expanded(), false); assert.equal(f.timers.size, 1);
    f.finish(); assert.equal(f.timers.size, 0);
});

test('a restored expanded TAB can collapse; resize and cleanup release temporary geometry', () => {
    for (const release of ['resize', 'cleanup']) {
        const f = fixture(true); f.setExpanded(false);
        assert.equal(f.expanded(), false);
        f[release]();
        assert.equal(f.timers.size, 0);
        for (const pane of f.panes) {
            assert.equal(pane.attributes.size, 0);
            assert.deepEqual([...pane.values], [['color', 'red']]);
        }
    }
});

test('missing panes are harmless and a measurement failure restores the prior body state and geometry', () => {
    const empty = fixture(false, 0); empty.setExpanded(true);
    assert.equal(empty.expanded(), true); assert.equal(empty.timers.size, 0);
    const broken = fixture(true); broken.breakLayout();
    assert.throws(() => broken.setExpanded(false), /detached layout/);
    assert.equal(broken.expanded(), true); assert.equal(broken.timers.size, 0);
    assert.ok(broken.panes.every(pane => pane.attributes.size === 0 && pane.values.size === 1));
});
