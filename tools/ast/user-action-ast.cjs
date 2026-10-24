const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-user-action-ast-v1', MARKER = '/*ki-user-action-ast:v1:';
const SCHEMA_TOKEN = '/*ki-user-action-schema:v1*/null';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;
const flat = n => n?.type === 'BinaryExpression' && n.operator === '+' ? [...flat(n.left), ...flat(n.right)] : [n];
const field = n => own(n) ? prop(n) : n?.type === 'CallExpression' ? prop(n.callee) === 'toString' && !n.arguments.length ? field(n.callee.object) : n.arguments.length === 1 ? field(n.arguments[0]) : null : null;

/** Discover the action DTO, its player label and the constructor in the same lexical scope. */
function analyzeUserAction(input) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [], constructorHooks: 0 };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, status, schema: {}, schemaToken: SCHEMA_TOKEN, edits: [], templates: [] };
    const fail = issue => { throw Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scopeNodes = new WeakMap(), functions = [], methods = [];
        walk.fullAncestor(ast, (node, _, chain) => {
            parents.set(node, chain[chain.length - 2]);
            if (fn(node)) functions.push(node);
            if (node.type === 'AssignmentExpression' && node.operator === '=' && fn(node.right) && prop(node.left) === 'toString' && protoType(node.left.object)) {
                methods.push({ node, f: node.right, type: protoType(node.left.object) });
            }
            if (!['ReturnStatement', 'ThrowStatement', 'AssignmentExpression'].includes(node.type)) return;
            const scope = chain.findLast(fn); if (!scope) return;
            let nodes = scopeNodes.get(scope); if (!nodes) scopeNodes.set(scope, nodes = new Map());
            if (!nodes.has(node.type)) nodes.set(node.type, []);
            nodes.get(node.type).push(node);
        });
        const direct = (scope, type) => scopeNodes.get(scope)?.get(type) || [];
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const diagnostics = label => methods.filter(m => direct(m.f, 'ReturnStatement').some(r => flat(r.argument).some(p =>
            p?.type === 'Literal' && typeof p.value === 'string' && p.value.startsWith(label + '('))));
        const action = unique(diagnostics('TankUserActionLog'), 'user-action-model-missing-or-ambiguous');
        const player = unique(diagnostics('UserLabelData'), 'user-action-player-model-missing-or-ambiguous');
        const owners = new Map(), schema = plan.schema;
        const discover = (dto, labels, typeRole) => {
            const parts = flat(unique(direct(dto.f, 'ReturnStatement'), 'user-action-diagnostic-return-ambiguous').argument);
            const roles = { [typeRole]: `identifier:${dto.type}` };
            for (const [label, required] of labels) {
                const entries = parts.flatMap((p, index) => p?.type === 'Literal' && typeof p.value === 'string' &&
                    new RegExp(`(?:^|[,(]\\s*)${label}=$`).test(p.value) ? [field(parts[index + 1])] : []);
                if (!entries.length && !required) continue;
                const key = unique(entries, `user-action-field-${label}-missing-or-ambiguous`);
                if (typeof key !== 'string' || !/^[$A-Z_a-z][$\w]*$/.test(key)) fail(`user-action-field-${label}-unsupported`);
                schema[label] = key; roles[label] = `property:${key}`;
            }
            owners.set(dto.node, roles);
        };
        discover(action, [['userLabelData', true], ['type', true]], 'actionType');
        discover(player, [['uid', true], ['teamRelation', false]], 'playerType');
        if (schema.userLabelData === schema.type) fail('user-action-fields-overlap');
        const ctor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id?.name === action.type && scopeOf(f) === scopeOf(action.node)), 'user-action-constructor-missing-or-ambiguous');
        if (direct(ctor, 'ReturnStatement').length || direct(ctor, 'ThrowStatement').length ||
            ctor.body.body.some(s => !['ExpressionStatement', 'VariableDeclaration', 'FunctionDeclaration'].includes(s.type))) fail('user-action-constructor-control-flow-unsupported');
        for (const key of ['userLabelData', 'type']) {
            unique(direct(ctor, 'AssignmentExpression').filter(a => a.operator === '=' && own(a.left) && prop(a.left) === schema[key]), `user-action-initialization-${key}-missing-or-ambiguous`);
        }
        const at = ctor.body.end - 1;
        const hook = `;try{window.__kaspSendAction("TankUserActionLog",this,${JSON.stringify(schema)})}catch(__kaspActionIgnored){}`;
        const edit = { start: at, end: at, expected: '', text: hook, before: source.slice(Math.max(0, at - 24), at), after: source.slice(at, at + 24) };
        status.hooked = status.ready = true; status.constructorHooks = 1;
        plan.edits = [{ start: 0, end: 0, expected: '', before: '', after: source.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' }, edit];
        owners.set(ctor, { actionType: `identifier:${action.type}`, userLabelData: `property:${schema.userLabelData}`, type: `property:${schema.type}` });
        const templateEdits = plan.edits.map(e => e === edit ? { ...e, text: e.text.replace(JSON.stringify(schema), SCHEMA_TOKEN) } : e);
        plan.templates = compileTemplates(source, templateEdits, owners, { evidence: true });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message); plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeUserAction };
