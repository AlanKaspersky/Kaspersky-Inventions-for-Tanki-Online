const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");
const code = transformSync(fs.readFileSync('src/modules/accountSearchNotice.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;

function fixture() {
    let account = null, menu = true, time = 0, handle = 0;
    const tasks = new Map(), frames = new Map(), listeners = new Map();
    const state = { lang: 'RU', currentScreen: 'lobby' };
    class Element {
        constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.style = { setProperty: (k, v) => { this[k] = v; } }; }
        get isConnected() { return this === root || !!this.parent?.isConnected; }
        setAttribute(k, v) { this.attributes[k] = v; }
        append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
        appendChild(node) { node.parent = this; this.children.push(node); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    }
    const root = new Element();
    const window = { location: { origin: 'https://tankionline.com' },
        addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type),
        setTimeout(fn, ms) { const id = ++handle; tasks.set(id, { fn, at: time + ms }); return id; },
        clearTimeout: id => tasks.delete(id),
        requestAnimationFrame(fn) { const id = ++handle; frames.set(id, fn); return id; },
        cancelAnimationFrame: id => frames.delete(id),
    };
    const module = { exports: {} };
    const context = { module, window, chrome: { runtime: { getURL: path => 'chrome-extension://ki/' + path } },
        document: { body: root, createElement: () => new Element(), querySelector: selector => selector === 'menu' ? menu ? {} : null : root },
        require: id => id.endsWith('/accountIdentity') ? { getVerifiedAccount: () => account }
            : id.endsWith('/accountId') ? { ACCOUNT_IDENTITY_MESSAGE: 'kasp:account-identity' }
            : id.endsWith('/state') ? { state } : { gameDOM: { play: { mainMenu: 'menu' }, common: { appContainer: 'root' } } },
    };
    runFeatureContext(code, context);
    return { state, tasks, frames, listeners, sync: module.exports.accountSearchNotice,
        notice: () => root.children[0], root,
        account(value) { account = value; }, menu(value) { menu = value; },
        notify(value = account, overrides = {}) { listeners.get('message')?.({ source: window, origin: window.location.origin,
            data: { type: 'kasp:account-identity', snapshot: { account: value, players: [] } }, ...overrides }); },
        advance(ms) {
            const end = time + ms;
            for (;;) {
                const entry = [...tasks].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!entry) break;
                time = entry[1].at; tasks.delete(entry[0]); entry[1].fn();
            }
            time = end;
        },
        frame() { for (const [id, fn] of [...frames]) { frames.delete(id); fn(); } },
        dispose: () => context.require('../core/featureRuntime').featureScope('accountSearchNotice').dispose(),
    };
}
const owner = { userId: '3074457415316504379', nickname: 'Player', clanTag: '' };

test('fast identity acquisition cancels the delayed notice and does not flash a window', () => {
    const f = fixture(); f.sync(); f.advance(599);
    assert.equal(f.notice(), undefined);
    f.notify(owner); f.account(owner); f.advance(0); f.advance(1000);
    assert.equal(f.notice(), undefined);
    assert.equal(f.tasks.size, 0);
});

test('a prolonged lobby search fades in an artwork notice and verified identity fades it out before removal', () => {
    const f = fixture(); f.sync(); f.advance(600);
    const notice = f.notice();
    assert.equal(notice.children[1].textContent, 'Поиск ID аккаунта');
    assert.match(notice.children[0]['--kasp-art-image'], /assets\/art1.png/);
    assert.equal(notice.attributes.role, 'status');
    assert.notEqual(notice.dataset.visible, 'true');
    f.frame(); f.frame();
    assert.equal(notice.dataset.visible, 'true');
    f.notify(owner); f.account(owner); f.advance(0);
    assert.equal(notice.dataset.visible, 'false');
    f.advance(199); assert.equal(f.notice(), notice);
    f.advance(1); assert.equal(f.notice(), undefined);
});

test('screen changes cancel a waiting search and release an existing notice with its fade', () => {
    const f = fixture(); f.sync(); f.advance(200);
    f.state.currentScreen = 'battle'; f.sync(); f.advance(1000);
    assert.equal(f.notice(), undefined);
    f.state.currentScreen = 'lobby'; f.menu(false); f.sync(); f.advance(1000);
    assert.equal(f.notice(), undefined, 'a stale lobby state alone cannot show the window in another section');
    f.menu(true); f.sync(); f.advance(600); f.frame(); f.frame();
    assert.ok(f.notice());
    f.menu(false); f.sync(); f.advance(200);
    assert.equal(f.notice(), undefined);
});

test('search resumption reverses the fade without duplicating the notice; language updates keep its position', () => {
    const f = fixture(); f.sync(); f.advance(600); f.frame(); f.frame();
    const notice = f.notice();
    f.account(owner); f.notify(); f.advance(0); f.advance(100);
    f.account(null); f.notify(); f.advance(0);
    assert.equal(f.notice(), notice);
    assert.equal(notice.dataset.visible, 'true');
    f.state.lang = 'EN'; f.sync();
    assert.equal(notice.children[1].textContent, 'Searching for account ID');
    f.advance(1000);
    assert.equal(f.root.children.length, 1);
});

test('foreign messages do not drive the notice and cleanup cancels pending frames, timers and listeners', () => {
    const f = fixture(); f.sync();
    const count = f.tasks.size;
    f.notify(owner, { origin: 'https://other.example' }); f.notify(owner, { source: {} });
    assert.equal(f.tasks.size, count);
    f.advance(600); f.frame();
    assert.equal(f.frames.size, 1);
    f.dispose();
    assert.equal(f.notice(), undefined);
    assert.equal(f.frames.size + f.tasks.size + f.listeners.size, 0);
    f.advance(1000); f.frame();
    assert.equal(f.notice(), undefined);
});
