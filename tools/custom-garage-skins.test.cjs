const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const stock = 'https://s.eu.tankionline.com/stock/image.webp';
const hd = 'https://s.eu.tankionline.com/hd/image.webp';
const classic = 'https://s.eu.tankionline.com/classic/image.webp';
const prefix = 'kasp_equipped_skins_uid_';

async function fixture() {
    let account = { userId: '3074457415316504379', nickname: 'Player', clanTag: '' };
    let garage = true, art = hd, cards = [], style = null, bridgeEnabled = true;
    const storage = new Map();
    let storageParses = 0;
    const row = { querySelectorAll: () => cards, contains: () => false };
    const menu = { querySelectorAll: () => [{ art }] };
    const document = {
        querySelector(selector) { return selector === 'garage' ? garage ? {} : null : selector === 'cards' ? row : selector === 'menu' ? menu : null; },
        querySelectorAll: () => [],
        getElementById: () => style,
        createElement: () => ({ id: '', textContent: '' }),
        head: { appendChild(value) { style = value; } },
    };
    const module = { exports: {} };
    runFeatureContext(transformSync(fs.readFileSync('src/modules/customGarageSkins.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, console: { log() {}, error: console.error, warn: console.warn }, document, Event,
        JSON: { stringify: JSON.stringify, parse(raw) {
            if ([...storage.values()].includes(raw)) storageParses++;
            return JSON.parse(raw);
        } },
        window: { dispatchEvent(event) {
            assert.equal(event.type, 'kasp:garage-skin-cards-request');
            if (bridgeEnabled) {
                event.preventDefault();
                for (const card of cards) if (card.native) card.setAttribute('data-kasp-skin-card', JSON.stringify(card.native));
            }
            return !event.defaultPrevented;
        } },
        chrome: { runtime: { getURL: value => value } },
        fetch: async () => ({ ok: true, json: async () => ({ names: { hornet: 'hornet' }, defaults: { hornet: stock } }) }),
        getComputedStyle: () => ({ backgroundImage: `url("${art}")` }),
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        require: id => id.endsWith('/accountIdentity') ? { getVerifiedAccount: () => account }
            : id.endsWith('/gameAugments') ? { GARAGE_SKIN_CARDS_REQUEST: 'kasp:garage-skin-cards-request' }
            : { gameDOM: { skins: { cards: 'cards', cardIcon: 'icon' }, garage: { skinArt: ['.art'], submenu: 'menu', item: 'items', mountedEquipment: 'mounted' }, screens: { garage: 'garage' }, common: { background: 'background' } } },
    });
    await new Promise(resolve => setImmediate(resolve));
    return {
        storage, update: module.exports.customGarageSkins,
        storageParses: () => storageParses,
        account(value) { account = value; }, garage(value) { garage = value; },
        screen(next, preview) { cards = next.map(native => {
            const attributes = new Map();
            return { native, getAttribute: key => attributes.get(key) ?? '',
                setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key) };
        }); art = preview; },
        bridge(value) { bridgeEnabled = value; },
        css: () => style?.textContent ?? '',
    };
}

function skin(id, options = {}) {
    return { id, name: 'Hornet XT', isMounted: true, isSelected: true, isOwned: true, isUnknown: false, isStandard: false, ...options };
}

test('an unavailable Classic preview never replaces equipped XT HD, including identical titles', async () => {
    const f = await fixture();
    f.screen([skin('101')], hd);
    f.update(); f.update();
    const key = prefix + '3074457415316504379';
    assert.equal(JSON.parse(f.storage.get(key)).hornet, hd);
    f.screen([skin('101', { isSelected: false }), skin('102', { isMounted: false, isOwned: false, isUnknown: true })], classic);
    f.update(); f.update(); f.update();
    assert.equal(JSON.parse(f.storage.get(key)).hornet, hd);
    f.garage(false); f.update();
    assert.ok(f.css().includes(hd));
    assert.ok(!f.css().includes(classic));
});

test('an owned preview and unresolved native card state cannot replace the mounted skin', async () => {
    const f = await fixture();
    f.screen([skin('101', { isSelected: false }), skin('102', { isMounted: false })], classic);
    f.update(); f.update();
    assert.equal(f.storage.size, 0);
    f.screen([null], classic); f.update(); f.update();
    assert.equal(f.storage.size, 0);
    f.screen([skin('102')], classic); f.update(); f.update();
    assert.equal(JSON.parse(f.storage.get(prefix + '3074457415316504379')).hornet, classic);
    f.screen([skin('0', { isStandard: true }), skin('102', { isMounted: false, isSelected: false })], stock); f.update(); f.update();
    assert.deepEqual(JSON.parse(f.storage.get(prefix + '3074457415316504379')), {});
    assert.equal(f.css(), '');
});

test('skins follow user IDs across renames and switches; legacy data stays separate', async () => {
    const f = await fixture();
    f.storage.set('kasp_equipped_skins', JSON.stringify({ hornet: classic }));
    f.screen([], hd); f.update();
    assert.equal(f.css(), '');
    f.screen([skin('101')], hd); f.update(); f.update();
    const saved = f.storage.get(prefix + '3074457415316504379');
    f.account({ userId: '3074457415316504379', nickname: 'Renamed', clanTag: '' }); f.update();
    assert.ok(f.css().includes(hd));
    f.garage(false);
    f.account({ userId: '2002', nickname: 'Renamed', clanTag: '' }); f.update();
    assert.equal(f.css(), '');
    assert.equal(f.storage.has(prefix + '2002'), false);
    f.account({ userId: '3074457415316504379', nickname: 'Renamed', clanTag: '' }); f.update();
    assert.ok(f.css().includes(hd));
    f.account(null); f.update();
    assert.equal(f.css(), '');
    assert.equal(f.storage.get(prefix + '3074457415316504379'), saved);
    assert.equal(JSON.parse(f.storage.get('kasp_equipped_skins')).hornet, classic);
});

test('pending learning is reset when the owner changes or identity is unavailable', async () => {
    const f = await fixture();
    f.screen([skin('101')], hd); f.update();
    f.account({ userId: '2002', nickname: 'Other', clanTag: '' }); f.update();
    assert.equal(f.storage.size, 0);
    f.account(null); f.update(); f.update();
    assert.equal(f.storage.size, 0);
    f.account({ userId: '2002', nickname: 'Other', clanTag: '' }); f.update();
    assert.equal(f.storage.size, 0);
    f.update();
    assert.equal(JSON.parse(f.storage.get(prefix + '2002')).hornet, hd);
});

test('an unavailable page-world bridge cannot reuse stale card evidence', async () => {
    const f = await fixture();
    f.screen([skin('101')], hd); f.update();
    f.bridge(false); f.update(); f.update();
    assert.equal(f.storage.size, 0);
    f.bridge(true); f.update(); f.update();
    assert.equal(JSON.parse(f.storage.get(prefix + '3074457415316504379')).hornet, hd);
});

test('periodic ticks retain live mounting checks while reusing unchanged parsed storage and refreshing changed artwork', async () => {
    const f = await fixture();
    f.screen([skin('101')], hd); f.update(); f.update(); f.update();
    const before = f.storageParses();
    for (let i = 0; i < 10; i++) f.update();
    assert.equal(f.storageParses(), before, 'unchanged periodic observations do not parse the same saved JSON again');
    f.screen([skin('102')], classic); f.update(); f.update();
    assert.equal(JSON.parse(f.storage.get(prefix + '3074457415316504379')).hornet, classic);
    assert.ok(f.css().includes(classic), 'the 250 ms caller still observes a newly mounted skin');
    f.screen([], classic);
    f.storage.set(prefix + '3074457415316504379', JSON.stringify({ hornet: hd })); f.update();
    assert.ok(f.css().includes(hd), 'storage changes invalidate generated CSS without restarting');
});
