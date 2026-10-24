const runFeatureContext = require("../helpers/feature-context.cjs");
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const dataModule = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/trophyData.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: dataModule });
const trophyData = dataModule.exports;

function fixture(lang) {
    let resolveDictionary, panel = null, requests = 0, replacements = 0;
    let handle = 0;
    const listeners = new Map(), timers = new Map();
    const window = { location: { origin: 'https://tankionline.com' },
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type) { listeners.delete(type); },
        setTimeout(callback) { const id = ++handle; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
    };
    const dictionary = new Promise(resolve => { resolveDictionary = resolve; });
    let account = { userId: '1001', nickname: 'Player', clanTag: '' };
    const storage = new Map([['kasp_trophies_favorites_uid_1001', JSON.stringify([{ id: 'ricochet', type: 'turret', icon: 'native-icon', current: 1000, max: 5000000 }])]]);
    const state = { lang, currentScreen: 'lobby' };
    const parent = { appendChild(value) { panel = value; value.parentElement = parent; } };
    const document = { querySelector: () => ({ parentElement: parent }), querySelectorAll: () => [],
        getElementById: () => panel, createElement: tag => ({ tag, dataset: {}, style: {}, children: [], textContent: '',
            get html() { return this.textContent + this.children.map(child => child.html).join(''); },
            appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); },
            insertAdjacentHTML() { throw Error('Persisted data must never be parsed as HTML'); },
            replaceWith(value) { replacements++; panel = value; value.parentElement = parent; }, remove() { panel = null; } }) };
    const module = { exports: {} };
    const context = {
        module, console, window, document, chrome: { runtime: { getURL: value => value } },
        fetch: async () => { requests++; return { ok: true, json: () => dictionary }; },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        require: id => id.endsWith('/accountIdentity') ? { getVerifiedAccount: () => account }
            : id.endsWith('/accountId') ? { ACCOUNT_IDENTITY_MESSAGE: 'kasp:account-identity' }
            : id.endsWith('/trophyData') ? trophyData
            : id.endsWith('/state') ? { state } : { gameDOM: { trophies: {} } },
    };
    runFeatureContext(transformSync(fs.readFileSync('src/modules/customTrophies.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, context);
    return { setAccount(value) { account = value; }, storage, update: module.exports.customTrophies, state, resolve: () => resolveDictionary({ ricochet: {
        id: 'ricochet', ru: 'Рикошет', en: 'Ricochet', type: 'turret' } }),
        notify(value = account, overrides = {}) { listeners.get('message')?.({ source: window, origin: window.location.origin,
            data: { type: 'kasp:account-identity', snapshot: { account: value, players: [] } }, ...overrides }); },
        async flush() {
            for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
            await new Promise(resolve => setImmediate(resolve));
        },
        timers, listeners, dispose: () => context.require('../core/featureRuntime').featureScope('customTrophies').dispose(),
        panel: () => panel, requests: () => requests, replacements: () => replacements };
}

test('dictionary preloads at startup and a late verified ID renders without another heavy update', async () => {
    const f = fixture('EN');
    assert.equal(f.requests(), 1);
    f.setAccount(null);
    f.resolve(); await f.flush();
    assert.equal(f.panel(), null);
    // The trophy listener can run before the content-world identity cache listener.
    const owner = { userId: '1001', nickname: 'Player', clanTag: '' };
    f.notify(owner);
    f.setAccount(owner);
    await f.flush();
    assert.ok(f.panel().html.includes('Ricochet'));
    assert.match(f.panel().className, /kasp-lobby-reveal/);
    assert.equal(f.requests(), 1);
    f.notify(); f.notify();
    assert.equal(f.timers.size, 1, 'identity heartbeats are coalesced');
    await f.flush();
    assert.equal(f.replacements(), 0, 'unchanged owner does not rebuild the panel');
    f.setAccount(null); f.notify(); await f.flush();
    assert.equal(f.panel(), null, 'logout clears old favorites without waiting for another heavy update');
});

test('identity events cannot bypass verified ownership, and cleanup cancels pending rendering', async () => {
    const f = fixture('EN');
    f.setAccount(null); f.resolve(); await f.flush();
    const owner = { userId: '1001', nickname: 'Player', clanTag: '' };
    f.notify(owner, { origin: 'https://other.example' });
    f.notify(owner, { source: {} });
    assert.equal(f.timers.size, 0);
    f.notify(owner); await f.flush();
    assert.equal(f.panel(), null, 'a message payload alone is not a verified owner');
    f.setAccount(owner); f.notify();
    assert.equal(f.timers.size, 1);
    f.dispose();
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    await f.flush();
    assert.equal(f.panel(), null);
});

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
    assert.doesNotMatch(f.panel().className, /kasp-lobby-reveal/, 'refreshes must not replay the entrance animation');
    await f.update(); await f.update();
    assert.equal(f.replacements(), 1);
});

test('remounting favorites after section navigation does not replay the ID entrance', async () => {
    const f = fixture('EN');
    const first = f.update(); f.resolve(); await first;
    assert.match(f.panel().className, /kasp-lobby-reveal/);
    f.panel().remove();
    await f.update();
    assert.doesNotMatch(f.panel().className, /kasp-lobby-reveal/);
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
        { id, type: 'turret', icon: 'https://evil.example/x.svg', current: 1000, max: 2000 },
        { id: 'valid', type: 'hull', icon: 'https://s.eu.tankionline.com/icon.webp', current: 2000, max: 3000 },
    ]));
    const pending = f.update(); f.resolve(); await pending;
    const [first, second] = f.panel().children;
    assert.equal(first.children[0].tag, 'div');
    assert.equal(first.children[0].children[0].textContent, id);
    assert.equal(first.children[0].children[0].children.length, 0);
    assert.equal(first.children[0].children[1].textContent, '50%');
    assert.equal(first.children[0].children[3].children[0].textContent, '1 000');
    assert.equal(first.children[0].children[3].children[1].textContent, '/ 2 000');
    assert.equal(second.children[0].children[1].textContent, '66%');
    assert.equal(first.html.includes('<img src=x onerror=alert(1)>'), true);
    const images = node => node.tag === 'img' || node.children.some(images);
    assert.equal(images(f.panel()), false, 'grid tiles do not load reward artwork');
});
