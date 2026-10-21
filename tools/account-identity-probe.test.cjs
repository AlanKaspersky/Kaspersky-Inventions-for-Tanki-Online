const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const ids = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/accountId.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: ids });
const nativeCode = transformSync(fs.readFileSync('src/core/accountIdentityNative.ts', 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'es2020',
}).code;
function loadNative(context = {}) {
    const loaded = { exports: {} };
    const fixture = { module: loaded, require: () => ids.exports, performance: { now: () => 0 }, ...context };
    runFeatureContext(nativeCode, fixture);
    return { ...loaded.exports, runtime: fixture.require('./featureRuntime') };
}
const { normalizeAccountId, inspectIdentityStores, installAccountIdentityNative, createNativeAccountReader } = loadNative();
function drain(reader) {
    let slices = 0;
    while (reader.pending()) { assert.ok(++slices < 30000, 'discovery must terminate'); reader.step(); }
    return reader.snapshot();
}
function readNativeAccountSnapshot(store) { return drain(createNativeAccountReader(store)); }

class User {
    constructor(id = '3074457415316504379', uid = 'Player') {
        this.a = true; this.b = { toString: () => id }; this.c = uid; this.d = 'CLAN';
    }
    toString() { return 'User(isUserPropertiesLoaded=' + this.a + ', id=' + this.b.toString() + ', uid=' + this.c + ', clanTag=' + this.d + ')'; }
}
class Remote {
    constructor(id, uid) { this.x = { toString: () => id }; this.y = uid; }
    toString() { return 'RemoteUserData(userId=' + this.x.toString() + ', uid=' + this.y + ')'; }
}
class RemoteStorage {
    constructor(players) { this.z = { nested: { values: players } }; }
    toString() { return 'RemoteUserDataStorage(userIdToData=' + this.z + ')'; }
}
class TOState {
    constructor(user) { this.owner = user; }
    toString() { return 'TOState(user=' + this.owner + ')'; }
}

function nativeHarness(cost = 0) {
    let time = 1000, cpu = 0, handle = 0;
    const tasks = new Map(), intervals = new Map(), listeners = new Map(), messages = [], timerDelays = [];
    const page = { location: { origin: 'https://tankionline.com' },
        postMessage(message) { messages.push(structuredClone(message)); },
        addEventListener(type, callback) { listeners.set(type, callback); },
        removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
        setTimeout(callback, delay) { const id = ++handle; tasks.set(id, callback); timerDelays.push(delay); return id; },
        clearTimeout(id) { tasks.delete(id); },
        setInterval(callback) { const id = ++handle; intervals.set(id, callback); return id; },
        clearInterval(id) { intervals.delete(id); },
    };
    const api = loadNative({ window: page, Date: { now: () => time }, performance: { now: () => cpu += cost } });
    const probe = api.installAccountIdentityNative(page);
    return { page, probe, tasks, intervals, listeners, messages, timerDelays,
        latest: () => messages.at(-1)?.snapshot,
        next() {
            const entry = tasks.entries().next().value;
            if (!entry) return false;
            tasks.delete(entry[0]); entry[1](); return true;
        },
        flush() {
            let steps = 0;
            while (this.next()) assert.ok(++steps < 30000, 'scheduled discovery must terminate');
        },
        tick(ms = 1000) { time += ms; for (const callback of [...intervals.values()]) callback(); },
        advance(ms) { time += ms; },
        api,
    };
}

test('TOState.user publishes before walking unrelated services or waiting for the heartbeat', () => {
    const harness = nativeHarness();
    let walks = 0;
    const services = new Proxy(Object.fromEntries(Array.from({ length: 1000 }, (_, i) => ['service' + i, {}])), {
        ownKeys(target) { walks++; return Reflect.ownKeys(target); },
    });
    const store = { services, mangledState: new TOState(new User()), unrelatedUser: new User('42'),
        friends: new RemoteStorage([new Remote('43', 'Player')]) };
    harness.probe.capture(store);
    assert.equal(walks, 0);
    assert.equal(harness.latest().account, null);
    harness.next();
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    assert.equal(walks, 0, 'the owner must publish before enumerating unrelated services');
    assert.equal(harness.latest().players.length, 0);
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.direct, true);
    harness.flush();
    assert.equal(harness.latest().account.userId, '3074457415316504379', 'TOState.user owns the account, not an unrelated User');
    assert.deepEqual(harness.latest().players, [{ userId: '43', nickname: 'Player' }]);
});

test('a cached direct User publishes newly loaded properties on store capture before the next heartbeat', () => {
    const harness = nativeHarness();
    const user = new User(); user.a = false;
    const store = new TOState(user);
    harness.probe.capture(store); harness.flush();
    assert.equal(harness.latest().account, null);
    const slices = harness.page.__kaspAccountDebug.status().discovery.slices;
    user.a = true;
    harness.probe.capture(store);
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.slices, slices);
    store.owner = new User('2002');
    harness.tick();
    assert.equal(harness.latest().account, null, 'replacing the authoritative user invalidates ownership');
    harness.flush();
    assert.equal(harness.latest().account.userId, '2002');
});

test('duplicate TOState aliases are deduplicated but distinct owners and native getters cannot supply a fast identity', () => {
    const shared = new TOState(new User());
    const aliased = createNativeAccountReader({ first: shared, second: shared });
    drain(aliased);
    assert.equal(aliased.status().direct, true);
    const ambiguous = createNativeAccountReader({ first: new TOState(new User('1001')), second: new TOState(new User('2002')) });
    assert.equal(drain(ambiguous).account, null);
    assert.equal(ambiguous.status().direct, false);
    let getters = 0;
    const getterState = new TOState(null);
    Object.defineProperty(getterState, 'owner', { get() { getters++; return new User(); } });
    assert.equal(readNativeAccountSnapshot(getterState).account, null);
    assert.equal(getters, 0);
});

test('capture yields immediately, discovers beyond the old 500-object limit and publishes the account before remote players', () => {
    const harness = nativeHarness(1);
    let enumerations = 0;
    const store = new Proxy({ ...Object.fromEntries(Array.from({ length: 800 }, (_, i) => ['service' + i, {}])),
        local: new User(), users: new RemoteStorage(Array.from({ length: 700 }, (_, i) => new Remote(String(i + 1), 'P' + i))),
    }, { ownKeys(target) { enumerations++; return Reflect.ownKeys(target); } });
    harness.probe.capture(store);
    assert.equal(enumerations, 0, 'capture runs inside the game hook and must not enumerate the store');
    assert.equal(harness.latest().account, null);
    assert.equal(harness.tasks.size, 1);
    assert.equal(harness.timerDelays[0], 0, 'initial account discovery starts in the next task without a polling delay');
    harness.next();
    assert.equal(harness.timerDelays[1], 8, 'continuations still yield to rendering and native loading');
    assert.equal(harness.latest().account, null, 'slow work is continued in later macrotasks');
    let turns = 0;
    while (!harness.latest().account) { assert.ok(harness.next()); assert.ok(++turns < 10000); }
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    assert.equal(harness.latest().players.length, 0, 'local identity does not wait for friend discovery');
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.pending, 'players');
    harness.flush();
    assert.equal(harness.latest().players.length, 700);
    assert.equal(harness.page.__kaspAccountDebug.status().runtime.disabled, false);
});

test('warm account reads reuse the cached path and schema without enumerating the store or inspecting the User prototype', () => {
    let walks = 0, methods = 0;
    const user = new Proxy(new User(), {
        getOwnPropertyDescriptor(target, key) { if (key === 'toString') methods++; return Reflect.getOwnPropertyDescriptor(target, key); },
        getPrototypeOf(target) { methods++; return Reflect.getPrototypeOf(target); },
    });
    const store = new Proxy({ local: user, users: new RemoteStorage([]) }, {
        ownKeys(target) { walks++; return Reflect.ownKeys(target); },
    });
    const harness = nativeHarness();
    harness.probe.capture(store); harness.flush();
    const before = { walks, methods, slices: harness.page.__kaspAccountDebug.status().discovery.slices };
    for (let i = 0; i < 20; i++) {
        harness.probe.capture(store);
        harness.tick(100);
        assert.equal(harness.latest().account.userId, '3074457415316504379');
        harness.page.__kaspAccountDebug.status();
    }
    assert.equal(walks, before.walks);
    assert.equal(methods, before.methods);
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.slices, before.slices);
    assert.equal(harness.tasks.size, 0);
    user.c = 'Renamed'; user.d = 'NEW'; harness.tick();
    assert.equal(harness.latest().account.nickname, 'Renamed');
    assert.equal(harness.latest().account.clanTag, 'NEW');
});

test('login without a reload retries missing models and then waits for loaded properties using the cached User', () => {
    const harness = nativeHarness();
    const store = {};
    harness.probe.capture(store); harness.flush();
    for (let i = 0; i < 10; i++) { harness.tick(); harness.flush(); }
    assert.equal(harness.latest().account, null);
    const user = new User(); user.a = false;
    store.state = { local: user, users: new RemoteStorage([]) };
    harness.tick(); harness.flush();
    assert.equal(harness.latest().account, null);
    const slices = harness.page.__kaspAccountDebug.status().discovery.slices;
    for (let i = 0; i < 10; i++) { harness.tick(); harness.flush(); }
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.slices, slices);
    user.a = true; harness.tick();
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    harness.flush();
    assert.equal(harness.page.__kaspAccountDebug.status().runtime.disabled, false);
});

test('replacement, logout and ambiguous accounts cannot reuse a cached owner or remote players', () => {
    const harness = nativeHarness();
    const store = { local: new User('1001'), users: new RemoteStorage([new Remote('42', 'Friend')]) };
    harness.probe.capture(store); harness.flush();
    assert.equal(harness.latest().players.length, 1);
    store.local = new User('2002');
    harness.tick();
    assert.equal(harness.latest().account, null, 'replacement invalidates the old path before rediscovery');
    assert.equal(harness.latest().players.length, 0);
    harness.flush();
    assert.equal(harness.latest().account.userId, '2002');
    store.local.a = false; harness.tick();
    assert.equal(harness.latest().account, null);
    assert.equal(harness.latest().players.length, 0);
    delete store.local; harness.tick(); harness.flush();
    store.local = new User('3003'); store.another = new User('4004');
    harness.tick(); harness.flush();
    assert.equal(harness.latest().account, null, 'two loaded local User models are ambiguous');
    delete store.another;
    harness.tick(); harness.flush();
    assert.equal(harness.latest().account.userId, '3003');
});

test('a new captured store cancels work belonging to the old store and publishes only the new owner', () => {
    const harness = nativeHarness(1);
    harness.probe.capture({ local: new User('1001'), users: new RemoteStorage(
        Array.from({ length: 300 }, (_, i) => new Remote(String(i + 1), 'Old' + i))) });
    while (!harness.latest().account) assert.ok(harness.next());
    harness.probe.capture({ local: new User('2002'), users: new RemoteStorage([new Remote('999', 'New')]) });
    assert.equal(harness.latest().account, null);
    assert.equal(harness.tasks.size, 1, 'old pending timeout was cancelled');
    const messagesBefore = harness.messages.length;
    harness.flush();
    assert.equal(harness.latest().account.userId, '2002');
    assert.deepEqual(harness.latest().players, [{ userId: '999', nickname: 'New' }]);
    assert.ok(harness.messages.slice(messagesBefore).every(message => message.snapshot.account?.userId !== '1001'));
});

test('unreadable sibling objects and native getters do not disable account discovery', () => {
    const harness = nativeHarness();
    const broken = new Proxy({}, { getPrototypeOf() { throw Error('unavailable model'); } });
    let getters = 0;
    const store = { broken, local: new User(), users: new RemoteStorage([]) };
    Object.defineProperty(store, 'getter', { enumerable: true, get() { getters++; throw Error('getter'); } });
    harness.probe.capture(store); harness.flush();
    assert.equal(getters, 0);
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    assert.match(harness.page.__kaspAccountDebug.status().discovery.lastError, /unavailable model/);
    assert.equal(harness.page.__kaspAccountDebug.status().runtime.disabled, false);
});

test('secondary discovery follows later friend data and clears a replaced native storage', () => {
    const harness = nativeHarness();
    const store = { local: new User() };
    harness.probe.capture(store); harness.flush();
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    store.users = new RemoteStorage([new Remote('42', 'Friend')]);
    harness.tick(5000); harness.flush();
    assert.deepEqual(harness.latest().players, [{ userId: '42', nickname: 'Friend' }]);
    store.users.z.nested.values[0].y = 'Renamed';
    harness.tick(5000); harness.flush();
    assert.deepEqual(harness.latest().players, [{ userId: '42', nickname: 'Renamed' }]);
    store.users = new RemoteStorage([new Remote('43', 'Other')]);
    harness.tick(5000); harness.flush();
    assert.equal(harness.latest().players.length, 0);
    harness.tick(); harness.flush();
    assert.deepEqual(harness.latest().players, [{ userId: '43', nickname: 'Other' }]);
});

test('cleanup cancels pending discovery, heartbeat and message listener, and clears the published account', () => {
    const harness = nativeHarness(1);
    harness.api.runtime.installFeatureDiagnostics(harness.page, 'page');
    harness.probe.capture({ local: new User() });
    harness.next();
    assert.equal(harness.tasks.size, 1);
    assert.equal(harness.listeners.size, 1);
    assert.equal(harness.intervals.size, 1);
    harness.page.__kaspPageModulesDebug.disable('accountIdentity');
    assert.equal(harness.tasks.size, 0);
    assert.equal(harness.listeners.size, 0);
    assert.equal(harness.intervals.size, 0);
    assert.equal(harness.latest().account, null);
    harness.probe.capture({ local: new User('1001') }); harness.tick(); harness.flush();
    assert.equal(harness.latest().account, null);
    assert.equal(harness.page.__kaspAccountDebug.status().runtime.resources, 0);
});

test('a slow secondary scan rests after completion instead of immediately rescanning an overdue interval', () => {
    const harness = nativeHarness(1);
    harness.probe.capture({ local: new User(), users: new RemoteStorage(
        Array.from({ length: 800 }, (_, i) => new Remote(String(i + 1), 'P' + i))) });
    let turns = 0;
    while (!harness.latest().players.length) {
        harness.advance(10);
        assert.ok(harness.next());
        assert.ok(++turns < 10000);
    }
    assert.equal(harness.tasks.size, 0);
    assert.equal(harness.page.__kaspAccountDebug.status().discovery.pending, null);
    harness.tick(1000);
    assert.equal(harness.tasks.size, 0);
    harness.tick(4000);
    assert.equal(harness.tasks.size, 1);
});

test('cyclic discovery, unreadable cached User and unlimited login wait yield and retry without a tight loop', () => {
    const harness = nativeHarness();
    const pair = Proxy.revocable(new User(), {});
    const store = { local: pair.proxy, users: new RemoteStorage([]) }; store.loop = store;
    Object.defineProperty(store, 'hidden', { value: {}, enumerable: false });
    harness.probe.capture(store); harness.flush();
    assert.equal(harness.latest().account.userId, '3074457415316504379');
    pair.revoke(); harness.tick(); harness.flush();
    for (let i = 0; i < 30; i++) { harness.tick(); harness.flush(); }
    assert.equal(harness.latest().account, null);
    assert.equal(harness.page.__kaspAccountDebug.status().runtime.disabled, false);
    assert.equal(harness.tasks.size, 0, 'failed discovery backs off instead of scheduling immediately forever');
    store.local = new User('2002'); harness.tick(); harness.flush();
    assert.equal(harness.latest().account.userId, '2002');
});

test('ownership comes only from the loaded local User.id, independently of all remote nicknames', () => {
    const user = new User();
    const store = { state: { local: user, users: new RemoteStorage([
        new Remote('42', 'Player'), new Remote('43', 'Friend'),
    ]) } };
    let snapshot = readNativeAccountSnapshot(store);
    assert.equal(snapshot.account.userId, '3074457415316504379');
    assert.equal(snapshot.account.nickname, 'Player');
    assert.deepEqual(Array.from(snapshot.players, p => p.userId), ['42', '43']);
    user.c = 'Renamed';
    snapshot = readNativeAccountSnapshot(store);
    assert.equal(snapshot.account.userId, '3074457415316504379');
    assert.equal(snapshot.account.nickname, 'Renamed');
    user.a = false;
    assert.equal(readNativeAccountSnapshot(store).account, null);
    delete store.state.local;
    assert.equal(readNativeAccountSnapshot(store).account, null);
    store.state.local = new User('1001'); store.state.ambiguous = new User('2002');
    assert.equal(readNativeAccountSnapshot(store).account, null);
});

test('isolated bridge caches the verified account across delayed heartbeats, rejects mismatches and expires remote names', () => {
    let now = 1000, listener, visible = 'Player';
    const page = { location: { origin: 'https://tankionline.com' }, postMessage() {},
        addEventListener(type, callback) { listener = callback; } };
    const identity = { exports: {} };
    runFeatureContext(transformSync(fs.readFileSync('src/core/accountIdentity.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module: identity, require: name => name === './gameDOM' ? { gameDOM: { account: {} } } : ids.exports, window: page, Date: { now: () => now },
        document: { querySelector: () => ({ textContent: visible }), querySelectorAll: () => [] },
    });
    const api = identity.exports;
    api.setupAccountIdentity();
    assert.equal(api.getVerifiedAccount(), null, 'a visible nickname alone must never establish ownership');
    const send = (userId, nickname, players = [], origin = page.location.origin) => listener({ source: page, origin,
        data: { type: 'kasp:account-identity', snapshot: { account: { userId, nickname, clanTag: '' }, players } } });
    send('1001', 'Player', [], 'https://other.example');
    assert.equal(api.getVerifiedAccount(), null);
    send('1001', 'Player', [{ userId: '30', nickname: 'Friend' }, { userId: '31', nickname: 'Duplicate' }, { userId: '32', nickname: 'Duplicate' }]);
    assert.equal(api.getVerifiedAccount().userId, '1001');
    assert.equal(api.getPlayerUserId('Friend'), '30');
    assert.equal(api.getPlayerUserId('Duplicate'), null);
    visible = 'Renamed';
    assert.equal(api.getVerifiedAccount(), null, 'wait for the native identity during a screen transition');
    send('1001', 'Renamed', [{ userId: '30', nickname: 'RenamedFriend' }]);
    assert.equal(api.getVerifiedAccount().userId, '1001');
    assert.equal(api.getPlayerUserId('Friend'), null);
    assert.equal(api.getPlayerUserId('RenamedFriend'), '30');
    send('2002', 'Renamed');
    assert.equal(api.getVerifiedAccount().userId, '2002', 'a reused nickname does not reuse the previous account ID');
    now += 5001;
    assert.equal(api.getVerifiedAccount().userId, '2002', 'a delayed heartbeat must not expire the page account cache');
    assert.equal(api.getPlayerUserId('RenamedFriend'), null);
    send('2002', 'Renamed');
    assert.equal(api.getVerifiedAccount().userId, '2002');
    now += 600000;
    assert.equal(api.getVerifiedAccount().userId, '2002', 'the cached ID has no elapsed-time expiry');
    listener({ source: page, origin: page.location.origin,
        data: { type: 'kasp:account-identity', snapshot: { account: null, players: [] } } });
    assert.equal(api.getVerifiedAccount(), null, 'an explicit native reset invalidates the cached account immediately');
});

test('the verified ID cache belongs to one page and cleanup clears it', () => {
    let listener;
    const page = { location: { origin: 'https://tankionline.com' }, postMessage() {},
        addEventListener(type, callback) { listener = callback; }, removeEventListener() {} };
    const loadIdentity = () => {
        const module = { exports: {} };
        const fixture = { module, require: name => name === './gameDOM' ? { gameDOM: { account: {} } } : ids.exports,
            window: page, document: { querySelector: () => null, querySelectorAll: () => [] } };
        runFeatureContext(transformSync(fs.readFileSync('src/core/accountIdentity.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, fixture);
        return { api: module.exports, runtime: fixture.require('./featureRuntime') };
    };
    const first = loadIdentity();
    first.api.setupAccountIdentity();
    listener({ source: page, origin: page.location.origin, data: { type: 'kasp:account-identity',
        snapshot: { account: { userId: '9007199254740993', nickname: 'Player', clanTag: '' }, players: [] } } });
    assert.equal(first.api.getVerifiedAccount().userId, '9007199254740993');
    const reloaded = loadIdentity();
    reloaded.api.setupAccountIdentity();
    assert.equal(reloaded.api.getVerifiedAccount(), null, 'a new page waits for native identity, not a persisted old owner');
    first.runtime.installFeatureDiagnostics(page, 'content');
    page.__kaspModulesDebug.disable('accountIdentity');
    assert.equal(first.api.getVerifiedAccount(), null);
});

test('64-bit IDs remain exact decimal strings; nicknames and unsafe numbers cannot become account IDs', () => {
    for (const id of ['9007199254740993', '9223372036854775807', '18446744073709551615', '-9223372036854775808']) {
        assert.equal(normalizeAccountId(id), id);
        assert.equal(normalizeAccountId({ toString: () => id }), id);
    }
    for (const value of [9007199254740993, 'Kaspersky', '00123', '0', '-0', '', null, undefined,
        '18446744073709551616', '-9223372036854775809', {}, { toString() { throw Error('native failure'); } }]) {
        assert.equal(normalizeAccountId(value), null);
    }
});

test('diagnostics discover renamed native fields without stringifying entire player models or reading getters', () => {
    class RemoteUserData {
        constructor() { this.a = { toString: () => '9007199254740993' }; this.b = 'Player'; this.c = 'secret-token'; }
        toString() { throw Error('do not stringify model'); return 'RemoteUserData(userId=' + this.a + ', uid=' + this.b + ', token=' + this.c + ')'; }
    }
    const player = new RemoteUserData();
    Object.defineProperty(player, 'secret', { get() { throw Error('do not invoke native getter'); } });
    const store = { state: { player } }; store.cycle = store;
    const result = inspectIdentityStores([store]);
    assert.equal(result.identities.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(result.identities[0])), {
        path: 'store0.state.player', model: 'RemoteUserData', fields: { userId: '9007199254740993', uid: 'Player' },
    });
    assert.equal(JSON.stringify(result).includes('secret-token'), false);
    assert.ok(result.visited < 10);
});

test('diagnostics do not select another player with the same nickname as the current account', () => {
    const page = { addEventListener() {}, setInterval() {}, postMessage() {}, location: { origin: 'https://tankionline.com' } };
    const probe = installAccountIdentityNative(page);
    const store = { self: { userId: '10', uid: 'SameName' }, other: { userId: '20', uid: 'SameName' } };
    probe.capture(store); probe.capture(store);
    const status = page.__kaspAccountDebug.inspect();
    assert.equal(status.stores, 1);
    assert.deepEqual(Array.from(status.identities, item => item.fields.userId), ['10', '20']);
    assert.equal('userId' in status, false);
    assert.equal(status.account, null);
    assert.equal('localStorage' in page, false);
});

test('identity inspection has finite traversal and output limits on large stores', () => {
    let reads = 0;
    const root = {};
    for (let i = 0; i < 110; i++) {
        root[i] = Object.fromEntries(Array.from({ length: 110 }, (_, j) => [j, { userId: String(j + 1) }]));
    }
    Object.defineProperty(root, 'getter', { get() { reads++; return root; } });
    const result = inspectIdentityStores([root]);
    assert.equal(reads, 0);
    assert.equal(result.truncated, true);
    assert.ok(result.visited <= 6000);
    assert.ok(result.identities.length <= 100);
});
