const runFeatureContext = require("../helpers/feature-context.cjs");
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const root = path.join(__dirname, "../../..");
const directory = 'src/modules/battleHistory/';
function loadModule(file, globals = {}, mocks = {}, cache = new Map()) {
    if (mocks[file]) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
    runFeatureContext(code, {
        module, URL, console, crypto: require('node:crypto').webcrypto,
        chrome: { runtime: { getURL: value => value } },
        ...globals,
        require(name) {
            const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) + '.ts';
            return loadModule(dependency, globals, mocks, cache);
        },
    });
    return module.exports;
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

function database(initial = [], { failAddAt = 0, manualCommit = false } = {}) {
    let records = plain(initial);
    const connections = [];
    const transactions = [];
    let adds = 0;
    const indexedDB = {
        open(name, version) {
            assert.equal(name, 'TankiBattlesDB');
            assert.equal(version, 5);
            const request = {};
            const db = {
                closed: false,
                close() { this.closed = true; },
                transaction(name, mode) {
                    assert.equal(name, 'battles');
                    const working = plain(records);
                    const requests = [];
                    const tx = {
                        mode, aborted: false,
                        abort() { this.aborted = true; this.onabort?.(); },
                        flushRequests() {
                            while (requests.length && !this.aborted) requests.shift()();
                        },
                        commit() {
                            this.flushRequests();
                            if (this.aborted) return;
                            records = working;
                            this.oncomplete?.();
                        },
                    };
                    function enqueue(operation) {
                        const request = {};
                        requests.push(() => {
                            try {
                                request.result = operation();
                                request.onsuccess?.();
                            } catch (error) {
                                request.error = error;
                                tx.error = error;
                                tx.onerror?.();
                                tx.abort();
                            }
                        });
                        return request;
                    }
                    const index = {
                        getAll: nickname => enqueue(() => plain(working.filter(b => b.userId === nickname))),
                        getAllKeys: nickname => enqueue(() => working.filter(b => b.userId === nickname).map(b => b.id)),
                        openCursor(nickname) {
                            const matches = working.filter(b => b.userId === nickname);
                            let offset = 0;
                            const request = {};
                            const advance = () => requests.push(() => {
                                const row = matches[offset++];
                                request.result = row ? {
                                    value: plain(row),
                                    update(value) { return enqueue(() => Object.assign(row, value)); },
                                    continue: advance,
                                } : null;
                                request.onsuccess?.();
                            });
                            advance();
                            return request;
                        },
                    };
                    const store = {
                        indexNames: { contains: name => name === 'userId' },
                        index(name) { assert.equal(name, 'userId'); return index; },
                        getAll: () => enqueue(() => plain(working)),
                        add: battle => enqueue(() => {
                            if (++adds === failAddAt) throw Error('write failed');
                            const id = battle.id ?? Math.max(0, ...working.map(b => b.id)) + 1;
                            if (working.some(b => b.id === id)) throw Error('duplicate id');
                            working.push({ ...plain(battle), id });
                            return id;
                        }),
                        delete: key => enqueue(() => {
                            const index = working.findIndex(b => b.id === key);
                            if (index >= 0) working.splice(index, 1);
                        }),
                    };
                    tx.objectStore = () => store;
                    transactions.push(tx);
                    if (!manualCommit) queueMicrotask(() => tx.commit());
                    return tx;
                },
            };
            connections.push(db);
            request.result = db;
            queueMicrotask(() => request.onsuccess());
            return request;
        },
    };
    const repository = loadModule(directory + 'repository.ts', { indexedDB, IDBKeyRange: { only: value => value } });
    return { repository, connections, transactions, get records() { return records; } };
}

test('ID-scoped reads survive renames, isolate reused nicknames and preserve unassigned legacy rows', async () => {
    const f = database([
        { id: 1, userId: '1001', nickname: 'Old', date: 10 },
        { id: 2, userId: '2002', nickname: 'Current', date: 20 },
        { id: 3, userId: '1001', nickname: 'Current', date: 30 },
        { id: 4, nickname: 'Current', date: 40 },
    ]);
    assert.deepEqual(plain(await f.repository.getAllBattles('1001')).map(b => b.id), [1, 3]);
    assert.deepEqual(plain(await f.repository.getAllBattles('2002')).map(b => b.id), [2]);
    assert.deepEqual(plain(await f.repository.getAllBattles(null)), []);
    assert.deepEqual(plain(await f.repository.getAllBattles('Current')), []);
    assert.equal(f.repository.mergeNicknameHistory, undefined);
    assert.equal(f.repository.getNicknameHistory, undefined);
    await f.repository.clearAccountHistory('1001');
    assert.deepEqual(f.records.map(b => b.id), [2, 4]);
    assert.ok(f.connections.every(db => db.closed));
});

test('writes resolve after commit and imports roll back all records on failure', async () => {
    const f = database([], { manualCommit: true });
    let completed = false;
    const pending = f.repository.addBattle({ userId: '1001', nickname: 'A' }).then(id => { completed = true; return id; });
    await tick();
    f.transactions[0].flushRequests();
    await tick();
    assert.equal(completed, false);
    assert.equal(f.connections[0].closed, false);
    f.transactions[0].commit();
    assert.equal(await pending, 1);
    assert.equal(f.connections[0].closed, true);

    const failed = database([{ id: 1, nickname: 'Existing' }], { failAddAt: 2 });
    await assert.rejects(failed.repository.addBattles([{ id: 10, userId: '1001', nickname: 'A' }, { id: 11, userId: '1001', nickname: 'B' }], '1001'), /write failed/);
    assert.deepEqual(failed.records, [{ id: 1, nickname: 'Existing' }]);
    assert.ok(failed.connections.every(db => db.closed));
    await failed.repository.addBattles([]);
    assert.equal(failed.connections.length, 1);
});

test('read failures propagate and synchronous request failures abort and close the database', async () => {
    const f = database();
    const originalOpen = f.repository;
    assert.deepEqual(plain(await originalOpen.getAllBattles('1001')), []);
    const db = {
        closed: false,
        close() { this.closed = true; },
        transaction() {
            const tx = { abort() { this.onabort(); }, objectStore() { throw Error('missing store'); } };
            return tx;
        },
    };
    const repository = loadModule(directory + 'repository.ts', {
        indexedDB: { open() {
            const request = { result: db };
            queueMicrotask(() => request.onsuccess());
            return request;
        } },
    });
    await assert.rejects(repository.getAllBattles('1001'), /missing store/);
    assert.equal(db.closed, true);
    const unavailable = loadModule(directory + 'repository.ts', {
        indexedDB: { open() {
            const request = { error: Error('database unavailable') };
            queueMicrotask(() => request.onerror());
            return request;
        } },
    });
    await assert.rejects(unavailable.getAllBattles('1001'), /database unavailable/);
});

test('import skips existing IDs and repeated file entries, preserving the first stored record', async () => {
    const f = database([{ id: 7, userId: '1001', nickname: 'Original' }]);
    const incoming = [
        { id: 7, userId: '1001', nickname: 'Do not overwrite' },
        { id: 9, userId: '1001', nickname: 'New' },
        { id: 9, userId: '1001', nickname: 'Duplicate' },
    ];
    assert.equal(await f.repository.addBattles(incoming, '1001'), 1);
    assert.deepEqual(f.records.map(b => b.nickname), ['Original', 'New']);
    assert.equal(f.records[1].battleId, 'legacy:9');
    assert.equal(await f.repository.addBattles(incoming, '1001'), 0);
    assert.equal(f.records.length, 2);
    assert.ok(f.transactions.every(tx => tx.mode === 'readwrite'));
});

test('portable battle IDs survive database key remapping and re-export, without affecting another owner', async () => {
    const f = database([{ id: 1, userId: '2002', nickname: 'Other account' }]);
    const backup = [{ id: 1, userId: '1001', nickname: 'Player' }];
    assert.equal(await f.repository.addBattles(backup, '1001'), 1);
    assert.equal(f.records[1].id, 2);
    const reexported = await f.repository.getAllBattles('1001');
    assert.equal(reexported[0].battleId, 'legacy:1');
    assert.equal(await f.repository.addBattles(reexported, '1001'), 0);
    assert.equal(await f.repository.addBattles(backup, '1001'), 0);
    assert.equal(f.records[0].nickname, 'Other account');
    await f.repository.addBattle({ userId: '1001', nickname: 'Captured' });
    const captured = (await f.repository.getAllBattles('1001')).find(b => b.nickname === 'Captured');
    assert.match(captured.battleId, /^[0-9a-f-]{36}$/);
    assert.equal(await f.repository.addBattles([{ ...captured, id: 99 }], '1001'), 0);
    assert.equal(f.records.length, 3);
});

function resultScreen({ secondTeam = false, mode = 'TDM', status = 'Victory', deaths = '5' } = {}) {
    function row(id, name, overrides = {}) {
        const columns = { 2: '9 999', 3: '1 234', 4: '10', 5: deaths, 6: '2.00', 7: '3 000', 8: '7', ...overrides };
        return {
            id,
            querySelector(selector) {
                if (selector.includes('col1')) return { textContent: name };
                if (selector.includes('rankIcon')) return { src: 'https://tankionline.com/rank.svg' };
                const column = selector.match(/col(\d)/)?.[1];
                return column ? { textContent: columns[column] ?? '' } : null;
            },
        };
    }
    const self = row('selfUserBg', '[CLAN] Player');
    const other = row('other', 'Enemy');
    const divider = row('teamRowSpace', '');
    const spacer = row('rowSpace', '');
    const tbody = { children: secondTeam ? [other, spacer, divider, self] : [self, spacer, divider, other] };
    for (const row of tbody.children) row.parentElement = tbody;
    const document = { querySelector(selector) {
        if (selector === '#selfUserBg') return self;
        if (selector === '.TableComponentStyle-tBody') return tbody;
        if (selector.includes('mapName')) return { textContent: '  Rio   ' + mode };
        if (selector.includes('resultText')) return { textContent: status };
        if (selector.includes('firstTeamAccount')) return { textContent: '1 000' };
        if (selector.includes('twoTeamAccount')) return { textContent: '900' };
        return null;
    } };
    return { document, self };
}

function captureFixture(options = {}, save = async () => 1) {
    const screen = resultScreen(options);
    const recovery = new Map();
    let nextRecovery = 0;
    let nickname = options.nickname ?? 'Player';
    const account = { getUserId: () => nickname === 'Unknown' ? null : nickname === 'Player' ? '1001' : '2002', getNickname: () => nickname, updateIdentity: () => true, setNickname: value => { nickname = value; } };
    const captureModule = loadModule(directory + 'capture.ts', {
        document: screen.document, window: { __kaspBattleKind: 'PRO' }, console: { error() {} },
        crypto: { randomUUID: () => `pending-${++nextRecovery}` },
        sessionStorage: { getItem: key => recovery.get(key) ?? null, setItem: (key, value) => recovery.set(key, value) },
    }, {
        [directory + 'repository.ts']: { addBattle: save },
        'src/modules/equipmentTracker.ts': { equipmentTracker: { get: () => ({ turret: 'turret', hull: 'hull' }) } },
    });
    return { ...screen, account, recovery, ...captureModule, capture: captureModule.createResultCapture(account) };
}

test('identity loss preserves one unassigned result, recovered only while its matching native result remains open', async () => {
    let writes = 0;
    const f = captureFixture({}, async () => { writes++; return 1; });
    f.account.setNickname('Unknown');
    await f.capture.capture(); await f.capture.capture();
    const pending = JSON.parse(f.recovery.get('kasp_history_unassigned_v1'));
    assert.equal(pending.length, 1); assert.equal(pending[0].owner, null);
    assert.ok(!('userId' in pending[0].result)); assert.equal(writes, 0);
    f.account.setNickname('Player'); await f.capture.capture();
    assert.equal(writes, 1); assert.deepEqual(JSON.parse(f.recovery.get('kasp_history_unassigned_v1')), []);
    f.account.setNickname('Unknown'); await f.capture.capture();
    assert.deepEqual(JSON.parse(f.recovery.get('kasp_history_unassigned_v1')), []);
});

test('capture preserves placement, second-team scores, stats, raw player names and equipment', () => {
    const f = captureFixture({ secondTeam: true });
    const result = f.readBattleResult(f.self, 'Player', '1001');
    assert.equal(result.map, 'Rio');
    assert.equal(result.mode, 'TDM');
    assert.equal(result.kind, 'PRO');
    assert.equal(result.top, '1');
    assert.equal(result.teamScoreMy, 900);
    assert.equal(result.teamScoreEnemy, 1000);
    assert.equal(result.reputation, 1234);
    assert.equal(result.crystals, 3000);
    assert.equal(result.kd, 2);
    assert.equal(result.turretIcon, 'turret');
    assert.equal(result.hullIcon, 'hull');
    assert.equal(result.players[1].name, '[CLAN] Player');
    assert.equal(result.players[1].isMe, true);
});

test('DM and empty result text use solo teams and zero deaths keep K/D equal to kills', () => {
    for (const options of [{ mode: 'DM' }, { mode: 'TDM', status: '' }]) {
        const f = captureFixture({ ...options, deaths: '0' });
        const result = f.readBattleResult(f.self, 'Player');
        assert.equal(result.status, 'DM');
        assert.equal(result.teamScoreMy, undefined);
        assert.equal(result.teamScoreEnemy, undefined);
        assert.equal(result.kd, 10);
        assert.equal(result.players.find(p => p.isMe).isEnemy, false);
        assert.equal(result.players.find(p => !p.isMe).isEnemy, true);
    }
    const { parseMapAndMode } = captureFixture();
    assert.deepEqual(plain(parseMapAndMode('  Rio  ctf ')), { map: 'Rio', mode: 'ctf' });
    assert.deepEqual(plain(parseMapAndMode('Rio')), { map: 'Rio', mode: 'MM' });
});

test('capture waits for complete cells, avoids duplicate saves, retries failed saves and resets for next result', async () => {
    let saves = 0;
    let fail = true;
    const f = captureFixture({}, async () => {
        saves++;
        if (fail) throw Error('save failed');
    });
    const originalQuery = f.self.querySelector;
    f.self.querySelector = selector => selector.includes('col3') ? { textContent: '' } : originalQuery(selector);
    await f.capture.capture();
    assert.equal(saves, 0);
    f.self.querySelector = originalQuery;
    await f.capture.capture();
    assert.equal(saves, 1);
    fail = false;
    await Promise.all([f.capture.capture(), f.capture.capture(), f.capture.capture()]);
    assert.equal(saves, 2);
    assert.equal(f.account.getNickname(), 'Player');
    f.capture.reset();
    await f.capture.capture();
    assert.equal(saves, 3);
});

test('a late failure from the previous result cannot unlock the current result', async () => {
    let rejectOld;
    let saves = 0;
    const f = captureFixture({}, () => ++saves === 1 ? new Promise((_, reject) => { rejectOld = reject; }) : Promise.resolve());
    const old = f.capture.capture();
    f.capture.reset();
    await f.capture.capture();
    rejectOld(Error('old transaction failed'));
    await old;
    await f.capture.capture();
    assert.equal(saves, 2);
});

test('capture waits for a real account ID and temporary identity loss does not duplicate a saved result', async () => {
    const saved = [];
    const f = captureFixture({}, async record => saved.push(plain(record)));
    let owner = null;
    f.account.getUserId = () => owner;
    await f.capture.capture();
    assert.equal(saved.length, 0);
    owner = '1001'; await f.capture.capture();
    assert.equal(saved.length, 1);
    assert.equal(saved[0].userId, '1001');
    owner = null; await f.capture.capture();
    owner = '1001'; await f.capture.capture();
    assert.equal(saved.length, 1);
    f.account.getNickname = () => 'Other';
    owner = '2002'; await f.capture.capture();
    assert.equal(saved.length, 1, 'a previous account result cannot be attributed to the new account');
});

test('import preserves portable identity from older numeric IDs but strips local destination keys', () => {
    const { parseHistoryImport } = loadModule(directory + 'validation.ts');
    const record = {
        id: 99, userId: '1001', nickname: 'Player', date: 1, status: 'Draw', map: 'Rio', mode: 'CP', top: '-',
        reputation: 0, kills: 0, deaths: 0, kd: 0, crystals: 0, stars: 0,
    };
    const imported = parseHistoryImport(JSON.stringify([record]), '1001');
    assert.equal(imported.length, 1);
    assert.equal(imported[0].id, undefined);
    assert.equal(imported[0].battleId, 'legacy:99');
    assert.deepEqual(plain(imported[0].players), []);
    for (const input of ['[]', '{}', 'broken', JSON.stringify([record, { ...record, kd: null }]),
        JSON.stringify([{ ...record, id: undefined }]), JSON.stringify([{ ...record, id: -1 }]),
        JSON.stringify([{ ...record, battleId: '' }]), JSON.stringify([{ ...record, battleId: {} }])]) {
        assert.throws(() => parseHistoryImport(input, '1001'));
    }
});

class Element {
    constructor(tag = 'div') {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.nodes = new Map();
        this.events = new Map();
        this.style = {
            setProperty(key, value, priority = '') { this[key] = value; this[key + ':priority'] = priority; },
            removeProperty(key) { delete this[key]; },
            getPropertyPriority(key) { return this[key + ':priority'] || ''; },
        };
        const classes = new Set();
        this.classes = classes;
        this.classList = {
            add: (...values) => values.forEach(value => classes.add(value)),
            remove: (...values) => values.forEach(value => classes.delete(value)),
            contains: value => classes.has(value),
        };
    }
    set className(value) {
        this.classes.clear();
        value.split(/\s+/).filter(Boolean).forEach(value => this.classes.add(value));
    }
    get className() { return [...this.classes].join(' '); }
    setAttribute(name, value) { (this.attributes ||= new Map()).set(name, value); }
    focus() { this.focused = true; }
    set innerHTML(value) {
        this.html = value;
        this.children = [];
        this.nodes.clear();
        if (value.includes('class="bh-card ')) {
            const visual = new Element();
            this.nodes.set('.bh-card', visual);
        }
        if (value.includes('id="bh-detailed-back"')) this.nodes.set('#bh-detailed-back', new Element('button'));
    }
    get innerHTML() { return this.html || ''; }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return this.text || ''; }
    querySelector(selector) {
        if (this.nodes.has(selector)) return this.nodes.get(selector);
        const match = node => selector.split(', ').some(part => part.startsWith('.') && node.classList.contains(part.slice(1)));
        return this.querySelectorAll(selector).find(match) || null;
    }
    querySelectorAll(selector) {
        const result = [];
        const visit = node => {
            if (selector.split(', ').some(part => part.startsWith('.') && node.classList.contains(part.slice(1)))) result.push(node);
            for (const child of [...node.children, ...node.nodes.values()]) visit(child);
        };
        for (const node of [...this.children, ...this.nodes.values()]) visit(node);
        return result;
    }
    appendChild(element) { element.parentElement = this; this.children.push(element); return element; }
    append(...elements) { elements.forEach(element => this.appendChild(element)); }
    remove() {
        this.removed = true;
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
    addEventListener(name, handler) {
        const handlers = this.events.get(name) || [];
        handlers.push(handler);
        this.events.set(name, handlers);
    }
    removeEventListener(name, handler) {
        this.events.set(name, (this.events.get(name) || []).filter(candidate => candidate !== handler));
    }
    async emit(name, event = {}) { await Promise.all((this.events.get(name) || []).map(handler => handler(event))); }
    click() { this.clicks = (this.clicks || 0) + 1; return this.emit('click'); }
    getBoundingClientRect() { return { bottom: 30, height: 42 }; }
}

function uiFixture() {
    const body = new Element('body');
    const document = new Element('document');
    const window = new Element('window');
    const selectors = new Map();
    const ids = new Map();
    document.body = body;
    document.documentElement = new Element('html');
    document.querySelector = selector => selector.split(', ').map(part => selectors.get(part) || body.querySelector(part)).find(Boolean) || null;
    document.querySelectorAll = () => [];
    document.getElementById = id => ids.get(id) || body.children.find(child => child.id === id && !child.removed) || null;
    document.createElement = tag => new Element(tag);
    window.setTimeout = callback => { callback(); return 0; };
    window.clearTimeout = () => {};
    window.getComputedStyle = element => ({ display: element.style.display || 'flex', rowGap: '8px' });
    return { document, window, selectors, ids, globals: { document, window, getComputedStyle: window.getComputedStyle } };
}

function viewFixture(getBattles, fetchOverride, globals = {}) {
    const ui = uiFixture();
    const list = new Element();
    const content = new Element();
    const panel = new Element();
    const pages = new Element();
    const total = new Element();
    content.nodes.set('.bh-left-panel', panel);
    panel.nodes.set('.bh-list', list);
    ui.selectors.set('.bh-list', list);
    ui.selectors.set('.custom-history-content', content);
    ui.ids.set('bh-page-list', pages);
    ui.ids.set('bh-total-battles', total);
    let nickname = 'Player';
    const account = { getUserId: () => nickname === 'Unknown' ? null : nickname === 'Player' ? '1001' : '2002', getNickname: () => nickname, updateIdentity: () => true };
    const state = { lang: 'EN' };
    ui.globals.fetch = fetchOverride || (async file => ({ ok: true, text: async () => fs.readFileSync(path.join(root, file), 'utf8') }));
    ui.globals.console = { error() {} };
    Object.assign(ui.globals, globals);
    const views = loadModule(directory + 'views.ts', ui.globals, {
        [directory + 'repository.ts']: { getAllBattles: getBattles },
        'src/core/state.ts': { state },
        'src/core/dataLoader.ts': { DataLoader: { getMapInfo: () => null, translateMap: value => value } },
    }).createHistoryViews(account);
    return { ...ui, ...views, list, content, panel, pages, total, state, setNickname(value) { nickname = value; } };
}

const match = (id, overrides = {}) => ({
    id, userId: '1001', nickname: 'Player', date: id, status: 'Victory', map: 'Map-' + id, mode: 'TDM', top: '1',
    reputation: 100, kills: 10, deaths: 5, kd: 2, crystals: 20, stars: 3,
    turretIcon: '', turretAugmentIcon: '', hullIcon: '', hullAugmentIcon: '',
    ...overrides,
});

test('lists sort newest first, keep 15 cards per page, clamp pages and preserve empty-state navigation', async () => {
    let battles = Array.from({ length: 36 }, (_, index) => match(index + 1));
    const f = viewFixture(async () => [...battles]);
    await f.renderBattleList();
    assert.equal(f.list.children.length, 15);
    assert.ok(f.list.children[0].innerHTML.includes('MAP-36'));
    assert.ok(f.list.children[14].innerHTML.includes('MAP-22'));
    assert.equal(f.total.textContent, '36');
    assert.equal(f.pages.children[0].disabled, true);
    await f.pages.children.at(-1).click();
    assert.ok(f.list.children[0].innerHTML.includes('MAP-21'));
    await f.renderBattleList(99);
    assert.equal(f.list.children.length, 6);
    assert.ok(f.list.children[0].innerHTML.includes('MAP-6'));
    assert.equal(f.pages.children.at(-1).disabled, true);
    battles = [];
    await f.renderBattleList(3);
    assert.ok(f.list.innerHTML.includes('No saved battles yet'));
    assert.equal(f.total.textContent, '0');
    assert.equal(f.pages.children[0].disabled, true);
    assert.equal(f.pages.children.at(-1).disabled, true);
});

test('a late page read and a previous account cannot overwrite the current list', async () => {
    const pending = [];
    const f = viewFixture(() => new Promise(resolve => pending.push(resolve)));
    const old = f.renderBattleList();
    const recent = f.renderBattleList();
    pending[1]([match(2)]);
    await recent;
    pending[0]([match(1)]);
    await old;
    assert.ok(f.list.children[0].innerHTML.includes('MAP-2'));
    const previousAccount = f.renderBattleList();
    f.setNickname('Other');
    f.reset();
    pending[2]([match(3)]);
    await previousAccount;
    assert.ok(f.list.children[0].innerHTML.includes('MAP-2'));
});

test('detail selection and back button keep the list, localization and literal NBSP intact', async () => {
    const f = viewFixture(async () => [match(1)]);
    f.state.lang = 'RU';
    await f.renderBattleList();
    const card = f.list.children[0];
    await card.click();
    const detail = f.content.children.at(-1);
    assert.equal(f.panel.style.display, 'none');
    assert.ok(detail.innerHTML.includes('‹ \u00A0 Все битвы'));
    assert.ok(!detail.innerHTML.includes('&amp;nbsp;'));
    await detail.querySelector('#bh-detailed-back').click();
    await tick();
    assert.equal(detail.removed, true);
    assert.equal(f.panel.style.display, 'flex');
    assert.equal(f.list.children[0], card);
});

test('initial and new-match animations remain distinct and account reset restarts initial animation', async () => {
    let battles = [match(1), match(2)];
    const f = viewFixture(async () => [...battles]);
    await f.renderBattleList(1, true);
    assert.ok(f.list.children[0].querySelector('.bh-card').classList.contains('bh-card--rise-in'));
    assert.equal(f.list.children[1].querySelector('.bh-card').style.animationDelay, '60ms');
    f.playPendingBattleListAnimation();
    assert.ok(!f.list.children[0].querySelector('.bh-card').classList.contains('bh-card--rise-in'));
    battles.push(match(3));
    await f.renderBattleList(1, true);
    assert.ok(f.list.children[0].querySelector('.bh-card').classList.contains('bh-card--new-in'));
    assert.ok(f.list.children[1].querySelector('.bh-card').classList.contains('bh-card--push-down'));
    assert.equal(f.list.children[1].querySelector('.bh-card').style['--bh-push-distance'], '-50px');
    f.reset();
    await f.renderBattleList(1, true);
    assert.ok(f.list.children[0].querySelector('.bh-card').classList.contains('bh-card--rise-in'));
});

function navigationFixture({ native = true } = {}) {
    const f = uiFixture();
    const footer = new Element('ul');
    const overlay = new Element();
    overlay.className = 'custom-history-overlay';
    overlay.style.display = 'none';
    const ownHeader = new Element();
    ownHeader.style.display = 'none';
    overlay.nodes.set('.custom-history-header', ownHeader);
    const background = new Element();
    background.style.setProperty('background', 'blue', 'important');
    background.style.visibility = 'collapse';
    f.document.documentElement.style.visibility = 'visible';
    f.document.body.style.visibility = 'inherit';
    f.document.body.append(background, overlay);
    const settings = new Element();
    settings.style.display = 'grid';
    const header = new Element();
    const title = new Element('span');
    title.textContent = 'SETTINGS';
    header.nodes.set('.BreadcrumbsComponentStyle-rootTitle > span', title);
    const back = new Element('button');
    f.selectors.set('.FooterComponentStyle-footer ul', footer);
    f.selectors.set('.custom-history-overlay', overlay);
    f.selectors.set('#app-root > .-container', background);
    if (native) {
        f.selectors.set('.BreadcrumbsComponentStyle-headerContainer', header);
        f.selectors.set('.BreadcrumbsComponentStyle-rootTitle > span', title);
        f.selectors.set('.BreadcrumbsComponentStyle-backButton', back);
        f.selectors.set('.SettingsComponentStyle-container', settings);
    }
    let nextTimer = 0;
    const timers = new Map();
    f.window.setTimeout = (callback, duration) => { timers.set(++nextTimer, { callback, duration }); return nextTimer; };
    f.window.clearTimeout = id => timers.delete(id);
    const runTimers = predicate => {
        for (const [id, timer] of [...timers]) {
            if (predicate(timer.duration)) { timers.delete(id); timer.callback(); }
        }
    };
    const observers = [];
    f.globals.MutationObserver = class {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() { this.disconnected = false; }
        disconnect() { this.disconnected = true; }
    };
    f.globals.requestAnimationFrame = callback => queueMicrotask(callback);
    f.globals.setTimeout = f.window.setTimeout;
    f.globals.console = { warn() {}, error() {} };
    const counts = { ensure: 0, list: 0, animation: 0 };
    const navigation = loadModule(directory + 'navigation.ts', f.globals, {
        'src/core/state.ts': { state: { lang: 'EN' } },
    }).createHistoryNavigation({
        ensureHistoryPage: async () => { counts.ensure++; },
        renderBattleList: async (page, animated) => { assert.equal(page, 1); assert.equal(animated, true); counts.list++; },
        playPendingBattleListAnimation: () => { counts.animation++; },
    });
    navigation.injectFooterButton();
    return { ...f, ...navigation, footer, overlay, ownHeader, background, settings, title, back,
        counts, observers, runTimers, timers,
        async open() {
            const pending = footer.children[0].click();
            await tick();
            runTimers(ms => ms >= 500 && ms <= 3000);
            await pending;
        },
    };
}

test('native opening keeps loader timing and restores visibility, settings and background on close', async () => {
    const f = navigationFixture();
    await f.open();
    assert.equal(f.overlay.style.display, 'flex');
    assert.equal(f.overlay.style.top, '30px');
    assert.equal(f.overlay.style.height, 'calc(100vh - 30px)');
    assert.equal(f.title.textContent, 'BATTLE HISTORY');
    assert.equal(f.settings.style.display, 'none');
    assert.equal(f.ownHeader.style.display, 'none');
    assert.equal(f.background.style.visibility, 'collapse');
    assert.equal(f.document.documentElement.style.visibility, 'visible');
    assert.equal(f.document.body.style.visibility, 'inherit');
    assert.deepEqual(f.counts, { ensure: 1, list: 1, animation: 1 });
    assert.equal(f.observers.filter(o => !o.disconnected).length, 1);
    const pageObserver = f.observers[0];
    const modal = new Element();
    modal.closeDialogMethod = () => { modal.closed = true; };
    f.ids.set('clear-confirm-overlay', modal);
    f.closeHistoryOverlay(f.overlay);
    assert.equal(modal.closed, true);
    assert.equal(f.overlay.style.display, 'none');
    assert.equal(f.settings.style.display, 'grid');
    assert.equal(f.background.style.background, 'blue');
    assert.equal(f.background.style.getPropertyPriority('background'), 'important');
    assert.equal(pageObserver.disconnected, true);
    assert.equal(f.window.events.get('resize').length, 0);
    assert.equal(f.back.clicks, 1);
});

test('header disappearance releases observers and account release does not navigate backwards', async () => {
    const f = navigationFixture();
    await f.open();
    f.selectors.delete('.BreadcrumbsComponentStyle-headerContainer');
    f.observers[0].callback();
    assert.equal(f.overlay.style.display, 'none');
    assert.equal(f.settings.style.display, 'grid');
    assert.equal(f.background.style.background, 'blue');
    assert.equal(f.observers[0].disconnected, true);
    assert.equal(f.back.clicks, undefined);
    f.release(f.overlay);
    assert.equal(f.back.clicks, undefined);
});

test('shop navigation hides history and return to settings invokes native back once', async () => {
    const f = navigationFixture();
    await f.open();
    f.title.textContent = 'SHOP';
    f.selectors.set('.NewShopCommonComponentStyle-commonContainer', new Element());
    f.observers[0].callback();
    assert.equal(f.overlay.style.display, 'none');
    assert.equal(f.settings.style.display, 'grid');
    assert.equal(f.observers[0].disconnected, true);
    const returnObserver = f.observers.find(o => !o.disconnected);
    f.selectors.delete('.NewShopCommonComponentStyle-commonContainer');
    f.title.textContent = 'SETTINGS';
    returnObserver.callback();
    f.runTimers(ms => ms === 150);
    assert.equal(f.back.clicks, 1);
    assert.equal(returnObserver.disconnected, true);
});

test('standalone fallback retains its close header and parallel footer clicks open only once', async () => {
    const f = navigationFixture({ native: false });
    const pending = f.open();
    await f.footer.children[0].click();
    await pending;
    assert.equal(f.counts.ensure, 1);
    assert.equal(f.overlay.style.display, 'flex');
    assert.equal(f.overlay.style.top, '0');
    assert.equal(f.overlay.style.height, '100vh');
    assert.equal(f.ownHeader.style.display, '');
    f.closeHistoryOverlay(f.overlay);
    assert.equal(f.overlay.style.display, 'none');
});

test('history shortcuts protect game input while dialogs and text fields keep their own keys', async () => {
    const f = navigationFixture({ native: false });
    await f.open();
    f.bindShortcuts();
    f.bindShortcuts();
    assert.equal(f.window.events.get('keydown').length, 1);
    let prevented = 0;
    const event = code => ({ code, key: code === 'Escape' ? 'Escape' : 'z',
        preventDefault() { prevented++; }, stopPropagation() {}, stopImmediatePropagation() {} });
    await f.document.emit('keydown', event('Digit1'));
    assert.equal(prevented, 1);
    f.document.activeElement = new Element('input');
    await f.document.emit('keydown', event('Space'));
    await f.window.emit('keydown', event('Escape'));
    assert.equal(prevented, 1);
    assert.equal(f.overlay.style.display, 'flex');
    f.document.activeElement = null;
    f.ids.set('clear-confirm-overlay', new Element());
    await f.window.emit('keydown', event('Escape'));
    assert.equal(f.overlay.style.display, 'flex');
    f.ids.clear();
    await f.window.emit('keydown', event('KeyZ'));
    assert.equal(f.overlay.style.display, 'none');
    assert.equal(prevented, 2);
});

test('failed templates are retried and simultaneous detail clicks show only the latest selection', async () => {
    let calls = 0;
    const f = viewFixture(async () => [match(1)], async file => ({
        ok: ++calls !== 1, status: 500,
        text: async () => fs.readFileSync(path.join(root, file), 'utf8'),
    }));
    await f.renderBattleList();
    assert.equal(f.list.children.length, 0);
    await f.renderBattleList();
    assert.equal(f.list.children.length, 1);
    const { historyTranslations } = loadModule(directory + 'localization.ts');
    await Promise.all([
        f.renderDetailedMatch(match(1), historyTranslations.EN, 'EN'),
        f.renderDetailedMatch(match(2), historyTranslations.EN, 'EN'),
    ]);
    assert.equal(f.content.children.length, 1);
    assert.ok(f.content.children[0].innerHTML.includes('Map-2'));
});

test('extension invalidation shows a localized reload notice and stops repeated history attempts', async () => {
    for (const lang of ['RU', 'EN']) {
        let reads = 0, templateAttempts = 0;
        const errors = [];
        const f = viewFixture(async () => { reads++; return [match(1)]; }, undefined, {
            console: { error: (...args) => errors.push(args) },
            chrome: { runtime: { getURL: file => {
                if (file.startsWith('templates/')) { templateAttempts++; throw Error('Extension context invalidated.'); }
                return file;
            } } },
        });
        f.state.lang = lang;
        const button = new Element('button');
        f.document.querySelectorAll = selector => selector === '.bh-control-btn' ? [button] : [];
        await f.renderBattleList();
        await f.renderBattleList();
        const dict = loadModule(directory + 'localization.ts').getHistoryDictionary(lang);
        await f.renderDetailedMatch(match(1), dict, lang);
        assert.equal(reads, 1);
        assert.equal(templateAttempts, 1);
        assert.equal(errors.length, 0);
        assert.equal(button.disabled, true);
        assert.equal(f.list.children[0].textContent, dict.contextExpired);
    }
});

test('an in-flight card render cannot overwrite the reload notice after extension invalidation', async () => {
    let finishCard;
    const f = viewFixture(async () => [match(1)], file => {
        if (file.includes('-card')) return new Promise(resolve => { finishCard = () => resolve({ ok: true,
            text: async () => fs.readFileSync(path.join(root, file), 'utf8') }); });
        return Promise.reject(Error('Extension context invalidated.'));
    });
    const pending = f.renderBattleList();
    await tick();
    const dict = loadModule(directory + 'localization.ts').getHistoryDictionary('EN');
    await f.renderDetailedMatch(match(1), dict, 'EN');
    finishCard(); await pending;
    assert.equal(f.list.children.length, 1);
    assert.equal(f.list.children[0].textContent, dict.contextExpired);
    assert.equal(f.content.children.length, 0);
});

test('pagination retains first/last pages and ellipses for long histories', async () => {
    const f = viewFixture(async () => Array.from({ length: 160 }, (_, index) => match(index + 1)));
    await f.renderBattleList(6);
    assert.deepEqual(f.pages.children.map(element => element.textContent), ['‹', '1', '…', '5', '6', '7', '…', '11', '›']);
});

function actionFixture(repository = {}) {
    const f = uiFixture();
    const created = [];
    f.document.createElement = tag => { const element = new Element(tag); created.push(element); return element; };
    const alerts = [];
    f.window.alert = message => alerts.push(message);
    const modals = [];
    const readers = [];
    const urls = [];
    class ExportURL extends URL {
        static createObjectURL(blob) { urls.push({ blob, url: 'blob:history' }); return 'blob:history'; }
        static revokeObjectURL(url) { urls.at(-1).revoked = url; }
    }
    let nickname = 'Player';
    const account = { getUserId: () => nickname === 'Unknown' ? null : nickname === 'Player' ? '1001' : '2002', getNickname: () => nickname, updateIdentity: () => true };
    let renders = 0;
    const state = { lang: 'EN' };
    const actions = loadModule(directory + 'actions.ts', {
        ...f.globals, URL: ExportURL, Blob, console: { error() {} },
        FileReader: class {
            constructor() { readers.push(this); }
            readAsText(file) { this.pending = this.onload({ target: { result: file.text } }); }
        },
    }, {
        [directory + 'repository.ts']: repository,
        'src/core/state.ts': { state },
        'src/core/modal.ts': { createKaspModal: async options => {
            if (f.ids.has(options.id)) return null;
            const modal = {
                body: new Element(), actions: new Element(), closeButton: new Element('button'),
                close() { modal.closed = true; f.ids.delete(options.id); },
            };
            f.ids.set(options.id, modal);
            modals.push(modal);
            return modal;
        } },
    }).createHistoryActions(account, async () => { renders++; });
    return { ...f, ...actions, created, alerts, modals, readers, urls, state,
        get renders() { return renders; }, setNickname(value) { nickname = value; },
        async import(text) {
            actions.importHistoryData();
            created.at(-1).onchange({ target: { files: [{ text }] } });
            await readers.at(-1).pending;
        },
    };
}

test('clear confirmation supports cancel and refreshes only after deletion completes', async () => {
    const deleted = [];
    let finishDelete;
    const f = actionFixture({ clearAccountHistory: nickname => {
        deleted.push(nickname);
        return new Promise(resolve => { finishDelete = resolve; });
    } });
    f.clearHistoryDb();
    await tick();
    await f.modals[0].actions.children[0].click();
    assert.deepEqual(deleted, []);
    f.clearHistoryDb();
    await tick();
    const confirm = f.modals[1].actions.children[1];
    await confirm.click();
    await confirm.click();
    assert.deepEqual(deleted, ['1001']);
    assert.equal(f.renders, 0);
    finishDelete();
    await tick();
    assert.equal(f.renders, 1);
});

test('nickname-linking UI is absent and an account switch cancels a pending clear', async () => {
    let deleted = 0;
    const f = actionFixture({ clearAccountHistory: async () => { deleted++; } });
    assert.equal(f.openLinkHistoryDialog, undefined);
    f.clearHistoryDb(); await tick();
    f.setNickname('Other');
    await f.modals[0].actions.children[1].click();
    assert.equal(deleted, 0);
});

test('import rejects invalid or foreign ownership and preserves previous nicknames of the same ID', async () => {
    const saved = [];
    const f = actionFixture({ addBattles: async battles => { saved.push(plain(battles)); return battles.length; } });
    await f.import(JSON.stringify([match(1), { bad: true }]));
    assert.equal(saved.length, 0);
    assert.equal(f.renders, 0);
    await f.import(JSON.stringify([match(1), match(2, { userId: '2002' })]));
    assert.equal(saved.length, 0, 'a mixed-account import must not write any records');
    await f.import(JSON.stringify([match(1, { userId: undefined })]));
    assert.equal(saved.length, 0, 'legacy ownership cannot be guessed');
    await f.import(JSON.stringify([match(1, { nickname: 'OldPlayer' })]));
    assert.equal(saved.length, 1);
    assert.equal(saved[0][0].nickname, 'OldPlayer');
    assert.equal(saved[0][0].id, undefined);
    assert.equal(f.renders, 1);
    assert.equal(f.alerts.at(-1), 'Imported battles: 1.');
    f.readers.at(-1).onerror();
    assert.ok(f.alerts.at(-1).includes('Could not import this file'));
});

test('export keeps JSON format and account ID in filename while releasing its Blob URL', async () => {
    const record = match(42);
    const f = actionFixture({ getAllBattles: async userId => { assert.equal(userId, '1001'); return [record]; } });
    await f.exportHistoryData();
    const link = f.created.at(-1);
    assert.match(link.download, /^Tanki_BattleHistory_1001_\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(link.clicks, 1);
    assert.deepEqual(JSON.parse(await f.urls[0].blob.text()), [record]);
    assert.equal(f.urls[0].revoked, 'blob:history');
    const empty = actionFixture({ getAllBattles: async () => [] });
    await empty.exportHistoryData();
    assert.equal(empty.urls.length, 0);
});

test('module preloads once, retries failed pages and replaces the overlay on account switch', async () => {
    const f = uiFixture();
    let nickname = 'Player';
    let enabled = false;
    let requests = 0;
    const storage = new Map([['kasp_last_nickname', 'Player']]);
    const { battleHistory } = loadModule('src/modules/battleHistory.ts', {
        ...f.globals, setTimeout: () => 0, console: { error() {} },
        localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
        fetch: async file => ({ ok: ++requests !== 1, status: 500,
            text: async () => fs.readFileSync(path.join(root, file), 'utf8') }),
    }, {
        'src/core/state.ts': { state: { lang: 'EN' } },
        'src/core/utils.ts': { utils: { getSetting: () => enabled } },
        'src/core/accountIdentity.ts': { getVerifiedAccount: () => ({ userId: nickname === 'Player' ? '1001' : '2002', nickname }) },
        'src/core/dataLoader.ts': { DataLoader: {} },
        'src/core/modal.ts': {},
        'src/modules/equipmentTracker.ts': {},
    });
    battleHistory();
    assert.equal(requests, 0);
    enabled = true;
    battleHistory();
    await tick();
    assert.equal(f.document.querySelector('.custom-history-overlay'), null);
    battleHistory();
    await tick();
    const first = f.document.querySelector('.custom-history-overlay');
    assert.ok(first);
    battleHistory();
    await tick();
    assert.equal(requests, 2);
    assert.equal(f.window.events.get('keydown').length, 1);
    nickname = 'Other';
    battleHistory();
    await tick();
    assert.equal(first.removed, true);
    assert.equal(storage.get('kasp_last_nickname'), 'Player', 'legacy storage remains untouched');
    assert.equal(requests, 3);
    assert.notEqual(f.document.querySelector('.custom-history-overlay'), first);
});

test('boot saves results over a retained canvas and resets capture before a direct next battle', async () => {
    const screen = resultScreen();
    let showingResults = false;
    const frames = [], observers = [], saved = [];
    const state = { lang: 'EN', currentScreen: 'loading', friendsMenuOpen: false, settingsOpen: false };
    const document = { documentElement: { lang: 'en' }, getElementById: () => null, addEventListener() {},
        querySelector(selector) {
            if (selector.includes('BattleComponentStyle-canvasContainer')) return {};
            return showingResults ? screen.document.querySelector(selector) : null;
        } };
    const globals = { document, window: { addEventListener() {}, setInterval() {}, setTimeout() {} },
        localStorage: { getItem: () => 'Player', setItem() {} },
        setTimeout() {}, fetch: () => new Promise(() => {}),
        performance: { now: () => 1000 }, requestAnimationFrame: fn => frames.push(fn),
        MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} } };
    const mocks = {
        'src/core/state.ts': { state },
        'src/core/utils.ts': { utils: { getLang: () => 'EN', getSetting: () => true } },
        'src/core/coreSettings.ts': { coreSettings: {} },
        'src/core/accountIdentity.ts': { getVerifiedAccount: () => ({ userId: '1001', nickname: 'Player' }) },
        'src/modules/equipmentTracker.ts': { equipmentTracker: { get: () => null } },
        [directory + 'repository.ts']: { addBattle: async battle => { saved.push(battle); } },
        [directory + 'views.ts']: { createHistoryViews: () => ({ reset() {}, renderBattleList() {}, playPendingBattleListAnimation() {} }) },
        [directory + 'actions.ts']: { createHistoryActions: () => ({}) },
        [directory + 'navigation.ts']: { createHistoryNavigation: () => ({ bindShortcuts() {}, injectFooterButton() {} }) },
    };
    const { battleHistory } = loadModule('src/modules/battleHistory.ts', globals, mocks);
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    mocks['src/modules.ts'] = { modules: new Proxy({}, { get: (_target, name) => name === 'battleHistory' ? battleHistory : noop }) };
    const { startBoot } = loadModule('src/boot.ts', globals, mocks);
    startBoot();
    const update = async () => { observers[0](); frames.splice(0).forEach(fn => fn()); await tick(); };
    await update(); assert.equal(state.currentScreen, 'battle');
    showingResults = true; await update();
    assert.equal(state.currentScreen, 'match_results', 'results take priority over the retained canvas');
    assert.equal(saved.length, 1);
    await update(); assert.equal(saved.length, 1, 'repeated DOM updates do not duplicate a result');
    showingResults = false; await update();
    assert.equal(state.currentScreen, 'battle');
    showingResults = true; await update();
    assert.equal(saved.length, 2, 'the next battle saves without a lobby visit');
});

test('boot updates TAB immediately on every mutation without waiting for a heavy pass', () => {
    let tabOpen = false;
    const frames = [], observers = [], calls = [];
    const state = { lang: 'EN', currentScreen: 'battle', friendsMenuOpen: false, settingsOpen: false };
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    const modules = new Proxy({}, { get: (_target, name) =>
        ['changeCounter', 'zeroResists', 'enemyWeapons', 'equipmentTracker'].includes(name)
            ? { sync: () => calls.push(name), onTick() {} } : noop });
    const globals = {
        document: { documentElement: { lang: 'en' }, getElementById: () => null,
            querySelector: selector => selector === '.BattleTabStatisticComponentStyle-container' && tabOpen ? {} : null },
        window: { addEventListener() {}, setInterval() {}, setTimeout() {} },
        performance: { now: () => 1000 }, requestAnimationFrame: fn => frames.push(fn),
        MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    };
    loadModule('src/boot.ts', globals, {
        'src/core/state.ts': { state },
        'src/core/utils.ts': { utils: { getLang: () => 'EN' } },
        'src/core/coreSettings.ts': { coreSettings: {} },
        'src/modules.ts': { modules },
    }).startBoot();
    observers[0]();
    assert.deepEqual(calls, [], 'closed TAB has no targeted updates');
    tabOpen = true;
    observers[0]();
    observers[0]();
    assert.deepEqual(calls, ['changeCounter', 'zeroResists', 'enemyWeapons', 'equipmentTracker',
        'changeCounter', 'zeroResists', 'enemyWeapons', 'equipmentTracker'], 'both mutations update before the queued frame');
    assert.equal(frames.length, 1, 'general work still coalesces into one frame');
    frames.shift()();
    assert.equal(calls.length, 8, 'the heavy pass does not repeat targeted TAB work');
    observers[0]();
    assert.equal(calls.length, 12, 'TAB remains immediate inside the heavy-pass throttle interval');
    tabOpen = false;
    observers[0]();
    assert.equal(calls.length, 12, 'closing TAB stops targeted updates');
});

function statisticsMutationFixture() {
    const { gameDOM } = loadModule('src/core/gameDOM.ts');
    const frames = [], observers = [], calls = [];
    const state = { lang: 'EN', currentScreen: 'battle', friendsMenuOpen: false, settingsOpen: false };
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    function element(selector = '', parentElement = null) {
        return { nodeType: 1, parentElement,
            querySelector: () => null,
            matches: selectors => selectors.split(',').some(value => value.trim() === selector),
            closest(selectors) {
                for (let node = this; node; node = node.parentElement) if (node.matches(selectors)) return node;
                return null;
            },
        };
    }
    const tab = element(gameDOM.statistics.container);
    const row = element('tr', tab);
    const globals = {
        document: { documentElement: { lang: 'en' }, getElementById: () => null,
            querySelector: selector => selector === gameDOM.statistics.container ? tab : null },
        window: { addEventListener() {}, setInterval() {}, setTimeout() {} },
        performance: { now: () => 1000 }, requestAnimationFrame: fn => frames.push(fn),
        MutationObserver: class {
            constructor(fn) { observers.push(fn); }
            observe() {}
            disconnect() { assert.fail('the shared observer must remain connected'); }
        },
    };
    loadModule('src/boot.ts', globals, {
        'src/core/state.ts': { state },
        'src/core/utils.ts': { utils: { getLang: () => 'EN' } },
        'src/core/coreSettings.ts': { coreSettings: {} },
        'src/modules.ts': { modules: new Proxy({}, { get: (_target, name) =>
            ['changeCounter', 'zeroResists', 'equipmentTracker'].includes(name)
                ? { sync: () => calls.push(name), onTick() {} } : noop }) },
    }).startBoot();
    return { frames, calls, element, tab, row,
        deliver: records => observers[0](records),
        mutation: (target, addedNodes = [], removedNodes = []) => ({ type: 'childList', target, addedNodes, removedNodes }),
    };
}

test('boot ignores TAB presentation insertions and cloned-content feedback without disconnecting or scheduling another pass', () => {
    const f = statisticsMutationFixture();
    const owned = ['.kasp-change-th', '.kasp-change-td', '.kasp-defence-th', '.kasp-compact-cell', '.kasp-zero-summary', '#kasp-tab-toggle-btn', '#kasp-enemy-weapons-btn'];
    const initial = f.mutation(f.row, [f.element('td', f.row)]);
    f.deliver([initial]);
    assert.equal(f.calls.length, 3);
    assert.equal(f.frames.length, 1);
    f.frames.shift()();
    for (const selector of owned) {
        const presentation = f.element(selector, f.row);
        f.deliver([f.mutation(f.row, [presentation])]);
        const icon = f.element('div', presentation);
        f.deliver([f.mutation(icon, [f.element('span', icon)], [f.element('span')])]);
        // Text-node mutation targets inherit ownership from their generated parent.
        f.deliver([f.mutation({ nodeType: 3, parentElement: icon }, [], [{ nodeType: 3 }])]);
    }
    assert.equal(f.calls.length, 3);
    assert.equal(f.frames.length, 0);
    const popup = f.element('#kasp-enemy-weapons-tooltip');
    f.deliver([f.mutation(popup, [f.element('div', popup)])]);
    assert.equal(f.calls.length, 3, 'popup content does not trigger another TAB pass');
    assert.equal(f.frames.length, 0);
    f.deliver([initial]);
    assert.equal(f.calls.length, 6, 'a later native update still synchronizes immediately');
    assert.equal(f.frames.length, 1);
});

test('boot retains mixed batches, native changes in summary wrappers and removal of generated cells', () => {
    const f = statisticsMutationFixture();
    const compact = f.element('.kasp-compact-cell', f.row);
    const owned = f.mutation(f.row, [compact]);
    const native = f.mutation(f.row, [f.element('td', f.row)]);
    const summary = f.element('.kasp-custom-summary-row', f.tab);
    const outside = f.element('div');
    const cases = [
        [owned, native],
        [f.mutation(f.row, [compact, f.element('td')])],
        [f.mutation(f.row, [], [compact])],
        [f.mutation(f.row, [compact], [f.element('td')])],
        [f.mutation(summary, [f.element('div', summary)])],
        [f.mutation(f.tab, [summary])],
        [{ type: 'characterData', target: { nodeType: 3, parentElement: f.row } }],
        [{ type: 'attributes', target: f.row }],
    ];
    cases.forEach((records, index) => {
        f.deliver(records);
        assert.equal(f.calls.length, (index + 1) * 3, `native evidence must not be skipped: case ${index}`);
    });
    assert.equal(f.frames.length, 1, 'general work remains coalesced');
    const before = f.calls.length;
    f.deliver([f.mutation(outside, [f.element('.kasp-zero-summary', outside)])]);
    assert.equal(f.calls.length, before, 'unrelated page changes do not rescan the open TAB');
});

test('open TAB ignores timer/score updates and synchronizes only a changed resistance cell', () => {
    const f = statisticsMutationFixture();
    const timer = f.element('div');
    for (let i = 0; i < 500; i++) f.deliver([f.mutation(timer, [{ nodeType: 3 }], [{ nodeType: 3 }])]);
    const score = f.element('.BattleTabStatisticComponentStyle-scoreCell', f.row);
    f.deliver([f.mutation(score, [{ nodeType: 3 }], [{ nodeType: 3 }])]);
    assert.deepEqual(f.calls, [], 'neither unrelated timers nor scores need TAB equipment/style reads');
    const resistance = f.element('.BattleTabStatisticComponentStyle-resistanceModuleCell', f.row);
    f.deliver([f.mutation(resistance, [f.element('div', resistance)])]);
    assert.deepEqual(f.calls, ['zeroResists']);
    f.deliver([f.mutation(f.row, [f.element('td', f.row)])]);
    assert.deepEqual(f.calls, ['zeroResists', 'changeCounter', 'zeroResists', 'equipmentTracker']);
});

test('boot refreshes quick upgrade buttons immediately as native garage controls mount or change', () => {
    let panelPresent = false, calls = 0;
    const frames = [], observers = [];
    const state = { lang: 'EN', currentScreen: 'garage', friendsMenuOpen: false, settingsOpen: false };
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    const globals = {
        document: { documentElement: { lang: 'en' }, getElementById: () => null,
            querySelector: selector => panelPresent && selector === '.TanksPartBaseComponentStyle-buttonsContainer' ? {} : null },
        window: { addEventListener() {}, setInterval() {}, setTimeout() {} },
        performance: { now: () => 1000 }, requestAnimationFrame: fn => frames.push(fn),
        MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    };
    loadModule('src/boot.ts', globals, {
        'src/core/state.ts': { state },
        'src/core/utils.ts': { utils: { getLang: () => 'EN' } },
        'src/core/coreSettings.ts': { coreSettings: {} },
        'src/modules.ts': { modules: new Proxy({}, { get: (_target, name) => name === 'autoUpgrade' ? () => { calls++; } : noop }) },
    }).startBoot();
    observers[0]();
    assert.equal(calls, 0, 'no targeted update before native controls exist');
    panelPresent = true;
    observers[0](); observers[0]();
    assert.equal(calls, 2, 'native mounting and subsequent changes run before the queued frame');
    assert.equal(frames.length, 1, 'other work remains coalesced');
    frames.shift()();
    const afterHeavyPass = calls;
    observers[0]();
    assert.equal(calls, afterHeavyPass + 1, 'quick buttons bypass the 150 ms heavy-pass throttle');
    panelPresent = false;
    observers[0]();
    assert.equal(calls, afterHeavyPass + 1, 'targeted updates stop when the native panel disappears');
});

test('boot styles garage actions over a retained battle canvas and resumes battle after closing', () => {
    let garageOpen = false;
    const frames = [], observers = [], classes = new Set(), iconStyles = new Map();
    const state = { lang: 'EN', currentScreen: 'battle', friendsMenuOpen: false, settingsOpen: false };
    const icon = { style: { setProperty: (key, value) => iconStyles.set(key, value),
        getPropertyValue: key => iconStyles.get(key) || '', getPropertyPriority: () => '', removeProperty: key => iconStyles.delete(key) } };
    const button = {
        textContent: 'Завершено', innerHTML: '<span>Завершено</span>', children: [{}],
        classList: { contains: name => classes.has(name),
            add: (...names) => names.forEach(name => classes.add(name)),
            remove: (...names) => names.forEach(name => classes.delete(name)) },
        querySelector: selector => selector.includes('-backgroundImage') ? icon : null,
        closest: () => null,
    };
    const document = {
        documentElement: { lang: 'en' }, getElementById: () => null, addEventListener() {},
        querySelector(selector) {
            if (selector.includes('BattleComponentStyle-canvasContainer')) return {};
            if (garageOpen && selector.includes('GarageCommonStyle-positionContent')) return {};
            return null;
        },
        querySelectorAll: selector => garageOpen && selector.includes('GarageCommonStyle-bigActionButton') ? [button] : [],
    };
    const globals = { document, window: { addEventListener() {}, setInterval() {}, setTimeout() {} },
        performance: { now: () => 1000 }, requestAnimationFrame: fn => frames.push(fn),
        MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} } };
    const mocks = {
        'src/core/state.ts': { state },
        'src/core/utils.ts': { utils: { getLang: () => 'EN' } },
        'src/core/coreSettings.ts': { coreSettings: {} },
    };
    const { garageButtons } = loadModule('src/modules/garageButtons.ts', globals, mocks);
    const noop = Object.assign(() => {}, { onTick() {}, sync() {}, setup() {} });
    mocks['src/modules.ts'] = { modules: new Proxy({}, { get: (_target, name) => name === 'garageButtons' ? garageButtons : noop }) };
    loadModule('src/boot.ts', globals, mocks).startBoot();
    const update = () => { observers[0](); frames.splice(0).forEach(fn => fn()); };
    update();
    assert.equal(state.currentScreen, 'battle');
    garageOpen = true;
    update();
    assert.equal(state.currentScreen, 'garage');
    assert.ok(classes.has('kasp-disabled-btn'), 'completed actions receive their disabled styling');
    assert.ok(iconStyles.get('mask-image').includes('max_level'), 'the upgrade icon is restored');
    garageOpen = false;
    update();
    assert.equal(state.currentScreen, 'battle');
});
