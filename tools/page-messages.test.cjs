const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleBox = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/pageMessages.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: moduleBox });
const { readPageMessage, postPageMessage } = moduleBox.exports;
const origin = 'https://tankionline.com';
const page = { location: { origin } };
const receive = data => readPageMessage({ source: page, origin, data }, page, data.type);

test('page bridge requires the same window, exact origin and a supported message schema', () => {
    const data = { type: 'kasp:useraction', detail: ['TankUserActionLog', 'Игрок', 'CHANGE_EQUIPMENT', 'SELF'] };
    assert.equal(receive(data), data);
    for (const event of [{ source: {}, origin, data }, { source: page, origin: 'https://evil.example', data },
        { source: page, origin: 'null', data }, { source: page, data }, { source: page, origin, data: null }]) {
        assert.equal(readPageMessage(event, page, data.type), null);
    }
    for (const detail of [[], ['TankUserActionLog', 'Player', {}], ['Other', 'Player', 'CHANGE_EQUIPMENT'],
        ['TankUserActionLog', 'x'.repeat(1000), 'CHANGE_EQUIPMENT'], ['TankUserActionLog', 'Player', 'CHANGE_EQUIPMENT', {}]]) {
        assert.equal(receive({ ...data, detail }), null);
    }
    assert.equal(receive({ type: 'kasp:battle-kind', detail: 'anything' }), null);
    assert.equal(receive({ type: 'kasp:battle-mode', detail: 'UNKNOWN' }), null);
});

test('account IDs retain all 64 bits, oversized snapshots are rejected and logout is accepted', () => {
    const account = { userId: '3074457415316504379', nickname: 'Player', clanTag: 'Clan' };
    const message = { type: 'kasp:account-identity', snapshot: { account, players: [{ userId: '1001', nickname: 'Friend' }] } };
    assert.equal(receive(message).snapshot.account.userId, account.userId);
    for (const userId of ['18446744073709551616', 3074457415316504379, 'Player', '001']) {
        assert.equal(receive({ ...message, snapshot: { account: { ...account, userId }, players: [] } }), null);
    }
    assert.equal(receive({ ...message, snapshot: { account, players: Array(6001).fill(message.snapshot.players[0]) } }), null);
    assert.ok(receive({ ...message, snapshot: { account: null, players: [] } }));
});

test('overdrive and presence reject invalid coordinates, durations, counts and malformed data', () => {
    const type = 'kasp:bonus-pickup';
    assert.ok(receive({ type, detail: { model: '1647333199409', position: { x: 1, y: 2, z: 3 } } }));
    assert.ok(receive({ type, detail: '1647333199409' }));
    for (const position of [{ x: Infinity, y: 0, z: 0 }, { x: '1', y: 0, z: 0 }, {}, Array(3).fill(1)]) {
        assert.equal(receive({ type, detail: { model: '1647333199409', position } }), null);
    }
    for (const battle of [{ map: 'Map', remaining: NaN }, { map: 'Map', players: 1.5 }, { map: 'Map', maxPlayers: 0 },
        { map: 'x'.repeat(129) }, { map: 'Map', remaining: 90000 }]) {
        assert.equal(receive({ type: 'kasp:battle-presence', at: 1, battle }), null);
    }
    assert.ok(receive({ type: 'kasp:battle-presence', at: 1, battle: null }));
    assert.equal(receive({ type: 'kasp:game-augments', detail: { format: 'kasp-augments-v1', devices: Array(20001) } }), null);
});

test('sending uses the current page origin and drops malformed outgoing payloads', () => {
    const sent = [];
    const target = { location: { origin }, postMessage: (...args) => sent.push(args) };
    const request = { type: 'kasp:game-augments-request' };
    postPageMessage(target, request);
    assert.equal(sent[0][0], request);
    assert.equal(sent[0][1], origin);
    postPageMessage(target, { type: 'kasp:battle-kind', detail: 'invalid' });
    postPageMessage(target, { type: 'kasp:discord-presence', version: 1, presence: { details: 'Lobby', state: 'Player', party: { size: [7, 6] } } });
    assert.equal(sent.length, 1);
});
