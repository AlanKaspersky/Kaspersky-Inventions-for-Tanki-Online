const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const root = path.join(__dirname, '..');
function load(file, globals = {}, cache = new Map()) {
    const absolute = path.resolve(root, file);
    if (cache.has(absolute)) return cache.get(absolute);
    const module = { exports: {} };
    cache.set(absolute, module.exports);
    vm.runInNewContext(transformSync(fs.readFileSync(absolute, 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
        module, exports: module.exports, URL, Map, Set, console, ...globals,
        require: name => load(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts')), globals, cache),
    });
    cache.set(absolute, module.exports);
    return module.exports;
}
const game = load('src/core/gameAugments.ts');
const catalog = load('src/core/augmentCatalog.ts');
const labels = load('src/core/augmentLabels.ts');
const rules = load('src/core/augmentRules.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Actual formatter/cache-write structures from the supplied game bundle, with unrelated scopes.
const fixture = `
function fake() { function jh(){return other} }
function ke(ctor){return ctor.prototype}
function mh(){} function jh(){} function desc(){} function dto(a,b){this.urg_1=a,this.vrg_1=b}
ke(mh).ocb=function(){var t=this.ncb_1;if(t!=null)return t;throw Error('missing')};
ke(mh).toString=function(){var t="DevicePropertiesCC [";return (t=t+"properties = "+iu(this.ocb())+" ")+"]"};
ke(jh).toString=function(){var t="DevicePropertyEntity [";return (t=(t=(t=t+"operation = "+this.rcb_1.toString()+" ")+"property = "+this.scb_1.toString()+" ")+"value = "+this.tcb_1+" ")+"]"};
ke(desc).toString=function(){var t="DescriptionModelCC [";return (t=(t=t+"description = "+this.idd_1+" ")+"name = "+this.jdd_1+" ")+"]"};
ke(dto).toString=function(){return "GarageDeviceObject(id="+this.urg_1.toString()+", baseItemId="+this.vrg_1.toString()+")"};
function model(){this.l7j_1={s2a_1:new Map}}
ke(model).r7i=function(t,n){this.l7j_1.s2a_1.set(t,n)};
function upgrade(){} function upgradeData(){} function group(){} function base(){}
ke(upgrade).och=function(){var t=this.mch_1;if(t!=null)return t;throw Error('missing')};
ke(upgrade).toString=function(){var t="UpgradeParamsCC [";return t+"currentLevel = "+this.lch_1+" itemData = "+this.och().toString()};
ke(upgradeData).ocb=function(){var t=this.fci_1;if(t!=null)return t;throw Error('missing')};
ke(upgradeData).toString=function(){var t="UpgradeParamsData [";return t+"properties = "+iu(this.ocb())+" upgradeLevelsCount = "+this.gci_1};
ke(group).ocb=function(){var t=this.tch_1;if(t!=null)return t;throw Error('missing')};
ke(group).toString=function(){var t="GaragePropertyParams [";return t+"properties = "+iu(this.ocb())};
ke(base).toString=function(){var t="PropertyData [";return t+"finalValue = "+this.xch_1+" initialValue = "+this.ych_1+" property = "+this.zch_1.toString()};
`;
const schema = { properties: 'ncb_1', operation: 'rcb_1', property: 'scb_1', value: 'tcb_1',
    name: 'jdd_1', description: 'idd_1', deviceId: 'urg_1', baseItemId: 'vrg_1',
    upgradeLevel: 'lch_1', upgradeData: 'mch_1', upgradeGroups: 'fci_1', upgradeLevels: 'gci_1',
    groupProperties: 'tch_1', baseProperty: 'zch_1', baseInitial: 'ych_1', baseFinal: 'xch_1' };
const long = id => Object.assign(Object.create({ toString: () => id }), { low: 1, high: 2 });
const list = entries => ({ t() { let index = 0; return { u: () => index < entries.length, v: () => entries[index++] }; } });
const device = (id = '931009767084', delta = 25) => ({ id, name: 'Магнитная смесь', description: '<b>server</b>', locale: 'RU',
    properties: [{ operation: 'DELTA_PERCENT', property: 'SHOT_RANGE', value: delta }], icons: ['https://s.eu.tankionline.com/static/images/device.svg'] });
const snapshot = (devices, revision = 1, session = 'page-one') => ({ format: 'kasp-augments-v1', session, revision, updatedAt: 1, hooked: true, devices });

test('editable rules preserve IDs, support localized labels, and reject invalid entries', () => {
    const template = JSON.parse(fs.readFileSync(path.join(root, 'database/augment-rules.json'), 'utf8'));
    assert.equal(rules.parseAugmentRules({ ...template, rules: [] }).rules.length, 0, 'example must not apply');
    const parsed = rules.parseAugmentRules({ rules: [
        { objectId: '3074457415741482382', property: labels.augmentPropertyLabel('SHOT_RANGE', 'RU'), status: 'better' },
        { objectId: '2', properity: labels.augmentPropertyLabel('SHOT_RANGE', 'EN'), status: 'lower' },
        { objectId: '2', property: 'SHOT_RANGE', status: 'better' },
        { objectId: 3, property: 'SHOT_RANGE', status: 'better' },
        { objectId: '4', property: 'SHOT_RANGE', status: 'neutral' },
        null,
    ] });
    assert.equal(parsed.rules.length, 2);
    assert.equal(parsed.rules[0].objectId, '3074457415741482382');
    assert.equal(parsed.rules[0].property, 'SHOT_RANGE');
    assert.equal(parsed.rules[1].status, 'better');
    assert.equal(parsed.errors.length, 4);
    assert.equal(rules.parseAugmentRules(null).rules.length, 0);
});

test('manual rules select columns directly without changing raw numeric effects or other devices', () => {
    const store = catalog.createAugmentCatalog();
    const properties = [
        { operation: 'DELTA_PERCENT', property: 'SHOT_RANGE', value: -25 },
        { operation: 'OVERRIDE_VALUE', property: 'NEW_PROPERTY', value: 0 },
        { operation: 'DELTA_PERCENT', property: 'HULL_MASS', value: 0 },
    ];
    store.accept(snapshot([{ ...device('1'), properties }, { ...device('2'), properties }]));
    assert.equal(store.setRules({ rules: [
        { objectId: '1', property: 'SHOT_RANGE', status: 'better' },
        { objectId: '1', property: 'NEW_PROPERTY', status: 'lower' },
        { objectId: '1', property: 'HULL_MASS', status: 'better' },
    ] }).length, 0);
    const result = store.get(device().icons[0], '1');
    assert.equal(result.advantages.length, 2);
    assert.equal(result.disadvantages.length, 1);
    assert.equal(result.neutral.length, 0);
    assert.equal(result.modifiers.RANGE, 0.75);
    assert.equal(store.get(device().icons[0], '2').neutral.length, 1);
    assert.equal(store.get(device().icons[0]), undefined, 'different manual rules prevent ambiguous artwork lookup');
    store.setRules({ rules: [] });
    assert.equal(store.get(device().icons[0], '1').advantages.length, 0);
    assert.ok(store.get(device().icons[0]));
});

test('page export refreshes exact identities, deduplicates cards, and reports unavailable data', () => {
    class Image {
        constructor(id, visible = true) {
            this.attributes = new Map([['src', device().icons[0]]]); this.src = device().icons[0]; this.visible = visible;
            this.__reactFiber$test = { memoizedProps: { item: { urg_1: long(id), vrg_1: long('42') } } };
        }
        getAttribute(key) { return this.attributes.get(key) || null; }
        hasAttribute(key) { return this.attributes.has(key); }
        setAttribute(key, value) { this.attributes.set(key, value); }
        removeAttribute(key) { this.attributes.delete(key); }
        getClientRects() { return this.visible ? [{}] : []; }
    }
    const images = [new Image('1'), new Image('1'), new Image('2', false), new Image('3')];
    const page = { setTimeout() {}, setInterval() {}, addEventListener() {}, postMessage() {} };
    const module = load('src/core/gameAugments.ts', { HTMLImageElement: Image,
        document: { body: {}, documentElement: { lang: 'en' }, querySelectorAll: () => images },
        localStorage: { getItem: () => 'en' } });
    module.installGameAugments(page); page.__kaspAugmentConfigure(schema);
    for (const id of ['1', '2']) {
        page.__kaspAugmentData({ p57: () => long(id) }, { ncb_1: list([{ rcb_1: 'OVERRIDE_VALUE', scb_1: 'SHOT_RANGE', tcb_1: 70 }]) });
    }
    page.__kaspAugmentData({ p57: () => long('42') }, baseData());
    const result = page.__kaspAugmentsDebug.page();
    assert.equal(result.devices.length, 1); assert.equal(result.unmatchedCards.length, 1);
    assert.equal(result.devices[0].objectId, '1'); assert.equal(result.devices[0].baseItemId, '42');
    assert.equal(result.devices[0].properties[0].baseValue, 50);
    assert.equal(result.devices[0].properties[0].name.EN, labels.augmentPropertyLabel('SHOT_RANGE', 'EN'));
    result.devices[0].properties[0].value = 999;
    assert.equal(JSON.parse(page.__kaspAugmentsDebug.exportPage()).devices[0].properties[0].value, 70);
});

test('late rule loading refreshes classification without requiring another game snapshot', async () => {
    let finish; const handlers = {}, events = [];
    const page = { addEventListener: (name, callback) => { handlers[name] = callback; },
        dispatchEvent: event => events.push(event.type), postMessage() {} }; page.top = page;
    const module = load('src/core/augmentCatalog.ts', { window: page,
        CustomEvent: class { constructor(type) { this.type = type; } },
        chrome: { runtime: { getURL: value => value } },
        fetch: () => new Promise(resolve => { finish = resolve; }),
        sessionStorage: { setItem() {} }, navigator: { storage: {} } });
    handlers.message({ source: page, data: { type: game.AUGMENTS_MESSAGE, detail: snapshot([device('1', -25)]) } });
    assert.equal(module.AugmentCatalog.getDevice(device().icons[0]).disadvantages.length, 1);
    finish({ ok: true, json: async () => ({ rules: [{ objectId: '1', property: 'SHOT_RANGE', status: 'better' }] }) });
    await tick();
    assert.equal(module.AugmentCatalog.getDevice(device().icons[0]).advantages.length, 1);
    assert.equal(events.length, 2);
});

test('discovers semantic fields in formatted/minified bundles despite duplicate class names', () => {
    for (const source of [fixture, transformSync(fixture, { minifyWhitespace: true }).code]) {
        const discovered = game.discoverAugmentSchema(source);
        for (const [key, value] of Object.entries(schema)) assert.equal(discovered[key], value, key);
    }
    const renamed = fixture.replace(/ncb_1/g, 'newList').replace(/rcb_1/g, 'newOperation');
    assert.equal(game.discoverAugmentSchema(renamed).properties, 'newList');
    assert.equal(game.discoverAugmentSchema(renamed).operation, 'newOperation');
});

test('patch preserves model cache writes and constructor behavior even when bridge callbacks throw', () => {
    let configured;
    const context = { window: {
        __kaspAugmentConfigure: value => { configured = value; },
        __kaspAugmentData: () => { throw new Error('diagnostic'); },
        __kaspAugmentLink: () => { throw new Error('diagnostic'); },
    }, Map };
    vm.runInNewContext(game.patchGameAugments(fixture), context);
    assert.equal(configured.properties, 'ncb_1');
    const m = new context.model();
    const object = {}, data = {};
    assert.equal(m.r7i(object, data), undefined);
    assert.equal(m.l7j_1.s2a_1.get(object), data);
    const dto = new context.dto('id', 'base');
    assert.equal(dto.urg_1, 'id');
    assert.equal(dto.vrg_1, 'base');
    assert.equal(game.patchGameAugments('unsupported bundle'), 'unsupported bundle');
    assert.equal(game.patchGameAugments(fixture + 'ke(other).r7i=function(t,n){this.x.y.set(t,n)}'),
        fixture + 'ke(other).r7i=function(t,n){this.x.y.set(t,n)}');
});

test('parses empty and populated native collections without retaining native references', () => {
    const item = { rcb_1: 'OVERRIDE_VALUE', scb_1: 'HEAT_PER_PERIOD', tcb_1: 0 };
    const result = game.readGameProperties(list([item]), schema);
    assert.equal(result[0].value, 0);
    item.tcb_1 = 100;
    assert.equal(result[0].value, 0);
    assert.equal(game.readGameProperties(list([]), schema).length, 0);
    assert.equal(game.readGameProperties(list([{ ...item, tcb_1: Infinity }]), schema), null);
});

test('renamed model methods are discovered by context and unrelated map writers stay untouched', () => {
    const source = fixture.replace('ke(model).r7i=',
        'ke(model).pop=function(){throw Error("No objects in stack")};ke(model).x57=function(){return this.modelId};ke(model).v7j=') +
        'function other(){this.a={b:new Map}};ke(other).z7j=function(t,n){this.a.b.set(t,n)};';
    for (const code of [source, transformSync(source, { minifyWhitespace: true }).code]) {
        assert.equal(game.discoverAugmentSchema(code).objectIdMethod, 'x57');
        const observed = [];
        const context = { Map, window: { __kaspAugmentConfigure() {}, __kaspAugmentData: (...args) => observed.push(args) } };
        const patched = game.patchGameAugments(code);
        assert.notEqual(patched, code);
        vm.runInNewContext(patched, context);
        const object = {}, data = {};
        const model = new context.model(); model.v7j(object, data);
        assert.equal(model.l7j_1.s2a_1.get(object), data);
        new context.other().z7j(object, data);
        assert.equal(observed.length, 1);
        assert.equal(observed[0][0], object);
    }
    const ambiguous = source + 'ke(other).pop=function(){throw Error("No objects in stack")};ke(other).x57=function(){return this.id};ke(other).newWriter=function(t,n){this.a.b.set(t,n)}';
    assert.equal(game.patchGameAugments(ambiguous), ambiguous);
});

test('collector uses the discovered object ID method after a game update', () => {
    const frames = [], messages = [];
    const page = { setTimeout: fn => frames.push(fn), setInterval() {}, addEventListener() {}, postMessage: m => messages.push(m) };
    const module = load('src/core/gameAugments.ts', { document: { documentElement: { lang: 'en' } }, localStorage: { getItem: () => 'en' } });
    module.installGameAugments(page);
    page.__kaspAugmentConfigure({ ...schema, objectIdMethod: 'x57' });
    const object = { x57: () => long('3074457415741482382') };
    page.__kaspAugmentData(object, { ncb_1: list([]), jdd_1: 'Device', idd_1: 'Description' });
    frames.splice(0).forEach(fn => fn());
    assert.equal(messages.at(-1).detail.devices[0].id, '3074457415741482382');
    assert.equal(messages.at(-1).detail.devices[0].name, 'Device');
});

test('preview discovery uses exact device IDs, rejects conflicting artwork and never reads icon getters', () => {
    const iconSchema = { ...schema, imageUrlMethod: 'url', viewDeviceId: 'viewId', viewPreview: 'preview' };
    const url = 'https://s.eu.tankionline.com/static/images/device.svg';
    const card = { parentElement: null, __reactFiber$test: { memoizedProps: {
        id: long('1'), icon: { url: () => url }, nearby: { id: long('2'), icon: { url: () => url + '?other' } },
    } } };
    assert.equal(game.findAugmentPreview(card, '1', iconSchema), url);
    card.__reactFiber$test.memoizedProps.nearby.id = long('1');
    assert.equal(game.findAugmentPreview(card, '1', iconSchema), undefined);
    card.__reactFiber$test.memoizedProps = { viewId: long('1'), preview: list([{ url: () => url }]) };
    assert.equal(game.findAugmentPreview(card, '1', iconSchema), url);
    let calls = 0;
    card.__reactFiber$test.memoizedProps = { id: long('1'), icon: Object.defineProperty({}, 'url', { get() { calls++; return () => url; } }) };
    assert.equal(game.findAugmentPreview(card, '1', iconSchema), undefined);
    assert.equal(calls, 0);
    assert.equal(game.isAugmentPreviewUrl('https://other.example/device.svg'), false);
    assert.equal(game.isAugmentPreviewUrl('javascript:alert(1)'), false);
    assert.equal(game.isAugmentPreviewUrl('blob:https://tankionline.com/uuid'), true);
    assert.equal(game.isAugmentPreviewUrl('https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg'), false);
});

test('React binding resolves exact large IDs and refuses ambiguous neighboring devices or getters', () => {
    const id = '3074457415741482382';
    const known = new Set([id, '2']);
    const card = { parentElement: null, __reactFiber$test: { memoizedProps: { item: { urg_1: long(id), vrg_1: long('99') } } } };
    assert.equal(game.findAugmentIdentity(card, known, schema).id, id);
    assert.equal(game.findAugmentIdentity(card, known, schema).baseItemId, '99');
    card.__reactFiber$test.memoizedProps = { first: long(id), second: long('2') };
    assert.equal(game.findAugmentIdentity(card, known, schema), null);
    card.__reactFiber$test.memoizedProps = Object.defineProperty({}, 'item', { get() { throw new Error('getter'); } });
    assert.equal(game.findAugmentIdentity(card, known, schema), null);
    let getterCalls = 0;
    card.__reactFiber$test.memoizedProps = { item: Object.defineProperty({ low: 1 }, 'high', {
        enumerable: true, get() { getterCalls++; return 2; },
    }) };
    assert.equal(game.findAugmentIdentity(card, known, schema), null);
    assert.equal(getterCalls, 0);
});

test('unavailable cosmetics read localized cell names and exact artwork without device modifiers', () => {
    const preview = device().icons[0];
    const props = { id: long('1931010000001'), name: 'Twins skin', isUnknown: true,
        typeStandardDevice: false, icon: { url: () => preview } };
    const card = { parentElement: null, __reactFiber$test: { memoizedProps: props } };
    const found = game.findUnavailableCosmetic(card, { ...schema, imageUrlMethod: 'url' });
    assert.equal(found.id, '1931010000001'); assert.equal(found.name, props.name); assert.equal(found.previewIcon, preview);
    props.name = 'Цвет выстрела';
    assert.equal(game.findUnavailableCosmetic(card, { ...schema, imageUrlMethod: 'url' }).name, props.name);
    props.isUnknown = false;
    assert.equal(game.findUnavailableCosmetic(card, { ...schema, imageUrlMethod: 'url' }), undefined);
    props.isUnknown = true; props.typeStandardDevice = true;
    assert.equal(game.findUnavailableCosmetic(card, { ...schema, imageUrlMethod: 'url' }), undefined);
});

test('active garage sections follow the selected menu tab independently of translated labels', () => {
    let selected = 0;
    const tabs = ['Устройства', 'Skins', 'Цвет выстрела'].map((textContent, index) => ({ textContent,
        classList: { contains: name => name === '-activeMenu' && selected === index } }));
    const document = { querySelectorAll: () => tabs };
    assert.equal(game.activeGarageCardSection(document), 'augments');
    selected = 1; assert.equal(game.activeGarageCardSection(document), 'skins');
    selected = 2; assert.equal(game.activeGarageCardSection(document), 'shot-color');
    const twoTabs = { querySelectorAll: () => tabs.slice(0, 2) };
    selected = 0; assert.equal(game.activeGarageCardSection(twoTabs), 'augments');
    selected = 1; assert.equal(game.activeGarageCardSection(twoTabs), 'skins', 'turrets without shot colors still resolve the skins section');
    selected = -1; assert.equal(game.activeGarageCardSection(document), null);
    assert.equal(game.activeGarageCardSection({ querySelectorAll: () => [] }), null);
});

test('selected cards use the committed React tree when switching skins and shot colors in both directions', () => {
    const schemaWithIcons = { ...schema, imageUrlMethod: 'url' };
    const rootState = {};
    const skinRoot = { stateNode: rootState }, colorRoot = { stateNode: rootState };
    const skin = { return: skinRoot, memoizedProps: { id: long('101'), name: 'Tsunami XT skin',
        isUnknown: true, typeStandardDevice: false, icon: { url: () => device().icons[0] + '?skin' } } };
    const color = { return: colorRoot, memoizedProps: { id: long('202'), name: 'Toxic',
        isUnknown: true, typeStandardDevice: false, icon: { url: () => device().icons[0] + '?color' } } };
    skin.alternate = color; color.alternate = skin;
    skinRoot.child = skin; colorRoot.child = color;
    const card = { parentElement: null, __reactFiber$test: skin };
    rootState.current = skinRoot;
    assert.equal(game.findUnavailableCosmetic(card, schemaWithIcons).name, 'Tsunami XT skin');
    rootState.current = colorRoot;
    assert.equal(game.findUnavailableCosmetic(card, schemaWithIcons).name, 'Toxic');
    assert.match(game.findAugmentPreview(card, '202', schemaWithIcons), /\?color$/);
    assert.equal(game.findAugmentPreview(card, '101', schemaWithIcons), undefined);
    rootState.current = skinRoot;
    assert.equal(game.findUnavailableCosmetic(card, schemaWithIcons).name, 'Tsunami XT skin');
    color.memoizedProps.isUnknown = false; rootState.current = colorRoot;
    assert.equal(game.findUnavailableCosmetic(card, schemaWithIcons), undefined, 'an owned card must not inherit the hidden skin');
});

test('collector joins properties and descriptions in either order, preserves empty effects, and replies to late listeners', () => {
    const frames = [], handlers = {}, messages = [];
    const page = { setTimeout: fn => frames.push(fn), setInterval() {},
        addEventListener: (name, callback) => { handlers[name] = callback; },
        postMessage: message => messages.push(message) };
    const document = { documentElement: { lang: 'en' } };
    const module = load('src/core/gameAugments.ts', { document, localStorage: { getItem: () => 'en' } });
    module.installGameAugments(page);
    page.__kaspAugmentConfigure(schema);
    const object = { p57: () => long('3074457415741482382') };
    page.__kaspAugmentData(object, { jdd_1: 'Adrenaline', idd_1: 'Conditional damage boost' });
    page.__kaspAugmentData(object, { ncb_1: list([]) });
    page.__kaspAugmentLink(long('3074457415741482382'), long('42'));
    frames.splice(0).forEach(fn => fn());
    const result = messages.at(-1).detail.devices[0];
    assert.equal(result.id, '3074457415741482382');
    assert.equal(result.baseItemId, '42');
    assert.equal(result.locale, 'EN');
    assert.equal(result.name, 'Adrenaline');
    assert.equal(result.properties.length, 0);
    const revision = messages.at(-1).detail.revision;
    page.__kaspAugmentData(object, { ncb_1: list([]) });
    assert.equal(frames.length, 0);
    handlers.message({ source: page, data: { type: module.AUGMENTS_REQUEST } });
    assert.equal(messages.at(-1).detail.revision, revision);
});

test('disabled card binding has no DOM observer or polling and restarts without losing captured data', () => {
    let enabled = false, scans = 0, starts = 0, disconnects = 0, serial = 0;
    const handlers = {}, timers = new Map(), attributes = new Set();
    let notify;
    const document = { body: {}, documentElement: { lang: 'en',
        toggleAttribute(name, value) { if (value) attributes.add(name); else attributes.delete(name); } },
        querySelectorAll() { scans++; return []; } };
    const page = { setTimeout() {}, setInterval(fn) { timers.set(++serial, fn); return serial; },
        clearInterval(id) { timers.delete(id); }, postMessage() {},
        addEventListener(name, handler) { handlers[name] = handler; } };
    const module = load('src/core/gameAugments.ts', { document,
        localStorage: { getItem: key => key === 'k_augments' ? String(enabled) : 'en' },
        MutationObserver: class { constructor(fn) { notify = fn; } observe() { starts++; } disconnect() { disconnects++; } } });
    module.installGameAugments(page);
    page.__kaspAugmentConfigure(schema);
    page.__kaspAugmentData({ p57: () => long('1') }, { ncb_1: list([]) });
    assert.equal(timers.size, 0); assert.equal(starts, 0); assert.equal(scans, 0);
    assert.equal(page.__kaspAugmentsDebug.status().devices, 1, 'one-time game data remains available when enabling later');
    enabled = true; handlers['kasp:settings-changed']();
    assert.equal(timers.size, 1); assert.equal(starts, 1); assert.ok(scans > 0);
    assert.ok(attributes.has('data-kasp-augments-enabled'));
    enabled = false; handlers['kasp:settings-changed']();
    assert.equal(timers.size, 0); assert.equal(disconnects, 1);
    assert.equal(attributes.has('data-kasp-augments-enabled'), false);
    const before = scans; notify([{ type: 'attributes', target: { matches: () => true } }]);
    assert.equal(scans, before, 'queued observer callbacks do not scan while disabled');
    enabled = true; handlers.storage();
    assert.equal(timers.size, 1); assert.equal(starts, 2);
});

test('binding a recycled card triggers UI updates even when its shared artwork is already known', () => {
    class Image {
        constructor() { this.attributes = new Map(); this.src = device().icons[0]; }
        getAttribute(key) { return this.attributes.get(key) || null; }
        hasAttribute(key) { return this.attributes.has(key); }
        setAttribute(key, value) { this.attributes.set(key, value); }
        removeAttribute(key) { this.attributes.delete(key); }
    }
    const image = new Image();
    image.__reactFiber$test = { memoizedProps: { id: long('1') } };
    const frames = [], messages = [];
    let scan, observeCards;
    const page = { setTimeout: fn => frames.push(fn), setInterval: fn => { scan = fn; },
        addEventListener() {}, postMessage: message => messages.push(message) };
    const module = load('src/core/gameAugments.ts', { HTMLImageElement: Image,
        MutationObserver: class { constructor(callback) { observeCards = callback; } observe() {} },
        document: { body: {}, documentElement: { lang: 'en' }, querySelectorAll: () => [image] },
        localStorage: { getItem: key => key === 'k_augments' ? 'true' : 'en' } });
    module.installGameAugments(page);
    page.__kaspAugmentConfigure(schema);
    for (const id of ['1', '2']) page.__kaspAugmentData({ p57: () => long(id) }, { ncb_1: list([]) });
    const flush = () => frames.splice(0).forEach(fn => fn());
    observeCards([{ type: 'childList', addedNodes: [{ nodeType: 1, matches: () => true }] }]);
    assert.equal(image.getAttribute('data-kasp-augment-id'), '1', 'new cards bind without waiting for the interval');
    assert.equal(messages.at(-1).detail.devices[0].icons[0], image.src, 'appearance is published immediately');
    flush();
    assert.equal(image.getAttribute('data-kasp-augment-id'), '1');
    image.__reactFiber$test.memoizedProps.id = long('2');
    scan(); flush(); // Both device records have now observed this same artwork.
    image.__reactFiber$test.memoizedProps.id = long('1');
    const before = messages.at(-1).detail.revision;
    scan(); flush();
    assert.equal(image.getAttribute('data-kasp-augment-id'), '1');
    assert.ok(messages.at(-1).detail.revision > before);
    scan();
    assert.equal(frames.length, 0, 'unchanged binding must not cause another update cycle');
    image.__reactFiber$test.memoizedProps = {};
    scan(); flush();
    assert.equal(image.hasAttribute('data-kasp-augment-id'), false);
});

test('catalog matches EU/RU assets and exact IDs without mixing devices that share artwork', () => {
    const store = catalog.createAugmentCatalog();
    store.accept(snapshot([device('1', 25), device('2', -50)]));
    const url = 'https://s.ru.tankionline.com/static/images/device.svg';
    assert.equal(store.get(url), undefined);
    assert.equal(store.get(url, '1').modifiers.RANGE, 1.25);
    assert.equal(store.get(url, '2').modifiers.RANGE, 0.5);
    assert.equal(store.get('https://s.eu.tankionline.com/other.svg', '1'), undefined);
    assert.equal(store.accept(snapshot([device()], 1)), false);
    assert.equal(store.accept(snapshot([device()], 2, 'old-page')), false);
    store.accept(snapshot([device('1', 25), device('2', 25)], 2));
    assert.equal(store.get(url).modifiers.RANGE, 1.25);
});

test('empty numeric lists do not merge distinct descriptions that share an icon', () => {
    const store = catalog.createAugmentCatalog();
    store.accept(snapshot([{ ...device('1'), name: 'Adrenaline', properties: [] },
        { ...device('2'), name: 'Another effect', properties: [] }]));
    const url = device().icons[0];
    assert.equal(store.get(url), undefined);
    assert.equal(store.get(url, '1').name, 'Adrenaline');
});

test('tooltips preserve descriptions and show other parameters only when classification is unresolved', () => {
    for (const language of ['RU', 'EN']) {
        const frames = [];
        const tooltip = { style: {}, getBoundingClientRect: () => ({ width: 100, height: 100 }) };
        const card = { style: {}, button: null,
            querySelector() { return this.button; }, appendChild(button) { this.button = button; } };
        const image = { parentElement: card, src: device().icons[0], getAttribute: () => null };
        const nativeDevice = { ...device(), locale: language, description: '<img src=x onerror=alert(1)>',
            properties: [{ operation: 'DELTA_PERCENT', property: 'SHOT_RANGE', value: 25 },
                { operation: 'OVERRIDE_VALUE', property: 'WEAPON_RELOAD_TIME', value: 500 }] };
        const view = catalog.presentGameAugment(nativeDevice, { WEAPON_RELOAD_TIME: 500 });
        const state = { lang: language, currentScreen: 'garage' };
        const dom = load('src/core/gameDOM.ts').gameDOM;
        const document = { body: {}, getElementById: () => tooltip, querySelector: () => null,
            querySelectorAll: selector => selector === dom.augments.cardImage ? [image] : [],
            createElement: () => ({ dataset: {}, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } }) };
        const module = { exports: {} };
        vm.runInNewContext(transformSync(fs.readFileSync(path.join(root, 'src/modules/augmentSpecs.ts'), 'utf8'),
            { loader: 'ts', format: 'cjs' }).code, { module, exports: module.exports, document,
            window: { innerWidth: 1000, innerHeight: 1000, getComputedStyle: () => ({ position: 'relative' }), addEventListener() {} },
            requestAnimationFrame: fn => frames.push(fn), queueMicrotask: fn => frames.push(fn), require: name => {
                if (name.endsWith('/gameDOM')) return { gameDOM: dom };
                if (name.endsWith('/state')) return { state };
                if (name.endsWith('/utils')) return { utils: { getSetting: () => true } };
                if (name.endsWith('/augmentCatalog')) return { AUGMENTS_UPDATED: 'updated' };
                if (name.endsWith('/gameAugments')) return game;
                if (name.endsWith('/dataLoader')) return { DataLoader: { hasDevice: () => true, getDevice: () => view } };
                throw new Error(name);
            } });
        module.exports.augmentSpecs();
        frames.shift()();
        card.button.handlers.mouseenter({ clientX: 10, clientY: 10 });
        assert.equal(tooltip.style.display, 'block');
        const originalRect = tooltip.getBoundingClientRect;
        tooltip.getBoundingClientRect = () => ({ width: 900, height: 900 });
        card.button.handlers.mousemove({ clientX: 500, clientY: 500 });
        assert.equal(tooltip.style.left, '10px', 'flipping a large tooltip must not move it beyond the left edge');
        assert.equal(tooltip.style.top, '515px', 'a tooltip that cannot fit above the cursor must remain below it');
        tooltip.getBoundingClientRect = () => ({ width: 100, height: 100 });
        card.button.handlers.mousemove({ clientX: 500, clientY: 950 });
        assert.equal(tooltip.style.top, '835px', 'a tooltip that fits above the cursor should flip normally');
        tooltip.getBoundingClientRect = () => ({ width: 900, height: 900 });
        card.button.handlers.mousemove({ clientX: 0, clientY: 0 });
        assert.equal(tooltip.style.left, '15px');
        assert.equal(tooltip.style.top, '15px');
        tooltip.getBoundingClientRect = originalRect;
        assert.ok(!tooltip.innerHTML.includes('<img'));
        assert.ok(tooltip.innerHTML.includes('&lt;img'));
        assert.ok(tooltip.innerHTML.includes(language === 'RU' ? 'Дальность поражения: +25%' : 'Shot range: +25%'));
        assert.ok(!tooltip.innerHTML.includes('500'));
        assert.ok(!tooltip.innerHTML.includes(language === 'RU' ? 'Другие параметры' : 'Other parameters'));
        state.lang = language === 'RU' ? 'EN' : 'RU';
        card.button.handlers.mouseenter({ clientX: 10, clientY: 10 });
        assert.ok(tooltip.innerHTML.includes(language === 'RU' ? 'Shot range: +25%' : 'Дальность поражения: +25%'));
        assert.ok(tooltip.innerHTML.includes(language === 'RU' ? 'Reload the game' : 'Перезагрузите игру'));
        assert.ok(!tooltip.innerHTML.includes('&lt;img'));
        view.neutral.push({ RU: 'Неизвестный параметр: +10%', EN: 'Unknown parameter: +10%' });
        card.button.handlers.mouseenter({ clientX: 10, clientY: 10 });
        assert.ok(tooltip.innerHTML.includes(state.lang === 'RU' ? 'Другие параметры' : 'Other parameters'));
        view.neutral.length = 0;
        view.advantages.length = 0;
        state.lang = language;
        card.button.handlers.mouseenter({ clientX: 10, clientY: 10 });
        assert.ok(tooltip.innerHTML.includes('&lt;img'), 'description must survive a device with no numeric effects');
        assert.ok(!tooltip.innerHTML.includes(language === 'RU' ? 'Другие параметры' : 'Other parameters'));
    }
});

test('unclassified absolute values are retained internally and do not invent live multipliers', () => {
    const data = device();
    data.properties = [{ operation: 'OVERRIDE_VALUE', property: 'HULL_MASS', value: 500 },
        { operation: 'DELTA_PERCENT', property: 'NEW_UNKNOWN_PARAMETER', value: -70 }];
    const view = catalog.presentGameAugment(data);
    assert.equal(view.neutral.length, 2);
    assert.equal(Object.keys(view.modifiers).length, 0);
    assert.match(view.neutral[0].RU, /Масса корпуса: = 500/);
    assert.match(view.neutral[0].EN, /Hull mass: = 500/);
    assert.equal(labels.augmentPropertyBenefit('WEAPON_RELOAD_TIME', -20), 'advantage');
    data.properties = [{ operation: 'DELTA_PERCENT', property: 'DAMAGE_FROM', value: 10 },
        { operation: 'DELTA_PERCENT', property: 'DAMAGE_TO', value: 20 }];
    assert.equal(catalog.liveAugmentModifiers(data).DAMAGE, undefined);
});

test('unavailable previews restore on native card changes, loading errors and module disable', () => {
    const placeholder = 'https://s.eu.tankionline.com/static/images/unavailable.5c3ecd75.svg';
    const preview = device().icons[0];
    const frames = [], classes = new Set(), listeners = {};
    let enabled = true;
    const tooltip = { style: {} };
    const cardClasses = new Set();
    const card = { style: {}, children: [],
        classList: { add: name => cardClasses.add(name), remove: name => cardClasses.delete(name), contains: name => cardClasses.has(name) },
        querySelector(selector) { return this.children.find(node => '.' + node.className === selector); },
        appendChild(node) { node.parentElement = this; this.children.push(node); } };
    const data = { previewIcon: preview, name: 'Swarm launcher', rarity: 'LEGENDARY' };
    const attributes = { 'data-kasp-augment-id': '1' };
    let activeTab = 0;
    const tabs = [0, 1, 2].map(index => ({ classList: { contains: () => activeTab === index } }));
    const image = { parentElement: card, src: placeholder, isConnected: true,
        getAttribute: name => attributes[name] || null, addEventListener: (name, fn) => { listeners[name] = fn; },
        setAttribute: (name, value) => { attributes[name] = value; },
        removeAttribute: name => { delete attributes[name]; },
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) } };
    const dom = load('src/core/gameDOM.ts').gameDOM;
    const document = { body: {}, getElementById: () => tooltip, querySelector: () => null,
        querySelectorAll: selector => selector === dom.augments.cardImage ? [image]
            : selector.includes('MenuComponentStyle-mainMenuItem') ? tabs : [],
        createElement: () => ({ dataset: {}, style: {}, addEventListener() {}, remove() {
            card.children = card.children.filter(node => node !== this); this.parentElement = null;
        } }) };
    const module = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync(path.join(root, 'src/modules/augmentSpecs.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code,
        { module, exports: module.exports, document,
            window: { getComputedStyle: () => ({ position: 'relative' }), addEventListener() {} },
            requestAnimationFrame: fn => frames.push(fn), queueMicrotask: fn => frames.push(fn), require: name => {
                if (name.endsWith('/gameDOM')) return { gameDOM: dom };
                if (name.endsWith('/state')) return { state: { lang: 'EN', currentScreen: 'garage' } };
                if (name.endsWith('/utils')) return { utils: { getSetting: () => enabled } };
                if (name.endsWith('/augmentCatalog')) return { AUGMENTS_UPDATED: 'updated' };
                if (name.endsWith('/gameAugments')) return game;
                if (name.endsWith('/dataLoader')) return { DataLoader: {
                    hasDevice: () => !!attributes['data-kasp-augment-id'],
                    getDevice: () => attributes['data-kasp-augment-id'] ? data : undefined } };
                throw Error(name);
            } });
    const update = () => { module.exports.augmentSpecs(); frames.splice(0).forEach(fn => fn()); };
    update(); assert.equal(image.src, preview); assert.ok(classes.has('kasp-unavailable-device-preview'));
    assert.ok(cardClasses.has('kasp-unavailable-device-card'));
    assert.equal(card.querySelector('.kasp-unavailable-device-name').textContent, data.name);
    assert.match(card.querySelector('.kasp-unavailable-device-rarity').style.backgroundImage, /legendary_icon/);
    const title = card.querySelector('.kasp-unavailable-device-name');
    update(); assert.equal(card.querySelector('.kasp-unavailable-device-name'), title, 'unchanged updates preserve decorations');
    cardClasses.clear(); update();
    assert.ok(cardClasses.has('kasp-unavailable-device-card'), 'selection overwriting className restores unavailable styling');
    assert.equal(card.querySelector('.kasp-unavailable-device-name'), title);
    data.name = 'Tornado launcher'; data.rarity = 'RARE'; update();
    assert.equal(title.textContent, data.name);
    assert.match(card.querySelector('.kasp-unavailable-device-rarity').style.backgroundImage, /legendary_icon/);
    delete data.rarity; update();
    assert.match(card.querySelector('.kasp-unavailable-device-rarity').style.backgroundImage, /legendary_icon/, 'all unavailable devices get the same badge, even without rarity');
    title.remove(); update(); assert.notEqual(card.querySelector('.kasp-unavailable-device-name'), title);
    image.src = 'https://s.eu.tankionline.com/static/images/owned.svg';
    update(); assert.equal(classes.size, 0); assert.match(image.src, /owned\.svg$/);
    assert.equal(cardClasses.size, 0); assert.equal(card.querySelector('.kasp-unavailable-device-name'), undefined);
    image.src = placeholder;
    update(); enabled = false; update(); assert.equal(image.src, placeholder); assert.equal(classes.size, 0);
    assert.equal(cardClasses.size, 0);
    enabled = true; update(); listeners.error(); assert.equal(image.src, placeholder); assert.equal(classes.size, 0);
    assert.ok(Object.hasOwn(attributes, 'data-kasp-preview-failed'), 'failed previews keep the native placeholder visible');
    update(); assert.equal(image.src, placeholder, 'a failed URL must not cause endless load retries');
    delete attributes['data-kasp-augment-id'];
    activeTab = 1;
    Object.assign(attributes, { 'data-kasp-cosmetic-id': '20', 'data-kasp-cosmetic-name': 'Twins XT skin',
        'data-kasp-cosmetic-preview': preview + '?skin', 'data-kasp-cosmetic-section': 'skins' });
    update(); assert.equal(image.src, preview + '?skin');
    assert.equal(Object.hasOwn(attributes, 'data-kasp-preview-failed'), false, 'a new preview clears the previous failure marker');
    assert.equal(card.querySelector('.kasp-unavailable-cosmetic-name').textContent, 'Twins XT skin');
    assert.equal(card.querySelector('.kasp-unavailable-device-gradient'), undefined);
    assert.equal(card.querySelector('.kasp-unavailable-device-rarity'), undefined);
    assert.equal(card.querySelector('.custom-card-specs-btn'), undefined, 'cosmetics have no device specs button');
    activeTab = 2; update();
    assert.equal(image.src, placeholder, 'switching tabs clears a stale skin preview before shot-color data arrives');
    assert.equal(card.querySelector('.kasp-unavailable-cosmetic-name'), undefined);
    attributes['data-kasp-cosmetic-section'] = 'shot-color';
    attributes['data-kasp-cosmetic-name'] = 'Aqua';
    attributes['data-kasp-cosmetic-preview'] = preview + '?color';
    update(); assert.equal(image.src, preview + '?color');
    assert.equal(card.querySelector('.kasp-unavailable-device-name').textContent, 'Aqua');
    assert.ok(card.querySelector('.kasp-unavailable-device-gradient'));
    assert.match(card.querySelector('.kasp-unavailable-device-rarity').style.backgroundImage, /legendary_icon/);
    delete attributes['data-kasp-cosmetic-id']; image.src = preview;
    update(); assert.equal(cardClasses.size, 0); assert.equal(classes.size, 0);
});

test('critical mixture and salvo timings are classified by parameter meaning rather than the sign alone', () => {
    const data = device();
    data.properties = ['CRITICAL_HIT_DAMAGE', 'MAX_CRITICAL_HIT_CHANCE', 'START_CRITICAL_HIT_CHANCE', 'CRITICAL_CHANCE_DELTA']
        .map(property => ({ operation: 'DELTA_PERCENT', property, value: 400 }));
    let view = catalog.presentGameAugment(data);
    assert.equal(view.advantages.length, 4);
    assert.equal(view.disadvantages.length, 0);
    assert.equal(view.neutral.length, 0);
    data.properties = [{ operation: 'DELTA_PERCENT', property: 'TIME_BETWEEN_SHOTS_OF_SALVO', value: 100 },
        { operation: 'DELTA_PERCENT', property: 'FREEZE_PER_TICK', value: -50 },
        { operation: 'DELTA_PERCENT', property: 'TESLA_GLOBE_CHARGE_MS', value: -33 }];
    view = catalog.presentGameAugment(data);
    assert.equal(view.advantages.length, 1);
    assert.equal(view.disadvantages.length, 2);
    assert.equal(view.neutral.length, 0);
});

const baseData = (currentLevel = 3) => ({ lch_1: currentLevel, mch_1: { gci_1: 10, fci_1: list([
    { tch_1: list([{ zch_1: 'SHOT_RANGE', ych_1: 20, xch_1: 120 },
        { zch_1: 'MAX_CRITICAL_HIT_CHANCE', ych_1: 0.1, xch_1: 0.1 }]) },
]) } });

test('equipment bases use raw game values and current upgrades without GUI unit conversion or guessed defaults', () => {
    const base = game.readEquipmentProperties(baseData(), schema);
    assert.equal(base.properties.SHOT_RANGE, 50);
    assert.equal(base.properties.MAX_CRITICAL_HIT_CHANCE, 0.1);
    assert.equal(game.readEquipmentProperties(baseData(0), schema).properties.SHOT_RANGE, 20);
    assert.equal(game.readEquipmentProperties(baseData(11), schema), null);
    const conflicting = baseData();
    conflicting.mch_1.fci_1 = list([{ tch_1: list([
        { zch_1: 'SHOT_RANGE', ych_1: 20, xch_1: 120 },
        { zch_1: 'SHOT_RANGE', ych_1: 40, xch_1: 140 },
    ]) }]);
    assert.equal(game.readEquipmentProperties(conflicting, schema).properties.SHOT_RANGE, undefined);
});

test('absolute overrides compare against their own equipment and refresh when its base arrives', () => {
    const store = catalog.createAugmentCatalog();
    const first = { ...device('1'), baseItemId: '11', properties: [{ operation: 'OVERRIDE_VALUE', property: 'SHOT_RANGE', value: 50 }] };
    const second = { ...device('2'), baseItemId: '22', properties: first.properties };
    store.accept(snapshot([first, second]));
    assert.equal(store.get(first.icons[0], '1').advantages.length, 0);
    store.accept({ ...snapshot([first, second], 2), equipment: [
        { id: '11', currentLevel: 0, properties: { SHOT_RANGE: 20 } },
        { id: '22', currentLevel: 0, properties: { SHOT_RANGE: 100 } },
    ] });
    assert.match(store.get(first.icons[0], '1').advantages[0].EN, /20 → 50/);
    assert.match(store.get(first.icons[0], '2').disadvantages[0].RU, /100 → 50/);
    assert.equal(store.get(first.icons[0]), undefined, 'different equipment bases cannot share an icon-only classification');
    const probability = catalog.presentGameAugment({ ...first, properties: [
        { operation: 'OVERRIDE_VALUE', property: 'MAX_CRITICAL_HIT_CHANCE', value: 1 },
        { operation: 'OVERRIDE_VALUE', property: 'AFTER_CRIT_CRITICAL_HIT_CHANCE', value: -1 },
    ] }, { MAX_CRITICAL_HIT_CHANCE: 0.1, AFTER_CRIT_CRITICAL_HIT_CHANCE: 0.1 });
    assert.match(probability.advantages[0].EN, /10% → 100%/);
    assert.equal(probability.neutral.length, 1, 'negative protocol sentinels are not ordinary probabilities');
});

test('zero deltas and unchanged absolute values do not create an unresolved parameter section', () => {
    const result = catalog.presentGameAugment({ ...device(), properties: [
        { operation: 'DELTA_PERCENT', property: 'SHOT_RANGE', value: 0 },
        { operation: 'OVERRIDE_VALUE', property: 'MAX_CRITICAL_HIT_CHANCE', value: 0.10000000149011612 },
    ] }, { MAX_CRITICAL_HIT_CHANCE: 0.1 });
    assert.equal(result.advantages.length, 0);
    assert.equal(result.disadvantages.length, 0);
    assert.equal(result.neutral.length, 0);
});

test('collector saves equipment baselines alongside devices and invalid data clears the previous baseline', () => {
    const frames = [], messages = [];
    const page = { setTimeout: fn => frames.push(fn), setInterval() {}, addEventListener() {}, postMessage: m => messages.push(m) };
    const module = load('src/core/gameAugments.ts', { document: { documentElement: { lang: 'en' } }, localStorage: { getItem: () => 'en' } });
    module.installGameAugments(page);
    page.__kaspAugmentConfigure(schema);
    const object = { p57: () => long('42') };
    page.__kaspAugmentData(object, baseData());
    frames.splice(0).forEach(fn => fn());
    assert.equal(messages.at(-1).detail.equipment[0].properties.SHOT_RANGE, 50);
    assert.equal(page.__kaspAugmentsDebug.status().equipment, 1);
    page.__kaspAugmentData(object, baseData(20));
    frames.splice(0).forEach(fn => fn());
    assert.equal(messages.at(-1).detail.equipment.length, 0);
});

test('rejects malformed bridge snapshots before lookup or persistence', () => {
    assert.equal(catalog.validateAugmentSnapshot(snapshot([{ ...device(), properties: [{ operation: 'UNKNOWN', property: 'DAMAGE', value: 1 }] }])), null);
    assert.equal(catalog.validateAugmentSnapshot(snapshot([device(), device()])), null);
    assert.equal(catalog.validateAugmentSnapshot(snapshot([{ ...device(), icons: ['javascript:alert(1)'] }])), null);
    assert.equal(catalog.validateAugmentSnapshot(snapshot([{ ...device(), properties: [{ operation: 'DELTA_PERCENT', property: '<script>', value: 1 }] }])), null);
});

test('rewrites private JSON on page initialization and saves newer snapshots in order without reading old data', async () => {
    const writes = [], handlers = {}, session = new Map();
    const page = { addEventListener: (name, callback) => { handlers[name] = callback; },
        dispatchEvent() {}, postMessage() {} };
    page.top = page;
    load('src/core/augmentCatalog.ts', { window: page, CustomEvent: class {},
        sessionStorage: { setItem: (key, value) => session.set(key, value) },
        navigator: { storage: { getDirectory: async () => ({ getFileHandle: async name => {
            assert.equal(name, 'kasp-augments.json');
            return { createWritable: async () => ({ write: async value => writes.push(value), close: async () => {}, abort: async () => {} }) };
        } }) } },
    });
    handlers.message({ source: page, data: { type: game.AUGMENTS_MESSAGE, detail: snapshot([device()], 1) } });
    handlers.message({ source: page, data: { type: game.AUGMENTS_MESSAGE, detail: snapshot([device('2')], 2) } });
    await tick();
    assert.equal(JSON.parse(writes[0]).devices.length, 0);
    assert.equal(JSON.parse(writes.at(-1)).devices[0].id, '2');
    assert.equal(JSON.parse(session.get(catalog.AUGMENTS_JSON_KEY)).revision, 2);
});

test('unsupported file storage retains the session JSON and does not reject game data', async () => {
    const handlers = {}, session = new Map();
    const page = { addEventListener: (name, callback) => { handlers[name] = callback; }, dispatchEvent() {}, postMessage() {} };
    page.top = page;
    const module = load('src/core/augmentCatalog.ts', { window: page, CustomEvent: class {}, navigator: { storage: {} },
        sessionStorage: { setItem: (key, value) => session.set(key, value) } });
    handlers.message({ source: page, data: { type: game.AUGMENTS_MESSAGE, detail: snapshot([device()]) } });
    await tick();
    assert.equal(JSON.parse(session.get(catalog.AUGMENTS_JSON_KEY)).devices.length, 1);
    assert.ok(module.AugmentCatalog.storageStatus().fileError);
});

test('shared reference loading does not fetch augments and does not wait for game device data', async () => {
    const fetched = [];
    const module = load('src/core/dataLoader.ts', {
        chrome: { runtime: { getURL: value => value } },
        console: { log() {}, error() {} },
        fetch: async url => {
            fetched.push(url);
            return { ok: true, json: async () => url.endsWith('maps.json') ? [] : {} };
        },
    });
    await module.DataLoader.readyPromise;
    assert.equal(module.DataLoader.isReady(), true);
    assert.deepEqual(fetched.sort(), ['database/maps.json', 'database/paints.json', 'database/skins.json']);
    assert.equal(module.DataLoader.getDevice('unknown.svg'), undefined);
});
