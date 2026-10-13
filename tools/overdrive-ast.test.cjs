const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { parse, tokenizer } = require('acorn');
const { analyzeOverdrive } = require('./overdrive-ast.cjs');

const moduleRef = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/bonusPickup.ts'), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: moduleRef, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const runtime = moduleRef.exports;

const source = `
/* fixture A */
(function(){
 function V$(x,y,z){this.$up=z;this.unrelated=99;this.$right=x;this['forward']=y}
 V$.prototype.toString=function(){if(window.failDiagnostics)throw Error('do not execute diagnostics');return 'Vector3 ('+this.$right+', '+this['forward']+', '+this.$up+')'};
 function B$(box,sound){this.metadata={};this.other={};this.$audio=sound;this['$mesh']=box}
 B$.prototype.toString=function(){if(window.failDiagnostics)throw Error('do not execute diagnostics');return 'BattleBonusData(box='+this['$mesh']+', pickupSound='+this.$audio+', dropSound='+this.other+')'};
 function X$(){}
 X$.prototype['take$']=function(a,b){'use strict';return play$(this,this.audio,a,b,'bonus pickup')};
 X$.prototype.spawn$=function(id,data,point,rotation,falling){
   var box=this.pool.get();
   return (box.init(id,data),box.place(point,rotation,falling,'onBonusCollision'),44);
 };
 function own$(box,point){return receiver['take$'](get$(box).$audio,point)}
 function teammate$(box,point){return receiver.take$(get$(box).$audio,point)}
 window.fixture={Vector:V$,Bonus:B$,Receiver:X$,own:own$,teammate:teammate$};
})();`;

test('offline AST plans handle renamed/computed fields, minification and both pickup paths without executing getters', async () => {
    for (const input of [source, transformSync(source, { minify: true, loader: 'js' }).code]) {
        const plan = analyzeOverdrive(input);
        assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
        assert.equal(plan.status.pickupCalls, 2);
        assert.equal(plan.status.registrationHooks, 1);
        assert.equal(await runtime.selectBonusPatchPlan(input, [plan]), plan);
        const events = [], order = [], plays = [];
        let reads = 0, sounds = 0;
        const bridge = runtime.createBonusPickupBridge((model, position) => events.push({ model, position }));
        const box = { init(_id, data) { this.data = data; order.push('init'); return 73; }, place() { order.push('place'); } };
        const window = { failDiagnostics: true, __kaspBonusType: runtime.registerBonusType, __kaspBonusContext: bridge.context,
            __kaspBonusPrepare: bridge.prepare, __kaspBonusRegister: (...args) => { order.push('observe'); bridge.register(...args); } };
        const context = { window, get$: box => { reads++; return box.data; },
            play$: (...args) => { plays.push(args); return 123; } };
        const patched = runtime.patchBonusPickups(input, undefined, plan);
        parse(patched, { ecmaVersion: 'latest' });
        vm.runInNewContext(patched, context);
        const { Vector, Bonus, Receiver, own, teammate } = window.fixture;
        const resource = Object.assign(Object.create({ toString: () => runtime.OVERDRIVE_BOX_MODEL }), { low: 1, high: 2 });
        const data = new Bonus({ id: resource }, 42);
        // Metadata appearing before the mapped mesh must not become the picked model.
        data.metadata = Object.assign(Object.create({ toString: () => '9876543210' }), { low: 3, high: 4 });
        Object.defineProperty(data, '$audio', { get() { sounds++; return 42; } });
        context.receiver = new Receiver(); context.receiver.pool = { get: () => box };
        const origin = new Vector(1, 2, 300), landing = new Vector(9000, 8000, 10);
        assert.equal(context.receiver.spawn$('one', data, origin, 0, false), 44);
        origin.$right = 100000;
        assert.equal(own(box, landing), 123); assert.equal(teammate(box, landing), 123);
        assert.deepEqual(order, ['init', 'observe', 'place']);
        assert.equal(reads, 2); assert.equal(sounds, 2, 'each native sound getter is evaluated exactly once');
        assert.equal(events.length, 2); assert.equal(events[0].model, runtime.OVERDRIVE_BOX_MODEL);
        assert.deepEqual({ ...events[0].position }, { x: 1, y: 2, z: 300 });
        assert.equal(plays[0][2], 42); assert.equal(plays[0][3], landing);
        assert.equal(runtime.patchBonusPickups(patched, undefined, plan), patched);
    }
});

test('unrelated changes use templates; edit guards and scope checks reject incompatible changes without partial patching', async () => {
    const plan = analyzeOverdrive(source);
    assert.equal((await runtime.selectBonusPatchPlan(source.replace('fixture A', 'fixture B'), [plan])).status.strategy, 'ast-template');
    assert.equal((await runtime.selectBonusPatchPlan(source + ' ', [plan])).status.strategy, 'ast-template');
    assert.equal(await runtime.selectBonusPatchPlan(source.replace('bonus pickup', 'different sound'), [plan]), undefined);
    let report;
    assert.equal(runtime.patchBonusPickups(source, status => { report = status; }), source);
    assert.equal(report.ready, false);
    const broken = { ...plan, edits: plan.edits.map((edit, index) => index === 1 ? { ...edit, before: 'stale' } : edit) };
    assert.equal(runtime.patchBonusPickups(source, status => { report = status; }, broken), source);
    assert.equal(report.issues[0], 'bundle-edit-mismatch');
    const ambiguous = analyzeOverdrive(source.replace("window.fixture=", "X$.prototype.other=function(a,b){play$(this,this.audio,a,b,'bonus pickup')};window.fixture="));
    assert.equal(ambiguous.status.ready, false); assert.ok(ambiguous.status.issues.includes('pickup-method-ambiguous'));
    const foreign = source + '\n(function(){function get$(t){return t}receiver.take$(get$(box).$audio,point)})();';
    assert.equal(analyzeOverdrive(foreign).status.pickupCalls, 2, 'a same-named call in a foreign lexical scope is left untouched');
});

test('prepared templates relocate hooks after renaming and formatting without regenerating the plan', async () => {
    const rename = { 'V$': 'NewVector$', 'B$': 'NewBonus$', 'X$': 'NewManager$', a: 'audioNew$', b: 'pointNew$',
        '$right': 'eastNew$', forward: 'northNew$', '$up': 'heightNew$', '$mesh': 'meshNew$', '$audio': 'soundNew$', 'take$': 'takeNew$',
        'play$': 'playNew$', 'get$': 'getNew$' };
    for (const input of [source, transformSync(source, { minify: true }).code]) {
        let changed = input;
        for (const token of [...tokenizer(input, { ecmaVersion: 'latest' })].reverse()) {
            if (!['name', 'string'].includes(token.type.label) || !Object.hasOwn(rename, token.value)) continue;
            const replacement = token.type.label === 'string' ? JSON.stringify(rename[token.value]) : rename[token.value];
            changed = changed.slice(0, token.start) + replacement + changed.slice(token.end);
        }
        changed = '/* unrelated client changes */\n' + changed.replace(/\)\{/g, ') {\n');
        const adapted = await runtime.selectBonusPatchPlan(changed, [analyzeOverdrive(input)]);
        assert.ok(adapted, 'the existing plan must match the changed bundle');
        assert.equal(adapted.status.strategy, 'ast-template');
        const patched = runtime.patchBonusPickups(changed, undefined, adapted);
        parse(patched, { ecmaVersion: 'latest' });
        const events = [], order = [];
        const bridge = runtime.createBonusPickupBridge((model, position) => events.push({ model, position }));
        const box = { init(_id, data) { this.data = data; order.push('init'); }, place() { order.push('place'); } };
        let reads = 0;
        const window = { failDiagnostics: true, __kaspBonusType: runtime.registerBonusType, __kaspBonusContext: bridge.context,
            __kaspBonusPrepare: bridge.prepare, __kaspBonusRegister: (...args) => { order.push('observe'); bridge.register(...args); } };
        const context = { window, getNew$: item => { reads++; return item.data; }, playNew$: () => 123 };
        vm.runInNewContext(patched, context);
        const { Vector, Bonus, Receiver, own, teammate } = window.fixture;
        const resource = Object.assign(Object.create({ toString: () => runtime.OVERDRIVE_BOX_MODEL }), { low: 1, high: 2 });
        const data = new Bonus({ id: resource }, 42);
        context.receiver = new Receiver(); context.receiver.pool = { get: () => box };
        const origin = new Vector(1, 2, 300), landing = new Vector(9000, 8000, 10);
        assert.equal(context.receiver.spawn$('one', data, origin, 0, false), 44);
        origin.eastNew$ = 100000;
        assert.equal(own(box, landing), 123); assert.equal(teammate(box, landing), 123);
        assert.deepEqual(order, ['init', 'observe', 'place']);
        assert.equal(reads, 2); assert.equal(events.length, 2);
        assert.equal(events[0].model, runtime.OVERDRIVE_BOX_MODEL);
        assert.deepEqual({ ...events[0].position }, { x: 1, y: 2, z: 300 });
    }
});

test('templates ignore quoted/commented copies and reject ambiguous hooks, role conflicts and duplicate coordinates', async () => {
    const plan = analyzeOverdrive(source);
    const copy = source.replace('/* fixture A */', '');
    const copied = source + '\n/* copied code\n' + copy + '\n*/\nconst quotedCode=' + JSON.stringify(source) + ';';
    assert.equal((await runtime.selectBonusPatchPlan(copied, [plan])).status.strategy, 'ast-template');
    assert.equal(await runtime.selectBonusPatchPlan('/*\n' + copy + '\n*/', [plan]), undefined);
    const duplicate = source + '\n' + source.slice(source.indexOf("X$.prototype['take$']"), source.indexOf('X$.prototype.spawn$'));
    assert.equal(await runtime.selectBonusPatchPlan(duplicate, [plan]), undefined);
    assert.equal(await runtime.selectBonusPatchPlan(source.replace('receiver.take$', 'receiver.wrong$'), [plan]), undefined);
    assert.equal(await runtime.selectBonusPatchPlan(source.replaceAll("this['forward']", "this['$right']"), [plan]), undefined);
    const invalid = { ...plan, templates: [{ ...plan.templates[0], pattern: '(' }] };
    assert.equal(await runtime.selectBonusPatchPlan(source + ' ', [invalid]), undefined);
});

test('runtime type registration rejects malformed maps and never reads accessor coordinates', () => {
    const prototype = {};
    assert.equal(runtime.registerBonusType(prototype, 'vector', { x: 'a', y: 'a', z: 'c' }), false);
    assert.equal(runtime.registerBonusType(prototype, 'vector', { x: 'a', y: 'b', z: 'c' }), true);
    const point = Object.assign(Object.create(prototype), { a: 1, b: 2, c: 3 });
    Object.defineProperty(point, 'b', { get() { throw Error('must not execute'); } });
    assert.equal(runtime.readBonusPosition(point), null);
    assert.equal(runtime.readBonusPosition({ f20_1: 1, g20_1: 2, h20_1: 3 }), null);
});

test('preparation CLI keeps previous plans and refuses incomplete mappings without changing its output', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-overdrive-ast-'));
    const input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-overdrive.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        fs.writeFileSync(input, source); let result = run(); assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(fs.readFileSync(output)).plans.length, 1);
        fs.writeFileSync(input, source.replace('fixture A', 'fixture B')); result = run(); assert.equal(result.status, 0, result.stderr);
        assert.equal(JSON.parse(fs.readFileSync(output)).plans.length, 2);
        const before = fs.readFileSync(output, 'utf8');
        fs.writeFileSync(input, 'console.log("no bonus classes")'); result = run(); assert.equal(result.status, 1);
        assert.equal(fs.readFileSync(output, 'utf8'), before);
    } finally {
        for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file);
        fs.rmdirSync(dir);
    }
});
