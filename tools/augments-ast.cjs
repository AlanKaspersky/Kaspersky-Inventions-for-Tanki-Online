const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-augments-ast-v1', MARKER = '/*ki-augments-ast:v1:';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 && n.arguments[0].type === 'Identifier' ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;
const direct = (root, type) => { const result = []; walk.fullAncestor(root, (n, _, a) => { if (n.type === type && [...a].reverse().find(fn) === root) result.push(n); }); return result; };
const categories = [
    ['DevicePropertiesCC [', { properties: 'properties' }],
    ['DevicePropertyEntity [', { operation: 'operation', property: 'property', value: 'value' }],
    ['DescriptionModelCC [', { name: 'name', description: 'description' }],
    ['GarageDevice(id=', { id: 'viewDeviceId', previewImage: 'viewPreview', rarity: 'viewRarity' }],
    ['GarageDeviceObject(id=', { id: 'deviceId', baseItemId: 'baseItemId' }],
    ['UpgradeParamsCC [', { currentLevel: 'upgradeLevel', itemData: 'upgradeData' }],
    ['UpgradeParamsData [', { properties: 'upgradeGroups', upgradeLevelsCount: 'upgradeLevels' }],
    ['GaragePropertyParams [', { properties: 'groupProperties' }],
    ['PropertyData [', { property: 'baseProperty', initialValue: 'baseInitial', finalValue: 'baseFinal' }],
];

/** Evaluate only string-building AST shapes, never game code. */
function diagnosticParts(f) {
    const env = new Map();
    const evaluate = n => {
        if (!n) return [];
        if (n.type === 'Literal' && typeof n.value === 'string') return [n.value];
        if (n.type === 'Identifier') return env.get(n.name) || [];
        if (n.type === 'BinaryExpression' && n.operator === '+') return [...evaluate(n.left), ...evaluate(n.right)];
        if (n.type === 'AssignmentExpression' && n.operator === '=' && n.left.type === 'Identifier') { const value = evaluate(n.right); env.set(n.left.name, value); return value; }
        if (n.type === 'SequenceExpression') { let value = []; for (const expression of n.expressions) value = evaluate(expression); return value; }
        if (own(n)) return [{ field: prop(n) }];
        if (n.type === 'CallExpression') {
            if (own(n.callee) && !n.arguments.length) return [{ getter: prop(n.callee) }];
            if (prop(n.callee) === 'toString' && !n.arguments.length) return evaluate(n.callee.object);
            if (n.callee.type === 'Identifier' && n.arguments.length === 1) return evaluate(n.arguments[0]);
        }
        return [];
    };
    const statements = [...direct(f, 'VariableDeclarator'), ...direct(f, 'ExpressionStatement'), ...direct(f, 'ReturnStatement')].sort((a, b) => a.start - b.start);
    let result = [];
    for (const statement of statements) {
        if (statement.type === 'VariableDeclarator' && statement.id.type === 'Identifier') env.set(statement.id.name, evaluate(statement.init));
        if (statement.type === 'ExpressionStatement') evaluate(statement.expression);
        if (statement.type === 'ReturnStatement') result = evaluate(statement.argument);
    }
    return result;
}

function analyzeAugments(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [] };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, schema: {}, edits: [], templates: [] };
    const fail = issue => { throw new Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), methods = [], functions = [];
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            if (fn(n)) functions.push(n);
            if (n.type === 'AssignmentExpression' && n.operator === '=' && fn(n.right) && protoType(n.left.object))
                methods.push({ node: n, fn: n.right, type: protoType(n.left.object), name: prop(n.left) });
        });
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const sameType = (a, b) => a.type === b.type && scopeOf(a.node) === scopeOf(b.node);
        const owners = new Map();
        const observe = (node, roles) => owners.set(node, { ...owners.get(node), ...roles });
        const schema = plan.schema;
        const fields = method => {
            const vars = new Map(direct(method.fn, 'VariableDeclarator').filter(n => n.id.type === 'Identifier' && own(n.init)).map(n => [n.id.name, prop(n.init)]));
            return [...new Set(direct(method.fn, 'ReturnStatement').map(n => own(n.argument) ? prop(n.argument) : vars.get(n.argument?.name)).filter(Boolean))];
        };
        let dtoType;
        const diagnostics = methods.filter(m => m.name === 'toString').map(m => ({ ...m, parts: diagnosticParts(m.fn) }));
        for (const [label, mapping] of categories) {
            const matches = diagnostics.filter(m => m.parts.some(p => typeof p === 'string' && p.startsWith(label)));
            if (!matches.length) continue;
            const method = unique(matches, `schema-${label}-ambiguous`);
            for (const [fieldLabel, role] of Object.entries(mapping)) {
                const index = method.parts.findIndex(p => typeof p === 'string' && new RegExp(`(?:^|[^\\w])${fieldLabel}\\s*=\\s*$`).test(p));
                const value = method.parts[index + 1];
                if (index < 0 || !value || typeof value === 'string') fail(`schema-${role}-missing`);
                const typeRole = `${Object.values(mapping)[0]}Type`;
                observe(method.node, { [typeRole]: `identifier:${method.type}` });
                if (value.field) {
                    schema[role] = value.field;
                    observe(method.node, { [role]: `property:${value.field}` });
                } else {
                    const getter = unique(methods.filter(m => sameType(m, method) && m.name === value.getter && m.fn.params.length === 0), `schema-${role}-getter-ambiguous`);
                    schema[role] = unique(fields(getter), `schema-${role}-field-ambiguous`);
                    observe(method.node, { [`${role}Getter`]: `property:${value.getter}` });
                    observe(getter.node, { [typeRole]: `identifier:${method.type}`, [`${role}Getter`]: `property:${value.getter}`, [role]: `property:${schema[role]}` });
                }
            }
            if (mapping.id === 'deviceId') dtoType = method;
        }
        for (const role of ['properties', 'operation', 'property', 'value', 'name', 'description']) if (!schema[role]) fail(`schema-${role}-missing`);
        const readers = methods.filter(m => { const literals = direct(m.fn, 'Literal').map(n => n.value); return literals.includes('No data for ') && literals.includes(' context: '); });
        const caches = methods.flatMap(m => {
            if (m.fn.params.length !== 2 || !m.fn.params.every(p => p.type === 'Identifier')) return [];
            const calls = direct(m.fn, 'CallExpression').filter(n => prop(n.callee) === 'set' && own(n.callee.object?.object) && n.arguments.length === 2 && n.arguments.every((a, i) => a.type === 'Identifier' && a.name === m.fn.params[i].name));
            if (calls.length !== 1 || !readers.some(r => sameType(r, m))) return [];
            const getters = methods.filter(g => sameType(g, m) && g.fn.params.length === 0 && g.fn.body.body.length === 1 && g.fn.body.body[0].type === 'ReturnStatement' && own(g.fn.body.body[0].argument));
            return getters.length === 1 ? [{ method: m, call: calls[0], getter: getters[0], reader: readers.find(r => sameType(r, m)) }] : [];
        });
        const cache = unique(caches, 'model-cache-missing-or-ambiguous');
        schema.objectIdMethod = cache.getter.name;
        observe(cache.reader.node, { modelType: `identifier:${cache.method.type}` });
        observe(cache.getter.node, { modelType: `identifier:${cache.method.type}`, objectIdMethod: `property:${schema.objectIdMethod}` });
        observe(cache.method.node, { modelType: `identifier:${cache.method.type}` });
        const edits = [];
        const edit = (start, end, text) => edits.push({ start, end, text, expected: source.slice(start, end), before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
        let temporary = '_kaspBonusResult'; while (source.includes(temporary)) temporary += '_';
        edit(cache.call.start, cache.call.end, `(function(${temporary}){try{window.__kaspAugmentData(${cache.method.fn.params[0].name},${cache.method.fn.params[1].name})}catch(__kaspIgnored){}return ${temporary}})(${source.slice(cache.call.start, cache.call.end)})`);
        if (dtoType) {
            const ctor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === dtoType.type && scopeOf(f) === scopeOf(dtoType.node)), 'device-constructor-missing-or-ambiguous');
            if (direct(ctor, 'ReturnStatement').length) fail('device-constructor-early-return');
            for (const role of ['deviceId', 'baseItemId']) if (!direct(ctor, 'AssignmentExpression').some(n => own(n.left) && prop(n.left) === schema[role])) fail(`device-constructor-${role}-missing`);
            observe(ctor, { deviceIdType: `identifier:${dtoType.type}`, deviceId: `property:${schema.deviceId}`, baseItemId: `property:${schema.baseItemId}` });
            edit(ctor.body.end - 1, ctor.body.end - 1, `;try{window.__kaspAugmentLink(this.${schema.deviceId},this.${schema.baseItemId})}catch(__kaspIgnored){}`);
        }
        const icons = [];
        for (const f of functions) {
            const vars = direct(f, 'VariableDeclarator').filter(n => n.id.type === 'Identifier' && prop(n.init) === 'icon' && prop(n.init.object) === 'props');
            if (!vars.length) continue;
            for (const call of direct(f, 'CallExpression')) if (!call.arguments.length && call.callee.type === 'MemberExpression' && vars.some(v => v.id.name === call.callee.object.name)) icons.push({ f, method: prop(call.callee) });
        }
        if (icons.length) {
            const method = unique([...new Set(icons.map(i => i.method))], 'image-url-method-ambiguous');
            schema.imageUrlMethod = method;
            observe(icons.find(i => i.method === method).f, { imageUrlMethod: `property:${method}` });
        }
        status.hooked = status.ready = true;
        const strict = ast.body.some((n, i) => n.directive === 'use strict' && ast.body.slice(0, i).every(p => p.directive));
        edit(0, 0, MARKER + JSON.stringify(status) + '*/\n' + (strict ? '"use strict";\n' : '') + `try{window.__kaspAugmentConfigure(${JSON.stringify(schema)})}catch(__kaspIgnored){}\n`);
        plan.edits = edits.sort((a, b) => a.start - b.start);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message);
        plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeAugments };
