const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const { analyzeUserAction } = require('./user-action-ast.cjs');
const patches = require('./test-client-patches.cjs');
const loaded = { exports: {} };
const compile = source => transformSync(source, { loader: 'ts', format: 'cjs' }).code;
vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../src/core/userActions.ts'), 'utf8')),
    { module: loaded, crypto: webcrypto, TextEncoder, require: () => patches });
const { selectUserActionPlan, patchUserActions, readUserAction, installUserActions } = loaded.exports;

const fixture = `
function Label(uid,relation){this.identifier="NotTheNickname";this.nickname=uid;this.relation=relation;this.clan="NotTheNicknameEither"}
proto(Label).toString=function(){if(window.failDiagnostics)throw Error("diagnostics must not execute");return "UserLabelData(uid="+this.nickname+", teamRelation="+this.relation.toString()+")"};
function Action(label,type){nativeInitialize();this.player=label;this.action=type;this.complete=true}
proto(Action).toString=function(){if(window.failDiagnostics)throw Error("diagnostics must not execute");return "TankUserActionLog(userLabelData="+this.player.toString()+", type="+this.action.toString()+")"};
window.actionClass=Action;window.labelClass=Label;
`;
function setup(source = fixture, plan = analyzeUserAction(source), override = {}) {
    const target = { messages: [], postMessage(message, origin) { assert.equal(origin, '*'); this.messages.push(message); } };
    installUserActions(target); target.failDiagnostics = true;
    let initializes = 0;
    const context = { window: target, proto: type => type.prototype, nativeInitialize() { initializes++; }, ...override };
    vm.runInNewContext(patchUserActions(source, undefined, plan), context);
    return { target, context, Action: target.actionClass, Label: target.labelClass, initializes: () => initializes };
}

test('action interception reads the mapped nickname and enum while preserving native initialization', () => {
    const plan = analyzeUserAction(fixture); assert.equal(plan.status.ready, true); assert.equal(plan.status.constructorHooks, 1);
    assert.deepEqual(plan.schema, { userLabelData: 'player', type: 'action', uid: 'nickname', teamRelation: 'relation' });
    const f = setup(), relation = { toString: () => 'ALLY' }, type = { toString: () => 'CHANGE_EQUIPMENT' };
    const label = new f.Label('Player_One', relation), action = new f.Action(label, type);
    assert.equal(action.player, label); assert.equal(action.action, type); assert.equal(action.complete, true); assert.equal(f.initializes(), 1);
    assert.equal(f.target.messages.length, 1); assert.equal(f.target.messages[0].type, 'kasp:useraction');
    assert.deepEqual(Array.from(f.target.messages[0].detail), ['TankUserActionLog', 'Player_One', 'CHANGE_EQUIPMENT', 'ALLY']);
    new f.Action(new f.Label('Other_Player', null), 'KILL');
    assert.deepEqual(Array.from(f.target.messages[1].detail), ['TankUserActionLog', 'Other_Player', 'KILL']);
});

test('renamed and minified native contracts adapt without corrupting schema labels', async () => {
    for (const base of [fixture, transformSync(fixture, { minify: true }).code]) {
        const plan = analyzeUserAction(base); assert.equal(plan.status.ready, true);
        assert.equal(await selectUserActionPlan(base, [plan]), plan);
        const source = base.replace(/\bAction\b/g, 'NewAction').replace(/\bLabel\b/g, 'NewLabel').replace(/\bproto\b/g, 'prototypeOf')
            .replace(/\.player\b/g, '.userLabelData').replace(/\.action\b/g, '.type').replace(/\.nickname\b/g, '.uid').replace(/\.relation\b/g, '.teamRelation') + '\nvar unrelatedReleaseChange=1;';
        const adapted = await selectUserActionPlan(source, [plan]); assert.ok(adapted);
        assert.equal(adapted.status.strategy, 'ast-template'); assert.equal(adapted.schema.type, 'type'); assert.equal(adapted.schema.uid, 'uid');
        assert.equal(patches.validatePatchEdits(source, adapted), true);
        const f = setup(source, adapted, { prototypeOf: type => type.prototype });
        new f.Action(new f.Label('Player_One', 'ENEMIES'), 'CHANGE_EQUIPMENT');
        assert.deepEqual(Array.from(f.target.messages[0].detail), ['TankUserActionLog', 'Player_One', 'CHANGE_EQUIPMENT', 'ENEMIES']);
    }
});

test('computed native fields and optional relation work while lexical constructor shadows stay untouched', async () => {
    const source = fixture.replaceAll('"', "'").replace(/\.(player|action|nickname|relation)\b/g, "['$1']") +
        '\nfunction other(){function Action(label,type){this.player=label;this.action=type}return Action}';
    const plan = analyzeUserAction(source); assert.equal(plan.status.ready, true);
    const adapted = await selectUserActionPlan(source + '\nvar changed=true;', [plan]); assert.ok(adapted);
    const f = setup(source + '\nvar changed=true;', adapted), label = new f.Label('Player_One', 'ALLY');
    new f.Action(label, 'CHANGE_EQUIPMENT'); const shadow = f.context.other(); new shadow(label, 'CHANGE_EQUIPMENT');
    assert.equal(f.target.messages.length, 1);
    const noRelation = fixture.replace('+", teamRelation="+this.relation.toString()', '');
    const partial = analyzeUserAction(noRelation); assert.equal(partial.status.ready, true); assert.equal(partial.schema.teamRelation, undefined);
    const next = setup(noRelation, partial); new next.Action(new next.Label('Player_One', 'ALLY'), 'CHANGE_EQUIPMENT');
    assert.deepEqual(Array.from(next.target.messages[0].detail), ['TankUserActionLog', 'Player_One', 'CHANGE_EQUIPMENT']);
});

test('observer errors cannot break construction; native initialization errors and strict mode remain unchanged', async () => {
    const source = '"use strict";\n' + fixture + '\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeUserAction(source), adapted = await selectUserActionPlan(source + '\nvar other=1;', [plan]); assert.ok(adapted);
    const f = setup(source + '\nvar other=1;', adapted), label = new f.Label('Player_One', 'ALLY');
    f.target.__kaspSendAction = () => { throw Error('observer failed'); };
    assert.equal(new f.Action(label, 'CHANGE_EQUIPMENT').complete, true); assert.equal(f.initializes(), 1);
    assert.equal((0, f.context.nativeStrict)(), true);
    delete f.target.__kaspSendAction; assert.equal(new f.Action(label, 'CHANGE_EQUIPMENT').complete, true);
    f.context.nativeInitialize = () => { throw Error('native initialization failed'); };
    assert.throws(() => new f.Action(label, 'CHANGE_EQUIPMENT'), /native initialization failed/);
    const patched = patchUserActions(source, () => { throw Error('diagnostic failed'); }, plan);
    assert.equal(patchUserActions(patched, undefined, plan), patched);
});

test('reader ignores accessors, inherited data and unrelated graphs and handles malformed enum values', () => {
    const schema = analyzeUserAction(fixture).schema;
    const label = { nickname: ' Player_One ', relation: 'ALLY' }, value = { player: label, action: 'CHANGE_EQUIPMENT' };
    let reads = 0; Object.defineProperty(value, 'unrelated', { get() { reads++; throw Error('unrelated getter'); } });
    value.graph = { recurse: value }; assert.deepEqual(Array.from(readUserAction(value, schema)), ['TankUserActionLog', 'Player_One', 'CHANGE_EQUIPMENT', 'ALLY']);
    assert.equal(reads, 0); assert.equal(readUserAction(Object.create(value), schema), null);
    for (const field of ['player', 'action']) {
        const guarded = { ...value }; Object.defineProperty(guarded, field, { get() { throw Error('mapped getter must not execute'); } });
        assert.equal(readUserAction(guarded, schema), null);
    }
    Object.defineProperty(label, 'nickname', { get() { throw Error('nickname getter must not execute'); } });
    assert.equal(readUserAction(value, schema), null);
    for (const type of [{}, null, { toString() { throw Error('broken enum'); } }, 'NotAnEnum']) {
        assert.equal(readUserAction({ player: { nickname: 'Player_One' }, action: type }, schema), null);
    }
    const relation = { toString() { throw Error('broken optional relation'); } };
    assert.deepEqual(Array.from(readUserAction({ player: { nickname: 'Player_One', relation }, action: 'CHANGE_EQUIPMENT' }, schema)), ['TankUserActionLog', 'Player_One', 'CHANGE_EQUIPMENT']);
});

test('mapped actions reach the existing change counter once per equipment change and under the actual nickname', () => {
    const f = setup(), listeners = [], stored = new Map();
    f.target.addEventListener = (type, callback) => { if (type === 'message') listeners.push(callback); };
    f.target.postMessage = message => { f.target.messages.push(message); listeners.forEach(callback => callback({ source: f.target, data: message })); };
    const counter = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(path.join(__dirname, '../src/modules/changeCounter.ts'), 'utf8')), {
        module: counter, window: f.target, document: { addEventListener() {}, querySelector: () => null },
        sessionStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
        require: () => ({ gameDOM: { statistics: { container: '.stats' }, screens: { battleCanvas: '.canvas' } } }),
    });
    const label = new f.Label('Player_One', 'ALLY');
    new f.Action(label, { toString: () => 'CHANGE_EQUIPMENT' }); new f.Action(label, 'CHANGE_EQUIPMENT'); new f.Action(label, 'KILL');
    new f.Action(new f.Label('Other_Player', 'ENEMIES'), 'CHANGE_EQUIPMENT');
    assert.deepEqual(JSON.parse(stored.get('kasp_player_changes_cache')), { Player_One: 2, Other_Player: 1 });
    f.target.__kaspSendAction('AnotherClass', {}, analyzeUserAction(fixture).schema); assert.equal(f.target.messages.length, 4);
});

test('incomplete, ambiguous, uninitialized or quoted contracts cannot install a partial action hook', async () => {
    const plan = analyzeUserAction(fixture), duplicate = fixture.replace(/\bAction\b/g, 'SecondAction').replace(/\bLabel\b/g, 'SecondLabel');
    for (const source of [fixture.replace('TankUserActionLog(', 'AnotherLog('), fixture.replace('UserLabelData(', 'AnotherLabel('),
        fixture.replace('uid=', 'anotherField='), fixture.replace('this.action=type;', ''), fixture.replace('this.action=type;', 'if(type)this.action=type;'),
        fixture.replace('this.action=type;', 'this.action=type;return this;'), fixture + '\n' + duplicate,
        'const quoted=' + JSON.stringify(fixture) + ';/*' + fixture + '*/']) {
        assert.equal(analyzeUserAction(source).status.ready, false);
        assert.equal(await selectUserActionPlan(source, [plan]), undefined);
        assert.equal(patchUserActions(source), source);
    }
    const stale = { ...plan, edits: plan.edits.map((e, i) => i === 1 ? { ...e, before: 'stale' } : e) };
    assert.equal(patchUserActions(fixture, undefined, stale), fixture);
});

test('action preparation never executes input and preserves historical plans on failure', () => {
    const os = require('node:os'), { spawnSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-action-ast-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-user-action.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        const source = 'throw Error("DO_NOT_EXECUTE");\n' + fixture; fs.writeFileSync(input, source);
        let result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(input, 'utf8'), source);
        fs.writeFileSync(input, source + '\nvar changed=true;'); result = run(); assert.equal(result.status, 0, result.stderr);
        const previous = fs.readFileSync(output, 'utf8'), data = JSON.parse(previous);
        assert.equal(data.format, 'ki-user-action-plans-v1'); assert.equal(data.plans.length, 2);
        fs.writeFileSync(input, source.replace('TankUserActionLog(', 'AnotherLog('));
        assert.equal(run().status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('all nine AST plans merge against original offsets and isolate a stale action mapping', () => {
    const readFixture = file => fs.readFileSync(path.join(__dirname, file), 'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const garage = readFixture('garage-items.test.cjs').replace('this.category+")"', 'this.category+", owned="+this.owned+", visible="+this.visible+", secret="+this.secret+")"');
    const inventory = readFixture('garage-inventory.test.cjs').replace('function Item(){}', '').replace(/proto\(Item\)\.toString=[^\n]+;/, '')
        .replace(/\.art\b/g, '.preview').replace(/\.mine\b/g, '.owned');
    const source = ['arcade-reload.test.cjs', 'overdrive-ast.test.cjs', 'game-augments.test.cjs', 'garage-details.test.cjs'].map(readFixture).join('\n') +
        '\n' + garage + '\n' + inventory + '\n' + readFixture('battle-presence-ast.test.cjs') + '\n' + readFixture('battle-statistics-ast.test.cjs') + '\n' + fixture;
    const plans = [require('./overdrive-ast.cjs').analyzeOverdrive(source), require('./arcade-ast.cjs').analyzeArcade(source), require('./augments-ast.cjs').analyzeAugments(source),
        require('./garage-details-ast.cjs').analyzeGarageDetails(source), require('./garage-items-ast.cjs').analyzeGarageItems(source), require('./garage-inventory-ast.cjs').analyzeGarageInventory(source),
        require('./battle-presence-ast.cjs').analyzeBattlePresence(source), require('./battle-statistics-ast.cjs').analyzeBattleStatistics(source), analyzeUserAction(source)];
    for (const plan of plans) assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const merged = patches.mergeClientPatchPlans(source, plans); assert.equal(merged.rejected.length, 0); new vm.Script(merged.code);
    const stale = { ...plans[8], sourceLength: source.length + 1 }, rest = patches.mergeClientPatchPlans(source, [...plans.slice(0, 8), stale]);
    assert.equal(rest.code, patches.mergeClientPatchPlans(source, plans.slice(0, 8)).code); assert.equal(rest.rejected[0], stale);
});
