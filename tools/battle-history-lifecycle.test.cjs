const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const root = path.join(__dirname, '..');
const directory = 'src/modules/battleHistory/';
function loadModule(file, globals = {}, mocks = {}, cache = new Map()) {
    if (mocks[file]) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
    vm.runInNewContext(code, {
        module, URL, console,
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

// A controlled IndexedDB adapter: requests and commit are separate, and abort discards writes.
function database(initial = [], { failAddAt = 0, manualCommit = false } = {}) {
    let records = plain(initial);
    const connections = [];
    const transactions = [];
    let adds = 0;
    const indexedDB = {
        open(name, version) {
            assert.equal(name, 'TankiBattlesDB');
            assert.equal(version, 4);
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
                        getAll: nickname => enqueue(() => plain(working.filter(b => b.nickname === nickname))),
                        getAllKeys: nickname => enqueue(() => working.filter(b => b.nickname === nickname).map(b => b.id)),
                        openCursor(nickname) {
                            const matches = working.filter(b => b.nickname === nickname);
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
                        indexNames: { contains: name => name === 'nickname' },
                        index(name) { assert.equal(name, 'nickname'); return index; },
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

test('database reads are account-scoped; clear and link preserve other accounts and record IDs', async () => {
    const f = database([
        { id: 1, nickname: 'A', date: 10 }, { id: 2, nickname: 'B', date: 20 },
        { id: 3, nickname: 'A', date: 30 }, { id: 4, nickname: 'C', date: 40 },
    ]);
    assert.deepEqual(plain(await f.repository.getAllBattles('A')).map(b => b.id), [1, 3]);
    assert.deepEqual(plain(await f.repository.getNicknameHistory()), [
        { nickname: 'A', count: 2 }, { nickname: 'B', count: 1 }, { nickname: 'C', count: 1 },
    ]);
    assert.equal(await f.repository.mergeNicknameHistory('A', 'B'), 2);
    assert.deepEqual(plain(await f.repository.getAllBattles('B')).map(b => b.id), [1, 2, 3]);
    assert.deepEqual(plain(await f.repository.getAllBattles('A')), []);
    await f.repository.clearNicknameHistory('B');
    assert.deepEqual(f.records, [{ id: 4, nickname: 'C', date: 40 }]);
    assert.ok(f.connections.every(db => db.closed));
});

test('writes resolve after commit and imports roll back all records on failure', async () => {
    const f = database([], { manualCommit: true });
    let completed = false;
    const pending = f.repository.addBattle({ nickname: 'A' }).then(id => { completed = true; return id; });
    await tick();
    f.transactions[0].flushRequests();
    await tick();
    assert.equal(completed, false);
    assert.equal(f.connections[0].closed, false);
    f.transactions[0].commit();
    assert.equal(await pending, 1);
    assert.equal(f.connections[0].closed, true);

    const failed = database([{ id: 1, nickname: 'Existing' }], { failAddAt: 2 });
    await assert.rejects(failed.repository.addBattles([{ nickname: 'A' }, { nickname: 'B' }]), /write failed/);
    assert.deepEqual(failed.records, [{ id: 1, nickname: 'Existing' }]);
    assert.ok(failed.connections.every(db => db.closed));
    await failed.repository.addBattles([]);
    assert.equal(failed.connections.length, 1);
});

test('read failures propagate and synchronous request failures abort and close the database', async () => {
    const f = database();
    const originalOpen = f.repository;
    assert.deepEqual(plain(await originalOpen.getAllBattles('A')), []);
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
    await assert.rejects(repository.getAllBattles('A'), /missing store/);
    assert.equal(db.closed, true);
    const unavailable = loadModule(directory + 'repository.ts', {
        indexedDB: { open() {
            const request = { error: Error('database unavailable') };
            queueMicrotask(() => request.onerror());
            return request;
        } },
    });
    await assert.rejects(unavailable.getAllBattles('A'), /database unavailable/);
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
    let nickname = options.nickname ?? 'Player';
    const account = { getNickname: () => nickname, updateNickname: () => true, setNickname: value => { nickname = value; } };
    const captureModule = loadModule(directory + 'capture.ts', {
        document: screen.document, window: { __kaspBattleKind: 'PRO' }, console: { error() {} },
    }, {
        [directory + 'repository.ts']: { addBattle: save },
        'src/modules/equipmentTracker.ts': { equipmentTracker: { get: () => ({ turret: 'turret', hull: 'hull' }) } },
    });
    return { ...screen, account, ...captureModule, capture: captureModule.createResultCapture(account) };
}

test('capture preserves placement, second-team scores, stats, raw player names and equipment', () => {
    const f = captureFixture({ secondTeam: true });
    const result = f.readBattleResult(f.self, 'Player');
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
    const f = captureFixture({ nickname: 'Unknown' }, async () => {
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

test('import validates the entire file and strips original database IDs', () => {
    const { parseHistoryImport } = loadModule(directory + 'validation.ts');
    const record = {
        id: 99, nickname: 'Player', date: 1, status: 'Draw', map: 'Rio', mode: 'CP', top: '-',
        reputation: 0, kills: 0, deaths: 0, kd: 0, crystals: 0, stars: 0,
    };
    const imported = parseHistoryImport(JSON.stringify([record]));
    assert.equal(imported.length, 1);
    assert.equal(imported[0].id, undefined);
    assert.deepEqual(plain(imported[0].players), []);
    for (const input of ['[]', '{}', 'broken', JSON.stringify([record, { ...record, kd: null }])]) {
        assert.throws(() => parseHistoryImport(input));
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

function viewFixture(getBattles, fetchOverride) {
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
    const account = { getNickname: () => nickname, updateNickname: () => true };
    const state = { lang: 'EN' };
    ui.globals.fetch = fetchOverride || (async file => ({ ok: true, text: async () => fs.readFileSync(path.join(root, file), 'utf8') }));
    ui.globals.console = { error() {} };
    const views = loadModule(directory + 'views.ts', ui.globals, {
        [directory + 'repository.ts']: { getAllBattles: getBattles },
        'src/core/state.ts': { state },
        'src/core/dataLoader.ts': { DataLoader: { getMapInfo: () => null, translateMap: value => value } },
    }).createHistoryViews(account);
    return { ...ui, ...views, list, content, panel, pages, total, state, setNickname(value) { nickname = value; } };
}

const match = (id, overrides = {}) => ({
    id, nickname: 'Player', date: id, status: 'Victory', map: 'Map-' + id, mode: 'TDM', top: '1',
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
    f.ids.set('link-history-overlay', modal);
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
    const account = { getNickname: () => nickname, updateNickname: () => true };
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
    const f = actionFixture({ clearNicknameHistory: nickname => {
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
    assert.deepEqual(deleted, ['Player']);
    assert.equal(f.renders, 0);
    finishDelete();
    await tick();
    assert.equal(f.renders, 1);
});

test('link dialog filters current/unknown accounts and locks repeated confirmation until merge finishes', async () => {
    let finishMerge;
    const moved = [];
    const f = actionFixture({
        getNicknameHistory: async () => [
            { nickname: 'Player', count: 2 }, { nickname: 'Unknown', count: 1 }, { nickname: 'OldPlayer', count: 3 },
        ],
        mergeNicknameHistory: (source, target) => {
            moved.push([source, target]);
            return new Promise(resolve => { finishMerge = resolve; });
        },
    });
    await f.openLinkHistoryDialog();
    const modal = f.modals[0];
    const select = modal.body.children[2].children[1];
    assert.deepEqual(select.children.map(option => option.value), ['', 'OldPlayer']);
    assert.equal(modal.actions.children[1].disabled, true);
    select.value = 'OldPlayer';
    await select.emit('change');
    const merging = modal.actions.children[1].click();
    await modal.actions.children[1].click();
    assert.deepEqual(moved, [['OldPlayer', 'Player']]);
    assert.equal(modal.actions.children[0].disabled, true);
    assert.equal(f.renders, 0);
    finishMerge(3);
    await merging;
    assert.equal(modal.closed, true);
    assert.equal(f.renders, 1);
    assert.deepEqual(f.alerts, ['Histories linked. Battles added: 3.']);
});

test('link handles no available history, unknown accounts and account changes during selection', async () => {
    let merges = 0;
    const f = actionFixture({ getNicknameHistory: async () => [], mergeNicknameHistory: async () => { merges++; } });
    await f.openLinkHistoryDialog();
    assert.equal(f.modals[0].actions.children[1].hidden, true);
    f.modals[0].close();
    f.setNickname('Unknown');
    await f.openLinkHistoryDialog();
    assert.equal(f.modals.length, 1);
    assert.deepEqual(f.alerts, ['Could not detect the current nickname.']);
    f.setNickname('Player');
    await f.openLinkHistoryDialog();
    const select = f.modals[1].body.children[2].children[1];
    select.value = 'Old';
    f.setNickname('Other');
    await f.modals[1].actions.children[1].click();
    assert.equal(merges, 0);
});

test('import rejects mixed invalid records before saving and preserves valid foreign account histories', async () => {
    const saved = [];
    const f = actionFixture({ addBattles: async battles => { saved.push(plain(battles)); } });
    await f.import(JSON.stringify([match(1), { bad: true }]));
    assert.equal(saved.length, 0);
    assert.equal(f.renders, 0);
    await f.import(JSON.stringify([match(1, { nickname: 'OldPlayer' })]));
    assert.equal(saved.length, 1);
    assert.equal(saved[0][0].nickname, 'OldPlayer');
    assert.equal(saved[0][0].id, undefined);
    assert.equal(f.renders, 1);
    assert.equal(f.alerts.at(-1), 'Imported battles: 1.');
    f.readers.at(-1).onerror();
    assert.ok(f.alerts.at(-1).includes('Could not import this file'));
});

test('export keeps JSON format and selected nickname in filename while releasing its Blob URL', async () => {
    const record = match(42);
    const f = actionFixture({ getAllBattles: async nickname => { assert.equal(nickname, 'Player'); return [record]; } });
    await f.exportHistoryData();
    const link = f.created.at(-1);
    assert.match(link.download, /^Tanki_BattleHistory_Player_\d{4}-\d{2}-\d{2}\.json$/);
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
        'src/core/accountIdentity.ts': { getAccountIdentity: () => ({ nickname }) },
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
    assert.equal(storage.get('kasp_last_nickname'), 'Other');
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
        'src/core/accountIdentity.ts': { getAccountIdentity: () => ({ nickname: 'Player' }) },
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

test('boot styles garage actions over a retained battle canvas and resumes battle after closing', () => {
    let garageOpen = false;
    const frames = [], observers = [], classes = new Set(), iconStyles = new Map();
    const state = { lang: 'EN', currentScreen: 'battle', friendsMenuOpen: false, settingsOpen: false };
    const icon = { style: { setProperty: (key, value) => iconStyles.set(key, value) } };
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
