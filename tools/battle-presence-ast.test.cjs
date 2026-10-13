const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const { analyzeBattlePresence } = require('./battle-presence-ast.cjs');
const patches = require('./test-client-patches.cjs');
const loaded = { exports: {} };
const compiled = transformSync(fs.readFileSync(path.join(__dirname, '../src/core/battlePresence.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code;
vm.runInNewContext(compiled, { module: loaded, crypto: webcrypto, TextEncoder,
    require: id => id === './clientPatches' ? patches : { gameDOM: { presence: { timer: '.timer' } } } });
const { selectBattlePresencePlan, patchBattlePresence } = loaded.exports;
const fixture = `
function Settings(){this.idSlot=new Value("battleId"),this.maxSlot=new Value("maxPeople")}
var getter=function(){var q=Scope;return this.changedField.resolve(this,descriptor("store",1,q,function(x){return x.renamedGetter()},null))};
function load(t,n){return settings(t).idSlot.set(runtime().current().id()),settings(t).maxSlot.set(n.limit)}
`;
function setup(source = fixture, options = {}) {
    const values = {}, captures = [], reads = { id: 0, limit: 0, settings: 0, store: 0 };
    const store = {}, context = {
        Scope: {}, descriptor() {}, runtime: () => ({ current: () => ({ id: () => { reads.id++; return 'battle-1'; } }) }),
        Value: function(name) { this.set = value => { values[name] = value; if (options.setterError && name === 'maxPeople') throw Error('native setter failed'); return value; }; },
        window: { __kaspPresenceStore(value) { captures.push(value); if (options.observerError) throw Error('observer failed'); },
            __kaspPresenceCapacity(id, limit) { captures.push([id, limit]); if (options.observerError) throw Error('observer failed'); } },
    };
    vm.runInNewContext(patchBattlePresence(source, undefined, analyzeBattlePresence(source)), context);
    const settings = new context.Settings(); context.settings = () => { reads.settings++; return settings; };
    const component = { changedField: { resolve() { reads.store++; return store; } } };
    const argument = { get limit() { reads.limit++; return 20; } };
    return { values, captures, reads, store, context, component, argument };
}

test('presence plan preserves native DI results, capacity writes, return values and single evaluation', () => {
    const plan = analyzeBattlePresence(fixture); assert.equal(plan.status.ready, true);
    assert.equal(plan.status.storeHooks, 1); assert.equal(plan.status.capacityHooks, 1);
    const f = setup();
    assert.equal(f.context.getter.call(f.component), f.store); assert.equal(f.captures[0], f.store);
    assert.equal(f.context.load({}, f.argument), 20);
    assert.deepEqual(f.values, { battleId: 'battle-1', maxPeople: 20 });
    assert.deepEqual(f.captures[1], ['battle-1', 20]);
    assert.deepEqual(f.reads, { id: 1, limit: 1, settings: 2, store: 1 });
    const patched = patchBattlePresence(fixture, () => { throw Error('report failed'); }, plan);
    assert.equal(patchBattlePresence(patched, undefined, plan), patched);
});

test('observer exceptions cannot affect native getters or setters, while native failures still propagate', () => {
    const f = setup(fixture, { observerError: true });
    assert.equal(f.context.getter.call(f.component), f.store); assert.equal(f.context.load({}, f.argument), 20);
    delete f.context.window.__kaspPresenceStore; delete f.context.window.__kaspPresenceCapacity;
    assert.equal(f.context.getter.call(f.component), f.store); assert.equal(f.context.load({}, f.argument), 20);
    f.component.changedField.resolve = () => { throw Error('native getter failed'); };
    assert.throws(() => f.context.getter.call(f.component), /native getter failed/);
    const broken = setup(fixture, { setterError: true });
    assert.throws(() => broken.context.load({}, broken.argument), /native setter failed/);
    assert.equal(broken.captures.length, 0);
});

test('known hashes and compatible renamed or reformatted builds select complete plans only', async () => {
    const plan = analyzeBattlePresence(fixture);
    assert.equal(await selectBattlePresencePlan(fixture, [plan]), plan);
    const changed = fixture.replaceAll('idSlot', 'battleKey').replaceAll('maxSlot', 'capacityKey')
        .replaceAll('changedField', 'container').replaceAll('resolve', 'lookup').replaceAll('renamedGetter', 'storeValue')
        .replaceAll('settings', 'configuration').replaceAll('runtime', 'clientState').replaceAll('"', "'") + '\nvar unrelated=42;';
    const adapted = await selectBattlePresencePlan(changed, [plan]); assert.ok(adapted);
    assert.equal(adapted.status.strategy, 'ast-template'); assert.equal(patches.validatePatchEdits(changed, adapted), true);
    new vm.Script(patchBattlePresence(changed, undefined, adapted));
    const context = { Scope: {}, descriptor() {}, Value: function() { this.set = value => value; }, clientState: () => ({ current: () => ({ id: () => 'new-battle' }) }),
        window: { captured: [], __kaspPresenceCapacity(...args) { this.captured.push(args); }, __kaspPresenceStore(value) { this.store = value; } } };
    vm.runInNewContext(patchBattlePresence(changed, undefined, adapted), context);
    const settings = new context.Settings(); context.configuration = () => settings;
    const store = {}; assert.equal(context.getter.call({ container: { lookup: () => store } }), store);
    assert.equal(context.window.store, store); assert.equal(context.load({}, { limit: 24 }), 24);
    assert.deepEqual(context.window.captured[0], ['new-battle', 24]);
    const storeOnly = analyzeBattlePresence(fixture, { profile: 'store' });
    assert.equal(storeOnly.status.ready, true); assert.equal(await selectBattlePresencePlan(fixture, [storeOnly]), undefined);
});

test('statement pairs, nested getters and injected local names preserve strict native scopes', async () => {
    const statements = fixture.replace('return settings(t).idSlot.set(runtime().current().id()),settings(t).maxSlot.set(n.limit)',
        '"use strict";settings(t).idSlot.set(runtime().current().id());settings(t).maxSlot.set(n.limit)');
    const f = setup(statements); f.context.load({}, f.argument); assert.deepEqual(f.captures[0], ['battle-1', 20]);
    const nested = '"use strict";\n' + fixture.replace('function load(t,n){', 'function load(t,n){var nested=function(){var a=Scope;return this.changedField.resolve(this,descriptor("store",1,a,function(x){return x.renamedGetter()},null))};') +
        '\nfunction nativeStrict(){return this===undefined}';
    const nestedPlan = analyzeBattlePresence(nested); assert.equal(nestedPlan.status.storeHooks, 2); assert.equal(nestedPlan.status.ready, true);
    new vm.Script(patchBattlePresence(nested, undefined, nestedPlan));
    // A nested getter can make the general getter template ambiguous; adaptation must then fail closed.
    assert.equal(await selectBattlePresencePlan(nested + '\nvar unrelated=1;', [nestedPlan]), undefined);
    const strict = '"use strict";\n' + fixture + '\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeBattlePresence(strict);
    const changed = strict + '\nvar _kaspBonusResult=5,__kaspPresenceId=7,__kaspPresenceLimit=9;';
    const adapted = await selectBattlePresencePlan(changed, [plan]); assert.ok(adapted);
    const c = { Scope: {}, descriptor() {}, Value: function() { this.set = v => v; }, runtime: () => ({ current: () => ({ id: () => 'battle-2' }) }),
        window: { __kaspPresenceCapacity(id, limit) { this.result = [id, limit]; } } };
    vm.runInNewContext(patchBattlePresence(changed, undefined, adapted), c);
    const settings = new c.Settings(); c.settings = () => settings;
    assert.equal(c.load({}, { limit: 16 }), 16); assert.deepEqual(c.window.result, ['battle-2', 16]);
    assert.equal(c._kaspBonusResult, 5); assert.equal(c.__kaspPresenceId, 7); assert.equal(c.__kaspPresenceLimit, 9);
    assert.equal((0, c.nativeStrict)(), true);
});

test('incomplete, ambiguous, stale and quoted contracts leave the original client untouched', async () => {
    const plan = analyzeBattlePresence(fixture);
    for (const changed of [fixture.replace('"store"', '"menu"'), fixture.replace('"maxPeople"', '"anotherLimit"'),
        fixture.replace('settings(t).maxSlot', 'other(t).maxSlot'), fixture.replace('settings(t).maxSlot.set(n.limit)', 'settings(t).maxSlot.set(n.limit, true)'),
        fixture + '\nfunction Other(){this.anotherId=new Value("battleId"),this.anotherMax=new Value("maxPeople")}',
        'const quoted=' + JSON.stringify(fixture) + ';/*' + fixture + '*/']) {
        assert.equal(analyzeBattlePresence(changed).status.ready, false);
        assert.equal(await selectBattlePresencePlan(changed, [plan]), undefined);
        assert.equal(patchBattlePresence(changed), changed);
    }
    const stale = { ...plan, edits: plan.edits.map((e, i) => i === 1 ? { ...e, expected: 'stale' } : e) };
    assert.equal(patchBattlePresence(fixture, undefined, stale), fixture);
});

test('Electron store capture feeds map, mode, server capacity and remaining time into the existing bridge', () => {
    let now = 100000, timer = null, poll;
    const target = { messages: [], location: { origin: 'https://tankionline.com' },
        setInterval(callback, ms) { assert.equal(ms, 1000); poll = callback; },
        postMessage(message, origin) { assert.equal(origin, this.location.origin); this.messages.push(message); } };
    const module = { exports: {} };
    vm.runInNewContext(compiled, { module, navigator: { userAgent: 'Electron' }, Date: { now: () => now },
        document: { querySelector: () => timer }, require: id => id === './clientPatches' ? patches : { gameDOM: { presence: { timer: '.timer' } } } });
    module.exports.installBattlePresence(target);
    const stats = { a: 'battle-1', b: 'Osa', c: 120, d: true, e: 'CP',
        toString() { return 'BattleStatistics(battleId=' + this.a + ', mapNameWithoutMode=' + this.b + ', remainingTimeInSec=' + this.c + ', battleLoaded=' + this.d + ', mode=' + this.e + ')'; } };
    const c = { ...setup().context, window: target };
    vm.runInNewContext(patchBattlePresence(fixture, undefined, analyzeBattlePresence(fixture)), c);
    const settings = new c.Settings(); c.settings = () => settings;
    c.getter.call({ changedField: { resolve: () => ({ stats }) } }); c.load({}, { limit: 20 }); poll();
    let battle = target.messages.at(-1).battle;
    assert.equal(battle.map, 'Osa'); assert.equal(battle.mode, 'CP'); assert.equal(battle.remaining, 120); assert.equal(battle.maxPlayers, 20);
    now += 5000; poll(); assert.equal(target.messages.at(-1).battle.remaining, 115);
    timer = { textContent: '1:30' }; poll(); assert.equal(target.messages.at(-1).battle.remaining, 90);
    stats.d = false; poll(); assert.equal(target.messages.at(-1).battle, null);
    assert.equal(target.__kaspPresenceStoreDebug().captured, true); assert.equal(target.__kaspPresenceStoreDebug().error, null);
    // Browser use remains inactive, including background timers.
    vm.runInNewContext(compiled, { module, navigator: { userAgent: 'Chrome' }, require: id => id === './clientPatches' ? patches : { gameDOM: {} } });
    module.exports.installBattlePresence({ setInterval() { throw Error('browser timer must not start'); } });
});

test('presence preparation never executes a bundle and keeps existing plans after incompatible input', () => {
    const { spawnSync } = require('node:child_process'), os = require('node:os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-presence-ast-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-battle-presence.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        const source = 'throw Error("DO_NOT_EXECUTE");\n' + fixture; fs.writeFileSync(input, source);
        const result = run(); assert.equal(result.status, 0, result.stderr);
        const previous = fs.readFileSync(output, 'utf8'), data = JSON.parse(previous);
        assert.equal(data.format, 'ki-battle-presence-plans-v1'); assert.equal(data.plans[0].profile, 'complete');
        assert.equal(fs.readFileSync(input, 'utf8'), source);
        fs.writeFileSync(input, source.replace('"store"', '"menu"'));
        assert.equal(run().status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('all seven AST plans merge against original offsets and isolate a stale presence mapping', () => {
    const readFixture = file => fs.readFileSync(path.join(__dirname, file), 'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const garage = readFixture('garage-items.test.cjs').replace('this.category+")"', 'this.category+", owned="+this.owned+", visible="+this.visible+", secret="+this.secret+")"');
    const inventory = readFixture('garage-inventory.test.cjs').replace('function Item(){}', '').replace(/proto\(Item\)\.toString=[^\n]+;/, '')
        .replace(/\.art\b/g, '.preview').replace(/\.mine\b/g, '.owned');
    const source = ['arcade-reload.test.cjs', 'overdrive-ast.test.cjs', 'game-augments.test.cjs', 'garage-details.test.cjs'].map(readFixture).join('\n') + '\n' + garage + '\n' + inventory + '\n' + fixture;
    const plans = [require('./overdrive-ast.cjs').analyzeOverdrive(source), require('./arcade-ast.cjs').analyzeArcade(source), require('./augments-ast.cjs').analyzeAugments(source),
        require('./garage-details-ast.cjs').analyzeGarageDetails(source), require('./garage-items-ast.cjs').analyzeGarageItems(source), require('./garage-inventory-ast.cjs').analyzeGarageInventory(source), analyzeBattlePresence(source)];
    for (const plan of plans) assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const result = patches.mergeClientPatchPlans(source, plans); assert.equal(result.rejected.length, 0); new vm.Script(result.code);
    const stale = { ...plans[6], sourceLength: source.length + 1 }, remaining = patches.mergeClientPatchPlans(source, [...plans.slice(0, 6), stale]);
    assert.equal(remaining.code, patches.mergeClientPatchPlans(source, plans.slice(0, 6)).code); assert.equal(remaining.rejected[0], stale);
});
