const runFeatureContext = require("../helpers/feature-context.cjs");
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const loaded = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/garageInventory.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: loaded, exports: loaded.exports, crypto: require('crypto').webcrypto, TextEncoder, require: () => require("../helpers/client-patches.cjs") });
const { installGarageInventoryDiagnostics } = loaded.exports;
const { analyzeGarageInventory } = require("../../ast/garage-inventory-ast.cjs");
const patchGarageInventoryDiagnostics = (code, report, plan) => loaded.exports.patchGarageInventoryDiagnostics(code, report, plan || analyzeGarageInventory(code));
const fixture = `
function State(t){this.raw=t;this.flat=t;this.completed=true}function Item(){}
proto(State).values=function(){return this.flat.b3()};
proto(State).toString=function(){return "GarageItemsState(itemsByBase="+this.raw+")"};
proto(Item).toString=function(){return "GarageItem(id="+this.key.toString()+", name="+this.title+", category="+this.kind.toString()+", viewCategory="+this.view.toString()+", description="+this.text+", preview="+stringify(this.art)+", owned="+this.mine+", buyable="+this.sale+", visible="+this.shown+", secret="+this.hidden+")"};
function nativeInventory(s){var list=s.values();for(var it=list.t();it.u();)it.v()}
function nativeImage(t){return t.mine?placeholder:t.art.url()}
`;
function setup() {
    const target = { document: { querySelectorAll: () => [{ getAttribute: () => '1' }] } };
    installGarageInventoryDiagnostics(target);
    const context = { window: target, proto: type => type.prototype };
    runFeatureContext(patchGarageInventoryDiagnostics(fixture), context);
    return { target, context };
}
const collection = items => ({ b3: () => ({ t: () => {
    let position = 0;
    return { u: () => position < items.length, v: () => items[position++] };
} }) });
const item = (id, visible) => ({ key: { toString: () => String(id) }, title: 'Item ' + id,
    kind: { toString: () => 'GRENADE' }, view: { toString: () => 'GRENADE' }, text: 'Native description',
    art: { url: () => 'native-image-' + id }, mine: false, sale: false, shown: visible, hidden: true });

test('diagnostic reports received hidden items and native metadata without changing inventory', () => {
    const { target, context } = setup();
    assert.equal(target.__kaspGarageInventoryDebug().captured, false);
    const values = [item(1, true), item(2, false)];
    const original = collection(values);
    const state = new context.State(original);
    assert.equal(state.completed, true);
    assert.equal(state.flat, original);
    const result = target.__kaspGarageInventoryDebug();
    assert.equal(result.captured, true);
    assert.equal(result.total, 2);
    assert.equal(result.hidden, 1);
    assert.equal(result.secret, 2);
    assert.equal(result.unowned, 2);
    assert.equal(result.items[1].name, 'Item 2');
    assert.equal(result.items[1].preview, 'native-image-2');
    assert.equal(result.items[1].visible, false);
    assert.equal(result.items[0].renderedInDOM, true);
    assert.equal(result.items[1].renderedInDOM, false);
    assert.equal(values[1].shown, false);
    new context.State(collection([item(3, false)]));
    assert.equal(target.__kaspGarageInventoryDebug().items[0].id, '3', 'reads the latest inventory state');
});

test('capture errors cannot interrupt native initialization', () => {
    const { target, context } = setup();
    target.__kaspGarageInventoryCapture = () => { throw new Error('diagnostic failure'); };
    assert.equal(new context.State(collection([])).completed, true);
});

test('unsupported bundles are unchanged, patch is idempotent and generated names can include dollar signs', () => {
    assert.equal(patchGarageInventoryDiagnostics('unknown bundle'), 'unknown bundle');
    const patched = patchGarageInventoryDiagnostics(fixture);
    assert.notEqual(patched, fixture);
    assert.equal(patchGarageInventoryDiagnostics(patched), patched);
    const renamed = fixture.replace(/\bState\b/g, 'S$').replaceAll('Item()', 'I$()').replaceAll('proto(Item)', 'proto(I$)');
    assert.notEqual(patchGarageInventoryDiagnostics(renamed), renamed);
    new vm.Script(patchGarageInventoryDiagnostics(renamed));
});

function mappedCollection(items, schema, calls = []) {
    const value = { [schema.valuesMethod]() {
        assert.equal(this, value); calls.push(schema.valuesMethod);
        const list = { [schema.iteratorMethod]() {
            assert.equal(this, list); calls.push(schema.iteratorMethod);
            let index = 0;
            const iterator = { [schema.hasNextMethod]() { assert.equal(this, iterator); return index < items.length; },
                [schema.nextMethod]() { assert.equal(this, iterator); return items[index++]; } };
            return iterator;
        } };
        return list;
    } };
    return value;
}

test('prepared inventory templates adapt all item fields and collection methods without changing JSON labels', async () => {
    // Native field names may themselves equal diagnostic JSON labels.
    let source = fixture;
    const fields = { key: 'id', title: 'name', kind: 'category', view: 'viewCategory', text: 'description', art: 'preview',
        mine: 'owned', sale: 'buyable', shown: 'visible', hidden: 'secret' };
    for (const [from, to] of Object.entries(fields)) source = source.replace(new RegExp('\\.'+from+'\\b','g'),'.'+to);
    for (const original of [source, transformSync(source, { minifyWhitespace: true }).code]) {
        const plan = analyzeGarageInventory(original); assert.equal(plan.status.ready, true);
        let changed = original.replace(/\bState\b/g, 'S$').replace(/\bItem\b/g, 'I$');
        for (const name of [...Object.values(fields), 'b3', 't', 'u', 'v', 'url', 'values', 'flat']) changed = changed.replace(new RegExp('\\.'+name+'\\b','g'),'.updated_'+name);
        changed += '\n/*unrelated update*/';
        const adapted = await loaded.exports.selectGarageInventoryPlan(changed, [plan]); assert.ok(adapted);
        assert.equal(adapted.status.strategy, 'ast-template');
        assert.equal(adapted.schema.id, 'updated_id'); assert.equal(adapted.schema.valuesMethod, 'updated_b3');
        assert.equal(adapted.schema.nextMethod, 'updated_v');
        const patched = patchGarageInventoryDiagnostics(changed, undefined, adapted); new vm.Script(patched);
        assert.equal(patched.includes(adapted.schemaToken), false);
        const target = { document: { querySelectorAll: () => [] } }; installGarageInventoryDiagnostics(target);
        const c = { window: target, proto: type => type.prototype }; runFeatureContext(patched, c);
        const raw = { updated_id: { toString: () => '9223372036854775807' }, updated_name: 'Native name', updated_owned: false,
            updated_visible: false, updated_secret: true, updated_preview: { updated_url: () => 'native-preview' } };
        const values = [raw], collection = mappedCollection(values, adapted.schema);
        new c['S$'](collection);
        const result = target.__kaspGarageInventoryDebug();
        assert.equal(result.total, 1); assert.equal(result.hidden, 1); assert.equal(result.secret, 1); assert.equal(result.unowned, 1);
        assert.equal(result.items[0].id, '9223372036854775807'); assert.equal(result.items[0].name, 'Native name');
        assert.equal(result.items[0].preview, 'native-preview'); assert.equal(result.items[0].updated_id, undefined);
        assert.equal(values[0], raw); assert.equal(raw.updated_visible, false);
    }
});

test('inventory capture performs no traversal or DOM queries until diagnostics are explicitly requested', () => {
    let queries = 0;
    const target = { document: { querySelectorAll() { queries++; return []; } },
        setInterval() { throw Error('unexpected polling'); }, setTimeout() { throw Error('unexpected background work'); } };
    installGarageInventoryDiagnostics(target);
    const plan = analyzeGarageInventory(fixture), c = { window: target, proto: type => type.prototype };
    runFeatureContext(patchGarageInventoryDiagnostics(fixture, undefined, plan), c);
    const calls = [], values = [item(1, false)], native = mappedCollection(values, plan.schema, calls);
    const state = new c.State(native);
    assert.equal(state.flat, native); assert.equal(state.completed, true); assert.equal(queries, 0); assert.equal(calls.length, 0);
    assert.equal(target.__kaspGarageInventoryDebug().total, 1); assert.equal(queries, 1);
    assert.deepEqual(calls, [plan.schema.valuesMethod, plan.schema.iteratorMethod]);
});

test('inventory diagnostics return partial failures and bound endless native collections without mutating them', () => {
    const { target, context } = setup();
    const broken = collection([item(1, false), { ...item(2, true), art: { url() { throw Error('native preview failed'); } } }]);
    new context.State(broken);
    const failed = target.__kaspGarageInventoryDebug();
    assert.equal(failed.captured, true); assert.equal(failed.partial, true); assert.equal(failed.items.length, 1);
    assert.match(failed.error, /native preview failed/);
    let reads = 0;
    const endless = { b3: () => ({ t: () => ({ u: () => true, v: () => { reads++; return item(reads, false); } }) }) };
    new context.State(endless); const limited = target.__kaspGarageInventoryDebug();
    assert.equal(limited.partial, true); assert.match(limited.error, /diagnostic limit/);
    assert.equal(limited.items.length, 20000); assert.equal(reads, 20000);
    new context.State({}); assert.match(target.__kaspGarageInventoryDebug().error, /collection method is unavailable/);
});

test('state scopes, assignment return values and native strict mode are preserved', async () => {
    const source = '"use strict";\n'+fixture.replace('this.flat=t;', 'this.completedValue=(this.flat=t);')+
        '\nfunction another(){function State(t){this.flat=t}return State}\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeGarageInventory(source); assert.equal(plan.status.ready, true);
    const changed = source + '\nvar _kaspBonusResult=456;';
    const adapted = await loaded.exports.selectGarageInventoryPlan(changed, [plan]); assert.ok(adapted);
    const capture = [], c = { window: { __kaspGarageInventoryCapture: (...args) => { capture.push(args); throw Error('bridge failed'); } }, proto: type => type.prototype };
    runFeatureContext(patchGarageInventoryDiagnostics(changed, undefined, adapted), c);
    const native = collection([]), state = new c.State(native);
    assert.equal(state.flat, native); assert.equal(state.completedValue, native); assert.equal(state.completed, true);
    assert.equal(capture.length, 1); assert.equal(capture[0][0], native); assert.equal(c._kaspBonusResult, 456);
    new (c.another())(native); assert.equal(capture.length, 1, 'another lexical State class stays untouched');
    assert.equal((0,c.nativeStrict)(), true);
});

test('unsupported or ambiguous inventory contracts cannot install a partial mapping', async () => {
    const plan = analyzeGarageInventory(fixture);
    assert.equal(await loaded.exports.selectGarageInventoryPlan(fixture, [plan]), plan);
    for (const changed of [fixture.replace('GarageItemsState(', 'AnotherState('), fixture.replace(', secret=', ', anotherFlag='),
        fixture.replace('this.flat=t;', 'this.another=t;'), fixture.replace('it.u()', 'testIterator(it)'),
        fixture+'\nproto(State).otherValues=function(){return this.flat.b3()}',
        'const quoted='+JSON.stringify(fixture)+';/*'+fixture+'*/']) {
        assert.equal(analyzeGarageInventory(changed).status.ready, false);
        assert.equal(await loaded.exports.selectGarageInventoryPlan(changed, [plan]), undefined);
        assert.equal(loaded.exports.patchGarageInventoryDiagnostics(changed), changed);
    }
    const stale = { ...plan, edits: plan.edits.map((e,i) => i === 1 ? { ...e, before: 'stale' } : e) };
    assert.equal(patchGarageInventoryDiagnostics(fixture, undefined, stale), fixture);
});

test('inventory preparation validates syntax without evaluating the client and preserves old plans on failure', () => {
    const path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ki-inventory-ast-')),input=path.join(dir,'main.js'),output=path.join(dir,'plans.json');
    const execute=()=>spawnSync(process.execPath,[path.join(__dirname,"../../prepare/prepare-garage-inventory.cjs"),input,'--out',output],{encoding:'utf8'});
    try {
        const source='throw Error("DO_NOT_EXECUTE");\n'+fixture;fs.writeFileSync(input,source);
        const result=execute();assert.equal(result.status,0,result.stderr);
        const previous=fs.readFileSync(output,'utf8'),data=JSON.parse(previous);
        assert.equal(data.format,'ki-garage-inventory-plans-v1');assert.equal(data.plans[0].schema.valuesMethod,'b3');
        assert.equal(fs.readFileSync(input,'utf8'),source);
        fs.writeFileSync(input,source.replace('GarageItemsState(', 'AnotherState('));
        assert.equal(execute().status,1);assert.equal(fs.readFileSync(output,'utf8'),previous);
    } finally { for(const file of[input,output])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir); }
});

test('all six AST plans share native item metadata and original offsets without invalidating each other', () => {
    const path=require('node:path'),readFixture=file=>fs.readFileSync(path.join(__dirname,file),'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const garage = readFixture("./garage-items.test.cjs").replace('this.category+")"',
        'this.category+", owned="+this.owned+", visible="+this.visible+", secret="+this.secret+")"');
    const inventory = fixture.replace('function Item(){}','').replace(/proto\(Item\)\.toString=[^\n]+;/,'')
        .replace(/\.art\b/g,'.preview').replace(/\.mine\b/g,'.owned');
    const source=readFixture("../battle/arcade-reload.test.cjs")+'\n'+readFixture("../ast/overdrive-ast.test.cjs")+'\n'+readFixture("./game-augments.test.cjs")+'\n'+readFixture("./garage-details.test.cjs")+'\n'+garage+'\n'+inventory;
    const plans=[require("../../ast/overdrive-ast.cjs").analyzeOverdrive(source),require("../../ast/arcade-ast.cjs").analyzeArcade(source),require("../../ast/augments-ast.cjs").analyzeAugments(source),
        require("../../ast/garage-details-ast.cjs").analyzeGarageDetails(source),require("../../ast/garage-items-ast.cjs").analyzeGarageItems(source),analyzeGarageInventory(source)];
    for(const plan of plans)assert.equal(plan.status.ready,true,JSON.stringify(plan.status));
    const {mergeClientPatchPlans}=require("../helpers/client-patches.cjs"),result=mergeClientPatchPlans(source,plans);
    assert.equal(result.rejected.length,0);new vm.Script(result.code);
    const stale={...plans[5],sourceLength:source.length+1},remaining=mergeClientPatchPlans(source,[...plans.slice(0,5),stale]);
    assert.equal(remaining.code,mergeClientPatchPlans(source,plans.slice(0,5)).code);assert.equal(remaining.rejected[0],stale);
});
