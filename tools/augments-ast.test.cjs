const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');
const { transformSync } = require('esbuild');
const { parse } = require('acorn');
const { analyzeAugments } = require('./augments-ast.cjs');
const { mergeClientPatchPlans } = require('./test-client-patches.cjs');
const root = path.join(__dirname, '..');
const fixture = fs.readFileSync(path.join(__dirname, 'game-augments.test.cjs'), 'utf8').match(/const fixture = `([\s\S]*?)`;/)[1] + `
function View(){}
ke(View).toString=function(){return "GarageDevice(id="+this.deviceId.toString()+", previewImage="+this.preview+", rarity="+this.rarity.toString()+")"};
function iconCard(t){var g=t.props.icon;return g==null?null:g.imageURL()}
`;
const moduleRef = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync(path.join(root, 'src/core/gameAugments.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module: moduleRef, crypto: webcrypto, TextEncoder,
    require: id => id === './clientPatches' ? require('./test-client-patches.cjs') : {},
});
const runtime = moduleRef.exports;
const context = () => ({ Map, window: { __kaspAugmentConfigure(value) { this.schema = value; },
    __kaspAugmentData(...args) { (this.data ||= []).push(args); }, __kaspAugmentLink(...args) { (this.links ||= []).push(args); } } });

test('augment AST derives every schema from native diagnostics and binds the writer to its own lexical class', () => {
    for (const code of [fixture, transformSync(fixture, { minifyWhitespace: true }).code]) {
        const plan = analyzeAugments(code);
        assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
        assert.equal(plan.schema.properties, 'ncb_1');
        assert.equal(plan.schema.objectIdMethod, 'p57');
        assert.equal(plan.schema.imageUrlMethod, 'imageURL');
        assert.equal(plan.schema.viewRarity, 'rarity');
        assert.equal(plan.schema.upgradeData, 'mch_1');
        assert.equal(plan.schema.baseFinal, 'xch_1');
        const c = context(); runFeatureContext(runtime.patchGameAugments(code, undefined, plan), c);
        const key = {}, value = {}; new c.model().r7i(key, value); new c.dto('123', '456');
        assert.equal(c.window.data.length, 1); assert.equal(c.window.data[0][0], key);
        assert.deepEqual(Array.from(c.window.links[0]), ['123', '456']);
    }
});

test('augment templates adapt renamed fields, methods and classes without evaluating the native bundle', async () => {
    for (const source of [fixture, transformSync(fixture, { minifyWhitespace: true }).code]) {
        const plan = analyzeAugments(source);
        let changed = source;
        for (const name of ['ke', 'mh', 'jh', 'desc', 'dto', 'model', 'upgrade', 'upgradeData', 'group', 'base', 'View',
            'ocb', 'och', 'p57', 'r7i', 'imageURL', ...Object.values(plan.schema)]) {
            // Diagnostic text stays intact; native obfuscated symbols carry underscores or are methods/classes.
            if (['deviceId', 'preview', 'rarity'].includes(name)) continue;
            changed = changed.replace(new RegExp(`\\b${name}\\b`, 'g'), `renamed_${name}`);
        }
        changed += '\nthrow Error("DO_NOT_EXECUTE");';
        const adapted = await runtime.selectGameAugmentsPlan(changed, [plan]);
        assert.ok(adapted, 'compatible native shapes should adapt');
        assert.equal(adapted.status.strategy, 'ast-template');
        assert.equal(adapted.schema.properties, 'renamed_ncb_1');
        assert.equal(adapted.schema.objectIdMethod, 'renamed_p57');
        assert.equal(adapted.schema.upgradeData, 'renamed_mch_1');
        const patched = runtime.patchGameAugments(changed, undefined, adapted);
        parse(patched, { ecmaVersion: 'latest' });
        const c = context();
        assert.throws(() => runFeatureContext(patched, c), /DO_NOT_EXECUTE/);
        assert.equal(c.window.schema.properties, 'renamed_ncb_1');
        const object = {}, data = {}, m = new c.renamed_model(); m.renamed_r7i(object, data);
        assert.equal(m.l7j_1.s2a_1.get(object), data);
        assert.equal(c.window.data.length, 1);
        new c.renamed_dto('id', 'base'); assert.deepEqual(Array.from(c.window.links[0]), ['id', 'base']);
    }
});

test('known hashes select exact plans; changed relevant shapes, quoted decoys and ambiguous native models skip only augments', async () => {
    const plan = analyzeAugments(fixture);
    assert.equal(await runtime.selectGameAugmentsPlan(fixture, [plan]), plan);
    for (const changed of [
        fixture.replace('DevicePropertiesCC [', 'UnknownProperties ['),
        fixture.replace('this.l7j_1.s2a_1.set(t,n)', 'this.l7j_1.s2a_1.delete(t)'),
        fixture.replace('ke(model).p57=function(){return this.modelId}', 'ke(model).p57=function(){return getId(this)}'),
        'const quoted=' + JSON.stringify(fixture) + ';/*' + fixture + '*/',
        fixture + '\nke(mh).ocb=function(){var t=this.ncb_1;if(t!=null)return t;throw Error(\'missing\')}',
    ]) {
        assert.equal(await runtime.selectGameAugmentsPlan(changed, [plan]), undefined);
        assert.equal(runtime.patchGameAugments(changed), changed);
    }
    const ambiguous = fixture + 'function another(){};ke(another).id=function(){return this.idValue};ke(another).read=function(t){throw Error("No data for "+t+" context: ")};ke(another).write=function(t,n){this.cache.native.set(t,n)}';
    assert.equal(analyzeAugments(ambiguous).status.ready, false);
    const damaged = { ...plan, edits: plan.edits.map((edit, index) => index === 1 ? { ...edit, before: 'stale' } : edit) };
    assert.equal(runtime.patchGameAugments(fixture, undefined, damaged), fixture);
    const patched = runtime.patchGameAugments(fixture, undefined, plan);
    assert.equal(runtime.patchGameAugments(patched, undefined, plan), patched);
});

test('map call interception preserves its return, receiver, write count and global strict mode even if bridges throw', async () => {
    const source = '"other directive";/*native*/"use strict";\n' + fixture.replace('this.l7j_1.s2a_1.set(t,n)}', 'return this.l7j_1.s2a_1.set(t,n)}') + '\nfunction isStrict(){return this===undefined}';
    const plan = analyzeAugments(source); assert.equal(plan.status.ready, true);
    for (const input of [source, source + '\n/*another-build*/', source.replace('"use strict";', '"use strict"\n')]) {
        const selected = await runtime.selectGameAugmentsPlan(input, [plan]); assert.ok(selected);
        const c = context(); c.window.__kaspAugmentData = c.window.__kaspAugmentLink = () => { throw Error('extension failed'); };
        runFeatureContext(runtime.patchGameAugments(input, undefined, selected), c);
        let writes = 0; const native = new Map(); const m = new c.model();
        m.l7j_1.s2a_1 = { set(key, data) { assert.equal(this, m.l7j_1.s2a_1); writes++; native.set(key, data); return this; } };
        const key = {}, value = {};
        assert.equal(m.r7i(key, value), m.l7j_1.s2a_1); assert.equal(writes, 1); assert.equal(native.get(key), value);
        assert.equal((0, c.isStrict)(), true); new c.dto('id', 'base');
    }
});

test('augments CLI never executes its input and preserves existing mappings when analysis fails', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-augments-ast-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-augments.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        const source = 'throw Error("DO_NOT_EXECUTE");\n' + fixture;
        fs.writeFileSync(input, source); let result = run(); assert.equal(result.status, 0, result.stderr);
        const previous = fs.readFileSync(output, 'utf8'), data = JSON.parse(previous);
        assert.equal(data.format, 'ki-augments-plans-v1'); assert.equal(data.plans[0].schema.properties, 'ncb_1');
        assert.equal(fs.readFileSync(input, 'utf8'), source);
        fs.writeFileSync(input, source.replace('No data for ', 'Missing data '));
        result = run(); assert.equal(result.status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('all three AST plans share original offsets without invalidating each other', () => {
    const readFixture = name => fs.readFileSync(path.join(__dirname, name), 'utf8').match(/const source = `([\s\S]*?)`;/)[1];
    const source = readFixture('arcade-reload.test.cjs') + '\n' + readFixture('overdrive-ast.test.cjs') + '\n' + fixture;
    const plans = [require('./overdrive-ast.cjs').analyzeOverdrive(source), require('./arcade-ast.cjs').analyzeArcade(source), analyzeAugments(source)];
    for (const plan of plans) assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const merged = mergeClientPatchPlans(source, plans);
    assert.equal(merged.rejected.length, 0); parse(merged.code, { ecmaVersion: 'latest' });
    for (const name of ['__kaspBonusPrepare', '__kaspArcadeHudCreate', '__kaspAugmentConfigure', '__kaspAugmentLink', '__kaspAugmentData']) assert.ok(merged.code.includes(name));
    const stale = { ...plans[2], sourceLength: source.length + 1 };
    const remaining = mergeClientPatchPlans(source, [plans[0], plans[1], stale]);
    assert.equal(remaining.code, mergeClientPatchPlans(source, plans.slice(0, 2)).code);
    assert.equal(remaining.rejected[0], stale);
});
