const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/garageItems.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: moduleUnderTest, exports: moduleUnderTest.exports, crypto: require('crypto').webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const { analyzeGarageItems } = require('./garage-items-ast.cjs');
const patchUnavailableGarageItems = (code, report, plan) => moduleUnderTest.exports.patchUnavailableGarageItems(code, report, plan || analyzeGarageItems(code));

const fixture = `
function Styles(){}function Card(){}function Item(){}
proto(Item).toString=function(){return "GarageItem(id="+this.id+", name="+this.name+", preview="+this.preview+", viewCategory="+this.category+")"};
register(Styles,"GarageItemComponentStyle",Base,metadata);
proto(Styles).image=function(){return "mainImg"},proto(Styles).other=function(){};
function existingFilter(t){t.css("filter","none")}
function image(t,n){var r=t.state.item,w=Dq.xut(null),d=w.tuv();d.jp8(styles().image()),r.unknown()&&!t.state.item.category.equals(paint())&&d.jp8('unavailable-size');var g,m=w.kap();g=r.unknown()&&!t.state.item.category.equals(paint())?missing:r.preview.url(),m.uuf(g),n.cap(w.c9l())}
proto(Card).render=function(t){var i=this.state.item;t.setAttribute("garage_item_id",i.id);i.unknown()||t.label(i.name);i.unknown()&&t.deny();image(this,t)},proto(Styles).finish=function(){};
`;

function run(source, enabled, unknown, category = 'turret', language = 'en', options = {}) {
    const result = { images: [], classes: [], filters: [], labels: [], denied: false };
    let unknownReads = 0;
    const node = { jp8: value => result.classes.push(value), [options.filterSetter || 'css']: (key, value) => {
        if (options.tintError) throw Error('native tint failed'); result.filters.push(value);
    } };
    const builder = { tuv: () => node, kap: () => ({ uuf: value => { result.images.push(value); return options.imageResult; } }),
        cap() {}, c9l() { return this; }, setAttribute() {}, label: value => { result.labels.push(value); return options.labelResult; },
        deny: () => { result.denied = true; } };
    const context = { localStorage: { getItem: () => { if (options.storageError) throw Error('storage denied'); return String(enabled); } }, register() {}, Base: {}, metadata: {},
        [options.protoHelper || 'proto']: type => type.prototype, Dq: { xut: () => builder }, missing: 'question-mark', paint: () => 'paint' };
    context.window = { localStorage: context.localStorage };
    vm.runInNewContext(source, context);
    context[options.styleFactory || 'styles'] = () => new context[options.stylesCtor || 'Styles']();
    const item = { id: '123', [options.itemName || 'name']: language === 'ru' ? 'Мортира' : 'Mortar',
        [options.unknownMethod || 'unknown']: () => { unknownReads++; return unknown; },
        [options.itemCategory || 'category']: { equals: value => category === value },
        [options.itemPreview || 'preview']: { [options.imageURL || 'url']: () => 'native-image' } };
    if (options.captureImageReturn) {
        const nativeImage = context.image;
        context.image = (...args) => { result.imageReturn = nativeImage(...args); return result.imageReturn; };
    }
    const returned = context[options.cardCtor || 'Card'].prototype.render.call({ [options.stateField || 'state']: { [options.itemField || 'item']: item } }, builder);
    if (options.counts) result.unknownReads = unknownReads;
    if (options.captureReturn) result.returned = returned;
    return result;
}

test('unavailable garage categories reveal native localized names and gray icons while retaining availability guards', () => {
    const patched = patchUnavailableGarageItems(fixture);
    assert.notEqual(patched, fixture);
    new vm.Script(patched);
    for (const category of ['turret', 'hull', 'grenade', 'drone', 'protection', 'supply']) {
        for (const language of ['ru', 'en']) {
            const result = run(patched, true, true, category, language);
            assert.deepEqual(result.images, ['native-image']);
            assert.deepEqual(result.labels, [language === 'ru' ? 'Мортира' : 'Mortar']);
            assert.deepEqual(result.filters, ['grayscale(1)']);
            assert.equal(result.classes.includes('unavailable-size'), false);
            assert.equal(result.denied, true);
        }
        assert.deepEqual(run(patched, false, true, category), run(fixture, false, true, category));
        assert.deepEqual(run(patched, true, false, category), run(fixture, true, false, category));
    }
});

test('unsupported bundles remain unchanged and repeat patching is idempotent', () => {
    assert.equal(patchUnavailableGarageItems('const untouched = 1;'), 'const untouched = 1;');
    const patched = patchUnavailableGarageItems(fixture);
    assert.equal(patchUnavailableGarageItems(patched), patched);
});

test('generated class and method renaming preserves discovery', () => {
    const renamed = fixture.replaceAll('Styles', 'Abc').replaceAll('proto', 'meta')
        .replaceAll('image', 'artwork').replaceAll('unknown', 'locked').replaceAll('css', 'setStyle');
    const patched = patchUnavailableGarageItems(renamed);
    assert.notEqual(patched, renamed);
    assert.ok(patched.includes('d.setStyle("filter","grayscale(1)")'));
    assert.ok(patched.includes('((i.locked())&&!'));
    new vm.Script(patched);
});

test('prepared garage-item templates adapt renamed fields, classes and native setters without rebuilding mappings', async () => {
    const names = { protoHelper: 'meta', styleFactory: 'styleFactory', stylesCtor: 'RenamedStyles', cardCtor: 'RenamedCard',
        filterSetter: 'setStyle', unknownMethod: 'locked', stateField: 'newState', itemField: 'equipment', itemName: 'title',
        itemCategory: 'type', itemPreview: 'artwork', imageURL: 'imageURL' };
    for (const source of [fixture, transformSync(fixture, { minifyWhitespace: true }).code]) {
        const plan = analyzeGarageItems(source); assert.equal(plan.status.ready, true);
        let changed = source;
        for (const [from, to] of Object.entries({ proto: names.protoHelper, Styles: names.stylesCtor, Card: names.cardCtor, styles: names.styleFactory })) changed = changed.replace(new RegExp('\\b'+from+'\\b','g'),to);
        for (const [from, to] of Object.entries({ css: names.filterSetter, unknown: names.unknownMethod, state: names.stateField, item: names.itemField,
            name: names.itemName, category: names.itemCategory, preview: names.itemPreview, url: names.imageURL })) changed = changed.replace(new RegExp('\\.'+from+'\\b','g'),'.'+to);
        changed += '\n/*unrelated update*/';
        const adapted = await moduleUnderTest.exports.selectGarageItemsPlan(changed, [plan]); assert.ok(adapted);
        assert.equal(adapted.status.strategy, 'ast-template');
        const patched = patchUnavailableGarageItems(changed, undefined, adapted); new vm.Script(patched);
        assert.equal(patched.includes('.unknown('), false); assert.equal(patched.includes('.css('), false);
        for (const category of ['turret', 'hull', 'grenade', 'drone', 'protection', 'supply', 'paint']) {
            const result = run(patched, true, true, category, 'ru', names);
            assert.deepEqual(result.images, ['native-image']); assert.deepEqual(result.labels, ['Мортира']);
            assert.deepEqual(result.filters, ['grayscale(1)']); assert.equal(result.denied, true);
            assert.equal(result.classes.includes('unavailable-size'), false);
            assert.deepEqual(run(patched, false, true, category, 'en', names), run(changed, false, true, category, 'en', names));
            assert.deepEqual(run(patched, true, false, category, 'en', names), run(changed, true, false, category, 'en', names));
        }
    }
});

test('nested native caption callbacks resolve their captured item without touching unrelated labels', async () => {
    const nested = fixture.replace('i.unknown()||t.label(i.name);',
        '(function(component,builder){var selected=component.state.item,captured;captured=selected;(function(node){captured.unknown()||node.label(captured.name)})(builder)})(this,t);');
    const source = nested + '\nfunction unrelated(t){var i=this.other.item;i.unknown()||t.label(i.name)}';
    const plan = analyzeGarageItems(source); assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const adapted = await moduleUnderTest.exports.selectGarageItemsPlan(source+'\n/*next build*/', [plan]); assert.ok(adapted);
    const patched = patchUnavailableGarageItems(source+'\n/*next build*/', undefined, adapted);
    assert.ok(patched.includes('function unrelated(t){var i=this.other.item;i.unknown()||t.label(i.name)}'));
    assert.deepEqual(run(patched, true, true).labels, ['Mortar']);
    assert.deepEqual(run(patched, false, true), run(source, false, true));
});

test('missing, ambiguous or quoted native contracts skip the whole garage-item patch', async () => {
    const plan = analyzeGarageItems(fixture);
    assert.equal(await moduleUnderTest.exports.selectGarageItemsPlan(fixture, [plan]), plan);
    const image = fixture.match(/function image\(t,n\)\{[^\n]*\}/)[0];
    for (const changed of [
        fixture.replace('GarageItemComponentStyle', 'another-style'), fixture.replace('mainImg', 'another-image'),
        fixture.replace(', name=', ', anotherName='), fixture.replace('i.unknown()||t.label(i.name)', 't.label(i.name)'),
        fixture + '\n' + image.replace('function image(', 'function duplicateImage('),
        'const quoted='+JSON.stringify(fixture)+';/*'+fixture+'*/',
    ]) {
        assert.equal(await moduleUnderTest.exports.selectGarageItemsPlan(changed, [plan]), undefined);
        assert.equal(analyzeGarageItems(changed).status.ready, false);
        assert.equal(moduleUnderTest.exports.patchUnavailableGarageItems(changed), changed);
    }
    const stale = { ...plan, edits: plan.edits.map((edit, i) => i === 1 ? { ...edit, before: 'stale' } : edit) };
    assert.equal(patchUnavailableGarageItems(fixture, undefined, stale), fixture);
});

test('native availability checks and setter returns are preserved; storage and added tint failures do not block the card', () => {
    const source = fixture.replace(',m.uuf(g),n.cap(w.c9l())', ';return m.uuf(g)').replace('i.unknown()||t.label(i.name);i.unknown()&&t.deny();image(this,t)',
        'i.unknown()&&t.deny();image(this,t);return i.unknown()||t.label(i.name)');
    const patched = patchUnavailableGarageItems(source); assert.notEqual(patched, source);
    for (const unknown of [true, false]) for (const enabled of [true, false]) {
        const options = { counts: true, captureImageReturn: true, imageResult: 'native-image-result', captureReturn: true, labelResult: 'native-label-result' };
        const result = run(patched, enabled, unknown, 'turret', 'en', options), native = run(source, enabled, unknown, 'turret', 'en', options);
        assert.equal(result.unknownReads, native.unknownReads); assert.equal(result.imageReturn, 'native-image-result');
        if (!enabled || !unknown) assert.equal(result.returned, native.returned);
        else assert.equal(result.returned, 'native-label-result');
    }
    const failedTint = run(patched, true, true, 'turret', 'en', { tintError: true, captureImageReturn: true, imageResult: 'native-image-result' });
    assert.deepEqual(failedTint.images, ['native-image']); assert.deepEqual(failedTint.labels, ['Mortar']);
    assert.equal(failedTint.denied, true); assert.equal(failedTint.imageReturn, 'native-image-result');
    assert.deepEqual(run(patched, true, true, 'turret', 'en', { storageError: true }), run(source, false, true));
});

test('fresh temporary names and native strict directives survive unknown bundle updates', async () => {
    const source = '"use strict";\n'+fixture+'\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeGarageItems(source);
    const changed = '"use strict";var __kaspItemUnavailable=123,_kaspBonusResult=456;\n'+fixture+'\nfunction nativeStrict(){return this===undefined}';
    const adapted = await moduleUnderTest.exports.selectGarageItemsPlan(changed, [plan]); assert.ok(adapted);
    const patched = patchUnavailableGarageItems(changed, undefined, adapted); new vm.Script(patched);
    assert.ok(patched.includes('var __kaspItemUnavailable_=false;'));
    const c = { proto: type => type.prototype, register() {}, Base: {}, metadata: {} }; vm.runInNewContext(patched,c);
    assert.equal(c.__kaspItemUnavailable,123); assert.equal(c._kaspBonusResult,456); assert.equal((0,c.nativeStrict)(),true);
    assert.deepEqual(run(patched,true,true).labels,['Mortar']);
});

test('garage-item preparation does not execute the input and preserves working plans when analysis fails', () => {
    const path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ki-items-ast-')),input=path.join(dir,'main.js'),output=path.join(dir,'plans.json');
    const execute=()=>spawnSync(process.execPath,[path.join(__dirname,'prepare-garage-items.cjs'),input,'--out',output],{encoding:'utf8'});
    try {
        const source='throw Error("DO_NOT_EXECUTE");\n'+fixture;fs.writeFileSync(input,source);
        const result=execute();assert.equal(result.status,0,result.stderr);
        const previous=fs.readFileSync(output,'utf8'),data=JSON.parse(previous);
        assert.equal(data.format,'ki-garage-items-plans-v1');assert.equal(data.plans[0].status.ready,true);assert.equal(fs.readFileSync(input,'utf8'),source);
        fs.writeFileSync(input,source.replace('mainImg','removedImage'));assert.equal(execute().status,1);assert.equal(fs.readFileSync(output,'utf8'),previous);
    } finally { for(const file of[input,output])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir); }
});

test('all five AST plans share original offsets and stale garage-item edits cannot invalidate other features', () => {
    const path=require('node:path'),readFixture=file=>fs.readFileSync(path.join(__dirname,file),'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const source=readFixture('arcade-reload.test.cjs')+'\n'+readFixture('overdrive-ast.test.cjs')+'\n'+readFixture('game-augments.test.cjs')+'\n'+readFixture('garage-details.test.cjs')+'\n'+fixture;
    const plans=[require('./overdrive-ast.cjs').analyzeOverdrive(source),require('./arcade-ast.cjs').analyzeArcade(source),require('./augments-ast.cjs').analyzeAugments(source),require('./garage-details-ast.cjs').analyzeGarageDetails(source),analyzeGarageItems(source)];
    for(const plan of plans)assert.equal(plan.status.ready,true,JSON.stringify(plan.status));
    const {mergeClientPatchPlans}=require('./test-client-patches.cjs'),merged=mergeClientPatchPlans(source,plans);
    assert.equal(merged.rejected.length,0);new vm.Script(merged.code);
    const stale={...plans[4],sourceLength:source.length+1},remaining=mergeClientPatchPlans(source,[...plans.slice(0,4),stale]);
    assert.equal(remaining.code,mergeClientPatchPlans(source,plans.slice(0,4)).code);assert.equal(remaining.rejected[0],stale);
});
