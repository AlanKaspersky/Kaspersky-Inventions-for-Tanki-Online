const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

function fixture(lang) {
    let resolveDictionary, panel = null, requests = 0, replacements = 0;
    const dictionary = new Promise(resolve => { resolveDictionary = resolve; });
    const state = { lang, currentScreen: 'lobby' };
    const parent = { appendChild(value) { panel = value; } };
    const document = { querySelector: () => ({ parentElement: parent }), querySelectorAll: () => [],
        getElementById: () => panel, createElement: () => ({ dataset: {}, html: '',
            insertAdjacentHTML(position, html) { this.html += html; },
            replaceWith(value) { replacements++; panel = value; }, remove() { panel = null; } }) };
    const module = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync('src/modules/customTrophies.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, console, document, chrome: { runtime: { getURL: value => value } },
        fetch: async () => { requests++; return { ok: true, json: () => dictionary }; },
        localStorage: { getItem: () => JSON.stringify([{ id: 'ricochet', type: 'turret', icon: 'native-icon', current: 1000, max: 5000000 }]) },
        require: id => id.endsWith('/state') ? { state } : { gameDOM: { trophies: {} } },
    });
    return { update: module.exports.customTrophies, state, resolve: () => resolveDictionary({ ricochet: {
        id: 'ricochet', ru: 'Рикошет', en: 'Ricochet', type: 'turret' } }),
        panel: () => panel, requests: () => requests, replacements: () => replacements };
}

test('concurrent first-load updates await the dictionary and immediately show localized names in RU and EN', async () => {
    for (const lang of ['RU', 'EN']) {
        const f = fixture(lang);
        const first = f.update(), second = f.update();
        await Promise.resolve(); await Promise.resolve();
        assert.equal(f.panel(), null, 'raw IDs must not be rendered while the dictionary is loading');
        assert.equal(f.requests(), 1);
        f.resolve();
        await Promise.all([first, second]);
        assert.ok(f.panel().html.includes(lang === 'RU' ? 'Рикошет' : 'Ricochet'));
        assert.equal(f.replacements(), 0);
    }
});

test('an existing lobby panel updates on language changes without replacing it on every tick', async () => {
    const f = fixture('EN');
    const first = f.update(); f.resolve(); await first;
    f.state.lang = 'RU'; await f.update();
    assert.ok(f.panel().html.includes('Рикошет'));
    assert.equal(f.replacements(), 1);
    await f.update(); await f.update();
    assert.equal(f.replacements(), 1);
});
