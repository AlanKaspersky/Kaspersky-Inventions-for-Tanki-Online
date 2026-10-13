const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-garage-inventory-ast-v1', MARKER = '/*ki-garage-inventory-ast:v1:';
const SCHEMA_TOKEN = '/*ki-inventory-schema:v1*/null';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;
const flat = n => n?.type === 'BinaryExpression' && n.operator === '+' ? [...flat(n.left), ...flat(n.right)] : [n];
const field = n => own(n) ? prop(n) : n?.type === 'CallExpression' ? prop(n.callee) === 'toString' ? field(n.callee.object) : n.arguments.length === 1 ? field(n.arguments[0]) : null : null;

/** Discover native inventory schemas and collection APIs without executing the client. */
function analyzeGarageInventory(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [] };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, schema: {}, schemaToken: SCHEMA_TOKEN, edits: [], templates: [], temporaries: [] };
    const fail = issue => { throw Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scopeNodes = new WeakMap(), functions = [], methods = [], calls = [];
        const indexed = new Set(['ReturnStatement', 'VariableDeclarator', 'CallExpression', 'AssignmentExpression', 'ForStatement']);
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            if (fn(n)) functions.push(n);
            if (n.type === 'CallExpression') calls.push(n);
            if (n.type === 'AssignmentExpression' && fn(n.right) && protoType(n.left.object)) methods.push({ node: n, f: n.right, type: protoType(n.left.object), name: prop(n.left) });
            if (!indexed.has(n.type)) return;
            const scope = a.findLast(fn); if (!scope) return;
            let types = scopeNodes.get(scope); if (!types) scopeNodes.set(scope, types = new Map());
            if (!types.has(n.type)) types.set(n.type, []);
            types.get(n.type).push(n);
        });
        const direct = (root, type) => scopeNodes.get(root)?.get(type) || [];
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const owners = new Map(), edits = [], schema = plan.schema;
        const observe = (node, roles) => owners.set(node, { ...owners.get(node), ...roles });
        const diagnostics = label => methods.filter(m => m.name === 'toString' && direct(m.f, 'ReturnStatement').some(r => flat(r.argument).some(p => p?.type === 'Literal' && typeof p.value === 'string' && p.value.startsWith(label))));
        const state = unique(diagnostics('GarageItemsState('), 'inventory-state-missing-or-ambiguous');
        const item = unique(diagnostics('GarageItem('), 'inventory-item-missing-or-ambiguous');
        observe(state.node, { stateType: `identifier:${state.type}` });
        const parts = flat(unique(direct(item.f, 'ReturnStatement'), 'inventory-item-diagnostic-return-ambiguous').argument);
        for (const label of ['id', 'name', 'category', 'viewCategory', 'description', 'preview', 'owned', 'buyable', 'visible', 'secret']) {
            const at = parts.findIndex(p => p?.type === 'Literal' && typeof p.value === 'string' && new RegExp(`(?:^|[,(]\\s*)${label}=$`).test(p.value));
            const name = at >= 0 ? field(parts[at + 1]) : null;
            if (!name) continue;
            schema[label] = name; observe(item.node, { [label]: `property:${name}` });
        }
        for (const key of ['id', 'name', 'owned', 'visible', 'secret']) if (!schema[key]) fail(`inventory-field-${key}-missing`);
        const values = methods.filter(m => m.type === state.type && scopeOf(m.node) === scopeOf(state.node) && !m.f.params.length && m.f.body.body.length === 1 &&
            m.f.body.body[0].type === 'ReturnStatement' && m.f.body.body[0].argument?.type === 'CallExpression' && !m.f.body.body[0].argument.arguments.length && own(m.f.body.body[0].argument.callee.object));
        const getter = unique(values, 'inventory-flat-values-getter-missing-or-ambiguous');
        const read = getter.f.body.body[0].argument, flatField = prop(read.callee.object);
        schema.valuesMethod = prop(read.callee);
        observe(getter.node, { stateType: `identifier:${state.type}`, flatField: `property:${flatField}`, valuesGetter: `property:${getter.name}`, valuesMethod: `property:${schema.valuesMethod}` });
        const constructor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === state.type && scopeOf(f) === scopeOf(state.node)), 'inventory-constructor-missing-or-ambiguous');
        const assignment = unique(direct(constructor, 'AssignmentExpression').filter(a => a.operator === '=' && own(a.left) && prop(a.left) === flatField), 'inventory-initialization-missing-or-ambiguous');

        // Infer the iterator contract from a for-loop that consumes this exact state getter.
        const consumers = [];
        for (const f of functions) for (const loop of direct(f, 'ForStatement')) {
            if (loop.init?.type !== 'VariableDeclaration' || loop.test?.type !== 'CallExpression' || loop.test.arguments.length) continue;
            for (const v of loop.init.declarations) {
                if (v.id.type !== 'Identifier' || v.init?.type !== 'CallExpression' || v.init.arguments.length || v.init.callee.type !== 'MemberExpression' || loop.test.callee.object?.name !== v.id.name) continue;
                let list = v.init.callee.object;
                if (list.type === 'Identifier') list = direct(f, 'VariableDeclarator').find(d => d.id.name === list.name)?.init;
                if (list?.type !== 'CallExpression' || list.arguments.length || prop(list.callee) !== getter.name) continue;
                const next = direct(f, 'CallExpression').filter(c => c.start >= loop.body.start && c.end <= loop.body.end && c.callee.object?.name === v.id.name && !c.arguments.length);
                const nextMethod = [...new Set(next.map(c => prop(c.callee)))];
                if (nextMethod.length !== 1) continue;
                consumers.push({ f, iteratorMethod: prop(v.init.callee), hasNextMethod: prop(loop.test.callee), nextMethod: nextMethod[0] });
            }
        }
        unique([...new Set(consumers.map(c => [c.iteratorMethod, c.hasNextMethod, c.nextMethod].join(':')))], 'inventory-iterator-contract-missing-or-ambiguous');
        const consumer = consumers.sort((a, b) => (a.f.end - a.f.start) - (b.f.end - b.f.start))[0];
        for (const key of ['iteratorMethod', 'hasNextMethod', 'nextMethod']) schema[key] = consumer[key];
        observe(consumer.f, { valuesGetter: `property:${getter.name}`, iteratorMethod: `property:${schema.iteratorMethod}`, hasNextMethod: `property:${schema.hasNextMethod}`, nextMethod: `property:${schema.nextMethod}` });
        if (schema.preview) {
            const images = calls.filter(c => !c.arguments.length && c.callee.type === 'MemberExpression' && prop(c.callee.object) === schema.preview && c.callee.object.object.type === 'Identifier');
            if (images.length) {
                schema.imageMethod = unique([...new Set(images.map(c => prop(c.callee)))], 'inventory-image-method-ambiguous');
                const evidence = images.map(c => {
                    for (let node = parents.get(c); node; node = parents.get(node)) {
                        if (node.type === 'ConditionalExpression' || fn(node)) return node;
                    }
                }).filter(Boolean).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
                observe(evidence, { preview: `property:${schema.preview}`, imageMethod: `property:${schema.imageMethod}` });
            }
        }
        let result = '_kaspBonusResult'; while (source.includes(result)) result += '_'; plan.temporaries.push(result);
        const original = source.slice(assignment.start, assignment.end);
        const hook = `(function(${result}){try{window.__kaspGarageInventoryCapture(${result},${JSON.stringify(schema)})}catch(__kaspInventoryIgnored){}return ${result}})(${original})`;
        edits.push({ start: assignment.start, end: assignment.end, expected: original, text: hook,
            before: source.slice(Math.max(0, assignment.start - 24), assignment.start), after: source.slice(assignment.end, assignment.end + 24) });
        observe(constructor, { stateType: `identifier:${state.type}`, flatField: `property:${flatField}` });
        status.hooked = status.ready = true;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        plan.edits = edits;
        // Schema JSON is materialized from captured roles, never rewritten as native property tokens.
        const templateEdits = edits.map(e => e.start === assignment.start ? { ...e, text: e.text.replace(JSON.stringify(schema), SCHEMA_TOKEN) } : e);
        plan.templates = compileTemplates(source, templateEdits, owners, { evidence: true });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message); plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeGarageInventory };
