const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

function fixture() {
    let now = 100000;
    const timers = new Set(), sockets = [];
    class Socket extends EventEmitter {
        constructor() { super(); this.writes = []; sockets.push(this); }
        connect(pipe) { this.pipe = pipe; }
        write(frame) { this.writes.push(frame); }
        destroy() { if (!this.destroyed) { this.destroyed = true; this.emit('close'); } }
        end() { this.ended = true; }
    }
    const exports = {};
    const context = {
        exports, Buffer, console,
        process: { platform: 'win32', pid: 123, env: {} },
        Date: class extends Date { static now() { return now; } },
        setTimeout(fn, delay) { const timer = { fn, at: now + delay, unref() {} }; timers.add(timer); return timer; },
        clearTimeout(timer) { timers.delete(timer); },
        require(name) { return name === 'node:net' ? { Socket } : require(name); },
    };
    // esbuild assigns module.exports rather than mutating the original exports object.
    const compiled = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, 'discordPresence.ts'), 'utf8'), {
        loader: 'ts', format: 'cjs', target: 'es2022',
    }).code, { ...context, module: compiled });
    return { ...compiled.exports, sockets, tick(delta) {
        const target = now + delta;
        for (;;) {
            const next = [...timers].filter(t => t.at <= target).sort((a, b) => a.at - b.at)[0];
            if (!next) break;
            now = next.at; timers.delete(next); next.fn();
        }
        now = target;
    } };
}
const readFrame = frame => ({ opcode: frame.readUInt32LE(), data: JSON.parse(frame.subarray(8).toString()) });
const presence = { details: 'В лобби', state: 'Kaspersky' };

test('validates incoming activity and Windows pipe path', () => {
    const f = fixture();
    assert.equal(f.discordPipe(0), '\\\\?\\pipe\\discord-ipc-0');
    assert.equal(f.validPresence(presence), true);
    for (const input of [null, {}, { ...presence, state: '' }, { ...presence, details: '\n' },
        { ...presence, details: 'x'.repeat(129) }]) assert.equal(f.validPresence(input), false);
    const disabled = new f.DiscordPresence(''); disabled.update(presence);
    assert.equal(f.sockets.length, 0);
});

test('handshake, partial frames, ping, latest activity and immediate clear', () => {
    const f = fixture(), client = new f.DiscordPresence('1558302320163291306');
    client.update(presence);
    const socket = f.sockets[0]; socket.emit('connect');
    assert.deepEqual(readFrame(socket.writes[0]), { opcode: 0, data: { v: 1, client_id: '1558302320163291306' } });
    const ready = f.rpcFrame(1, { evt: 'READY' });
    socket.emit('data', ready.subarray(0, 5)); assert.equal(socket.writes.length, 1);
    socket.emit('data', ready.subarray(5));
    assert.equal(readFrame(socket.writes[1]).data.args.activity.state, 'Kaspersky');
    client.update(presence); assert.equal(socket.writes.length, 2);
    socket.emit('data', f.rpcFrame(3, { ping: 1 }));
    assert.deepEqual(readFrame(socket.writes[2]), { opcode: 4, data: { ping: 1 } });
    client.update({ ...presence, details: 'В гараже' });
    client.update({ ...presence, details: 'В битве' });
    f.tick(15000);
    assert.equal(readFrame(socket.writes[3]).data.args.activity.details, 'В битве');
    client.dispose();
    assert.equal(readFrame(socket.writes[4]).data.args.activity, null);
    assert.equal(socket.ended, true);
    f.tick(500); assert.equal(socket.destroyed, true);
});

test('tries other pipes and reconnects after Discord restarts', () => {
    const f = fixture(), client = new f.DiscordPresence('1558302320163291306');
    client.update(presence); f.sockets[0].destroy();
    const socket = f.sockets[1]; assert.equal(socket.pipe, f.discordPipe(1));
    socket.emit('connect'); socket.emit('data', f.rpcFrame(1, { evt: 'READY' }));
    socket.destroy(); f.tick(15000);
    const next = f.sockets[2]; assert.equal(next.pipe, f.discordPipe(0));
    next.emit('connect'); next.emit('data', f.rpcFrame(1, { evt: 'READY' }));
    assert.equal(readFrame(next.writes[1]).data.args.activity.details, 'В лобби');
    client.dispose();
});

test('preload accepts game messages only and exposes no Node API', () => {
    let listener;
    const messages = [], window = { location: { protocol: 'https:', hostname: 'tankionline.com',
        pathname: '/play/', origin: 'https://tankionline.com' }, addEventListener(type, fn) { listener = fn; } };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, 'preload.ts'), 'utf8'), {
        loader: 'ts', format: 'cjs',
    }).code, { exports: {}, window, require() { return { ipcRenderer: { send(...args) { messages.push(args); } } }; } });
    const event = { source: window, origin: window.location.origin,
        data: { type: 'kasp:discord-presence', version: 1, presence } };
    listener({ ...event, origin: 'https://example.com' });
    listener({ ...event, source: {} });
    window.location.pathname = '/player'; listener(event);
    assert.equal(messages.length, 0);
    window.location.pathname = '/play/'; listener(event);
    assert.equal(messages[0][0], 'ki:discord-presence');
    assert.equal(messages[0][1].state, 'Kaspersky');
    listener({ ...event, data: { ...event.data, presence: null } });
    assert.equal(messages[1][1], null);
    listener({ ...event, data: { ...event.data, presence: { ...presence, timestamps: { end: 200 }, party: { size: [12, 24] } } } });
    assert.equal(messages[2][1].timestamps.end, 200);
    assert.deepEqual(Array.from(messages[2][1].party.size), [12, 24]);
    listener({ ...event, data: { ...event.data, presence: { ...presence, party: { size: [25, 24] } } } });
    assert.equal(messages.length, 3);
    assert.equal(window.ipcRenderer, undefined);
});

test('extension keeps labels English, translates battle maps and resumes after page restore', () => {
    function load(electron) {
        const events = {}, messages = [], intervals = new Map();
        const state = { lang: 'RU', currentScreen: 'lobby' };
        let serial = 0;
        const window = { location: { origin: 'https://tankionline.com' },
            postMessage(message) { messages.push(message); },
            setInterval(fn) { intervals.set(++serial, fn); return serial; },
            clearInterval(id) { intervals.delete(id); },
            addEventListener(name, fn) { events[name] = fn; } };
        const compiled = { exports: {} };
        vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../../src/modules/discordPresence.ts'), 'utf8'), {
            loader: 'ts', format: 'cjs',
        }).code, { module: compiled, window, require(name) {
            if (name.endsWith('/electron')) return { isElectronClient: () => electron };
            if (name.endsWith('/accountIdentity')) return { getAccountIdentity: () => ({ nickname: 'Kaspersky' }) };
            if (name.endsWith('/state')) return { state };
            if (name.endsWith('/dataLoader')) return { DataLoader: { translateMap: name => name === 'Молотов' ? 'Molotov' : name } };
            if (name.endsWith('/battlePresence')) return { BATTLE_PRESENCE_MESSAGE: 'kasp:battle-presence' };
            throw new Error(name);
        } });
        compiled.exports.setupDiscordPresence();
        return { events, messages, intervals, state, window };
    }
    assert.equal(load(false).messages.length, 0);
    const f = load(true);
    assert.equal(f.messages[0].presence.details, 'In the lobby');
    assert.equal(f.messages[0].presence.state, 'Kaspersky');
    f.state.lang = 'EN'; f.state.currentScreen = 'battle';
    [...f.intervals.values()][0]();
    assert.equal(f.messages[1].presence.details, 'In a battle');
    f.events.pagehide(); assert.equal(f.messages[2].presence, null);
    assert.equal(f.intervals.size, 0);
    f.events.pageshow(); assert.equal(f.intervals.size, 1);
    assert.equal(f.messages[3].presence.details, 'In a battle');
    f.state.lang = 'RU';
    f.events.message({ source: f.window, origin: 'https://tankionline.com', data: { type: 'kasp:battle-presence',
        battle: { map: 'Молотов DM', remaining: 120, players: 12, maxPlayers: 24 } } });
    [...f.intervals.values()][0]();
    assert.equal(f.messages[4].presence.details, 'Molotov DM');
    assert.deepEqual(Array.from(f.messages[4].presence.party.size), [12, 24]);
    assert.ok(Math.abs(f.messages[4].presence.timestamps.end - Math.floor(Date.now() / 1000) - 120) <= 1);
    f.state.currentScreen = 'lobby'; [...f.intervals.values()][0]();
    assert.equal(f.messages[5].presence.details, 'In the lobby');
    assert.equal(f.messages[5].presence.party, undefined);
    assert.equal(f.messages[5].presence.timestamps, undefined);
});

test('RPC sends battle countdown and party and clears them on leaving a battle', () => {
    const f = fixture(), client = new f.DiscordPresence('1558302320163291306');
    const battle = { ...presence, details: 'Molotov', timestamps: { end: 200 }, party: { size: [12, 24] } };
    assert.equal(f.validPresence(battle), true);
    for (const bad of [{ ...battle, timestamps: { end: NaN } }, { ...battle, party: { size: [25, 24] } },
        { ...battle, party: { size: [1, 0] } }]) assert.equal(f.validPresence(bad), false);
    client.update(battle);
    const socket = f.sockets[0]; socket.emit('connect'); socket.emit('data', f.rpcFrame(1, { evt: 'READY' }));
    let activity = readFrame(socket.writes[1]).data.args.activity;
    assert.deepEqual(activity.timestamps, { end: 200 });
    assert.deepEqual(activity.party, { size: [12, 24] });
    client.update(presence); f.tick(15000);
    activity = readFrame(socket.writes[2]).data.args.activity;
    assert.equal(activity.party, undefined); assert.equal(activity.timestamps, undefined);
    client.dispose();
});

test('battle store reader uses current battle limits and excludes spectators', () => {
    const compiled = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../../src/core/battlePresence.ts'), 'utf8'), {
        loader: 'ts', format: 'cjs',
    }).code, { module: compiled, require() { return { gameDOM: {} }; } });
    const stats = { a: { toString: () => 'battle-1' }, b: 'Молотов', c: 120, d: true, e: 'CP',
        toString() { return "BattleStatistics(battleId=" + this.a + ", mapNameWithoutMode=" + this.b + ", remainingTimeInSec=" + this.c + ", battleLoaded=" + this.d + ", mode=" + this.e + ")"; } };
    const params = { a: 12, b: { k3_1: 2 },
        toString() { return "BattleParams(maxPeopleCount=" + this.a + ", battleMode=" + this.b + ")"; } };
    const teams = ['BLUE', 'RED', 'SPECTATOR'];
    const users = { a: { t() { let i = 0; return { u: () => i < 3, v: () => i++ }; } },
        b: { z2: id => teams[id] },
        toString() { return "BattleUsers(onlineUsers=" + this.a + ", teams=" + this.b + ")"; } };
    const store = { stats, users, lobby: { z2: id => id === stats.a ? params : null } };
    const resourceGraph = depth => depth ? Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`resource${i}`, resourceGraph(depth - 1)])) : {};
    store.resources = resourceGraph(4);
    assert.equal(compiled.exports.parseBattleClock('12:34'), 754);
    assert.equal(compiled.exports.parseBattleClock('1:02:03'), 3723);
    assert.equal(compiled.exports.parseBattleClock('∞'), undefined);
    assert.equal(compiled.exports.parseBattleClock('12:90'), undefined);
    let result = compiled.exports.readBattlePresence(store);
    assert.equal(result.map, 'Молотов'); assert.equal(result.remaining, 120);
    assert.equal(result.mode, 'CP');
    assert.equal(result.players, 2); assert.equal(result.maxPlayers, 24);
    assert.equal(compiled.exports.readBattlePresence(store, new Map([['battle-1', 20]])).maxPlayers, 20);
    assert.equal(compiled.exports.readBattlePresence(store, new Map([['other-battle', 20]])).maxPlayers, 24);
    const matchmaking = { stats, users };
    assert.equal(compiled.exports.readBattlePresence(matchmaking, new Map([['battle-1', 20]])).maxPlayers, 20);
    params.b.k3_1 = 0;
    result = compiled.exports.readBattlePresence(store); assert.equal(result.maxPlayers, 12);
    stats.d = false; assert.equal(compiled.exports.readBattlePresence(store), null);
});

test('server capacity hook captures battle identity and limit without breaking settings loading', () => {
    const compiled = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../../src/core/battlePresence.ts'), 'utf8'), {
        loader: 'ts', format: 'cjs',
    }).code, { module: compiled, require() { return { gameDOM: {} }; } });
    const source = 'function Settings(){this.idSlot=new Value("battleId"),this.maxSlot=new Value("maxPeople")}function load(t,n){settings(t).idSlot.set(runtime().current().id()),settings(t).maxSlot.set(n.limit)}';
    const patched = compiled.exports.patchBattleCapacity(source);
    assert.notEqual(patched, source);
    const values = {}, captured = [], context = {
        Value: function(name) { this.set = value => { values[name] = value; }; },
        runtime: () => ({ current: () => ({ id: () => 'battle-1' }) }),
        window: { __kaspPresenceCapacity(id, limit) { captured.push([id, limit]); } },
    };
    vm.runInNewContext(patched, context);
    const settings = new context.Settings(); context.settings = () => settings;
    context.load({}, { limit: 20 });
    assert.deepEqual(values, { battleId: 'battle-1', maxPeople: 20 });
    assert.deepEqual(captured, [['battle-1', 20]]);
    context.window.__kaspPresenceCapacity = () => { throw new Error('observer'); };
    context.load({}, { limit: 24 }); assert.equal(values.maxPeople, 24);
    assert.equal(compiled.exports.patchBattleCapacity('function unchanged(){}'), 'function unchanged(){}');
});

test('presence captures the DI store without a React accessor and preserves getter behavior', () => {
    const compiled = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../../src/core/battlePresence.ts'), 'utf8'), {
        loader: 'ts', format: 'cjs',
    }).code, { module: compiled, require() { return { gameDOM: {} }; } });
    const source = 'getter=function(){var q=Scope;return this.changedField.resolve(this,descriptor("store",1,q,function(x){return x.renamedGetter()},null))}';
    let matches;
    const patched = compiled.exports.patchBattlePresence(source, count => { matches = count; });
    assert.equal(matches, 1);
    const store = {}, captured = [], context = { Scope: {}, descriptor() {},
        window: { __kaspPresenceStore(value) { captured.push(value); } } };
    vm.runInNewContext(patched, context);
    const component = { changedField: { resolve() { return store; } } };
    assert.equal(context.getter.call(component), store);
    assert.equal(captured[0], store);
    context.window.__kaspPresenceStore = () => { throw new Error('observer failed'); };
    assert.equal(context.getter.call(component), store);
    delete context.window.__kaspPresenceStore;
    assert.equal(context.getter.call(component), store);
    component.changedField.resolve = () => { throw new Error('original failure'); };
    assert.throws(() => context.getter.call(component), /original failure/);
    const unrelated = source.replace('"store"', '"menu"');
    assert.equal(compiled.exports.patchBattlePresence(unrelated), unrelated);
});
