const runFeatureContext = require('./test-feature-context.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const compile = file => transformSync(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code;
const domModule = { exports: {} };
runFeatureContext(compile('src/core/gameDOM.ts'), { module: domModule });
const code = compile('src/core/cybersportNative.ts');
const pure = { exports: {} };
runFeatureContext(code, { module: pure, require: () => domModule.exports });

test('the original creation callback gets enforced arguments even after map resets before Start', () => {
    const calls = [], reports = [], options = { toString: () => '[Private, ReArmor]' };
    const model = { state: { maxPlayers: '12', timeLimit: '30', selectedMinUserRank: 27, selectedOptions: options },
        props: { launchFun(...args) { calls.push({ args, receiver: this }); return 'submitted'; } } };
    const receiver = {};
    const guard = pure.exports.guardCybersportSubmission(model, () => true, () => 9,
        (submission, error) => reports.push({ submission, error }));
    assert.equal(model.props.launchFun.call(receiver, 'battle name', 12, 30, 0, 31, 27, ['stale options']), 'submitted');
    assert.deepEqual(calls[0].args, ['battle name', 6, 12, 0, 31, 9, options]);
    assert.equal(calls[0].receiver, receiver);
    assert.equal(reports[0].submission.private, true); assert.equal(reports[0].error, null);
    guard.restore();
});

test('ordinary formats and restored callbacks retain all original arguments', () => {
    const calls = [], original = (...args) => calls.push(args);
    const model = { state: {}, props: { launchFun: original } };
    const guard = pure.exports.guardCybersportSubmission(model, () => false, () => 9, () => assert.fail());
    model.props.launchFun('ordinary', 8, 30, 100, 31, 27, []);
    assert.deepEqual(calls[0], ['ordinary', 8, 30, 100, 31, 27, []]);
    guard.restore(); assert.equal(model.props.launchFun, original);
});

test('unconfirmed privacy or rank never submits defaults and allows a manual retry', () => {
    for (const [rank, options] of [[9, '[ReArmor]'], [null, '[Private]']]) {
        let calls = 0, reason;
        const model = { state: { selectedOptions: options, creationStarted: true },
            props: { launchFun() { calls++; } }, setState(patch) { Object.assign(this.state, patch); } };
        pure.exports.guardCybersportSubmission(model, () => true, () => rank, (_, error) => { reason = error; });
        model.props.launchFun('name', 8, 30, 0, 31, 27, []);
        assert.equal(calls, 0); assert.equal(reason, 'native-preset-not-ready');
        assert.equal(model.state.creationStarted, false);
    }
});

function fixture({ localized = 'Маршал', deferred = false } = {}) {
    const dom = domModule.exports.gameDOM.battleCreate;
    class Element {
        constructor() { this.isConnected = true; this.attrs = new Set(); this.queries = new Map(); }
        hasAttribute(key) { return this.attrs.has(key); }
        querySelector(key) { return this.queries.get(key) || null; }
        querySelectorAll(key) { return this.queries.get(key) || []; }
        contains(element) { return element === this || element.parent === this; }
        closest(key) { return key === '.JoinToBattleComponentStyle-buttonJoin' && this.isStart ? this : null; }
    }
    const module = { exports: {} };
    runFeatureContext(code, { module, require: () => domModule.exports, Node: Element, Element, console: { warn() {} } });
    const core = module.exports, root = new Element(), panel = new Element(), field = new Element(), dropdown = new Element(), checkbox = new Element(), row = new Element(), start = new Element();
    root.attrs.add(core.CYBERSPORT_ACTIVE); root.queries.set(dom.options, panel);
    panel.queries.set(dom.parameterInputs, [field]); panel.queries.set(dom.rankDropdowns, dropdown);
    panel.queries.set(dom.optionRows, [row]); row.queries.set('input[type="checkbox"]', checkbox); start.isStart = true;
    start.parent = root;
    const sent = [], pending = [], frames = [], documentListeners = new Map(), windowListeners = new Map();
    const state = { maxPlayers: '8', timeLimit: '30', selectedMinUserRank: 27, selectedOptions: '[ReArmor]', creationStarted: false };
    const write = (key, value) => deferred ? pending.push(() => state[key] = value) : state[key] = value;
    const model = { state, props: { launchFun(...args) { sent.push(args); } },
        setState(patch) { Object.assign(state, patch); } };
    // Deliberately stale fiber memoizedProps; only live instance props are authoritative.
    const attach = (element, component) => element.__reactFiber$fixture = {
        stateNode: element, return: { memoizedProps: { defaultValue: 31 }, stateNode: component } };
    attach(panel, model);
    attach(field, { props: { onMaxPlayersChanged: value => write('maxPlayers', value),
        onTimeLimitChanged: value => write('timeLimit', value) } });
    attach(dropdown, { props: { minRank: 9, maxRank: 27, defaultValue: 27, localized,
        onChangeFunction: value => write('selectedMinUserRank', value) } });
    attach(checkbox, { props: { label: 'PRIVATE', checked: false, onChange: value => {
        if (value) write('selectedOptions', '[Private, ReArmor]'); } } });
    const document = { querySelector: selector => root.isConnected && root.hasAttribute(core.CYBERSPORT_ACTIVE) ? root : null,
        addEventListener: (type, listener) => documentListeners.set(type, listener) };
    const page = { document, requestAnimationFrame: fn => frames.push(fn),
        addEventListener: (type, listener) => windowListeners.set(type, listener) };
    core.installCybersportNative(page);
    const sync = () => documentListeners.get(core.CYBERSPORT_SYNC)();
    const event = type => ({ type, target: start, code: 'Space', preventDefault() { this.prevented = true; },
        stopImmediatePropagation() { this.stopped = true; } });
    return { root, panel, core, model, state, sent, sync, page, event, documentListeners, windowListeners,
        commit() { pending.splice(0).forEach(fn => fn()); },
        flush() { frames.splice(0).forEach(fn => fn()); } };
}

test('MAIN bridge applies numeric native callbacks independently of RU/EN and reads live instance props', () => {
    for (const localized of ['Маршал', 'Marshal']) {
        const f = fixture({ localized }); f.sync();
        const status = f.page.__kaspCybersportDebug.status();
        assert.equal(status.ready, true); assert.equal(status.minRank, 9); assert.equal(status.players, '6');
        f.model.props.launchFun('name', 8, 30, 0, 31, 27, []);
        assert.deepEqual(f.sent[0], ['name', 6, 12, 0, 31, 9, '[Private, ReArmor]']);
        assert.equal(f.page.__kaspCybersportDebug.status().lastSubmission.minRank, 9);
    }
});

test('click and Space cannot create an unconfirmed battle while React updates are pending', () => {
    for (const type of ['click', 'keydown']) {
        const f = fixture({ deferred: true }); f.sync();
        assert.equal(f.page.__kaspCybersportDebug.status().ready, false);
        const event = f.event(type);
        (type === 'click' ? f.documentListeners : f.windowListeners).get(type)(event);
        assert.equal(event.prevented, true); assert.equal(event.stopped, true);
        f.commit(); f.flush();
        assert.equal(f.page.__kaspCybersportDebug.status().ready, true);
        const second = f.event(type);
        (type === 'click' ? f.documentListeners : f.windowListeners).get(type)(second);
        assert.equal(second.prevented, undefined);
    }
});

test('a fresh native launch function is guarded again and leaving Esports restores the game callback', () => {
    const f = fixture(); f.sync();
    const original = (...args) => f.sent.push(args);
    f.model.props.launchFun = original;
    f.sync(); assert.notEqual(f.model.props.launchFun, original);
    f.model.props.launchFun('name', 16, 30, 0, 31, 27, []); assert.equal(f.sent[0][1], 6);
    f.root.attrs.delete(f.core.CYBERSPORT_ACTIVE); f.sync();
    assert.equal(f.model.props.launchFun, original); assert.equal(f.page.__kaspCybersportDebug.status().active, false);
});

test('changing maps with an unmounted rank control cannot reuse the previous minimum rank', () => {
    const f = fixture(); f.sync();
    f.model.props.activeMap = {}; f.panel.queries.delete(domModule.exports.gameDOM.battleCreate.rankDropdowns);
    f.sync();
    const event = f.event('click'); f.documentListeners.get('click')(event);
    assert.equal(event.prevented, true); assert.equal(f.sent.length, 0);
    f.model.props.launchFun('name', 8, 30, 0, 31, 27, []);
    assert.equal(f.sent.length, 0);
});

test('an incompatible native signature is rejected without changing the underlying request', () => {
    let calls = 0, error;
    const model = { state: { selectedOptions: '[Private]' }, props: { launchFun() { calls++; } } };
    pure.exports.guardCybersportSubmission(model, () => true, () => 9, (_, cause) => { error = cause; });
    model.props.launchFun('changed signature', { players: 8, minutes: 30 });
    assert.equal(calls, 0); assert.equal(error, 'native-launch-signature-mismatch');
});

test('Start buttons outside the marked creation root are not blocked by Esports readiness', () => {
    const f = fixture({ deferred: true }); f.sync();
    const event = f.event('click'); event.target.parent = null;
    f.documentListeners.get('click')(event); assert.equal(event.prevented, undefined);
});
