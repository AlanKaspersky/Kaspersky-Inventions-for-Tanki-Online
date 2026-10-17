const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/garageDetails.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: moduleUnderTest, exports: moduleUnderTest.exports, crypto: require('crypto').webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const { analyzeGarageDetails } = require('./garage-details-ast.cjs');
const patchUnavailableGarageDetails = (code, report, plan) => moduleUnderTest.exports.patchUnavailableGarageDetails(code, report, plan || analyzeGarageDetails(code));

const fixture = `
function diagnostic(){return "State("+", selectedDevice="+this.device.toString()+", selectedSkin="+this.skin.toString()}
function deviceRender(t){var n=this.state.device,i=X,r=Dq.xut(i),s=Dq.xut(X),_=Dq.xut(X),f=Dq.xut(X),v=f.tuv();if(v.jp8(style.n1p9(false,defaultIcon,(c=this).state.device.lrf()?missing:c.state.device.preview.w93())),n.lrf()&&RE(v,"invert(0.25)"),_.cap(f.c9l()),!n.lrf()){var p=Mq(Description);_.iap(p,describe(this,n))}s.cap(_.c9l()),function(t,n){if(t.state.device.lrf())denied.push('device')}(this,s);var c}
function skinPreview(t,n){var i=X,r=Dq.xut(i);r.tuv().jp8(style.n1p9(false,defaultIcon,function(t){var n;if(t.state.skin.lrf()&&!standard(t))n=missing;else if(t.props.skinType.equals(AH()))n=t.state.skin.preview.w93();else{var i=t.state.skin.large,r=null==i?null:i.w93();n=null==r?defaultIcon:r}return n}(t))),n.cap(r.c9l())}
function skinRender(t){var n=this.state.skin,i=X,r=Dq.xut(i),s=Dq.xut(X),_=Dq.xut(X),h=_.tuv();if(h.jp8('layout'),!standard(this)&&n.lrf()){var a=X,c=Dq.xut(a),l=c.tuv();RE(l,"invert(0.25)"),skinPreview(this,c),_.cap(c.c9l())}else{skinPreview(this,_);var f=Mq(Description);_.iap(f,describe(this,n))}s.cap(_.c9l()),function(t,n){if(t.state.skin.lrf())denied.push('skin')}(this,s)}
`;
function run(source, enabled, unknown, section, isStandard = false, options = {}) {
    const images = [], filters = [], descriptions = [], denied = [];
    const counts = { unknown: 0, standard: 0 };
    const builder = () => {
        const node = { jp8: value => images.push(value) };
        return { tuv: () => node, cap() {}, c9l() { return this; }, iap(type, description) { descriptions.push(description); } };
    };
    const context = { localStorage: { getItem: () => { if (options.storageError) throw Error('storage denied'); return String(enabled); } }, denied,
        X: {}, Dq: { xut: builder }, style: { n1p9: (standard, fallback, image) => image },
        RE: (node, filter) => { if (options.tintError && filter === 'grayscale(1)') throw Error('native tint failed'); filters.push(filter); }, Mq: value => value, Description: {},
        defaultIcon: 'default', missing: 'unavailable', standard: () => { counts.standard++; return isStandard; },
        AH: () => 'shot-color', describe: (component, item) => ({ name: item.name, description: item.description }) };
    context.window = { localStorage: context.localStorage };
    context[options.filterHelper || 'RE'] = context.RE;
    context[options.standardHelper || 'standard'] = context.standard;
    context[options.descriptionHelper || 'describe'] = context.describe;
    runFeatureContext(source, context);
    const item = { [options.unknownMethod || 'lrf']: () => { counts.unknown++; return unknown; }, name: 'Название / Name', description: 'Описание / Description',
        preview: { [options.imageURL || 'w93']: () => 'real-preview' }, large: { [options.imageURL || 'w93']: () => 'real-large-skin' } };
    const component = { state: { [options.deviceField || 'device']: item, [options.skinField || 'skin']: item }, props: { skinType: { equals: () => section === 'shot-color' } } };
    context[section === 'device' ? 'deviceRender' : 'skinRender'].call(component, builder());
    return { images, filters, descriptions, denied, ...(options.counts ? { counts } : {}) };
}
test('native unavailable details show real resources and descriptions without changing mounting checks', () => {
    const patched = patchUnavailableGarageDetails(fixture);
    assert.notEqual(patched, fixture);
    new vm.Script(patched);
    for (const section of ['device', 'skin', 'shot-color']) {
        const result = run(patched, true, true, section);
        assert.ok(result.images.includes(section === 'skin' ? 'real-large-skin' : 'real-preview'));
        assert.ok(result.filters.includes('grayscale(1)'));
        assert.equal(result.descriptions.length, 1);
        assert.equal(result.descriptions[0].description, 'Описание / Description');
        assert.equal(result.denied.length, 1, 'native unavailable-item mounting guard remains active');
        assert.deepEqual(run(patched, false, true, section), run(fixture, false, true, section));
        assert.deepEqual(run(patched, true, false, section), run(fixture, true, false, section));
    }
});
test('unknown render structures are preserved', () => {
    assert.equal(patchUnavailableGarageDetails('const untouched = 1;'), 'const untouched = 1;');
});

test('standard skins and shot colors keep native previews even if the unknown flag is true', () => {
    const patched = patchUnavailableGarageDetails(fixture);
    for (const section of ['skin', 'shot-color']) {
        for (const unknown of [true, false]) {
            const result = run(patched, true, unknown, section, true);
            assert.deepEqual(result, run(fixture, true, unknown, section, true));
            assert.equal(result.filters.includes('grayscale(1)'), false);
        }
    }
});


test('prepared detail templates adapt renamed native fields and helpers on both formatted and minified builds', async () => {
    const names = { deviceField: 'newDevice', skinField: 'newSkin', unknownMethod: 'isUnknown', imageURL: 'imageURL',
        filterHelper: 'newFilter', standardHelper: 'isStandardSkin', descriptionHelper: 'nativeDescription' };
    const replacements = { device: names.deviceField, skin: names.skinField, lrf: names.unknownMethod, w93: names.imageURL,
        RE: names.filterHelper, standard: names.standardHelper, describe: names.descriptionHelper, skinPreview: 'nativeSkinPreview' };
    for (const source of [fixture, transformSync(fixture, { minifyWhitespace: true }).code]) {
        const plan = analyzeGarageDetails(source); assert.equal(plan.status.ready, true);
        let changed = source;
        for (const [from, to] of Object.entries(replacements)) changed = changed.replace(new RegExp('\\b' + from + '\\b', 'g'), to);
        changed += '\n/*unrelated game update*/';
        const adapted = await moduleUnderTest.exports.selectGarageDetailsPlan(changed, [plan]);
        assert.ok(adapted); assert.equal(adapted.status.strategy, 'ast-template');
        const patched = patchUnavailableGarageDetails(changed, undefined, adapted); new vm.Script(patched);
        assert.equal(patched.includes('.lrf('), false); assert.equal(patched.includes('.w93('), false);
        for (const section of ['device', 'skin', 'shot-color']) {
            const result = run(patched, true, true, section, false, names);
            assert.equal(result.descriptions.length, 1); assert.ok(result.filters.includes('grayscale(1)'));
            assert.ok(result.images.includes(section === 'skin' ? 'real-large-skin' : 'real-preview'));
            assert.equal(result.denied.length, 1);
            assert.deepEqual(run(patched, false, true, section, false, names), run(changed, false, true, section, false, names));
            assert.deepEqual(run(patched, true, false, section, false, names), run(changed, true, false, section, false, names));
        }
        for (const section of ['skin', 'shot-color']) assert.deepEqual(run(patched, true, true, section, true, names), run(changed, true, true, section, true, names));
    }
});

test('missing or ambiguous native detail contracts and quoted decoys cannot install a partial patch', async () => {
    const plan = analyzeGarageDetails(fixture);
    assert.equal(await moduleUnderTest.exports.selectGarageDetailsPlan(fixture, [plan]), plan);
    for (const changed of [
        fixture.replace('selectedSkin=', 'removedSkin='),
        fixture.replace('!n.lrf()){var p=', 'isAvailable(n)){var p='),
        fixture.replace('invert(0.25)', 'another-filter'),
        fixture.replace('t.state.skin.lrf()&&!standard(t)', 't.state.skin.lrf()'),
        fixture + '\nfunction duplicate(){return "State("+", selectedDevice="+this.device.toString()+", selectedSkin="+this.skin.toString()}',
        'const quoted=' + JSON.stringify(fixture) + ';/*' + fixture + '*/',
    ]) {
        assert.equal(await moduleUnderTest.exports.selectGarageDetailsPlan(changed, [plan]), undefined);
        assert.equal(moduleUnderTest.exports.patchUnavailableGarageDetails(changed), changed);
        assert.equal(analyzeGarageDetails(changed).status.ready, false);
    }
    const stale = { ...plan, edits: plan.edits.map((edit, index) => index === 1 ? { ...edit, before: 'stale' } : edit) };
    assert.equal(patchUnavailableGarageDetails(fixture, undefined, stale), fixture);
    const patched = patchUnavailableGarageDetails(fixture, undefined, plan);
    assert.equal(patchUnavailableGarageDetails(patched, undefined, plan), patched);
});

test('native availability and standard-skin checks keep their evaluation counts and added tint failures do not lose descriptions', () => {
    const patched = patchUnavailableGarageDetails(fixture);
    for (const section of ['skin', 'shot-color']) for (const unknown of [true, false]) for (const standard of [true, false]) {
        const original = run(fixture, true, unknown, section, standard, { counts: true });
        const result = run(patched, true, unknown, section, standard, { counts: true });
        assert.deepEqual(result.counts, original.counts);
        const failed = run(patched, true, unknown, section, standard, { tintError: true });
        assert.equal(failed.descriptions.length, 1);
    }
    for (const section of ['device', 'skin', 'shot-color']) assert.deepEqual(
        run(patched, true, true, section, false, { storageError: true }), run(fixture, false, true, section));
});

test('temporary-name collisions and unrelated leading code preserve native strict mode and preview behavior', async () => {
    const source = '"use strict";\n' + fixture + '\nfunction nativeStrict(){return this===undefined}';
    const plan = analyzeGarageDetails(source);
    const changed = '"use strict";var __kaspDetailsUnavailable=123;\n' + fixture + '\nfunction nativeStrict(){return this===undefined}';
    const adapted = await moduleUnderTest.exports.selectGarageDetailsPlan(changed, [plan]); assert.ok(adapted);
    const patched = patchUnavailableGarageDetails(changed, undefined, adapted);
    assert.ok(patched.includes('var __kaspDetailsUnavailable_=false;'));
    const context = {}; runFeatureContext(patched, context);
    assert.equal(context.__kaspDetailsUnavailable, 123); assert.equal((0, context.nativeStrict)(), true);
    assert.equal(run(patched, true, true, 'skin').descriptions.length, 1);
});

test('garage details CLI validates syntax without executing input and preserves old plans on analysis failure', () => {
    const path = require('node:path'), os = require('node:os'), { spawnSync } = require('node:child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-details-ast-')), input = path.join(dir, 'main.js'), output = path.join(dir, 'plans.json');
    const execute = () => spawnSync(process.execPath, [path.join(__dirname, 'prepare-garage-details.cjs'), input, '--out', output], { encoding: 'utf8' });
    try {
        const source = 'throw Error("DO_NOT_EXECUTE");\n' + fixture;
        fs.writeFileSync(input, source); const result = execute(); assert.equal(result.status, 0, result.stderr);
        const previous = fs.readFileSync(output, 'utf8'), data = JSON.parse(previous);
        assert.equal(data.format, 'ki-garage-details-plans-v1'); assert.equal(data.plans[0].status.devicePanels, 1);
        assert.equal(fs.readFileSync(input, 'utf8'), source);
        fs.writeFileSync(input, source.replace('selectedSkin=', 'removedSkin='));
        assert.equal(execute().status, 1); assert.equal(fs.readFileSync(output, 'utf8'), previous);
    } finally { for (const file of [input, output]) if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test('all four AST modules merge against original offsets while stale garage details cannot remove other features', () => {
    const path = require('node:path');
    const readFixture = file => fs.readFileSync(path.join(__dirname, file), 'utf8').match(/const (?:source|fixture) = `([\s\S]*?)`;/)[1];
    const source = readFixture('arcade-reload.test.cjs') + '\n' + readFixture('overdrive-ast.test.cjs') + '\n' + readFixture('game-augments.test.cjs') + '\n' + fixture;
    const plans = [require('./overdrive-ast.cjs').analyzeOverdrive(source), require('./arcade-ast.cjs').analyzeArcade(source),
        require('./augments-ast.cjs').analyzeAugments(source), analyzeGarageDetails(source)];
    for (const plan of plans) assert.equal(plan.status.ready, true, JSON.stringify(plan.status));
    const { mergeClientPatchPlans } = require('./test-client-patches.cjs');
    const result = mergeClientPatchPlans(source, plans); assert.equal(result.rejected.length, 0); new vm.Script(result.code);
    const bad = { ...plans[3], sourceLength: source.length + 1 };
    const partial = mergeClientPatchPlans(source, [...plans.slice(0, 3), bad]);
    assert.equal(partial.code, mergeClientPatchPlans(source, plans.slice(0, 3)).code); assert.equal(partial.rejected[0], bad);
});
