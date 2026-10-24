const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-garage-details-ast-v1', MARKER = '/*ki-garage-details-ast:v1:';
const enabled = '(function(){try{return window.localStorage.getItem("k_augments")==="true"}catch(__kaspDetailsIgnored){return false}})()';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const all = (root, type) => { const result = []; walk.full(root, n => { if (n.type === type) result.push(n); }); return result; };
const flat = n => n?.type === 'BinaryExpression' && n.operator === '+' ? [...flat(n.left), ...flat(n.right)] : [n];
const valueField = n => {
    if (n?.type === 'MemberExpression' && n.object.type === 'ThisExpression') return prop(n);
    if (n?.type === 'CallExpression') return prop(n.callee) === 'toString' ? valueField(n.callee.object) : n.arguments.length === 1 ? valueField(n.arguments[0]) : null;
    return null;
};
const isUnknown = (n, item, method) => n?.type === 'CallExpression' && n.arguments.length === 0 && n.callee.type === 'MemberExpression' &&
    (typeof item === 'string' ? n.callee.object.name === item : prop(n.callee.object) === item.field) && (!method || prop(n.callee) === method);

/** Offline discovery follows native state diagnostics and the branches that attach descriptions. */
function analyzeGarageDetails(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [], devicePanels: 0, skinPanels: 0, previewPanels: 0 };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, edits: [], templates: [], temporaries: [] };
    const fail = issue => { throw new Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scopeNodes = new WeakMap(), functions = [], diagnostics = [];
        const indexed = new Set(['ReturnStatement', 'VariableDeclarator', 'IfStatement', 'CallExpression', 'ConditionalExpression']);
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            if (fn(n)) functions.push(n);
            if (!indexed.has(n.type)) return;
            const scope = a.findLast(fn);
            if (!scope) return;
            let types = scopeNodes.get(scope);
            if (!types) scopeNodes.set(scope, types = new Map());
            if (!types.has(n.type)) types.set(n.type, []);
            types.get(n.type).push(n);
        });
        const direct = (root, type) => scopeNodes.get(root)?.get(type) || [];
        for (const f of functions) for (const ret of direct(f, 'ReturnStatement')) {
            const parts = flat(ret.argument);
            for (let i = 0; i < parts.length - 1; i++) {
                if (parts[i]?.type !== 'Literal' || typeof parts[i].value !== 'string') continue;
                const label = /(?:^|, )selected(Device|Skin)=$/.exec(parts[i].value)?.[1];
                const field = valueField(parts[i + 1]);
                if (label && field) diagnostics.push({ f, field, kind: label === 'Device' ? 'device' : 'skin' });
            }
        }
        const owners = new Map(), edits = [];
        const observe = (node, roles) => owners.set(node, { ...owners.get(node), ...roles });
        const edit = (start, end, text) => edits.push({ start, end, text, expected: source.slice(start, end), before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
        const text = n => source.slice(n.start, n.end);
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const candidates = [];
        for (const f of functions) {
            const vars = direct(f, 'VariableDeclarator');
            for (const item of vars.filter(v => v.id.type === 'Identifier' && v.init?.type === 'MemberExpression' &&
                v.init.object.type === 'MemberExpression' && v.init.object.object.type === 'ThisExpression' && diagnostics.some(d => d.field === prop(v.init)))) {
                const descCalls = direct(f, 'CallExpression').filter(c => c.callee.type === 'MemberExpression' && c.arguments.length === 2 &&
                    c.arguments[0].type === 'Identifier' && c.arguments[1].type === 'CallExpression' && c.arguments[1].callee.type === 'Identifier' &&
                    c.arguments[1].arguments.length === 2 && c.arguments[1].arguments[0].type === 'ThisExpression' && c.arguments[1].arguments[1].name === item.id.name);
                if (!descCalls.length) continue;
                const desc = unique(descCalls, 'description-attachment-ambiguous');
                const descVar = unique(vars.filter(v => v.id.name === desc.arguments[0].name && v.init?.type === 'CallExpression' && v.init.arguments.length === 1 && v.init.arguments[0].type === 'Identifier'), 'description-type-missing-or-ambiguous');
                const branches = direct(f, 'IfStatement').filter(b => [b.consequent, b.alternate].some(body => body && desc.start >= body.start && desc.end <= body.end));
                const branch = unique(branches, 'description-branch-missing-or-ambiguous');
                const gate = branch.test.type === 'SequenceExpression' ? branch.test.expressions.at(-1) : branch.test;
                const kind = unique([...new Set(diagnostics.filter(d => d.field === prop(item.init)).map(d => d.kind))], 'selected-item-kind-ambiguous');
                candidates.push({ f, item, descVar, branch, gate, kind });
            }
        }
        const devices = candidates.filter(c => c.kind === 'device'), skin = unique(candidates.filter(c => c.kind === 'skin'), 'skin-description-panel-missing-or-ambiguous');
        if (!devices.length) fail('device-description-panels-missing');
        if (new Set(devices.map(d => prop(d.item.init))).size !== devices.length) fail('device-description-panel-ambiguous');
        let unknownMethod, filterHelper, descriptionType;
        const bindPanel = (c, role) => {
            const diagnostic = unique(diagnostics.filter(d => d.field === prop(c.item.init) && d.kind === c.kind), 'selected-item-diagnostic-ambiguous');
            observe(diagnostic.f, { [role]: `property:${diagnostic.field}` });
            // Only the native description prefix is templated; purchase/mounting closures stay outside it.
            const prefix = { start: parents.get(c.item).start, end: c.branch.end };
            observe(prefix, { [role]: `property:${diagnostic.field}`, unknownMethod: `property:${unknownMethod}`,
                filterHelper: `identifier:${filterHelper}`, descriptionType: `identifier:${descriptionType}` });
            return prefix;
        };
        for (const [index, c] of devices.entries()) {
            if (c.gate?.type !== 'UnaryExpression' || c.gate.operator !== '!' || !isUnknown(c.gate.argument, c.item.id.name) ||
                c.descVar.start < c.branch.consequent.start || c.descVar.end > c.branch.consequent.end) fail('device-description-gate-unsupported');
            const method = prop(c.gate.argument.callee);
            const filters = direct(c.f, 'CallExpression').filter(n => n.callee.type === 'Identifier' && n.arguments.length === 2 && n.arguments[1].value === 'invert(0.25)' && n.start < c.branch.consequent.start);
            const filter = unique(filters, 'device-filter-missing-or-ambiguous');
            const parent = parents.get(filter);
            if (parent.type !== 'LogicalExpression' || parent.operator !== '&&' || !isUnknown(parent.left, c.item.id.name, method)) fail('device-filter-guard-unsupported');
            const type = c.descVar.init.arguments[0].name;
            if (unknownMethod && (unknownMethod !== method || filterHelper !== filter.callee.name || descriptionType !== type)) fail('device-panel-contracts-conflict');
            unknownMethod = method; filterHelper = filter.callee.name; descriptionType = type;
            const preview = unique(direct(c.f, 'ConditionalExpression').filter(n => n.start >= c.branch.test.start && n.end <= c.branch.test.end && isUnknown(n.test, { field: prop(c.item.init) }, method)), 'device-preview-gate-missing-or-ambiguous');
            bindPanel(c, `selectedDevice${index}`);
            edit(c.gate.start, c.gate.end, `(${text(c.gate)}||${enabled})`);
            edit(filter.arguments[1].start, filter.arguments[1].end, `(${enabled}?"grayscale(1)":${text(filter.arguments[1])})`);
            edit(preview.test.start, preview.test.end, `(${text(preview.test)}&&!${enabled})`);
        }
        if (skin.descVar.init.arguments[0].name !== descriptionType || skin.gate.type !== 'LogicalExpression' || skin.gate.operator !== '&&' ||
            !isUnknown(skin.gate.right, skin.item.id.name, unknownMethod) || skin.gate.left.type !== 'UnaryExpression' || skin.gate.left.operator !== '!' ||
            skin.gate.left.argument.type !== 'CallExpression' || skin.gate.left.argument.callee.type !== 'Identifier' || skin.gate.left.argument.arguments.length !== 1 ||
            skin.gate.left.argument.arguments[0].type !== 'ThisExpression' || !skin.branch.alternate || skin.descVar.start < skin.branch.alternate.start) fail('skin-description-gate-unsupported');
        const standard = skin.gate.left.argument.callee.name;
        const skinPrefix = bindPanel(skin, 'selectedSkin');
        observe(skinPrefix, { standardSkin: `identifier:${standard}` });
        const previewCalls = direct(skin.f, 'CallExpression').filter(c => c.callee.type === 'Identifier' && c.arguments.length === 2 &&
            c.arguments[0].type === 'ThisExpression' && c.arguments[1].type === 'Identifier' && c.arguments[1].name !== skin.item.id.name && c.start >= skin.branch.start && c.end <= skin.branch.end);
        const previewName = unique([...new Set(previewCalls.map(c => c.callee.name))], 'skin-preview-helper-missing-or-ambiguous');
        if (previewCalls.length !== 2) fail('skin-preview-branches-unsupported');
        observe(skinPrefix, { previewRenderer: `identifier:${previewName}` });
        edit(skin.gate.start, skin.gate.end, `((${text(skin.gate)})&&!${enabled})`);
        const previewFn = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === previewName && scopeOf(f) === scopeOf(skin.f)), 'skin-preview-renderer-missing-or-ambiguous');
        if (previewFn.params.length !== 2 || !previewFn.params.every(p => p.type === 'Identifier')) fail('skin-preview-parameters-unsupported');
        const previewIf = unique(all(previewFn, 'IfStatement').filter(b => b.test.type === 'LogicalExpression' && b.test.operator === '&&' &&
            isUnknown(b.test.left, { field: prop(skin.item.init) }, unknownMethod) && b.test.right.type === 'UnaryExpression' && b.test.right.operator === '!' &&
            b.test.right.argument.type === 'CallExpression' && b.test.right.argument.callee.name === standard), 'skin-preview-availability-missing-or-ambiguous');
        const inner = scopeOf(previewIf), invocation = parents.get(inner);
        if (invocation?.type !== 'CallExpression' || invocation.callee !== inner || scopeOf(invocation) !== previewFn) fail('skin-preview-callback-not-immediate');
        const attach = unique(direct(previewFn, 'CallExpression').filter(c => c.callee.type === 'MemberExpression' && c.callee.object.name === previewFn.params[1].name &&
            c.arguments.length === 1 && c.arguments[0].type === 'CallExpression' && !c.arguments[0].arguments.length && c.arguments[0].callee.type === 'MemberExpression' && c.arguments[0].callee.object.type === 'Identifier'), 'skin-preview-attachment-missing-or-ambiguous');
        const builderName = attach.arguments[0].callee.object.name;
        const nodeCalls = direct(previewFn, 'CallExpression').filter(c => c.callee.type === 'MemberExpression' && c.callee.object.name === builderName && !c.arguments.length && c !== attach.arguments[0]);
        const nodeMethod = unique([...new Set(nodeCalls.map(c => prop(c.callee)))], 'skin-preview-style-node-missing-or-ambiguous');
        observe(previewFn, { previewRenderer: `identifier:${previewName}`, selectedSkin: `property:${prop(skin.item.init)}`, unknownMethod: `property:${unknownMethod}`, standardSkin: `identifier:${standard}` });
        let temporary = '__kaspDetailsUnavailable'; while (source.includes(temporary)) temporary += '_';
        plan.temporaries.push(temporary);
        let bodyStart = previewFn.body.start + 1;
        for (const statement of previewFn.body.body) { if (!statement.directive) break; bodyStart = statement.end; }
        edit(bodyStart, bodyStart, `;var ${temporary}=false;`);
        edit(previewIf.test.start, previewIf.test.end, `((${temporary}=(${text(previewIf.test)}))&&!${enabled})`);
        // Tint only the native unavailable preview. Failures in the added tint do not stop attachment.
        edit(attach.start, attach.end, `((function(){try{${temporary}&&${enabled}&&${filterHelper}(${builderName}.${nodeMethod}(),"grayscale(1)")}catch(__kaspDetailsIgnored){}})(),${text(attach)})`);
        status.devicePanels = devices.length; status.skinPanels = 1; status.previewPanels = 1;
        status.hooked = status.ready = true;
        edit(0, 0, MARKER + JSON.stringify(status) + '*/\n');
        plan.edits = edits.sort((a, b) => a.start - b.start || a.end - b.end);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true, sharedKeys: new Map([[`identifier:${filterHelper}`, 'filterHelper']]) });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message);
        plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeGarageDetails };
