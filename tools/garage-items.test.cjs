const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/garageItems.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { patchUnavailableGarageItems } = moduleUnderTest.exports;

const fixture = `
function Styles(){}function Card(){}
register(Styles,"GarageItemComponentStyle",Base,metadata);
proto(Styles).image=function(){return "mainImg"},proto(Styles).other=function(){};
function existingFilter(t){t.css("filter","none")}
function image(t,n){var r=t.state.item,w=Dq.xut(null),d=w.tuv();d.jp8(styles().image()),r.unknown()&&!t.state.item.category.equals(paint())&&d.jp8('unavailable-size');var g,m=w.kap();g=r.unknown()&&!t.state.item.category.equals(paint())?missing:r.preview.url(),m.uuf(g),n.cap(w.c9l())}
proto(Card).render=function(t){var i=this.state.item;t.setAttribute("garage_item_id",i.id);i.unknown()||t.label(i.name);i.unknown()&&t.deny();image(this,t)},proto(Styles).finish=function(){};
`;

function run(source, enabled, unknown, category = 'turret', language = 'en') {
    const result = { images: [], classes: [], filters: [], labels: [], denied: false };
    const node = { jp8: value => result.classes.push(value), css: (key, value) => result.filters.push(value) };
    const builder = { tuv: () => node, kap: () => ({ uuf: value => result.images.push(value) }),
        cap() {}, c9l() { return this; }, setAttribute() {}, label: value => result.labels.push(value),
        deny: () => { result.denied = true; } };
    const context = { localStorage: { getItem: () => String(enabled) }, register() {}, Base: {}, metadata: {},
        proto: type => type.prototype, Dq: { xut: () => builder }, missing: 'question-mark', paint: () => 'paint' };
    vm.runInNewContext(source, context);
    context.styles = () => new context.Styles();
    const item = { id: '123', name: language === 'ru' ? 'Мортира' : 'Mortar', unknown: () => unknown,
        category: { equals: value => category === value }, preview: { url: () => 'native-image' } };
    context.Card.prototype.render.call({ state: { item } }, builder);
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
    assert.ok(patched.includes('r.locked()&&__kaspShowUnavailableGarageItems()&&d.setStyle("filter","grayscale(1)")'));
    assert.ok(patched.includes('(!i.locked()||__kaspShowUnavailableGarageItems())&&t.label(i.name)'));
    new vm.Script(patched);
});
