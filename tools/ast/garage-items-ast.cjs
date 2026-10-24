const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { generate } = require('astring');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-garage-items-ast-v1', MARKER = '/*ki-garage-items-ast:v1:';
const enabled = '(function(){try{return window.localStorage.getItem("k_augments")==="true"}catch(__kaspItemsIgnored){return false}})()';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const flat = n => n?.type === 'BinaryExpression' && n.operator === '+' ? [...flat(n.left), ...flat(n.right)] : [n];
const field = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression' ? prop(n) : n?.type === 'CallExpression' ?
    prop(n.callee) === 'toString' ? field(n.callee.object) : n.arguments.length === 1 ? field(n.arguments[0]) : null : null;
const same = (a, b) => a && b && generate(a) === generate(b);

/** Build-time discovery of native garage images and labels, including nested render callbacks. */
function analyzeGarageItems(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [], imagePanels: 0, labelPanels: 0 };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, edits: [], templates: [], temporaries: [] };
    const fail = issue => { throw Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scopeNodes = new WeakMap(), functions = [], calls = [], assignments = [];
        const indexed = new Set(['ReturnStatement', 'VariableDeclarator', 'CallExpression', 'ConditionalExpression', 'LogicalExpression', 'AssignmentExpression', 'Literal']);
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            if (fn(n)) functions.push(n);
            if (n.type === 'CallExpression') calls.push(n);
            if (n.type === 'AssignmentExpression') assignments.push(n);
            if (!indexed.has(n.type)) return;
            const scope = a.findLast(fn); if (!scope) return;
            let types = scopeNodes.get(scope); if (!types) scopeNodes.set(scope, types = new Map());
            if (!types.has(n.type)) types.set(n.type, []);
            types.get(n.type).push(n);
        });
        const direct = (root, type) => scopeNodes.get(root)?.get(type) || [];
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const owners = new Map(), edits = [];
        const observe = (node, roles) => owners.set(node, { ...owners.get(node), ...roles });
        const text = n => source.slice(n.start, n.end);
        const edit = (start, end, value) => edits.push({ start, end, text: value, expected: source.slice(start, end), before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
        const fresh = base => { let name = base; while (source.includes(name)) name += '_'; plan.temporaries.push(name); return name; };
        const metadata = unique(calls.filter(c => c.arguments[1]?.value === 'GarageItemComponentStyle' && c.arguments[0]?.type === 'Identifier'), 'garage-style-metadata-missing-or-ambiguous');
        const styleType = metadata.arguments[0].name;
        const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;
        const styleMethod = unique(assignments.filter(a => fn(a.right) && protoType(a.left.object) === styleType && scopeOf(a) === scopeOf(metadata) && direct(a.right, 'Literal').some(l => l.value === 'mainImg')), 'garage-main-image-style-missing-or-ambiguous');
        const imageStyle = prop(styleMethod.left);
        observe(metadata, { styleType: `identifier:${styleType}` });
        observe(styleMethod, { styleType: `identifier:${styleType}`, imageStyle: `property:${imageStyle}` });
        const diagnostic = unique(functions.filter(f => direct(f, 'ReturnStatement').some(r => flat(r.argument).some(p => p?.type === 'Literal' && typeof p.value === 'string' && p.value.startsWith('GarageItem(')))), 'garage-item-diagnostic-missing-or-ambiguous');
        const parts = flat(unique(direct(diagnostic, 'ReturnStatement'), 'garage-item-diagnostic-return-ambiguous').argument), schema = {};
        for (const [label, role] of [['name', 'itemName'], ['preview', 'itemPreview'], ['viewCategory', 'itemCategory']]) {
            const at = parts.findIndex(p => p?.type === 'Literal' && typeof p.value === 'string' && new RegExp(`(?:^|[,(]\\s*)${label}=$`).test(p.value));
            const name = at >= 0 ? field(parts[at + 1]) : null;
            if (!name) fail(`garage-item-${label}-field-missing`);
            schema[role] = name;
            observe(diagnostic, { [role]: `property:${name}` });
        }
        const imageFns = functions.filter(f => f.type === 'FunctionDeclaration' && f.params.length === 2 && f.params.every(p => p.type === 'Identifier') &&
            direct(f, 'CallExpression').some(c => c.callee.type === 'MemberExpression' && c.arguments.length === 1 && c.arguments[0].type === 'CallExpression' && prop(c.arguments[0].callee) === imageStyle));
        const image = unique(imageFns, 'garage-image-renderer-missing-or-ambiguous');
        const styleApply = unique(direct(image, 'CallExpression').filter(c => c.callee.type === 'MemberExpression' && c.callee.object.type === 'Identifier' &&
            c.arguments.length === 1 && c.arguments[0].type === 'CallExpression' && prop(c.arguments[0].callee) === imageStyle), 'garage-image-style-application-ambiguous');
        const isUnknown = (n, item, method) => n?.type === 'CallExpression' && !n.arguments.length && n.callee.type === 'MemberExpression' &&
            n.callee.object.name === item && (!method || prop(n.callee) === method);
        const placeholder = unique(direct(image, 'ConditionalExpression').filter(c => c.test.type === 'LogicalExpression' && c.test.operator === '&&' &&
            c.test.left.type === 'CallExpression' && !c.test.left.arguments.length && c.test.left.callee.object?.type === 'Identifier' &&
            c.test.right.type === 'UnaryExpression' && c.test.right.operator === '!' && c.test.right.argument.type === 'CallExpression' &&
            prop(c.test.right.argument.callee.object) === schema.itemCategory && c.alternate.type === 'CallExpression' &&
            prop(c.alternate.callee.object) === schema.itemPreview && c.alternate.callee.object.object.name === c.test.left.callee.object.name), 'garage-placeholder-missing-or-ambiguous');
        const item = placeholder.test.left.callee.object.name, unknownMethod = prop(placeholder.test.left.callee);
        const itemVar = unique(direct(image, 'VariableDeclarator').filter(v => v.id.name === item && v.init?.type === 'MemberExpression' &&
            v.init.object.type === 'MemberExpression' && v.init.object.object.name === image.params[0].name), 'garage-image-item-binding-missing-or-ambiguous');
        const stateField = prop(itemVar.init.object), itemField = prop(itemVar.init);
        if (!same(placeholder.test.right.argument.callee.object.object, itemVar.init)) fail('garage-placeholder-category-binding-conflict');
        const sizing = unique(direct(image, 'LogicalExpression').filter(l => l.operator === '&&' && same(l.left, placeholder.test) && l.right.type === 'CallExpression' &&
            l.right.callee.object?.name === styleApply.callee.object.name && prop(l.right.callee) === prop(styleApply.callee)), 'garage-placeholder-sizing-missing-or-ambiguous');
        const filterCalls = calls.filter(c => c.callee.type === 'MemberExpression' && c.arguments.length === 2 && c.arguments[0].value === 'filter' && typeof c.arguments[1].value === 'string');
        const filterSetter = unique([...new Set(filterCalls.map(c => prop(c.callee)))], 'native-filter-setter-missing-or-ambiguous');
        const filterEvidence = filterCalls.map(c => scopeOf(c)).find(f => f.type === 'FunctionDeclaration' && f.end - f.start < 1500);
        if (!filterEvidence) fail('native-filter-setter-evidence-missing');
        observe(filterEvidence, { filterSetter: `property:${filterSetter}` });
        observe(image, { imageRenderer: `identifier:${image.id.name}`, imageStyle: `property:${imageStyle}`, unknownMethod: `property:${unknownMethod}`,
            selectedState: `property:${stateField}`, selectedItem: `property:${itemField}`, itemCategory: `property:${schema.itemCategory}`, itemPreview: `property:${schema.itemPreview}` });
        const assigned = parents.get(placeholder);
        const resultVar = assigned?.type === 'AssignmentExpression' && assigned.left.type === 'Identifier' ? assigned.left.name : assigned?.type === 'VariableDeclarator' && assigned.id.type === 'Identifier' ? assigned.id.name : null;
        if (!resultVar) fail('garage-image-resource-binding-missing');
        const imageSet = unique(direct(image, 'CallExpression').filter(c => c.arguments.length === 1 && c.arguments[0].name === resultVar && c.callee.type === 'MemberExpression'), 'garage-image-resource-setter-missing-or-ambiguous');
        if (imageSet.start < placeholder.end || styleApply.start > placeholder.start) fail('garage-image-evaluation-order-unsupported');
        const temporary = fresh('__kaspItemUnavailable'), result = fresh('_kaspBonusResult');
        let bodyStart = image.body.start + 1;
        for (const statement of image.body.body) { if (!statement.directive) break; bodyStart = statement.end; }
        edit(bodyStart, bodyStart, `;var ${temporary}=false;`);
        edit(sizing.left.start, sizing.left.end, `((${text(sizing.left)})&&!${enabled})`);
        edit(placeholder.test.start, placeholder.test.end, `(((${temporary}=(${text(placeholder.test.left)}))&&${text(placeholder.test.right)})&&!${enabled})`);
        edit(imageSet.start, imageSet.end, `(function(${result}){try{${temporary}&&${enabled}&&${styleApply.callee.object.name}.${filterSetter}("filter","grayscale(1)")}catch(__kaspItemsIgnored){}return ${result}})(${text(imageSet)})`);

        // Resolve a label's item through its lexical bindings instead of looking near setAttribute text.
        const selectedBinding = (name, scope, seen = new Set()) => {
            const key = scope.start + ':' + name; if (seen.has(key)) return null; seen.add(key);
            const declarations = direct(scope, 'VariableDeclarator').filter(v => v.id.name === name);
            const values = declarations.filter(v => v.init).map(v => v.init);
            values.push(...direct(scope, 'AssignmentExpression').filter(a => a.operator === '=' && a.left.type === 'Identifier' && a.left.name === name).map(a => a.right));
            if (values.length === 1) {
                const value = values[0];
                if (value.type === 'Identifier') return selectedBinding(value.name, scope, seen);
                if (value.type === 'MemberExpression' && prop(value) === itemField && prop(value.object) === stateField) return scope;
                return null;
            }
            if (values.length || declarations.length || scope.params?.some(p => p.name === name)) return null;
            const outer = scopeOf(scope); return fn(outer) ? selectedBinding(name, outer, seen) : null;
        };
        const allNodes = (root, type) => { const nodes = []; walk.full(root, n => { if (n.type === type) nodes.push(n); }); return nodes; };
        const labels = [];
        for (const f of functions) for (const l of direct(f, 'LogicalExpression')) {
            if (l.operator !== '||' || l.left.type !== 'CallExpression' || l.left.callee.object?.type !== 'Identifier' ||
                !isUnknown(l.left, l.left.callee.object.name, unknownMethod) || l.right.type !== 'CallExpression' || l.right.callee.type !== 'MemberExpression' ||
                l.right.arguments.length !== 1 || prop(l.right.arguments[0]) !== schema.itemName || l.right.arguments[0].object.name !== l.left.callee.object.name) continue;
            const bound = selectedBinding(l.left.callee.object.name, f); if (!bound) continue;
            let card;
            for (let owner = f; fn(owner) && owner.end - owner.start < 20000; owner = scopeOf(owner)) {
                if (allNodes(owner, 'Literal').some(n => n.value === 'garage_item_id') && allNodes(owner, 'CallExpression').some(c => c.callee.name === image.id.name)) { card = owner; break; }
            }
            if (card) labels.push({ node: l, owner: bound });
        }
        const label = unique(labels, 'garage-native-label-missing-or-ambiguous');
        observe(label.owner, { selectedState: `property:${stateField}`, selectedItem: `property:${itemField}`, unknownMethod: `property:${unknownMethod}`, itemName: `property:${schema.itemName}` });
        edit(label.node.start, label.node.end, `((${text(label.node.left)})&&!${enabled})||${text(label.node.right)}`);
        status.imagePanels = status.labelPanels = 1; status.hooked = status.ready = true;
        edit(0, 0, MARKER + JSON.stringify(status) + '*/\n');
        plan.edits = edits.sort((a, b) => a.start - b.start || a.end - b.end);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true, sharedKeys: new Map([[`property:${filterSetter}`, 'filterSetter']]) });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message); plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeGarageItems };
