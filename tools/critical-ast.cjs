const { parse } = require('acorn');
const walk = require('acorn-walk');
const { generate } = require('astring');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');
const { analyzeArcade } = require('./arcade-ast.cjs');
const { addCriticalEvents } = require('./critical-events-ast.cjs');
const { addSupercharge } = require('./critical-supercharge.cjs');

const FORMAT = 'ki-critical-ast-v1', MARKER = '/*ki-critical-ast:v1:';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;
const field = n => own(n) ? prop(n) : n?.type === 'CallExpression' && n.arguments.length === 1 ? field(n.arguments[0]) : null;

/** Observe native server critical state and attach only to the local reload material. */
function analyzeCritical(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [] };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, schema: {}, edits: [], templates: [], temporaries: [] };
    const fail = issue => { throw Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const arcade = analyzeArcade(source, { exposeContract: true });
        if (!arcade.status.ready || !arcade.contract) fail('critical-local-hud-unavailable');
        const c = arcade.contract, ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scoped = new WeakMap(), callOwners = new WeakMap(), functions = [], methods = [], assignments = [], calls = [], variables = [], returns = [], properties = [];
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            const inFunction = a.findLast(fn);
            if (inFunction && !fn(n)) {
                if (!scoped.has(inFunction)) scoped.set(inFunction, new Map());
                const index = scoped.get(inFunction);
                if (!index.has(n.type)) index.set(n.type, []);
                index.get(n.type).push(n);
            }
            if (fn(n)) functions.push(n);
            if (n.type === 'AssignmentExpression') {
                assignments.push(n);
                if (fn(n.right) && protoType(n.left.object)) methods.push({ node: n, f: n.right, type: protoType(n.left.object), name: prop(n.left) });
            }
            if (n.type === 'CallExpression') {
                calls.push(n);
                callOwners.set(n, a.findLast(p => p.type === 'AssignmentExpression' && fn(p.right) && protoType(p.left.object)));
            }
            if (n.type === 'VariableDeclarator') variables.push(n);
            if (n.type === 'ReturnStatement') returns.push(n);
            if (n.type === 'Property') properties.push(n);
        });
        const scope = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const inside = (node, root) => node.start >= root.start && node.end <= root.end;
        const literals = root => { const out = []; walk.full(root, n => { if (n.type === 'Literal') out.push(n.value); }); return out; };
        const direct = (list, f) => scoped.get(f)?.get(list === calls ? 'CallExpression' : list === assignments ? 'AssignmentExpression' : list === variables ? 'VariableDeclarator' : 'ReturnStatement') || [];
        const owners = new Map(), edits = [], schema = plan.schema;
        const fresh = base => { let name = base; while (source.includes(name)) name += '_'; plan.temporaries.push(name); return name; };
        const ownerName = fresh('__kaspCriticalOwner');
        const observe = (n, roles = {}) => owners.set(n, { ...owners.get(n), ...roles });
        const edit = (start, end, text) => edits.push({ start, end, text, expected: source.slice(start, end), before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
        const anchor = unique(methods.filter(m => literals(m.f).includes('_nextShotCriticalStatePerpared_criticalCodec')), 'critical-rpc-missing-or-ambiguous');
        const rpcCall = unique(direct(calls, anchor.f).filter(n => own(n.callee) && n.arguments.length === 1), 'critical-rpc-callback-ambiguous');
        const impl = unique(methods.filter(m => m.name === prop(rpcCall.callee) && m.f.params.length === 1 &&
            direct(calls, m.f).some(call => call.arguments.length === 1 && call.arguments[0].type === 'NewExpression' && call.arguments[0].arguments[0]?.name === m.f.params[0].name)), 'critical-rpc-implementation-ambiguous');
        const dispatch = unique(direct(calls, impl.f).filter(n => n.arguments.length === 1 && n.arguments[0].type === 'NewExpression'), 'critical-event-dispatch-ambiguous');
        // Read the server model without activating an aiming marker or changing visibility.
        if (direct(returns, impl.f).length) fail('critical-rpc-control-flow-unsupported');
        const entityBinding = unique(direct(variables, impl.f).filter(v => v.id.type === 'Identifier' &&
            v.init?.type === 'CallExpression' && own(v.init.callee) && v.init.arguments.length === 1 &&
            dispatch.callee.object?.name === v.id.name), 'critical-rpc-entity-ambiguous');
        observe(anchor.node, { rpcMethod: `property:${impl.name}` });
        observe(impl.node, { rpcMethod: `property:${impl.name}` });
        edit(impl.f.body.end - 1, impl.f.body.end - 1,
            `;try{window.__kaspCriticalBridge.ready(this,${entityBinding.id.name},${impl.f.params[0].name})}catch(__kaspCriticalIgnored){}`);
        // Real server kills invalidate a prepared shot independently of the HUD lifecycle.
        const deathAnchor = unique(methods.filter(m => literals(m.f).includes('_kill_isCriticalCodec')), 'critical-kill-rpc-missing-or-ambiguous');
        const deathCalls = direct(calls, deathAnchor.f).filter(n => own(n.callee) && n.arguments.length === 4);
        const deathRpc = unique(deathCalls.filter(call => {
            for (let parent = parents.get(call); parent && parent !== deathAnchor.f; parent = parents.get(parent)) {
                if (parent.type === 'BlockStatement' && literals(parent).includes('_kill_isCriticalCodec')) return true;
            }
            return false;
        }), 'critical-kill-callback-ambiguous');
        const death = unique(methods.filter(m => m.name === prop(deathRpc.callee) && m.f.params.length === 4 &&
            direct(variables, m.f).some(v => v.init?.type === 'CallExpression' && own(v.init.callee) && v.init.arguments.length === 1)), 'critical-kill-implementation-ambiguous');
        if (direct(returns, death.f).length) fail('critical-kill-control-flow-unsupported');
        const deadEntity = unique(direct(variables, death.f).filter(v => v.id.type === 'Identifier' &&
            v.init?.type === 'CallExpression' && own(v.init.callee) && v.init.arguments.length === 1), 'critical-kill-entity-ambiguous');
        observe(deathAnchor.node, { killMethod: `property:${death.name}` });
        observe(death.node, { killMethod: `property:${death.name}` });
        edit(death.f.body.end - 1, death.f.body.end - 1,
            `;try{window.__kaspCriticalBridge.reset(this,${deadEntity.id.name})}catch(__kaspCriticalIgnored){}`);
        const info = unique(methods.filter(m => m.name === 'toString' && literals(m.f).includes('TankInfoCC [')), 'critical-equipment-schema-ambiguous');
        const names = {};
        for (const label of ['weaponBaseId', 'weaponDeviceId']) {
            const values = []; walk.full(info.f, n => {
                const prefix = n.type === 'BinaryExpression' && n.operator === '+' ? n.left.type === 'BinaryExpression' ? n.left.right : n.left : null;
                if (prefix?.type === 'Literal' && prefix.value === label + ' = ') values.push(field(n.right) || (n.right.type === 'CallExpression' ? prop(n.right.callee.object) : null));
            });
            names[label] = unique(values.filter(Boolean), 'critical-equipment-field-' + label + '-ambiguous');
        }
        schema.weaponField = names.weaponBaseId; schema.deviceField = names.weaponDeviceId;
        observe(info.node, { weaponField: `property:${schema.weaponField}`, deviceField: `property:${schema.deviceField}` });
        const hudUnit = unique(methods.filter(m => m.f.start < c.createAt && m.f.end > c.createAt), 'critical-hud-owner-ambiguous');
        const hudScope = scope(hudUnit.node);
        addCriticalEvents({ source, methods, functions, calls, assignments, variables, returns, scope, direct, parents,
            hudScope, dispatch, unique, fail, observe, edit, schema });
        addSupercharge({ methods, calls, variables, returns, scope, direct, dispatch, unique, fail, observe, edit, schema });
        const equipCandidates = functions.filter(f => f.type === 'FunctionDeclaration' && scope(f) === hudScope && f.params.length <= 4 &&
            direct(calls, f).some(n => n.callee.name === c.localTank) &&
            source.slice(f.start, f.end).includes('.' + schema.deviceField));
        const equipment = unique(equipCandidates, 'critical-local-equipment-consumer-ambiguous');
        if (direct(returns, equipment).length) fail('critical-equipment-control-flow-unsupported');
        const deviceReads = []; walk.full(equipment, n => { if (n.type === 'MemberExpression' && prop(n) === schema.deviceField && equipment.params.some(p => p.name === n.object.name)) deviceReads.push(n); });
        const infoArg = unique([...new Set(deviceReads.map(n => n.object.name))], 'critical-local-equipment-argument-ambiguous');
        const localLookup = unique(direct(calls, equipment).filter(n => n.callee.name === c.localTank), 'critical-local-equipment-lookup-ambiguous');
        observe(equipment, { deviceField: `property:${schema.deviceField}` });
        edit(equipment.body.end - 1, equipment.body.end - 1, `;try{window.__kaspCriticalBridge.equipment(${generate(localLookup)},${infoArg})}catch(__kaspCriticalIgnored){}`);
        const factory = parse(c.factory, { ecmaVersion: 'latest' }).body[0].expression;
        const material = factory.arguments[2], foreground = material.arguments[1];
        if (material.type !== 'NewExpression' || foreground?.type !== 'CallExpression' || foreground.arguments.length !== 1) fail('critical-native-color-factory-unsupported');
        const barCtor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === c.barType && scope(f) === hudScope && f.params.length >= 3), 'critical-bar-constructor-ambiguous');
        schema.materialField = prop(unique(direct(assignments, barCtor).filter(a => own(a.left) && a.right.name === barCtor.params[2].name), 'critical-bar-material-field-ambiguous').left);
        const matCtor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === material.callee.name && scope(f) === hudScope), 'critical-material-constructor-ambiguous');
        schema.foregroundField = prop(unique(direct(assignments, matCtor).filter(a => own(a.left) && a.right.name === matCtor.params[1]?.name), 'critical-material-foreground-field-ambiguous').left);
        observe(barCtor, { materialField: `property:${schema.materialField}` }); observe(matCtor, { foregroundField: `property:${schema.foregroundField}` });
        const ownerAt = offset => unique(methods.filter(m => m.f.start < offset && m.f.end > offset), 'critical-hud-hook-owner-ambiguous').node;
        observe(hudUnit.node); observe(ownerAt(c.frameAt)); observe(ownerAt(c.cleanupEnd - 1));
        edit(c.createAt, c.createAt, `,(function(${ownerName}){try{window.__kaspCriticalBridge.attach(${ownerName},${ownerName}.${c.barField},${generate({ ...foreground, arguments: [{ type: 'Literal', value: 16711680 }] })})}catch(__kaspCriticalIgnored){}})(${c.createOwner})`);
        edit(c.frameAt, c.frameAt, `,(function(${ownerName}){try{window.__kaspCriticalBridge.frame(${ownerName},${c.localTank}(${ownerName}.${c.world}()))}catch(__kaspCriticalIgnored){}})(${c.frameOwner})`);
        edit(c.cleanupEnd - 1, c.cleanupEnd - 1, ';try{window.__kaspCriticalBridge.detach(this)}catch(__kaspCriticalIgnored){}');
        const local = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === c.localTank && scope(f) === hudScope), 'critical-local-tank-lookup-ambiguous'); observe(local);
        const shared = new Map([[`identifier:${c.localTank}`, 'localTank'], [`property:${c.world}`, 'world'], [`property:${c.barField}`, 'barField'], [`identifier:${foreground.callee.name}`, 'colorFactory']]);
        for (const [node, roles] of owners) walk.fullAncestor(node, (n, _, a) => {
            if (n.type === 'MemberExpression' && shared.has(`property:${prop(n)}`)) roles[shared.get(`property:${prop(n)}`)] = `property:${prop(n)}`;
            if (n.type !== 'Identifier') return;
            const p = a[a.length - 2], key = `${p?.type === 'MemberExpression' && p.property === n ? 'property' : 'identifier'}:${n.name}`;
            if (shared.has(key)) roles[shared.get(key)] = key;
        });
        if (Object.values(schema).some(s => typeof s !== 'string' || !/^[$A-Z_a-z][$\w]*$/.test(s))) fail('critical-invalid-schema');
        status.hooked = status.ready = true;
        const strict = ast.body.slice(0, ast.body.findIndex(n => !n.directive) < 0 ? ast.body.length : ast.body.findIndex(n => !n.directive)).some(n => n.directive === 'use strict');
        edit(0, 0, MARKER + JSON.stringify(status) + '*/\n' + (strict ? '"use strict";\n' : '') + 'try{window.__kaspCriticalBridge.configure(' + JSON.stringify(schema) + ')}catch(__kaspCriticalIgnored){}\n');
        plan.edits = edits.sort((a, b) => a.start - b.start || a.end - b.end);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true, sharedKeys: shared });
    } catch (error) { status.hooked = status.ready = false; status.issues.push(error.message); plan.edits = []; plan.templates = []; }
    return plan;
}
module.exports = { analyzeCritical };
