const { parse } = require('acorn');
const walk = require('acorn-walk');
const { generate } = require('astring');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-overdrive-ast-v1';
const MARKER = '/*ki-overdrive-ast:v1:';
const id = name => ({ type: 'Identifier', name });
const literal = value => ({ type: 'Literal', value });
const member = (object, name) => ({ type: 'MemberExpression', object, property: id(name), computed: false, optional: false });
const call = (callee, args) => ({ type: 'CallExpression', callee, arguments: args, optional: false });
const isFunction = node => node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
const nameOf = node => node?.type === 'MemberExpression'
    ? !node.computed && node.property.type === 'Identifier' ? node.property.name
        : node.computed && typeof node.property.value === 'string' ? node.property.value : null : null;

function guarded(name, args, expression = false, result, resultName = '_kaspBonusResult') {
    const target = member(id('window'), name);
    const statement = { type: 'TryStatement', block: { type: 'BlockStatement', body: [{ type: 'ExpressionStatement',
        expression: { type: 'LogicalExpression', operator: '&&', left: target, right: call(target, args) } }] },
        handler: { type: 'CatchClause', param: id('_kaspBonusError'), body: { type: 'BlockStatement', body: [] } }, finalizer: null };
    return generate(expression ? call({ type: 'FunctionExpression', id: null, params: result ? [id(resultName)] : [], generator: false, async: false,
        body: { type: 'BlockStatement', body: result ? [statement, { type: 'ReturnStatement', argument: id(resultName) }] : [statement] } }, result ? [result] : []) : statement);
}

function prototypeOf(node) {
    if (node?.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 1 && node.arguments[0].type === 'Identifier') return node;
    if (nameOf(node) === 'prototype' && node.object.type === 'Identifier') return node;
    return null;
}

function pieces(node) {
    return node?.type === 'BinaryExpression' && node.operator === '+' ? [...pieces(node.left), ...pieces(node.right)] : [node];
}
function thisField(node) {
    if (node?.type === 'MemberExpression' && node.object.type === 'ThisExpression') return nameOf(node);
    if (node?.type === 'CallExpression' && node.arguments.length === 1) return thisField(node.arguments[0]);
    return null;
}
function semanticFields(fn) {
    const returns = [];
    walk.fullAncestor(fn, (node, _state, ancestors) => {
        if (node.type === 'ReturnStatement' && [...ancestors].reverse().find(isFunction) === fn && node.argument) returns.push(pieces(node.argument));
    });
    for (const parts of returns) {
        const first = parts.findIndex(part => part?.type === 'Literal' && typeof part.value === 'string' && part.value.startsWith('Vector3 ('));
        if (first >= 0) {
            const fields = parts.slice(first + 1).map(thisField).filter(Boolean);
            if (fields.length === 3 && new Set(fields).size === 3) return { kind: 'vector', fields: { x: fields[0], y: fields[1], z: fields[2] } };
        }
        if (!parts.some(part => typeof part?.value === 'string' && part.value.startsWith('BattleBonusData('))) continue;
        const fields = {};
        for (let index = 0; index < parts.length - 1; index++) {
            const text = parts[index]?.value;
            if (typeof text !== 'string') continue;
            for (const label of ['box', 'pickupSound']) if (text.endsWith(`${label}=`)) fields[label] = thisField(parts[index + 1]);
        }
        if (fields.box && fields.pickupSound && fields.box !== fields.pickupSound) return { kind: 'bonus', fields };
    }
    return null;
}

function bodyStart(fn) {
    let offset = fn.body.start + 1;
    for (const statement of fn.body.body) {
        if (!statement.directive) break;
        offset = statement.end;
    }
    return offset;
}

/** Offline structural analysis. Generated edits preserve the rest of the bundle byte-for-byte. */
function analyzeOverdrive(input) {
    const source = input.replace(/^\uFEFF/, '');
    const sha256 = createHash('sha256').update(source).digest('hex');
    if (source.startsWith(MARKER)) {
        const status = JSON.parse(source.slice(MARKER.length, source.indexOf('*/')));
        return { format: FORMAT, sha256, sourceLength: source.length, edits: [], status, schemas: [] };
    }
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    const methods = [], calls = [], collisions = new Set(), pickupFunctions = new Set(), scopes = new WeakMap(), parents = new WeakMap(), callOwners = new WeakMap();
    walk.fullAncestor(ast, (node, _state, ancestors) => {
        if (node.type === 'CallExpression' && ancestors.length > 1) parents.set(node, ancestors[ancestors.length - 2]);
        if (node.type === 'AssignmentExpression' && node.operator === '=' && node.right.type === 'FunctionExpression' && prototypeOf(node.left.object)) {
            const chain = ancestors.filter(isFunction);
            const entry = { node, fn: node.right, proto: node.left.object, name: nameOf(node.left), scope: chain[chain.length - 1] || ast };
            methods.push(entry);
        }
        if (node.type === 'CallExpression') {
            calls.push(node);
            const chain = [ast, ...ancestors.filter(isFunction)];
            scopes.set(node, chain);
            const fn = chain[chain.length - 1];
            const assignment = ancestors.find(parent => parent.type === 'AssignmentExpression' && parent.right === fn);
            if (fn !== ast) callOwners.set(node, assignment || fn);
            if (node.arguments.length === 5 && node.arguments[4].value === 'bonus pickup') pickupFunctions.add(chain[chain.length - 1]);
        }
        if (node.type === 'Literal' && node.value === 'onBonusCollision' || node.type === 'Identifier' && node.name === 'onBonusCollision') {
            const fn = [...ancestors].reverse().find(isFunction);
            if (fn) collisions.add(fn);
        }
    });
    const edits = [], schemas = [], templateOwners = new Map();
    const managerKey = proto => `identifier:${proto.type === 'CallExpression' ? proto.arguments[0].name : proto.object.name}`;
    function edit(start, end, text) {
        edits.push({ start, end, expected: source.slice(start, end), text,
            before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
    }
    for (const method of methods.filter(method => method.name === 'toString')) {
        const schema = semanticFields(method.fn);
        if (schema) schemas.push({ ...schema, method });
    }
    const schemaIssues = [];
    for (const kind of ['vector', 'bonus']) {
        const candidates = schemas.filter(schema => schema.kind === kind);
        if (candidates.length !== 1) { schemaIssues.push(`${kind}-schema-${candidates.length ? 'ambiguous' : 'missing'}`); continue; }
        const schema = candidates[0];
        templateOwners.set(schema.method.node, kind === 'bonus'
            ? { sound: `property:${schema.fields.pickupSound}`, box: `property:${schema.fields.box}` }
            : { vectorX: `property:${schema.fields.x}`, vectorY: `property:${schema.fields.y}`, vectorZ: `property:${schema.fields.z}` });
        edit(schema.method.node.end, schema.method.node.end, ',' + guarded('__kaspBonusType',
            [schema.method.proto, literal(kind), { type: 'ObjectExpression', properties: Object.entries(schema.fields).map(([key, value]) => ({
                type: 'Property', key: id(key), value: literal(value), kind: 'init', method: false, shorthand: false, computed: false })) }], true));
    }
    const pickupMethods = methods.filter(method => {
        if (!pickupFunctions.has(method.fn)) return false;
        if (method.fn.params.length !== 2 || method.fn.params.some(param => param.type !== 'Identifier')) return false;
        return calls.some(node => (scopes.get(node) || []).slice(-1)[0] === method.fn && node.arguments.length === 5 &&
            node.arguments[0].type === 'ThisExpression' && node.arguments[1].type === 'MemberExpression' && node.arguments[1].object.type === 'ThisExpression' &&
            node.arguments[2].name === method.fn.params[0].name && node.arguments[3].name === method.fn.params[1].name && node.arguments[4].value === 'bonus pickup');
    });
    const issues = [];
    let contextHook = false, pickupCalls = 0, registrationHooks = 0;
    if (pickupMethods.length !== 1) issues.push(pickupMethods.length ? 'pickup-method-ambiguous' : 'pickup-method-missing');
    else {
        const pickup = pickupMethods[0];
        templateOwners.set(pickup.node, { pickup: `property:${pickup.name}`, manager: managerKey(pickup.proto) });
        edit(bodyStart(pickup.fn), bodyStart(pickup.fn), guarded('__kaspBonusContext', pickup.fn.params) + ';');
        contextHook = true;
        const bonusFields = schemas.filter(schema => schema.kind === 'bonus');
        for (const node of calls) {
            if (nameOf(node.callee) !== pickup.name || node.arguments.length !== 2 || !(scopes.get(node) || []).includes(pickup.scope)) continue;
            const sound = node.arguments[0], resource = sound?.object, field = nameOf(sound);
            if (!field || resource?.type !== 'CallExpression' || resource.arguments.length !== 1 || resource.arguments[0].type !== 'Identifier') continue;
            // A known BonusData schema prevents unrelated calls of the same method name from being instrumented.
            if (bonusFields.length && !bonusFields.some(schema => schema.fields.pickupSound === field)) continue;
            const owner = callOwners.get(node);
            if (owner) templateOwners.set(owner, { pickup: `property:${pickup.name}`, sound: `property:${field}` });
            edit(sound.start, sound.end, generate(call(member(id('window'), '__kaspBonusPrepare'), [resource, literal(field), resource.arguments[0]])));
            pickupCalls++;
        }
        if (!pickupCalls) issues.push('pickup-call-missing');
    }
    for (const method of methods) {
        const params = method.fn.params;
        if (![5, 6].includes(params.length) || params.some(param => param.type !== 'Identifier')) continue;
        let hasCollision = collisions.has(method.fn);
        // Native callbacks can be nested inside the registration function.
        if (!hasCollision) walk.simple(method.fn.body, { Literal(node) { if (node.value === 'onBonusCollision') hasCollision = true; } });
        if (!hasCollision) continue;
        const poolVars = [];
        walk.simple(method.fn.body, { VariableDeclarator(node) {
            if (node.id.type === 'Identifier' && node.init?.type === 'CallExpression' && node.init.callee.type === 'MemberExpression' &&
                node.init.callee.object.type === 'MemberExpression' && node.init.callee.object.object.type === 'ThisExpression' &&
                (scopes.get(node.init) || []).slice(-1)[0] === method.fn) poolVars.push(node.id);
        } });
        if (poolVars.length !== 1) continue;
        const instance = poolVars[0];
        const initCalls = calls.filter(node => (scopes.get(node) || []).slice(-1)[0] === method.fn && node.callee.type === 'MemberExpression' &&
            node.callee.object.name === instance.name && node.arguments.length === 2 &&
            node.arguments[0].name === params[0].name && node.arguments[1].name === params[1].name);
        if (initCalls.length === 1 && ['ExpressionStatement', 'SequenceExpression'].includes(parents.get(initCalls[0])?.type)) {
            const init = initCalls[0];
            let resultName = '_kaspBonusResult';
            while (source.includes(resultName)) resultName += '_';
            const absent = { type: 'UnaryExpression', operator: 'void', prefix: true, argument: literal(0) };
            edit(init.start, init.end, guarded('__kaspBonusRegister', [params[1], params[0], params[2], absent, absent, instance], true, init, resultName));
            templateOwners.set(method.node, { manager: managerKey(method.proto) });
            registrationHooks++;
        } else if (!initCalls.length && params.length === 6) {
            edit(bodyStart(method.fn), bodyStart(method.fn), guarded('__kaspBonusRegister', [params[1], ...params.slice(0, 1), ...params.slice(2, 5)]) + ';');
            templateOwners.set(method.node, { manager: managerKey(method.proto) });
            registrationHooks++;
        }
    }
    if (!registrationHooks) issues.push('registration-missing');
    const status = { kind: 'hooks', strategy: 'ast-plan', pickupHook: pickupCalls > 0, pickupCalls, contextHook, registrationHooks,
        issues, schemaIssues, ready: issues.length === 0 && schemaIssues.length === 0 };
    if (edits.length) edit(0, 0, `${MARKER}${JSON.stringify(status)}*/\n`);
    edits.sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 1; index < edits.length; index++) if (edits[index - 1].end > edits[index].start) throw new Error('Overlapping AST edits');
    return { format: FORMAT, sha256, sourceLength: source.length, status, edits,
        templates: status.ready ? compileTemplates(source, edits, templateOwners) : [],
        schemas: schemas.map(({ kind, fields, method }) => ({ kind, fields, prototype: generate(method.proto) })) };
}

module.exports = { analyzeOverdrive, FORMAT, MARKER };
