const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const loaded = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/garageInventory.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code,
    { module: loaded, exports: loaded.exports });
const { patchGarageInventoryDiagnostics, installGarageInventoryDiagnostics } = loaded.exports;
const fixture = `
function State(t){this.raw=t;this.flat=t;this.completed=true}function Item(){}
proto(State).values=function(){return this.flat.b3()};
proto(State).toString=function(){return "GarageItemsState(itemsByBase="+this.raw+")"};
proto(Item).toString=function(){return "GarageItem(id="+this.key.toString()+", name="+this.title+", category="+this.kind.toString()+", viewCategory="+this.view.toString()+", description="+this.text+", preview="+stringify(this.art)+", owned="+this.mine+", buyable="+this.sale+", visible="+this.shown+", secret="+this.hidden+")"};
function nativeImage(t){return t.mine?placeholder:t.art.url()}
`;
function setup() {
    const target = { document: { querySelectorAll: () => [{ getAttribute: () => '1' }] } };
    installGarageInventoryDiagnostics(target);
    const context = { window: target, proto: type => type.prototype };
    vm.runInNewContext(patchGarageInventoryDiagnostics(fixture), context);
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
