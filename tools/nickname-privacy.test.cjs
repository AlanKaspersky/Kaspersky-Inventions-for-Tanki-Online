const runFeatureContext = require('./test-feature-context.cjs');
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
            if (dependency === 'src/core/gameDOM.ts' || dependency === 'src/core/accountId.ts') return load(dependency, {});
            if (dependency.startsWith('src/modules/battleHistory/')) return load(dependency, context);
            return context.require(name.replace('../../core/', '../core/').replace('../equipmentTracker', './equipmentTracker'));
        },
    };
    runFeatureContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, sandbox);
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
    let identityListener;
    const identityWindow = { location: { origin: 'https://tankionline.com' }, postMessage() {},
        addEventListener(type, callback) { identityListener = callback; } };
    const identity = load('src/core/accountIdentity.ts', { document, window: identityWindow });
    identity.setupAccountIdentity();
    const setAccount = (userId, nickname, players = [{ userId: '2001', nickname: 'Friend' }]) => identityListener({ source: identityWindow, origin: identityWindow.location.origin,
        data: { type: 'kasp:account-identity', snapshot: { account: { userId, nickname, clanTag: '[CLAN]' }, players } } });
    setAccount('1001', 'Kaspersky');
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
        identity, privacy, moduleContext, setAccount, get writes() { return writes; }, setEnabled: value => { enabled = value; } };
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
        '{ getCurrentUserId, getMyClanTag, getCustomCategories, setCustomCategory }');
    friends.setCustomCategory('1001', '2001', 'purple');
    assert.equal(friends.getCurrentUserId(), '1001');
    assert.equal(friends.getMyClanTag(), '[CLAN]');
    assert.equal(JSON.parse(f.storage.get('tankiCustomCategories_uid_1001'))['2001'], 'purple');
    assert.equal(f.storage.has('tankiCustomCategories_Hidden'), false);
    assert.equal(friends.getCustomCategories()['2001'], 'purple');
});

test('friend labels use IDs, retain legacy data separately, and isolate accounts with the same nickname', () => {
    const f = fixture();
    const legacy = JSON.stringify({ Friend: 'red' });
    f.storage.set('tankiCustomCategories_Kaspersky', legacy);
    const friends = load('src/modules/customFriends.ts', f.moduleContext,
        '{ getCurrentUserId, getCustomCategories, setCustomCategory }');
    assert.deepEqual(Object.keys(friends.getCustomCategories()), []);
    friends.setCustomCategory('1001', '2001', 'purple');
    f.setAccount('1002', 'Kaspersky');
    assert.deepEqual(Object.keys(friends.getCustomCategories()), []);
    friends.setCustomCategory('1001', '2001', 'red');
    assert.equal(f.storage.has('tankiCustomCategories_uid_1002'), false, 'stale menu cannot write for another owner');
    f.setAccount('1001', 'Kaspersky');
    assert.equal(friends.getCustomCategories()['2001'], 'purple');
    assert.equal(f.storage.get('tankiCustomCategories_Kaspersky'), legacy);
});

function friendElement(tag = 'div', className = '', text = '') {
    const element = { tag, className, text, dataset: {}, style: {}, children: [], parent: null,
        get textContent() { return this.text + this.children.map(child => child.textContent).join(''); },
        get innerText() { return this.textContent; },
        appendChild(child) { this.children.push(child); child.parent = this; return child; },
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; },
        querySelectorAll(selector) {
            const matches = child => selector === 'span' ? child.tag === 'span' : selector.startsWith('.') && child.className.split(/\s+/).includes(selector.slice(1));
            return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
        },
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
        getBoundingClientRect() { return { top: 0, bottom: 100 }; },
    };
    element.classList = {
        contains: name => element.className.split(/\s+/).includes(name),
        add: name => { if (!element.classList.contains(name)) element.className += ' ' + name; },
        remove: name => { element.className = element.className.split(/\s+/).filter(value => value !== name).join(' '); },
    };
    return element;
}

function friendsMenuFixture(label = '[EIite] Friend') {
    const f = fixture();
    f.document.createElement = tag => friendElement(tag);
    const menu = friendElement('div', 'ContextMenuStyle-menu');
    const rank = friendElement('div', 'ContextMenuStyle-menuItemRank');
    const span = friendElement('span', 'ksc-116 -whiteSpaceNoWrap -whiteSpaceNoWrap', label);
    rank.appendChild(span); menu.appendChild(rank);
    const api = load('src/modules/customFriends.ts', f.moduleContext,
        '{ injectCategoriesMenu, updateCardBadge, applyFilter }');
    return { ...f, api, menu, rank, span, row: () => menu.querySelector('.custom-category-row') };
}

test('friend context-menu buttons resolve clan-prefixed and plain names to the same user ID', () => {
    for (const label of ['[EIite] Friend', '[EIite]Friend', '[EIite]\u00a0Friend', 'Friend']) {
        const f = friendsMenuFixture(label);
        f.api.injectCategoriesMenu(f.menu);
        assert.equal(f.row()?.children.length, 3, label);
        assert.equal(f.menu.dataset.customCategoriesInjected, '1001:2001');
        const row = f.row();
        f.api.injectCategoriesMenu(f.menu); assert.equal(f.row(), row, 'do not duplicate existing buttons');
        row.children[0].onclick({ stopPropagation() {} });
        assert.equal(JSON.parse(f.storage.get('tankiCustomCategories_uid_1001'))['2001'], 'purple');
        assert.equal(row.children[0].classList.contains('active'), true);
        row.children[0].onclick({ stopPropagation() {} });
        assert.deepEqual(JSON.parse(f.storage.get('tankiCustomCategories_uid_1001')), {});
    }
});

test('friend badges and color filters resolve clan-prefixed card labels by ID', () => {
    const f = friendsMenuFixture();
    f.storage.set('tankiCustomCategories_uid_1001', JSON.stringify({ '2001': 'purple' }));
    const list = friendElement('div', 'FriendListComponentStyle-scrollCommunity');
    const card = friendElement('div', 'FriendListComponentStyle-blockList');
    card.appendChild(friendElement('span', '-whiteSpaceNoWrap', '[EIite] Friend'));
    list.appendChild(card);
    f.api.applyFilter(list, 'purple');
    assert.equal(card.style.display, '');
    assert.equal(card.querySelector('.custom-rarity-badge')?.className, 'custom-rarity-badge rarity-purple');
    f.api.applyFilter(list, 'red'); assert.equal(card.style.display, 'none');
    f.api.applyFilter(list, 'all'); assert.equal(card.style.display, '');
});

test('a reused friend menu rechecks its current header and account before writing a label', () => {
    const f = friendsMenuFixture();
    f.setAccount('1001', 'Kaspersky', [{ userId: '2001', nickname: 'Friend' }, { userId: '2002', nickname: 'Other' }]);
    f.api.injectCategoriesMenu(f.menu);
    const oldButton = f.row().children[0];
    f.rank.remove();
    const newRank = friendElement('div', 'ContextMenuStyle-menuItemRank');
    newRank.appendChild(friendElement('span', '-whiteSpaceNoWrap', '[NEW] Other'));
    f.menu.appendChild(newRank);
    oldButton.onclick({ stopPropagation() {} });
    assert.equal(f.storage.has('tankiCustomCategories_uid_1001'), false, 'stale button cannot mark the previous friend');
    f.api.injectCategoriesMenu(f.menu);
    assert.equal(f.menu.dataset.customCategoriesInjected, '1001:2002');
    const currentButton = f.row().children[0];
    currentButton.onclick({ stopPropagation() {} });
    assert.equal(JSON.parse(f.storage.get('tankiCustomCategories_uid_1001'))['2002'], 'purple');
    f.setAccount('1002', 'Kaspersky');
    currentButton.onclick({ stopPropagation() {} });
    assert.equal(f.storage.has('tankiCustomCategories_uid_1002'), false);
});

test('friend menu does not create nickname-keyed labels when the native player ID is unavailable', () => {
    const f = friendsMenuFixture('[EIite] Unknown');
    f.api.injectCategoriesMenu(f.menu);
    assert.equal(f.row(), null);
    assert.equal(f.storage.size, 0);
});

test('history uses the actual nickname, including after switching accounts', () => {
    const f = fixture();
    f.privacy.setupNicknamePrivacy();
    const history = load('src/modules/battleHistory.ts', f.moduleContext,
        '{ updateIdentity, getNickname: () => currentNickname }');
    assert.equal(history.updateIdentity(), true);
    assert.equal(history.getNickname(), 'Kaspersky');
    assert.equal(f.storage.has('kasp_last_nickname'), false);
    f.header.textContent = '[NEW] SecondPlayer';
    f.setAccount('1002', 'SecondPlayer');
    f.observers[0].callback();
    history.updateIdentity();
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
