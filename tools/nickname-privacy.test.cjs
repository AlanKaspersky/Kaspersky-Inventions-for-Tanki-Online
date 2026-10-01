const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file, context, expose = '') {
    let source = read(file);
    if (expose) {
        const index = source.lastIndexOf('    return () => {');
        assert.ok(index >= 0);
        source = source.slice(0, index) + `globalThis.review = ${expose};\n` + source.slice(index);
    }
    const sandbox = {
        ...context, module: { exports: {} },
        require(name) {
            const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) + '.ts';
            if (dependency.startsWith('src/modules/battleHistory/')) return load(dependency, context);
            return context.require(name.replace('../../core/', '../core/').replace('../equipmentTracker', './equipmentTracker'));
        },
    };
    vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, sandbox);
    return expose ? sandbox.review : sandbox.module.exports;
}

function fixture() {
    let writes = 0;
    const element = text => ({
        textContent: text, children: [{ originalChild: true }], attributes: new Map(),
        getAttribute(key) { return this.attributes.get(key) ?? null; },
        hasAttribute(key) { return this.attributes.has(key); },
        setAttribute(key, value) { this.attributes.set(key, value); writes++; },
        removeAttribute(key) { this.attributes.delete(key); writes++; },
    });
    const classes = new Set();
    const properties = new Map();
    const html = {
        classList: { contains: key => classes.has(key), add: key => { classes.add(key); writes++; }, remove: key => classes.delete(key) },
        style: { getPropertyValue: key => properties.get(key) || '', setProperty: (key, value) => { properties.set(key, value); writes++; } },
    };
    const header = element('[CLAN] Kaspersky');
    const xp = element('1 234');
    const uid = element('UID: Kaspersky');
    const type = element('TYPE: browser');
    const self = element('[CLAN] Kaspersky');
    const other = element('OtherPlayer');
    const document = {
        documentElement: html,
        header, parameters: [uid, type], cells: [self, other], resultName: null,
        querySelector(selector) {
            if (selector === '.UserInfoContainerStyle-userNameRank') return this.header;
            if (selector.startsWith('#selfUserBg ')) return this.resultName;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.ClientInfoComponentStyle-parameterText') return this.parameters;
            if (selector === '.UserInfoContainerStyle-userNameRank, .UserInfoContainerStyle-progressValue') return this.header ? [this.header, xp] : [];
            if (selector === '.BattleTabStatisticComponentStyle-nicknameCell span') return this.cells;
            return [];
        },
    };
    const storage = new Map();
    const localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
    const state = { lang: 'EN' };
    let enabled = true;
    const observers = [];
    const identity = load('src/core/accountIdentity.ts', { document });
    const privacy = load('src/modules/hideNickname.ts', {
        document,
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe(target, options) { this.target = target; this.options = options; }
        },
        require: name => {
            if (name === '../core/accountIdentity') return identity;
            if (name === '../core/state') return { state };
            if (name === '../core/utils') return { utils: { getSetting: () => enabled } };
            throw Error(name);
        },
    });
    const moduleContext = {
        document, localStorage, URL,
        chrome: { runtime: { getURL: file => file } },
        require: name => {
            if (name === '../core/accountIdentity') return identity;
            if (name === '../core/state') return { state };
            if (name === '../core/utils') return { utils: {} };
            if (name === '../core/historyMarkup') return load('src/core/historyMarkup.ts', { URL });
            if (name === '../core/dataLoader') return { DataLoader: {} };
            if (name === '../core/modal' || name === './equipmentTracker') return {};
            throw Error(name);
        },
    };
    return { element, html, header, xp, uid, type, self, other, document, storage, state, observers,
        identity, privacy, moduleContext, get writes() { return writes; }, setEnabled: value => { enabled = value; } };
}

test('masking preserves the real nickname, clan, XP and native children', () => {
    const f = fixture();
    const children = f.header.children;
    f.privacy.setupNicknamePrivacy();
    assert.equal(f.header.textContent, '[CLAN] Kaspersky');
    assert.equal(f.header.children, children);
    assert.equal(f.xp.textContent, '1 234');
    assert.equal(f.identity.getAccountIdentity().nickname, 'Kaspersky');
    assert.equal(f.identity.getAccountIdentity().clanTag, '[CLAN]');
    assert.equal(f.header.getAttribute('data-kasp-private-tooltip'), '[CLAN] Kaspersky');
    assert.equal(f.self.hasAttribute('data-kasp-private-nickname'), true);
    assert.equal(f.other.hasAttribute('data-kasp-private-nickname'), false);
});

test('privacy is enabled synchronously before nickname elements are inserted', () => {
    const f = fixture();
    f.document.header = null;
    f.document.parameters = [];
    f.document.cells = [];
    f.privacy.setupNicknamePrivacy();
    assert.equal(f.html.classList.contains('kasp-hide-nickname'), true);
    assert.equal(f.observers.length, 1);
    assert.equal(f.observers[0].options.characterData, true);
    // The CSS mask is already active; the mutation callback updates metadata
    // directly, without a timeout or requestAnimationFrame in this sandbox.
    f.document.header = f.header;
    f.observers[0].callback();
    assert.equal(f.identity.getAccountIdentity().nickname, 'Kaspersky');
});

test('UID is masked without modifying TYPE or the original UID text', () => {
    const f = fixture();
    f.privacy.setupNicknamePrivacy();
    assert.equal(f.uid.textContent, 'UID: Kaspersky');
    assert.equal(f.uid.hasAttribute('data-kasp-private-uid'), true);
    assert.equal(f.uid.getAttribute('data-kasp-private-tooltip'), 'Kaspersky');
    assert.equal(f.type.textContent, 'TYPE: browser');
    assert.equal(f.type.hasAttribute('data-kasp-private-uid'), false);
    assert.equal(f.type.hasAttribute('data-kasp-public-parameter'), true);
    f.uid.textContent = 'TYPE: browser';
    f.observers[0].callback();
    assert.equal(f.uid.hasAttribute('data-kasp-private-uid'), false);
});

test('account switches and language changes keep identity current without extra mutations', () => {
    const f = fixture();
    f.privacy.setupNicknamePrivacy();
    const writes = f.writes;
    for (let i = 0; i < 20; i++) f.privacy.hideNickname();
    assert.equal(f.writes, writes);
    f.header.textContent = '[NEW] OtherPlayer';
    f.uid.textContent = 'UID: OtherPlayer';
    f.state.lang = 'RU';
    f.observers[0].callback();
    assert.equal(f.identity.getAccountIdentity().nickname, 'OtherPlayer');
    assert.equal(f.identity.getAccountIdentity().clanTag, '[NEW]');
    assert.equal(f.self.hasAttribute('data-kasp-private-nickname'), false);
    assert.equal(f.other.hasAttribute('data-kasp-private-nickname'), true);
    assert.equal(f.html.style.getPropertyValue('--kasp-hidden-label'), '"Скрыто"');
});

test('identity falls back to UID and self results without an account cache', () => {
    const f = fixture();
    f.document.header = null;
    assert.equal(f.identity.getAccountIdentity().nickname, 'Kaspersky');
    f.document.parameters = [];
    f.document.resultName = f.element('[TAG] ResultPlayer');
    assert.equal(f.identity.getAccountIdentity().nickname, 'ResultPlayer');
    f.document.resultName = null;
    assert.equal(f.identity.getAccountIdentity(), null);
});

test('friends use the actual account key and clan while privacy is enabled', () => {
    const f = fixture();
    f.privacy.setupNicknamePrivacy();
    const friends = load('src/modules/customFriends.ts', f.moduleContext,
        '{ getCurrentNickname, getMyClanTag, getCustomCategories, setCustomCategory }');
    friends.setCustomCategory('Friend', 'purple');
    assert.equal(friends.getCurrentNickname(), 'Kaspersky');
    assert.equal(friends.getMyClanTag(), '[CLAN]');
    assert.equal(JSON.parse(f.storage.get('tankiCustomCategories_Kaspersky')).Friend, 'purple');
    assert.equal(f.storage.has('tankiCustomCategories_Hidden'), false);
    assert.equal(friends.getCustomCategories().Friend, 'purple');
});

test('history uses the actual nickname, including after switching accounts', () => {
    const f = fixture();
    f.privacy.setupNicknamePrivacy();
    const history = load('src/modules/battleHistory.ts', f.moduleContext,
        '{ updateNickname, getNickname: () => currentNickname }');
    assert.equal(history.updateNickname(), true);
    assert.equal(history.getNickname(), 'Kaspersky');
    assert.equal(f.storage.get('kasp_last_nickname'), 'Kaspersky');
    f.header.textContent = '[NEW] SecondPlayer';
    f.observers[0].callback();
    history.updateNickname();
    assert.equal(history.getNickname(), 'SecondPlayer');
});

test('disabled privacy leaves the UI alone and re-enabling uses the existing observer', () => {
    const f = fixture();
    f.setEnabled(false);
    f.privacy.setupNicknamePrivacy();
    assert.equal(f.html.classList.contains('kasp-hide-nickname'), false);
    assert.equal(f.observers.length, 0);
    f.setEnabled(true);
    f.privacy.setupNicknamePrivacy();
    f.html.classList.remove('kasp-hide-nickname');
    f.privacy.setupNicknamePrivacy();
    assert.equal(f.html.classList.contains('kasp-hide-nickname'), true);
    assert.equal(f.observers.length, 1);
});
