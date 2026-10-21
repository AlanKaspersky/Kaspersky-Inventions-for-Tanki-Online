const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const { webcrypto, createHash } = require('node:crypto');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compile = source => transformSync(source, { loader: 'ts', format: 'cjs' }).code;
const gameDOMModule = { exports: {} };
runFeatureContext(compile(read('src/core/gameDOM.ts')), { module: gameDOMModule });
const bonusPickupModule = { exports: {} };
runFeatureContext(compile(read('src/core/bonusPickup.ts')), { module: bonusPickupModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const arcadeReloadModule = { exports: {} };
runFeatureContext(compile(read('src/core/arcadeReload.ts')), { module: arcadeReloadModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const detailsModule = { exports: {} };
runFeatureContext(compile(read('src/core/garageDetails.ts')), { module: detailsModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const garageItemsModule = { exports: {} };
runFeatureContext(compile(read('src/core/garageItems.ts')), { module: garageItemsModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const inventoryModule = { exports: {} };
runFeatureContext(compile(read('src/core/garageInventory.ts')), { module: inventoryModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const presenceModule = { exports: {} };
runFeatureContext(compile(read('src/core/battlePresence.ts')), {
    module: presenceModule, crypto: webcrypto, TextEncoder, require: id => id === './clientPatches' ? require('./test-client-patches.cjs') : gameDOMModule.exports,
});
const statisticsModule = { exports: {} };
runFeatureContext(compile(read('src/core/battleStatistics.ts')), { module: statisticsModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const actionsModule = { exports: {} };
runFeatureContext(compile(read('src/core/userActions.ts')), { module: actionsModule, crypto: webcrypto, TextEncoder, require: () => require('./test-client-patches.cjs') });
const criticalDevicesModule = { exports: {} };
runFeatureContext(compile(read('src/core/criticalDevices.ts')), {module:criticalDevicesModule});
const criticalModule = { exports: {} };
runFeatureContext(compile(read('src/core/criticalIndicator.ts')), { module: criticalModule, crypto: webcrypto, TextEncoder, require: id => id === './criticalDevices' ? criticalDevicesModule.exports : require('./test-client-patches.cjs') });
const directionModule = { exports: {} };
runFeatureContext(compile(read('src/core/overdriveDirection.ts')), { module: directionModule, crypto: webcrypto, TextEncoder,
    require: id => id === './bonusPickup' ? bonusPickupModule.exports : require('./test-client-patches.cjs') });
const tick = () => new Promise(resolve => setImmediate(resolve));

function injectorFixture(fetch, plans = JSON.parse(read('src/generated/overdrive.json')).plans, bonusOverrides = {}, arcadePlans = [], arcadeOverrides = {}, augmentOverrides = {}, detailsOverrides = {}, itemsOverrides = {}, inventoryOverrides = {}, presenceOverrides = {}, userAgent = 'Chrome', statisticsOverrides = {}, actionOverrides = {}, criticalOverrides = {}) {
    class Script {
        constructor() {
            this.src = 'https://tankionline.com/static/js/main.123.js';
            this.type = 'module';
            this.nonce = 'page-nonce';
            this.async = false;
            this.attributes = [
                { name: 'src', value: this.src }, { name: 'type', value: this.type },
                { name: 'crossorigin', value: 'anonymous' }, { name: 'integrity', value: 'sha256-original' },
                { name: 'defer', value: '' },
            ];
            this.listeners = new Map();
        }
        setAttribute(name, value) {
            const attribute = this.attributes.find(attribute => attribute.name === name);
            if (attribute) attribute.value = value;
            else this.attributes.push({ name, value });
            if (name === 'src' || name === 'type') this[name] = value;
        }
        remove() { this.removed = true; }
        addEventListener(name, handler) { this.listeners.set(name, handler); }
    }
    const appended = [];
    const errors = [];
    const observers = [];
    const head = { appendChild(script) { appended.push(script); } };
    const context = {
        require: id => {
            if (id === './core/supplyPrivacy') return { installSupplyPrivacy() {}, selectSupplyPrivacyPlan: async () => undefined, supplyPrivacyPlanValid: () => false };
            if (id === './generated/supply-privacy.json') return { plans: [] };
            if (id === './core/bonusPickup') return { ...bonusPickupModule.exports, ...bonusOverrides };
            if (id === './core/cybersportNative') return { installCybersportNative() {} };
            if (id === './core/accountIdentityNative') return { installAccountIdentityNative: () => ({ capture() {}, reportMapping() {} }) };
            if (id === './generated/overdrive.json') return { plans };
            if (id === './generated/overdrive-direction.json') return { plans: [] };
            if (id === './generated/critical.json') return { plans: [] };
            if (id === './generated/user-action.json') return { plans: [] };
            if (id === './generated/battle-statistics.json') return { plans: [] };
            if (id === './generated/battle-presence.json') return { plans: [] };
            if (id === './generated/garage-inventory.json') return { plans: [] };
            if (id === './generated/garage-items.json') return { plans: [] };
            if (id === './generated/garage-details.json') return { plans: [] };
            if (id === './generated/augments.json') return { plans: [] };
            if (id === './generated/arcade.json') return { plans: arcadePlans };
            if (id === './core/clientPatches') return require('./test-client-patches.cjs');
            if (id === './core/arcadeReload') return { ...arcadeReloadModule.exports, ...arcadeOverrides };
            if (id === './core/gameAugments') return { installGameAugments() {}, installGarageSkinCardsBridge() {}, selectGameAugmentsPlan: async () => undefined, patchGameAugments: code => code, ...augmentOverrides };
            if (id === './core/garageDetails') return { ...detailsModule.exports, ...detailsOverrides };
            if (id === './core/garageItems') return { ...garageItemsModule.exports, ...itemsOverrides };
            if (id === './core/garageInventory') return { ...inventoryModule.exports, ...inventoryOverrides };
            if (id === './core/criticalIndicator') return { ...criticalModule.exports, ...criticalOverrides };
            if (id === './core/overdriveDirection') return directionModule.exports;
            if (id === './core/userActions') return { ...actionsModule.exports, ...actionOverrides };
            if (id === './core/battleStatistics') return { ...statisticsModule.exports, ...statisticsOverrides };
            if (id === './core/battlePresence') return { ...presenceModule.exports, installBattlePresence() {}, ...presenceOverrides };
            throw new Error(`Unexpected injector import: ${id}`);
        },
        window: { location: { origin: 'https://tankionline.com' }, messages: [], addEventListener() {}, removeEventListener() {}, setInterval() { return 0; }, clearInterval() {}, postMessage(value) { this.messages.push(value); } },
        navigator: { userAgent },
        document: { head, documentElement: head, createElement: () => {
            const script = new Script();
            script.src = '';
            script.type = '';
            script.attributes = [];
            return script;
        } },
        console: { error: (...values) => errors.push(values), warn() {} },
        HTMLScriptElement: Script,
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        fetch,
    };
    runFeatureContext(compile(read('src/kasp_injector.ts')), context);
    return {
        Script, appended, errors, observers, page: context.window,
        async intercept(...scripts) {
            observers[0].callback([{ addedNodes: scripts }]);
            await tick();
        },
    };
}

test('injector applies an exact-hash AST plan before other transformations and skips unknown bundles', async () => {
    const source = 'function Stats(id,map,mode,mm,loaded,a,b,c,d,e,f){this.id=id,this.map=map,this.mode=mode,this.mm=mm,this.loaded=loaded,this.a=a,this.b=b,this.c=c,this.d=d,this.e=e,this.f=f}' +
        'proto(Stats).toString=function(){return"BattleStatistics(battleId="+this.id+", mapName="+this.map+", mode="+this.mode+", isMMBattle="+this.mm+", battleLoaded="+this.loaded+")"};';
    // A small prepared plan isolates injector ordering from the analyzer's own tests.
    const status = { kind: 'hooks', strategy: 'ast-plan', pickupHook: true, pickupCalls: 1,
        contextHook: true, registrationHooks: 1, issues: [], schemaIssues: [], ready: true };
    const plan = { format: 'ki-overdrive-ast-v1', sha256: createHash('sha256').update(source).digest('hex'),
        sourceLength: source.length, status, edits: [{ start: source.length, end: source.length,
            expected: '', before: source.slice(-24), after: '', text: 'window.astApplied=true;' }] };
    for (const input of [source, source.replace('battleId=', 'battleID=')]) {
        const f = injectorFixture(async () => ({ ok: true, text: async () => input }), [plan], {}, [], {}, {}, {}, {}, {}, {}, 'Chrome', {
            selectBattleStatisticsPlan: async code => require('./battle-statistics-ast.cjs').analyzeBattleStatistics(code),
        });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1);
        const exact = input === source;
        assert.equal(f.appended[0].textContent.includes('window.astApplied=true;'), exact);
        assert.equal(f.page.__kaspBonusDebug.status().ready, exact);
        assert.equal(f.errors.length, 0);
        assert.equal(typeof f.page.__kaspBonusType, 'function');
        if (exact) {
            const context = { window: f.page, proto: type => type.prototype };
            runFeatureContext(f.appended[0].textContent, context);
            new context.Stats('1', 'Sandbox', 'DM', false, true);
            assert.equal(f.page.astApplied, true);
            assert.equal(f.page.messages.find(message => message.type === 'kasp:battle-kind').detail, 'PRO');
        }
    }
});

test('an overdrive preparation exception skips only that feature and still injects the game', async () => {
    const source = 'window.mainLoaded=true;';
    const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [], {
        patchBonusPickups() { throw Error('unsupported overdrive structure'); }
    });
    await f.intercept(new f.Script());
    assert.equal(f.appended.length, 1);
    assert.equal(f.appended[0].textContent, source);
    assert.equal(f.page.__kaspBonusDebug.status().ready, false);
    assert.equal(f.page.__kaspBonusDebug.status().issues[0], 'overdrive-patch-error');
    assert.equal(f.errors.length, 0, 'the injector must not fall back to an unmodified game or lose other features');
    runFeatureContext(f.appended[0].textContent, { window: f.page });
    assert.equal(f.page.mainLoaded, true);
});

test('an arcade preparation exception leaves game loading and the other prepared plan intact', async () => {
    const source='window.mainLoaded=true;';
    const bonusPlan={format:'ki-overdrive-ast-v1',sha256:createHash('sha256').update(source).digest('hex'),sourceLength:source.length,
        status:{kind:'hooks',ready:true,strategy:'ast-plan',issues:[],schemaIssues:[],pickupCalls:1,registrationHooks:1,contextHook:true,pickupHook:true},
        edits:[{start:source.length,end:source.length,expected:'',before:source.slice(-24),after:'',text:'window.bonusPlanApplied=true;'}]};
    const f=injectorFixture(async()=>({ok:true,text:async()=>source}),[bonusPlan],{},[],{
        patchArcadeReload(){throw Error('unsupported native renderer');}
    });
    await f.intercept(new f.Script());
    for(let tries=0;!f.appended.length&&tries<100;tries++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.equal(f.appended.length,1);runFeatureContext(f.appended[0].textContent,{window:f.page});
    assert.equal(f.page.mainLoaded,true);assert.equal(f.page.bonusPlanApplied,true);
    assert.equal(f.page.__kaspArcadeReloadDebug.status().hooked,false);
    assert.equal(f.page.__kaspArcadeReloadDebug.status().issues[0],'arcade-patch-error');
    assert.equal(f.page.__kaspBonusDebug.status().ready,true);assert.equal(f.errors.length,0);
});

test('an augments preparation exception leaves the native game and other features active', async () => {
    const source = 'window.mainLoaded=true;';
    const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [], {}, [], {}, {
        selectGameAugmentsPlan() { throw Error('unsupported native device models'); }
    });
    await f.intercept(new f.Script());
    assert.equal(f.appended.length, 1);
    assert.equal(f.errors.length, 0);
    runFeatureContext(f.appended[0].textContent, { window: f.page });
    assert.equal(f.page.mainLoaded, true);
});

test('garage details are merged with other AST plans before legacy transformations', async () => {
    const source = 'window.mainLoaded=true;';
    const hash = createHash('sha256').update(source).digest('hex');
    const edit = text => ({ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text });
    const bonus = { format: 'ki-overdrive-ast-v1', sha256: hash, sourceLength: source.length,
        status: { kind: 'hooks', ready: true, issues: [], schemaIssues: [] }, edits: [edit('window.bonusApplied=true;')] };
    const details = { format: 'ki-garage-details-ast-v1', sha256: hash, sourceLength: source.length,
        status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] }, edits: [edit('window.detailsApplied=true;')] };
    for (const fail of [false, true]) {
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {}, {
            selectGarageDetailsPlan() { if (fail) throw Error('unsupported native description renderer'); return Promise.resolve(details); }
        });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(f.page.detailsApplied, fail ? undefined : true);
    }
});

test('garage-item preparation and failures stay independent of the game and other AST modules', async () => {
    const source = 'window.mainLoaded=true;', hash = createHash('sha256').update(source).digest('hex');
    const edit = text => ({ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text });
    const bonus = { format: 'ki-overdrive-ast-v1', sha256: hash, sourceLength: source.length,
        status: { kind: 'hooks', ready: true, issues: [], schemaIssues: [] }, edits: [edit('window.bonusApplied=true;')] };
    const details = { format: 'ki-garage-details-ast-v1', sha256: hash, sourceLength: source.length,
        status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] }, edits: [edit('window.detailsApplied=true;')] };
    const items = { ...details, format: 'ki-garage-items-ast-v1', edits: [edit('window.itemsApplied=true;')] };
    for (const fail of [false, true]) {
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {},
            { selectGarageDetailsPlan: async () => details },
            { selectGarageItemsPlan() { if (fail) throw Error('unsupported native garage renderer'); return Promise.resolve(items); } });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true); assert.equal(f.page.detailsApplied, true);
        assert.equal(f.page.itemsApplied, fail ? undefined : true);
    }
});

test('inventory preparation and its failures leave the game and other AST features active', async () => {
    const source = 'window.mainLoaded=true;', hash = createHash('sha256').update(source).digest('hex');
    const edit = text => ({ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text });
    const bonus = { format: 'ki-overdrive-ast-v1', sha256: hash, sourceLength: source.length,
        status: { kind: 'hooks', ready: true, issues: [], schemaIssues: [] }, edits: [edit('window.bonusApplied=true;')] };
    const inventory = { format: 'ki-garage-inventory-ast-v1', sha256: hash, sourceLength: source.length,
        status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] }, edits: [edit('window.inventoryApplied=true;')] };
    for (const fail of [false, true]) {
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {}, {}, {},
            { selectGarageInventoryPlan() { if (fail) throw Error('unsupported native inventory'); return Promise.resolve(inventory); } });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(f.page.inventoryApplied, fail ? undefined : true);
        assert.equal(f.page.__kaspGarageInventoryDebug().captured, false);
    }
});

test('Electron presence plans observe original offsets and failures cannot remove other game features', async () => {
    const source = 'window.mainLoaded=true;';
    const bonusPlan = { format: 'ki-overdrive-ast-v1', sourceLength: source.length, sha256: createHash('sha256').update(source).digest('hex'),
        status: { kind: 'hooks', ready: true, strategy: 'ast-plan', issues: [], schemaIssues: [], pickupCalls: 1, registrationHooks: 1, contextHook: true, pickupHook: true },
        edits: [{ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text: 'window.bonusApplied=true;' }] };
    for (const behavior of ['success', 'exception', 'stale']) {
        const presencePlan = { format: 'ki-battle-presence-ast-v1', profile: 'complete', sourceLength: behavior === 'stale' ? source.length + 1 : source.length,
            status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] },
            edits: [{ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: 'window.presenceApplied=true;' }] };
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonusPlan], {}, [], {}, {}, {}, {}, {}, {
            selectBattlePresencePlan(code) { assert.equal(code, source); if (behavior === 'exception') throw Error('presence incompatible'); return presencePlan; },
        }, 'Electron');
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(!!f.page.presenceApplied, behavior === 'success');
    }
    let reads = 0;
    const chrome = injectorFixture(async () => ({ ok: true, text: async () => source }), [], {}, [], {}, {}, {}, {}, {}, {
        selectBattlePresencePlan(code, plans, profile) {
            reads++;
            assert.equal(profile, 'store');
            throw Error('unavailable browser store mapping');
        },
    });
    await chrome.intercept(new chrome.Script()); assert.equal(reads, 1);
    assert.equal(chrome.appended[0].textContent, source);
});

test('statistics preparation is independent of other AST modules in both browsers and Electron', async () => {
    const source = 'window.mainLoaded=true;';
    const bonus = { format: 'ki-overdrive-ast-v1', sourceLength: source.length, sha256: createHash('sha256').update(source).digest('hex'),
        status: { kind: 'hooks', ready: true, strategy: 'ast-plan', issues: [], schemaIssues: [] },
        edits: [{ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text: 'window.bonusApplied=true;' }] };
    for (const userAgent of ['Chrome', 'Electron']) for (const behavior of ['success', 'exception', 'stale']) {
        const statistics = { format: 'ki-battle-statistics-ast-v1', sourceLength: behavior === 'stale' ? source.length + 1 : source.length,
            status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] },
            edits: [{ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: 'window.statisticsApplied=true;' }] };
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {}, {}, {}, {}, {}, userAgent, {
            selectBattleStatisticsPlan(code) { assert.equal(code, source); if (behavior === 'exception') throw Error('statistics incompatible'); return statistics; },
        });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(!!f.page.statisticsApplied, behavior === 'success');
    }
});

test('action preparation uses original offsets and stays independent of game loading and other AST modules', async () => {
    const source = 'window.mainLoaded=true;';
    const bonus = { format: 'ki-overdrive-ast-v1', sourceLength: source.length, sha256: createHash('sha256').update(source).digest('hex'),
        status: { kind: 'hooks', ready: true, strategy: 'ast-plan', issues: [], schemaIssues: [] },
        edits: [{ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text: 'window.bonusApplied=true;' }] };
    for (const userAgent of ['Chrome', 'Electron']) for (const behavior of ['success', 'exception', 'stale']) {
        const action = { format: 'ki-user-action-ast-v1', sourceLength: behavior === 'stale' ? source.length + 1 : source.length,
            status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [] },
            edits: [{ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: 'window.actionsApplied=true;' }] };
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {}, {}, {}, {}, {}, userAgent, {}, {
            selectUserActionPlan(code) { assert.equal(code, source); if (behavior === 'exception') throw Error('action incompatible'); return action; },
        });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(!!f.page.actionsApplied, behavior === 'success');
    }
});

test('critical preparation and failures cannot remove other prepared features or block native loading', async () => {
    const source = 'window.mainLoaded=true;', hash = createHash('sha256').update(source).digest('hex');
    const bonus = { format: 'ki-overdrive-ast-v1', sha256: hash, sourceLength: source.length,
        status: { kind: 'hooks', ready: true, strategy: 'ast-plan', issues: [], schemaIssues: [] },
        edits: [{ start: source.length, end: source.length, expected: '', before: source.slice(-24), after: '', text: 'window.bonusApplied=true;' }] };
    for (const behavior of ['success', 'exception', 'stale']) {
        const plan = { format: 'ki-critical-ast-v1', sourceLength: behavior === 'stale' ? source.length + 1 : source.length,
            status: { hooked: true, ready: true, strategy: 'ast-plan', issues: [], juggernautHook: true },
            edits: [{ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: 'window.criticalApplied=true;' }] };
        const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [bonus], {}, [], {}, {}, {}, {}, {}, {}, 'Chrome', {}, {}, {
            selectCriticalPlan(code) { assert.equal(code, source); if (behavior === 'exception') throw Error('unsupported critical state'); return plan; },
        });
        await f.intercept(new f.Script());
        for (let tries = 0; !f.appended.length && tries < 100; tries++) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(f.appended.length, 1); assert.equal(f.errors.length, 0);
        runFeatureContext(f.appended[0].textContent, { window: f.page });
        assert.equal(f.page.mainLoaded, true); assert.equal(f.page.bonusApplied, true);
        assert.equal(!!f.page.criticalApplied, behavior === 'success');
        assert.equal(f.page.__kaspCriticalDebug.status().mapping.ready, behavior === 'success');
    }
});

test('injected statistics use the native matchmaking flag and ignore unloaded defaults and misleading titles', async () => {
    const source = 'function Stats(id,map,mode,mm,loaded,a,b,c,d,e,f){this.id=id,this.map=map,this.mode=mode,this.mm=mm,this.loaded=loaded,this.a=a,this.b=b,this.c=c,this.d=d,this.e=e,this.f=f}' +
        'proto(Stats).toString=function(){return"BattleStatistics(battleId="+this.id+", mapName="+this.map+", mode="+this.mode+", isMMBattle="+this.mm+", battleLoaded="+this.loaded+")"};';
    const f = injectorFixture(async () => ({ ok: true, text: async () => source }), [], {}, [], {}, {}, {}, {}, {}, {}, 'Chrome', {
        selectBattleStatisticsPlan: async code => require('./battle-statistics-ast.cjs').analyzeBattleStatistics(code),
    });
    await f.intercept(new f.Script());
    const context = { window: f.page, proto: type => type.prototype };
    runFeatureContext(f.appended[0].textContent, context);
    const kinds = () => f.page.messages.filter(message => message.type === 'kasp:battle-kind').map(message => message.detail);
    new context.Stats('1', 'Sandbox DM', 'DM', false, true, 0, 0, 0, 0, 0, 0);
    assert.deepEqual(kinds(), ['PRO']);
    new context.Stats('2', 'PRO in the map title', 'CTF', true, true, 0, 0, 0, 0, 0, 0);
    assert.deepEqual(kinds(), ['PRO', 'MM']);
    new context.Stats('0', '', '', false, false, 0, 0, 0, 0, 0, 0);
    f.page.__kaspBattleStats({ name: 'Unknown map', loaded: true });
    assert.deepEqual(kinds(), ['PRO', 'MM'], 'unknown or unloaded state must not overwrite the recorded kind');
});

test('HTTP errors reject the response body and restore one original script with its attributes', async () => {
    let bodyReads = 0;
    let requests = 0;
    const f = injectorFixture(async () => {
        requests++;
        return { ok: false, status: 503, text: async () => { bodyReads++; return '<html>unavailable</html>'; } };
    });
    const original = new f.Script();
    await f.intercept(original);
    assert.equal(bodyReads, 0);
    assert.equal(requests, 1);
    assert.equal(original.type, 'javascript/blocked');
    assert.equal(original.removed, true);
    assert.equal(f.observers[0].disconnected, true);
    assert.equal(f.appended.length, 1);
    const fallback = f.appended[0];
    assert.notEqual(fallback, original);
    assert.equal(fallback.type, 'module');
    assert.equal(fallback.src, original.src);
    assert.equal(fallback.nonce, 'page-nonce');
    assert.equal(fallback.async, false);
    assert.deepEqual(fallback.attributes, original.attributes);
    assert.equal(fallback.textContent, undefined);
    fallback.listeners.get('error')();
    await tick();
    assert.equal(f.appended.length, 1);
    assert.equal(requests, 1);
    assert.equal(f.errors.length, 2);
});

test('network rejection and response body failures use native loading without an unhandled rejection', async () => {
    for (const fetch of [
        async () => { throw Error('offline'); },
        async () => ({ ok: true, text: async () => { throw Error('body interrupted'); } }),
    ]) {
        const f = injectorFixture(fetch);
        await f.intercept(new f.Script());
        assert.equal(f.appended.length, 1);
        assert.equal(f.appended[0].type, 'module');
        assert.equal(f.errors.length, 1);
    }
});

test('successful loading preserves both hooks and ignores further main scripts in the same mutation batch', async () => {
    const code = 'function Label(uid){this.nick=uid}Label.prototype.toString=function(){return"UserLabelData(uid="+this.nick+")"};'
        + 'function User(a,b){this.field=a;this.kind=b}User.prototype.toString=function(){return"TankUserActionLog(userLabelData="+this.field+", type="+this.kind+")"};'
        + 'function Stats(a,b,c,d,e,f,g,h,i,j,k){this.a=a,this.b=b,this.c=c,this.d=d,this.e=e,this.f=f,this.g=g,this.h=h,this.i=i,this.j=j,this.k=k}'
        + 'Stats.prototype.toString=function(){return"BattleStatistics(battleId="+this.a+", mapName="+this.b+", mode="+this.c+", isMMBattle="+this.d+", battleLoaded="+this.e+")"};';
    let requests = 0;
    const f = injectorFixture(async () => { requests++; return { ok: true, text: async () => code }; }, [], {}, [], {}, {}, {}, {}, {}, {}, 'Chrome', {
        selectBattleStatisticsPlan: async source => require('./battle-statistics-ast.cjs').analyzeBattleStatistics(source),
    }, { selectUserActionPlan: async source => require('./user-action-ast.cjs').analyzeUserAction(source) });
    const first = new f.Script();
    const second = new f.Script();
    await f.intercept(first, second);
    assert.equal(requests, 1);
    assert.equal(second.removed, undefined);
    assert.equal(f.appended.length, 1);
    assert.ok(f.appended[0].textContent.includes('window.__kaspSendAction("TankUserActionLog",this,'));
    assert.ok(f.appended[0].textContent.includes('window.__kaspBattleStats(this,'));
    assert.equal(f.appended[0].nonce, 'page-nonce');
    assert.equal(f.appended[0].type, 'module');
    assert.equal(f.errors.length, 0);
});

function upgradeFixture() {
    class Element {
        constructor() { this.style = {}; this.children = []; this.listeners = new Map(); this.classList = { add() {} }; }
        appendChild(child) { this.children.push(child); }
        append(...children) { this.children.push(...children); }
        addEventListener(name, handler) { this.listeners.set(name, handler); }
        click() { this.listeners.get('click')?.({ type: 'click', isTrusted: false, target: this }); }
    }
    const timers = new Map();
    const frames = new Map();
    const listeners = new Map();
    let gamepads = [];
    let nextTimer = 0;
    let dialog = null;
    let enters = 0;
    let confirms = 0;
    let cancels = 0;
    let confirmReads = 0;
    const normalButton = { textContent: 'Улучшить', querySelector: () => null,
        click() { confirms++; document.dispatchEvent({ type: 'click', isTrusted: false, target: this }); } };
    const rubyButton = { ...normalButton, textContent: 'Купить за 100 рубинов' };
    const garageButton = {
        closest: () => null,
        classList: { contains: value => value === '-widthHeightButtonGarage' },
        querySelector(selector) {
            if (selector === '.-commonBlockForHotKey') return { textContent: 'Enter' };
            if (selector === '.GarageCommonStyle-iconCoinSmall') return {};
            return null;
        },
    };
    const document = {
        createElement: () => new Element(),
        addEventListener(type, handler) {
            const handlers = listeners.get(type) || new Set();
            handlers.add(handler); listeners.set(type, handlers);
        },
        removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
        getElementById: () => null,
        dispatchEvent(event) {
            if (event.type === 'keydown' && event.key === 'Enter' && !event.isTrusted) enters++;
            for (const handler of [...listeners.get(event.type) || []]) handler(event);
        },
        querySelectorAll(selector) {
            return selector === '.SquarePriceButtonComponentStyle-commonBlockButton' ? [garageButton] : [];
        },
        querySelector(selector) {
            if (selector === '.TanksPartBaseComponentStyle-buttonsContainer') return { querySelectorAll: () => [garageButton] };
            if (selector === '.DialogContainerComponentStyle-container') return dialog && {
                querySelector: () => ({ textContent: dialog.header || '' }),
            };
            if (selector === '.DialogContainerComponentStyle-enterButton.DialogContainerComponentStyle-getRubyButton') {
                confirmReads++;
                if (dialog?.disappearing && confirmReads >= 4) return null;
                return dialog?.normal ? normalButton : dialog?.ruby ? rubyButton : null;
            }
            if (selector === '.DialogContainerComponentStyle-keyButton') return { click() { cancels++; } };
            return null;
        },
    };
    const modal = {
        dialog: new Element(), body: new Element(), actions: new Element(),
        onClose(handler) { this.onCloseHandler = handler; },
        close() { modal.onCloseHandler?.(); },
    };
    let source = read('src/modules/autoUpgrade.ts');
    const index = source.lastIndexOf('    return () => {');
    assert.ok(index >= 0);
    source = source.slice(0, index) + 'globalThis.review = { performAction, getState: () => ({ isRunning, upgraded }) };\n' + source.slice(index);
    const context = {
        module: { exports: {} }, document,
        window: {
            getComputedStyle: () => ({ backgroundImage: 'url(crystals.svg)' }),
            setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
            clearTimeout: id => timers.delete(id),
            requestAnimationFrame(callback) { frames.set(++nextTimer, callback); return nextTimer; },
            cancelAnimationFrame: id => frames.delete(id),
        },
        navigator: { getGamepads: () => gamepads },
        KeyboardEvent: class { constructor(type, options) { Object.assign(this, options, { type, isTrusted: false }); } },
        require(name) {
            if (name === '../core/state') return { state: { lang: 'EN' } };
            if (name === '../core/utils') return { utils: { getSetting: () => true } };
            if (name === '../core/modal') return { createKaspModal: async () => modal };
            if (name === '../core/gameDOM') return gameDOMModule.exports;
            throw Error(name);
        },
    };
    runFeatureContext(compile(source), context);
    return {
        async start(count = 5, keyboard = false) {
            context.review.performAction(count);
            await tick();
            if (keyboard) {
                document.dispatchEvent({ type: 'keydown', key: 'Enter', isTrusted: true,
                    preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} });
            } else modal.actions.children.at(-1).click();
        },
        step() {
            const pending = [...timers].find(([, timer]) => timer.delay === 30);
            assert.ok(pending, 'upgrade step is scheduled');
            timers.delete(pending[0]);
            pending[1].callback();
        },
        setDialog(value) { dialog = value; confirmReads = 0; },
        input(type, options = {}) {
            const event = { type, key: 'a', isTrusted: true, ...options };
            document.dispatchEvent(event);
            return event;
        },
        setGamepads(value) { gamepads = value; },
        frame() {
            const pending = [...frames];
            frames.clear();
            for (const [, callback] of pending) callback();
        },
        get frames() { return frames.size; },
        get cancellationListeners() {
            return ['keydown', 'pointerdown', 'mousedown', 'click'].map(type => listeners.get(type)?.size || 0).reduce((a, b) => a + b, 0);
        },
        get state() { return context.review.getState(); },
        get enters() { return enters; }, get confirms() { return confirms; }, get cancels() { return cancels; },
        get steps() { return [...timers.values()].filter(timer => timer.delay === 30).length; },
    };
}

test('unknown dialogs stop upgrading without sending Enter, clicking or counting a completed upgrade', async () => {
    const f = upgradeFixture();
    await f.start();
    f.step();
    assert.equal(f.enters, 1);
    f.setDialog({ header: 'Unexpected confirmation' });
    f.step();
    assert.equal(f.enters, 1);
    assert.equal(f.confirms, 0);
    assert.equal(f.cancels, 0);
    assert.equal(f.state.upgraded, 0);
    assert.equal(f.state.isRunning, false);
    assert.equal(f.steps, 0);
});

test('ruby dialogs are cancelled and normal confirmations retain the requested upgrade count', async () => {
    const ruby = upgradeFixture();
    await ruby.start();
    ruby.setDialog({ ruby: true });
    ruby.step();
    assert.equal(ruby.cancels, 1);
    assert.equal(ruby.enters, 0);
    assert.equal(ruby.confirms, 0);
    assert.equal(ruby.state.isRunning, false);
    assert.equal(ruby.state.upgraded, 0);

    const normal = upgradeFixture();
    await normal.start(1);
    normal.setDialog({ normal: true });
    normal.step();
    assert.equal(normal.confirms, 1);
    assert.equal(normal.enters, 0);
    assert.equal(normal.state.upgraded, 1);
    normal.step();
    assert.equal(normal.confirms, 1);
    normal.setDialog(null);
    normal.step();
    assert.equal(normal.state.isRunning, false);
    assert.equal(normal.steps, 0);
    assert.equal(normal.frames, 0);
    assert.equal(normal.cancellationListeners, 0);
});

test('a confirmation button that disappears before clicking stops without incrementing the upgrade count', async () => {
    const f = upgradeFixture();
    await f.start();
    f.setDialog({ normal: true, disappearing: true });
    f.step();
    assert.equal(f.confirms, 0);
    assert.equal(f.enters, 0);
    assert.equal(f.state.upgraded, 0);
    assert.equal(f.state.isRunning, false);
    assert.equal(f.steps, 0);
});

test('any trusted keyboard or mouse press stops pending upgrades without blocking the user action', async () => {
    for (const [type, options] of [
        ['keydown', { key: 'ArrowRight' }], ['keydown', { key: 'Enter' }], ['keydown', { key: 'Shift' }],
        ['keydown', { key: 'a', repeat: true }], ['pointerdown', {}], ['mousedown', { button: 0 }],
        ['mousedown', { button: 2 }], ['click', {}]
    ]) {
        const f = upgradeFixture();
        await f.start();
        f.step();
        f.setDialog({ normal: true });
        let prevented = false;
        f.input(type, { ...options, preventDefault() { prevented = true; } });
        assert.equal(f.state.isRunning, false, type);
        assert.equal(f.steps, 0);
        assert.equal(f.frames, 0);
        assert.equal(f.confirms, 0);
        assert.equal(prevented, false);
    }
});

test('synthetic Enter and confirmation clicks continue the sequence; new user input also stops it while waiting for dialog close', async () => {
    const f = upgradeFixture();
    await f.start();
    f.step();
    assert.equal(f.enters, 1);
    assert.equal(f.state.isRunning, true);
    f.setDialog({ normal: true });
    f.step();
    assert.equal(f.confirms, 1);
    assert.equal(f.state.isRunning, true);
    f.input('keydown', { key: 'ArrowLeft' });
    assert.equal(f.state.isRunning, false);
    assert.equal(f.steps, 0);
    assert.equal(f.frames, 0);
    assert.equal(f.state.upgraded, 1);
    assert.equal(f.cancellationListeners, 0);
    f.setDialog(null);
    await f.start();
    assert.equal(f.cancellationListeners, 4);
    f.input('mousedown');
    assert.equal(f.cancellationListeners, 0);
});

test('new gamepad button presses stop upgrades on either a frame or the next purchase step', async () => {
    const pad = pressed => ({ index: 0, connected: true, buttons: [{ pressed: false }, { pressed }] });
    for (const viaFrame of [true, false]) {
        const f = upgradeFixture();
        f.setGamepads([null, pad(false)]);
        await f.start();
        f.setDialog({ normal: true });
        f.setGamepads([null, pad(true)]);
        if (viaFrame) f.frame(); else f.step();
        assert.equal(f.state.isRunning, false);
        assert.equal(f.steps, 0);
        assert.equal(f.frames, 0);
        assert.equal(f.confirms, 0);
    }
});

test('a gamepad button held during confirmation does not abort start; releasing and pressing it again stops the queue', async () => {
    const f = upgradeFixture();
    const pad = { index: 3, connected: true, buttons: [{ pressed: true }] };
    f.setGamepads([pad]);
    await f.start();
    f.frame();
    assert.equal(f.state.isRunning, true);
    pad.buttons[0].pressed = false;
    f.frame();
    assert.equal(f.state.isRunning, true);
    pad.buttons[0].pressed = true;
    f.frame();
    assert.equal(f.state.isRunning, false);
    assert.equal(f.frames, 0);
    assert.equal(f.steps, 0);
});

test('Enter can start the setup confirmation and the next Enter press stops upgrading', async () => {
    const f = upgradeFixture();
    await f.start(5, true);
    assert.equal(f.state.isRunning, true);
    f.step();
    assert.equal(f.enters, 1);
    f.input('keydown', { key: 'Enter' });
    assert.equal(f.state.isRunning, false);
    assert.equal(f.steps, 0);
});


test('quarantining bonus observers preserves native getter evaluation, return values and exceptions', () => {
    const f = injectorFixture(async () => ({ ok: true, text: async () => '' }));
    f.page.__kaspPageModulesDebug.disable('overdriveHooks');
    let reads = 0; const sound = {};
    const data = { get sound() { reads++; return sound; } };
    assert.equal(f.page.__kaspBonusPrepare(data, 'sound'), sound); assert.equal(reads, 1);
    assert.equal(f.page.__kaspBonusPickup(sound), sound);
    const failure = Error('native getter');
    assert.throws(() => f.page.__kaspBonusPrepare({ get sound() { throw failure; } }, 'sound'), error => error === failure);
});
