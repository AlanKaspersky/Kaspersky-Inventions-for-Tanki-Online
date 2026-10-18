const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

function fixture(lang) {
    let resolveDictionary, panel = null, requests = 0, replacements = 0;
    const dictionary = new Promise(resolve => { resolveDictionary = resolve; });
    let account = { userId: '1001', nickname: 'Player', clanTag: '' };
    const storage = new Map([['kasp_trophies_favorites_uid_1001', JSON.stringify([{ id: 'ricochet', type: 'turret', icon: 'native-icon', current: 1000, max: 5000000 }])]]);
    const state = { lang, currentScreen: 'lobby' };
    const parent = { appendChild(value) { panel = value; } };
    const document = { querySelector: () => ({ parentElement: parent }), querySelectorAll: () => [],
        getElementById: () => panel, createElement: tag => ({ tag, dataset: {}, style: {}, children: [], textContent: '',
            get html() { return this.textContent + this.children.map(child => child.html).join(''); },
            appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); },
            insertAdjacentHTML() { throw Error('Persisted data must never be parsed as HTML'); },
            replaceWith(value) { replacements++; panel = value; }, remove() { panel = null; } }) };
    const module = { exports: {} };
    runFeatureContext(transformSync(fs.readFileSync('src/modules/customTrophies.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, console, document, chrome: { runtime: { getURL: value => value } },
        fetch: async () => { requests++; return { ok: true, json: () => dictionary }; },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        require: id => id.endsWith('/accountIdentity') ? { getVerifiedAccount: () => account } : id.endsWith('/state') ? { state } : { gameDOM: { trophies: {} } },
    });
    return { setAccount(value) { account = value; }, storage, update: module.exports.customTrophies, state, resolve: () => resolveDictionary({ ricochet: {
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

test('favorites follow the account ID across renames and are cleared from the UI on account switch or logout', async () => {
    const f = fixture('EN');
    f.storage.set('kasp_trophies_favorites', 'legacy-value');
    const first = f.update(); f.resolve(); await first;
    assert.ok(f.panel());
    f.setAccount({ userId: '1001', nickname: 'Renamed', clanTag: '' });
    await f.update();
    assert.ok(f.panel());
    f.setAccount({ userId: '2002', nickname: 'Renamed', clanTag: '' });
    await f.update();
    assert.equal(f.panel(), null);
    f.setAccount({ userId: '1001', nickname: 'Renamed', clanTag: '' });
    await f.update();
    assert.ok(f.panel());
    f.setAccount(null); await f.update();
    assert.equal(f.panel(), null);
    assert.equal(f.storage.get('kasp_trophies_favorites'), 'legacy-value');
});

test('a dictionary load started for one account cannot render favorites for that account after switching', async () => {
    const f = fixture('EN');
    const pending = f.update();
    f.setAccount({ userId: '2002', nickname: 'Other', clanTag: '' });
    f.resolve(); await pending;
    assert.equal(f.panel(), null);
    await f.update();
    assert.equal(f.panel(), null);
});

test('persisted markup stays literal text and unsafe artwork cannot create HTML or external requests', async () => {
    const f = fixture('EN');
    const id = '<img src=x onerror=alert(1)>';
    f.storage.set('kasp_trophies_favorites_uid_1001', JSON.stringify([
        { id, type: 'turret', icon: 'https://evil.example/x.svg', current: 1, max: 2 },
        { id: 'valid', type: 'hull', icon: 'https://s.eu.tankionline.com/icon.webp', current: 2, max: 3 },
    ]));
    const pending = f.update(); f.resolve(); await pending;
    const [first, second] = f.panel().children;
    assert.equal(first.children[0].tag, 'div');
    assert.equal(first.children[0].children[0].textContent, id);
    assert.equal(first.children[0].children[0].children.length, 0);
    assert.equal(first.children[0].children[1].textContent, '50%');
    assert.equal(first.children[0].children[3].children[0].textContent, '1');
    assert.equal(first.children[0].children[3].children[1].textContent, '/ 2');
    assert.equal(second.children[0].children[1].textContent, '66%');
    assert.equal(first.html.includes('<img src=x onerror=alert(1)>'), true);
    const images = node => node.tag === 'img' || node.children.some(images);
    assert.equal(images(f.panel()), false, 'grid tiles do not load reward artwork');
});
