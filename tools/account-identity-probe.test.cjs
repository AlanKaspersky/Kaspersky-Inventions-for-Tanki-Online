const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const ids = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/accountId.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: ids });
const loaded = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/accountIdentityNative.ts', 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'es2020',
}).code, { module: loaded, require: () => ids.exports });
const { normalizeAccountId, inspectIdentityStores, installAccountIdentityNative } = loaded.exports;
const { readNativeAccountSnapshot } = loaded.exports;

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

test('isolated bridge rejects missing, stale and mismatched identity and resolves friends without storing nicknames', () => {
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
    assert.equal(api.getVerifiedAccount(), null);
    assert.equal(api.getPlayerUserId('RenamedFriend'), null);
    send('2002', 'Renamed');
    assert.equal(api.getVerifiedAccount().userId, '2002');
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
    const status = page.__kaspAccountDebug.status();
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
