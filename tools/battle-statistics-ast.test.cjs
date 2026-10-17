const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const { analyzeBattleStatistics } = require('./battle-statistics-ast.cjs');
const patches = require('./test-client-patches.cjs');
const loaded = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/battleStatistics.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: loaded, crypto: webcrypto, TextEncoder, require: () => patches });
const { selectBattleStatisticsPlan, patchBattleStatistics, installBattleStatistics, readBattleStatistics } = loaded.exports;

const fixture = `
function Stats(id,map,mode,mm,loaded){nativeInitialize();this.key=id;this.title=map;this.rule=mode;this.match=mm;this.ready=loaded;this.unrelated="TDM";this.complete=true}
proto(Stats).toString=function(){if(window.failDiagnostics)throw Error("diagnostics must not execute");return "BattleStatistics(battleId="+this.key.toString()+", mapName="+this.title+", mode="+this.rule.toString()+", isMMBattle="+this.match+", battleLoaded="+this.ready+")"};
window.statsClass=Stats;
`;
function setup(source = fixture, plan = analyzeBattleStatistics(source), override = {}) {
    const target = { location: { origin: 'https://tankionline.com' }, messages: [], postMessage(message, origin) { assert.equal(origin, 'https://tankionline.com'); this.messages.push(message); } };
    installBattleStatistics(target); target.failDiagnostics = true;
    let initializes = 0;
    const context = { window: target, proto: type => type.prototype, nativeInitialize() { initializes++; }, ...override };
    runFeatureContext(patchBattleStatistics(source, undefined, plan), context);
    return { target, context, Stats: target.statsClass, initializes: () => initializes };
}

test('statistics interception reads native matchmaking and mode fields after complete initialization', () => {
    const plan = analyzeBattleStatistics(fixture); assert.equal(plan.status.ready, true); assert.equal(plan.status.constructorHooks, 1);
    assert.deepEqual(plan.schema, { battleId: 'key', mapName: 'title', mode: 'rule', isMMBattle: 'match', battleLoaded: 'ready' });
    const f = setup(); const mode = { toString: () => 'CP' };
    const stats = new f.Stats('1', 'PRO mentioned in title', mode, true, true);
    assert.equal(stats.rule, mode); assert.equal(stats.complete, true); assert.equal(f.initializes(), 1);
    assert.deepEqual(f.target.messages.map(m => [m.type, m.detail]), [['kasp:battle-mode', 'CP'], ['kasp:battle-kind', 'MM']]);
    new f.Stats('2', 'Osa DM', 'CTF', false, true);
    assert.deepEqual(f.target.messages.slice(-2).map(m => m.detail), ['CTF', 'PRO']);
    new f.Stats('0', 'Another map TDM', 'DM', false, false);
    assert.equal(f.target.messages.length, 4, 'unloaded defaults must not overwrite either history field');
    new f.Stats('3', 'Unknown map', '', false, true);
    assert.equal(f.target.messages.at(-1).detail, 'PRO');
    assert.equal(f.target.messages.length, 5, 'an unrelated TDM string cannot supply the mode');
});

test('prepared statistics templates map renamed fields and constructors without altering semantic JSON keys', async () => {
    for (const base of [fixture, transformSync(fixture, { minify: true }).code]) {
        const plan = analyzeBattleStatistics(base); assert.equal(plan.status.ready, true);
        assert.equal(await selectBattleStatisticsPlan(base, [plan]), plan);
        const source = base.replace(/\bStats\b/g, 'NewStats').replace(/\.key\b/g, '.battle').replace(/\.title\b/g, '.mapName')
            .replace(/\.rule\b/g, '.mode').replace(/\.match\b/g, '.isMMBattle').replace(/\.ready\b/g, '.battleLoaded')
            .replace(/\bproto\b/g, 'prototypeOf') + '\nvar unrelatedReleaseChange=1;';
        const adapted = await selectBattleStatisticsPlan(source, [plan]); assert.ok(adapted);
        assert.equal(adapted.status.strategy, 'ast-template'); assert.equal(adapted.schema.mode, 'mode');
        assert.equal(adapted.schema.isMMBattle, 'isMMBattle'); assert.equal(patches.validatePatchEdits(source, adapted), true);
        const f = setup(source, adapted, { prototypeOf: type => type.prototype });
        const value = new f.Stats('1', 'Misleading map TDM', 'CP', false, true);
        assert.equal(value.battleLoaded, true); assert.deepEqual(f.target.messages.map(m => m.detail), ['CP', 'PRO']);
    }
});

test('computed native fields and single quotes are discovered while lexical constructor shadows stay untouched', async () => {
    const source = fixture.replaceAll('"', "'").replace(/\.(key|title|rule|match|ready)\b/g, "['$1']") +
        '\nfunction other(){function Stats(id,map,mode,mm,loaded){this.key=id;this.title=map;this.rule=mode;this.match=mm;this.ready=loaded}return Stats}';
    const plan = analyzeBattleStatistics(source); assert.equal(plan.status.ready, true);
    const adapted = await selectBattleStatisticsPlan(source + '\nvar changed=true;', [plan]); assert.ok(adapted);
    const f = setup(source + '\nvar changed=true;', adapted); new f.Stats('1', 'Osa', 'DM', false, true);
    const shadow = f.context.other(); const before = f.target.messages.length;
    new shadow('2', 'Osa', 'CP', true, true); assert.equal(f.target.messages.length, before);
    assert.deepEqual(f.target.messages.map(m => m.detail), ['DM', 'PRO']);
});

test('bridge failures preserve native construction, initialization failures propagate and strict mode stays native', async () => {
    const source = '"use strict";\n' + fixture + '\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeBattleStatistics(source), adapted = await selectBattleStatisticsPlan(source + '\nvar other=1;', [plan]); assert.ok(adapted);
    const f = setup(source + '\nvar other=1;', adapted);
    f.target.__kaspBattleStats = () => { throw Error('observer failed'); };
    const value = new f.Stats('1', 'Osa', 'DM', false, true); assert.equal(value.complete, true); assert.equal(f.initializes(), 1);
    assert.equal((0, f.context.nativeStrict)(), true);
    f.context.nativeInitialize = () => { throw Error('native initialization failed'); };
    assert.throws(() => new f.Stats('1', 'Osa', 'DM', false, true), /native initialization failed/);
    const patched = patchBattleStatistics(source, () => { throw Error('diagnostic failed'); }, plan);
    assert.equal(patchBattleStatistics(patched, undefined, plan), patched);
});

test('statistics reader avoids accessors and inherited defaults and keeps explicit mode ahead of the map suffix', () => {
    const schema = analyzeBattleStatistics(fixture).schema;
    const value = { key: '1', title: 'Osa CP', rule: 'dm', match: false, ready: true };
    assert.deepEqual(JSON.parse(JSON.stringify(readBattleStatistics(value, schema))), { kind: 'PRO', mode: 'DM' });
    value.rule = ''; assert.equal(readBattleStatistics(value, schema).mode, 'CP');
    value.title = 'Osa'; value.rule = { toString() { throw Error('native mode unavailable'); } };
    assert.deepEqual(JSON.parse(JSON.stringify(readBattleStatistics(value, schema))), { kind: 'PRO' });
    for (const field of ['ready', 'match', 'rule']) {
        const guarded = { ...value }; Object.defineProperty(guarded, field, { get() { throw Error('getter must not execute'); } });
        assert.doesNotThrow(() => readBattleStatistics(guarded, schema));
    }
    assert.equal(readBattleStatistics(Object.create(value), schema), null);
    assert.equal(readBattleStatistics(value, undefined), null);
    value.ready = false; assert.equal(readBattleStatistics(value, schema), null);
});

test('missing, ambiguous, uninitialized, quoted or unsupported native contracts cannot install a partial hook', async () => {
    const plan = analyzeBattleStatistics(fixture);
    const duplicate = fixture.replace(/\bStats\b/g, 'Second').replace('window.statsClass=Second;', '');
    for (const source of [fixture.replace('BattleStatistics(', 'AnotherStatistics('), fixture.replace('isMMBattle=', 'anotherFlag='),
        fixture.replace('this.match=mm;', ''), fixture.replace('this.match=mm;', 'if(mm)this.match=mm;'),
        fixture.replace('this.ready=loaded;', 'this.ready=loaded;return this;'), fixture + '\n' + duplicate,
        'const quoted=' + JSON.stringify(fixture) + ';/*' + fixture + '*/']) {
        assert.equal(analyzeBattleStatistics(source).status.ready, false);
        assert.equal(await selectBattleStatisticsPlan(source, [plan]), undefined);
        assert.equal(patchBattleStatistics(source), source);
    }
    const stale = { ...plan, edits: plan.edits.map((e, i) => i === 1 ? { ...e, before: 'stale' } : e) };
    assert.equal(patchBattleStatistics(fixture, undefined, stale), fixture);
});

test('statistics preparation validates syntax without evaluating input and preserves working historical plans', () => {
    const os = require('node:os'), { spawnSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-statistics-ast-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-battle-statistics.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        const source = 'throw Error("DO_NOT_EXECUTE");\n' + fixture; fs.writeFileSync(input, source);
        let result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(input, 'utf8'), source);
        fs.writeFileSync(input, source + '\nvar changed=true;'); result = run(); assert.equal(result.status, 0, result.stderr);
        const previous = fs.readFileSync(output, 'utf8'), data = JSON.parse(previous);
        assert.equal(data.format, 'ki-battle-statistics-plans-v1'); assert.equal(data.plans.length, 2);
        fs.writeFileSync(input, source.replace('BattleStatistics(', 'AnotherStatistics('));
        assert.equal(run().status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('all eight AST plans share original offsets and a statistics mismatch leaves the other modules active', () => {
    const readFixture = file => fs.readFileSync(path.join(__dirname, file), 'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const garage = readFixture('garage-items.test.cjs').replace('this.category+")"', 'this.category+", owned="+this.owned+", visible="+this.visible+", secret="+this.secret+")"');
    const inventory = readFixture('garage-inventory.test.cjs').replace('function Item(){}', '').replace(/proto\(Item\)\.toString=[^\n]+;/, '')
        .replace(/\.art\b/g, '.preview').replace(/\.mine\b/g, '.owned');
    const source = ['arcade-reload.test.cjs', 'overdrive-ast.test.cjs', 'game-augments.test.cjs', 'garage-details.test.cjs'].map(readFixture).join('\n') +
        '\n' + garage + '\n' + inventory + '\n' + readFixture('battle-presence-ast.test.cjs') + '\n' + fixture;
    const plans = [require('./overdrive-ast.cjs').analyzeOverdrive(source), require('./arcade-ast.cjs').analyzeArcade(source), require('./augments-ast.cjs').analyzeAugments(source),
        require('./garage-details-ast.cjs').analyzeGarageDetails(source), require('./garage-items-ast.cjs').analyzeGarageItems(source), require('./garage-inventory-ast.cjs').analyzeGarageInventory(source),
        require('./battle-presence-ast.cjs').analyzeBattlePresence(source), analyzeBattleStatistics(source)];
    for (const plan of plans) assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const merged = patches.mergeClientPatchPlans(source, plans); assert.equal(merged.rejected.length, 0); new vm.Script(merged.code);
    const stale = { ...plans[7], sourceLength: source.length + 1 }, rest = patches.mergeClientPatchPlans(source, [...plans.slice(0, 7), stale]);
    assert.equal(rest.code, patches.mergeClientPatchPlans(source, plans.slice(0, 7)).code); assert.equal(rest.rejected[0], stale);
});
