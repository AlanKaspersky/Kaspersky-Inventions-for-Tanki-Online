const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const compile = source => transformSync(source, { loader: 'ts', format: 'cjs' }).code;
const gameDOMModule = { exports: {} };
vm.runInNewContext(compile(read('src/core/gameDOM.ts')), { module: gameDOMModule });
const bonusPickupModule = { exports: {} };
vm.runInNewContext(compile(read('src/core/bonusPickup.ts')), { module: bonusPickupModule });
const tick = () => new Promise(resolve => setImmediate(resolve));

function injectorFixture(fetch) {
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
            if (id === './core/bonusPickup') return bonusPickupModule.exports;
            throw new Error(`Unexpected injector import: ${id}`);
        },
        window: { postMessage() {} },
        document: { head, documentElement: head, createElement: () => {
            const script = new Script();
            script.src = '';
            script.type = '';
            script.attributes = [];
            return script;
        } },
        console: { error: (...values) => errors.push(values) },
        HTMLScriptElement: Script,
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        fetch,
    };
    vm.runInNewContext(compile(read('src/kasp_injector.ts')), context);
    return {
        Script, appended, errors, observers,
        async intercept(...scripts) {
            observers[0].callback([{ addedNodes: scripts }]);
            await tick();
        },
    };
}

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
    const code = 'function User(a){this.field=a}User.prototype.toString=function(){return"TankUserActionLog(x="+this.field};'
        + 'function Stats(a,b,c,d,e,f,g,h,i,j,k){this.a=a,this.b=b,this.c=c,this.d=d,this.e=e,this.f=f,this.g=g,this.h=h,this.i=i,this.j=j,this.k=k}'
        + 'Stats.prototype.toString=function(){return"BattleStatistics(x="+this.a};';
    let requests = 0;
    const f = injectorFixture(async () => { requests++; return { ok: true, text: async () => code }; });
    const first = new f.Script();
    const second = new f.Script();
    await f.intercept(first, second);
    assert.equal(requests, 1);
    assert.equal(second.removed, undefined);
    assert.equal(f.appended.length, 1);
    assert.ok(f.appended[0].textContent.includes('window.__kaspSendAction("TankUserActionLog", this)'));
    assert.ok(f.appended[0].textContent.includes('window.__kaspBattleStats(this)'));
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
        click() { this.listeners.get('click')?.(); }
    }
    const timers = new Map();
    let nextTimer = 0;
    let dialog = null;
    let enters = 0;
    let confirms = 0;
    let cancels = 0;
    let confirmReads = 0;
    const normalButton = { textContent: 'Улучшить', querySelector: () => null, click() { confirms++; } };
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
        addEventListener() {}, removeEventListener() {}, getElementById: () => null,
        dispatchEvent() { enters++; },
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
        },
        KeyboardEvent: class {},
        require(name) {
            if (name === '../core/state') return { state: { lang: 'EN' } };
            if (name === '../core/utils') return { utils: { getSetting: () => true } };
            if (name === '../core/modal') return { createKaspModal: async () => modal };
            if (name === '../core/gameDOM') return gameDOMModule.exports;
            throw Error(name);
        },
    };
    vm.runInNewContext(compile(source), context);
    return {
        async start(count = 5) {
            context.review.performAction(count);
            await tick();
            modal.actions.children.at(-1).click();
        },
        step() {
            const pending = [...timers].find(([, timer]) => timer.delay === 30);
            assert.ok(pending, 'upgrade step is scheduled');
            timers.delete(pending[0]);
            pending[1].callback();
        },
        setDialog(value) { dialog = value; confirmReads = 0; },
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
