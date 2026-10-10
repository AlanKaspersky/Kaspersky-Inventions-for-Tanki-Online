const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/garageDetails.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { patchUnavailableGarageDetails } = moduleUnderTest.exports;

// Native render structure: the details branch precedes the separate mount/purchase branch.
const fixture = `
function diagnostic(){return "State("+", selectedDevice="+this.device.toString()+", selectedSkin="+this.skin.toString()}
function deviceRender(t){var n=this.state.device,i=X,r=Dq.xut(i),s=Dq.xut(X),_=Dq.xut(X),f=Dq.xut(X),v=f.tuv();if(v.jp8(style.n1p9(false,defaultIcon,(c=this).state.device.lrf()?missing:c.state.device.preview.w93())),n.lrf()&&RE(v,"invert(0.25)"),_.cap(f.c9l()),!n.lrf()){var p=Mq(Description);_.iap(p,describe(this,n))}s.cap(_.c9l()),function(t,n){if(t.state.device.lrf())denied.push('device')}(this,s);var c}
function skinPreview(t,n){var i=X,r=Dq.xut(i);r.tuv().jp8(style.n1p9(false,defaultIcon,function(t){var n;if(t.state.skin.lrf()&&!standard(t))n=missing;else if(t.props.skinType.equals(AH()))n=t.state.skin.preview.w93();else{var i=t.state.skin.large,r=null==i?null:i.w93();n=null==r?defaultIcon:r}return n}(t))),n.cap(r.c9l())}
function skinRender(t){var n=this.state.skin,i=X,r=Dq.xut(i),s=Dq.xut(X),_=Dq.xut(X),h=_.tuv();if(h.jp8('layout'),!standard(this)&&n.lrf()){var a=X,c=Dq.xut(a),l=c.tuv();RE(l,"invert(0.25)"),skinPreview(this,c),_.cap(c.c9l())}else{skinPreview(this,_);var f=Mq(Description);_.iap(f,describe(this,n))}s.cap(_.c9l()),function(t,n){if(t.state.skin.lrf())denied.push('skin')}(this,s)}
`;
function run(source, enabled, unknown, section) {
    const images = [], filters = [], descriptions = [], denied = [];
    const builder = () => {
        const node = { jp8: value => images.push(value) };
        return { tuv: () => node, cap() {}, c9l() { return this; }, iap(type, description) { descriptions.push(description); } };
    };
    const context = { localStorage: { getItem: () => String(enabled) }, denied,
        X: {}, Dq: { xut: builder }, style: { n1p9: (standard, fallback, image) => image },
        RE: (node, filter) => filters.push(filter), Mq: value => value, Description: {},
        defaultIcon: 'default', missing: 'unavailable', standard: () => false,
        AH: () => 'shot-color', describe: (component, item) => ({ name: item.name, description: item.description }) };
    vm.runInNewContext(source, context);
    const item = { lrf: () => unknown, name: 'Название / Name', description: 'Описание / Description',
        preview: { w93: () => 'real-preview' }, large: { w93: () => 'real-large-skin' } };
    const component = { state: { device: item, skin: item }, props: { skinType: { equals: () => section === 'shot-color' } } };
    context[section === 'device' ? 'deviceRender' : 'skinRender'].call(component, builder());
    return { images, filters, descriptions, denied };
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
