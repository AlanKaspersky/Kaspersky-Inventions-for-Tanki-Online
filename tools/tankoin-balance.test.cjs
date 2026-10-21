const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require('./test-feature-context.cjs');

const domModule = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/gameDOM.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: domModule });
const { gameDOM } = domModule.exports;
const code = transformSync(fs.readFileSync('src/modules/tankoinBalance.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code;

function fixture({ storage = new Map(), userId = '1001', name = 'First', storageBlocked = false } = {}) {
    class Element {
        constructor(tag = 'div') { this.tagName = tag; }
        children = [];
        parentElement = null;
        className = '';
        dataset = {};
        attributes = new Map();
        text = '';
        get isConnected() { return this === root || !!this.parentElement?.isConnected; }
        get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
        set textContent(text) { this.text = text; this.children = []; }
        classList = { toggle: (name, force) => {
            const classes = new Set(this.className.split(/\s+/).filter(Boolean));
            if (force) classes.add(name); else classes.delete(name);
            this.className = [...classes].join(' ');
        } };
        get src() { return this.getAttribute('src') || ''; }
        set src(value) { this.setAttribute('src', value); }
        getAttribute(name) { return this.attributes.get(name) ?? null; }
        setAttribute(name, value) { this.attributes.set(name, value); }
        removeAttribute(name) { this.attributes.delete(name); }
        appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        prepend(child) { child.remove(); child.parentElement = this; this.children.unshift(child); }
        get firstChild() { return this.children[0] || null; }
        insertBefore(child, before) {
            if (!before) return this.appendChild(child);
            child.remove(); child.parentElement = this;
            this.children.splice(this.children.indexOf(before), 0, child);
            return child;
        }
        remove() {
            if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
            this.parentElement = null;
        }
        matches(selector) {
            const exclude = /:not\(#([^)]*)\)/.exec(selector);
            if (exclude && this.id === exclude[1]) return false;
            const base = selector.replace(/:not\([^)]*\)/g, '');
            if (base.startsWith('#')) return this.id === base.slice(1);
            if (base.startsWith('.')) return this.className.split(/\s+/).includes(base.slice(1));
            return this.tagName === base;
        }
        querySelectorAll(selector) {
            if (selector === gameDOM.account.currencyGroup) return this.descendants().filter(element =>
                element.tagName === 'div' && element.children.some((child, index) =>
                    child.matches(gameDOM.account.currencyIcon) && element.children[index + 1]?.matches(gameDOM.account.currencyIcon)));
            const parts = selector.split(/\s+/);
            const match = element => {
                if (!element.matches(parts.at(-1))) return false;
                let ancestor = element.parentElement;
                for (let i = parts.length - 2; i >= 0; i--) {
                    while (ancestor && !ancestor.matches(parts[i])) ancestor = ancestor.parentElement;
                    if (!ancestor) return false;
                    ancestor = ancestor.parentElement;
                }
                return true;
            };
            const descendants = this.children.flatMap(child => [child, ...child.descendants()]);
            return descendants.filter(match);
        }
        descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    }
    const root = new Element();
    const node = (selector, parent = root, tag = 'div') => {
        const element = new Element(tag);
        element.className = selector.replace(/^\./, '');
        parent.appendChild(element);
        return element;
    };
    let header = node(gameDOM.account.currencyHeader);
    let nickname = name;
    let verifiedId = userId;
    let hideCurrency = false;
    let reads = 0, writes = 0;
    const listeners = {}, observers = [];
    const state = { lang: 'EN' };
    const module = { exports: {} };
    const context = {
        module, window: { location: { origin: 'https://tankionline.com' }, addEventListener: (name, handler) => { listeners[name] = handler; } },
        localStorage: {
            getItem(key) { reads++; if (storageBlocked) throw Error('storage blocked'); return storage.get(key) ?? null; },
            setItem(key, value) { writes++; if (storageBlocked) throw Error('storage blocked'); storage.set(key, value); },
        },
        document: { querySelector: selector => root.querySelector(selector), createElement: tag => new Element(tag) },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
            observe(target, options) { this.targets.push({ target, options }); }
            disconnect() { this.targets = []; }
        },
        require: name => ({
            '../core/accountIdentity': {
                getAccountIdentity: () => nickname ? { nickname } : null,
                getVerifiedAccount: () => verifiedId && nickname ? { userId: verifiedId, nickname } : null,
            },
            '../core/accountId': { ACCOUNT_IDENTITY_MESSAGE: 'kasp:account-identity' },
            '../core/gameDOM': { gameDOM }, '../core/state': { state },
            '../core/utils': { utils: { getSetting: () => hideCurrency } },
        }[name]),
    };
    runFeatureContext(code, context);
    const sync = module.exports.tankoinBalance;
    return {
        sync, state, observers, storage,
        storageAccess: () => ({ reads, writes }),
        panel: () => root.querySelector('#kasp-tankoin-balance'),
        text: () => root.querySelector('#kasp-tankoin-balance')?.querySelector('span').textContent,
        native(amount) {
            const container = node(gameDOM.account.tankoinContainer, header);
            const block = node('.' + gameDOM.classes.tankoinBlock, container);
            const span = new Element('span'); span.textContent = amount; block.append(span);
            const icon = node(gameDOM.account.tankoinIcon, block, 'img'); icon.src = 'https://example.test/coin.svg';
            return { container, span };
        },
        exchange(amount) {
            const dialog = node('.ConverterDialogComponentStyle-modal');
            const span = node('.ConverterDialogComponentStyle-coinBalanceText', dialog, 'span');
            span.textContent = amount;
            return { dialog, span };
        },
        update() { observers.find(observer => observer.targets.length)?.callback([]); },
        hide(value) { hideCurrency = value; listeners['kasp:settings-changed'](); },
        account(value, id = value === 'First' ? '1001' : '1002') { nickname = value; verifiedId = id; sync(); },
        verify(id) { verifiedId = id; sync(); },
        verifyByMessage(id, foreign = false) {
            verifiedId = id;
            listeners.message({ source: foreign ? {} : context.window, origin: context.window.location.origin,
                data: { type: 'kasp:account-identity', snapshot: {
                    account: { userId: id, nickname, clanTag: '' }, players: [],
                } } });
        },
        replaceHeader() { header.remove(); header = node(gameDOM.account.currencyHeader); sync(); },
        showLobby(keepOldHeader = false) {
            if (!keepOldHeader) header.remove();
            header = new Element(); root.appendChild(header);
            const profile = node('.test-profile', header);
            const currencies = node('.test-currencies', header);
            node(gameDOM.account.currencyIcon, currencies);
            node(gameDOM.account.currencyIcon, currencies);
            return { header, profile, currencies };
        },
        dispose() { context.require('../core/featureRuntime').featureScope('tankoinBalance').dispose(); },
    };
}

test('lobby Tankoins wait for verified ownership, then reveal once with the cached balance', () => {
    const f = fixture({ userId: null, storage: new Map([['kasp_tankoin_balance_uid_1001', '42']]) });
    f.state.currentScreen = 'lobby'; f.sync();
    assert.equal(f.panel(), null);
    f.verify('1001');
    assert.equal(f.text(), '42');
    assert.match(f.panel().className, /kasp-lobby-reveal/);
    const panel = f.panel(); f.sync();
    assert.equal(f.panel(), panel, 'unchanged balances do not recreate the entering counter');
    f.state.currentScreen = 'garage'; f.replaceHeader();
    f.state.currentScreen = 'lobby'; f.replaceHeader();
    assert.doesNotMatch(f.panel().className, /kasp-lobby-reveal/, 'section navigation does not replay ID reveal');
    f.verify(null);
    assert.equal(f.panel(), null);
});

test('Tankoin header shows an unknown balance until observed, preserves zero and avoids duplicate native balances', () => {
    const f = fixture();
    f.sync();
    assert.equal(f.text(), '—');
    const native = f.native('0');
    f.sync();
    assert.equal(f.panel(), null);
    native.container.remove();
    f.sync();
    assert.equal(f.text(), '0');
    const panel = f.panel();
    f.sync();
    assert.equal(f.panel(), panel);
    assert.equal(f.panel().querySelector('img').src, 'https://example.test/coin.svg');
    f.replaceHeader();
    assert.equal(f.text(), '0');
});

test('native shop text and exchange balance changes refresh the remembered amount without reading the exchange input', () => {
    const f = fixture();
    const native = f.native('1\u00a0250');
    f.sync();
    native.span.textContent = '900';
    f.update();
    native.container.remove(); f.sync();
    assert.equal(f.text(), '900');
    const exchange = f.exchange('750');
    f.sync();
    assert.equal(f.text(), '750');
    assert.ok(f.observers.at(-1).targets[0].options.characterData);
    exchange.span.textContent = '500'; f.update();
    assert.equal(f.text(), '500');
    exchange.span.textContent = 'Loading'; f.update();
    assert.equal(f.text(), '500');
    exchange.dialog.remove(); f.sync();
    assert.equal(f.text(), '500');
    assert.ok(f.observers.every(observer => !observer.targets.length));
});

test('masked native amounts stay readable while the custom balance respects privacy and language changes', () => {
    const f = fixture();
    const native = f.native('Hidden'); native.span.dataset.originalValue = '2\u00a0000';
    f.sync(); native.container.remove(); f.sync();
    f.hide(true);
    assert.equal(f.text(), 'Hidden');
    assert.equal(f.panel().querySelector('span').dataset.originalValue, '2\u00a0000');
    const exchange = f.exchange('1\u00a0000'); f.sync();
    assert.equal(f.text(), 'Hidden');
    assert.equal(f.panel().querySelector('span').dataset.originalValue, '1\u00a0000');
    f.state.lang = 'RU'; f.sync();
    assert.equal(f.text(), 'Скрыто');
    exchange.dialog.remove(); f.hide(false);
    assert.equal(f.text(), '1\u00a0000');
    assert.equal(f.panel().querySelector('span').dataset.originalValue, undefined);
});

test('switching accounts clears the session balance and cleanup disconnects observers and removes the panel', () => {
    const f = fixture();
    const native = f.native('100'); f.sync(); native.container.remove(); f.sync();
    assert.equal(f.text(), '100');
    f.account('Second');
    assert.equal(f.text(), '—');
    const exchange = f.exchange('25'); f.sync();
    assert.equal(f.text(), '25');
    f.dispose();
    assert.equal(f.panel(), null);
    assert.ok(f.observers.every(observer => !observer.targets.length));
    assert.equal(exchange.span.textContent, '25');
});

test('lobby currency group receives the counter before rubies and crystals and retains the shop balance across navigation', () => {
    const f = fixture();
    const lobby = f.showLobby(); f.sync();
    assert.equal(f.text(), '—');
    assert.deepEqual(lobby.header.children, [lobby.profile, f.panel(), lobby.currencies]);
    f.replaceHeader();
    const native = f.native('450'); f.sync();
    assert.equal(f.panel(), null);
    native.container.remove();
    const returned = f.showLobby(); f.sync();
    assert.equal(f.text(), '450');
    assert.deepEqual(returned.header.children, [returned.profile, f.panel(), returned.currencies]);
    f.replaceHeader();
    assert.equal(f.text(), '450');
});

test('counter moves to a replacement lobby currency group even while its previous parent remains connected', () => {
    const f = fixture();
    const oldLobby = f.showLobby(); f.sync();
    const oldPanel = f.panel();
    // An existing page container can survive a navigation while its currency group is replaced.
    oldLobby.currencies.remove();
    const lobby = f.showLobby(true); f.sync();
    assert.equal(f.panel().parentElement, lobby.header);
    assert.equal(oldPanel.isConnected, false);
    assert.equal(oldLobby.header.children.includes(oldPanel), false);
});

test('remembered zero survives a reload and later exchange balances replace it without writing on every render', () => {
    const storage = new Map();
    const first = fixture({ storage });
    const native = first.native('0'); first.sync(); native.container.remove(); first.sync();
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '0');
    first.dispose();
    const reloaded = fixture({ storage }); reloaded.sync();
    assert.equal(reloaded.text(), '0');
    const exchange = reloaded.exchange('2\u00a0500'); reloaded.sync();
    exchange.span.textContent = '1\u00a0000'; reloaded.update();
    exchange.dialog.remove(); reloaded.sync();
    reloaded.sync();
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '1\u00a0000');
    assert.deepEqual(reloaded.storageAccess(), { reads: 1, writes: 2 });
    reloaded.dispose();
    const last = fixture({ storage }); last.sync(); last.hide(true);
    assert.equal(last.text(), 'Hidden');
    last.hide(false);
    assert.equal(last.text(), '1\u00a0000');
});

test('persistent balances belong to verified IDs, including renamed accounts and different IDs with the same nickname', () => {
    const storage = new Map([
        ['kasp_tankoin_balance_uid_1001', '300'], ['kasp_tankoin_balance_uid_1002', '20'],
    ]);
    const f = fixture({ storage }); f.sync();
    assert.equal(f.text(), '300');
    f.account('Renamed', '1001');
    assert.equal(f.text(), '300');
    f.account('Renamed', '1002');
    assert.equal(f.text(), '20');
    const exchange = f.exchange('15'); f.sync(); exchange.dialog.remove(); f.sync();
    assert.equal(storage.get('kasp_tankoin_balance_uid_1002'), '15');
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '300');
    f.account('First', '1001');
    assert.equal(f.text(), '300');
});

test('unverified identities neither read nor write caches, and a pending live balance is saved after verification', () => {
    const storage = new Map([['kasp_tankoin_balance_uid_1001', '300']]);
    const f = fixture({ storage, userId: null }); f.sync();
    assert.equal(f.text(), '—');
    assert.deepEqual(f.storageAccess(), { reads: 0, writes: 0 });
    const native = f.native('250'); f.sync(); native.container.remove(); f.sync();
    assert.equal(f.text(), '250');
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '300');
    f.verify('1001');
    assert.equal(f.text(), '250');
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '250');
    f.verify(null);
    const exchange = f.exchange('200'); f.sync(); exchange.dialog.remove(); f.sync();
    assert.equal(f.text(), '200');
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '250');
    f.verify('1001');
    assert.equal(storage.get('kasp_tankoin_balance_uid_1001'), '200');
});

test('corrupt or unavailable storage leaves live balance updates working and does not retry failed writes on every render', () => {
    const invalid = fixture({ storage: new Map([['kasp_tankoin_balance_uid_1001', '{broken}']]) });
    invalid.sync();
    assert.equal(invalid.text(), '—');
    const f = fixture({ storageBlocked: true });
    const native = f.native('125'); f.sync(); native.container.remove(); f.sync(); f.sync();
    assert.equal(f.text(), '125');
    assert.deepEqual(f.storageAccess(), { reads: 1, writes: 1 });
});

test('a later verified identity message restores the cache immediately without waiting for a DOM change', () => {
    const f = fixture({ userId: null, storage: new Map([['kasp_tankoin_balance_uid_1001', '500']]) });
    f.sync();
    assert.equal(f.text(), '—');
    f.verifyByMessage('1001', true);
    assert.equal(f.text(), '—');
    f.verifyByMessage('1001');
    assert.equal(f.text(), '500');
});
