const { parse } = require('acorn');
const walk = require('acorn-walk');
const { generate } = require('astring');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');

const FORMAT = 'ki-battle-presence-ast-v1', MARKER = '/*ki-battle-presence-ast:v1:';
const fn = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const same = (a, b) => a && b && generate(a) === generate(b);

/** Offline interception of native DI store getters and paired battle-capacity writes. */
function analyzeBattlePresence(input, { profile = 'complete' } = {}) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [], storeHooks: 0, capacityHooks: 0 };
    const plan = { format: FORMAT, sha256, sourceLength: source.length, profile, status, edits: [], templates: [], temporaries: [] };
    const fail = issue => { throw Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    try {
        if (!['complete', 'store', 'capacity'].includes(profile)) fail('unsupported-presence-profile');
        const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
        const parents = new WeakMap(), scopeNodes = new WeakMap(), functions = [], assignments = [], sequences = [], blocks = [];
        const indexed = new Set(['VariableDeclarator', 'ReturnStatement']);
        walk.fullAncestor(ast, (n, _, a) => {
            parents.set(n, a[a.length - 2]);
            if (fn(n)) functions.push(n);
            if (n.type === 'AssignmentExpression') assignments.push(n);
            if (n.type === 'SequenceExpression') sequences.push(n);
            if (n.type === 'BlockStatement') blocks.push(n);
            if (!indexed.has(n.type)) return;
            const scope = a.findLast(fn); if (!scope) return;
            let types = scopeNodes.get(scope); if (!types) scopeNodes.set(scope, types = new Map());
            if (!types.has(n.type)) types.set(n.type, []);
            types.get(n.type).push(n);
        });
        const direct = (root, type) => scopeNodes.get(root)?.get(type) || [];
        const scopeOf = node => { for (let n = parents.get(node); n; n = parents.get(n)) if (fn(n)) return n; return ast; };
        const owners = new Map(), edits = [];
        const observe = (node, roles = {}) => owners.set(node, { ...owners.get(node), ...roles });
        const fresh = base => { let name = base; while (source.includes(name)) name += '_'; plan.temporaries.push(name); return name; };
        const result = fresh('_kaspBonusResult');
        const text = n => source.slice(n.start, n.end);
        const edit = (start, end, value) => edits.push({ start, end, text: value, expected: source.slice(start, end), before: source.slice(Math.max(0, start - 24), start), after: source.slice(end, end + 24) });
        if (profile !== 'capacity') for (const f of functions) {
            if (f.params.length || f.body.type !== 'BlockStatement') continue;
            for (const ret of direct(f, 'ReturnStatement')) {
                const call = ret.argument;
                if (call?.type !== 'CallExpression' || call.arguments.length !== 2 || !own(call.callee.object) || call.arguments[0].type !== 'ThisExpression') continue;
                const descriptor = call.arguments[1];
                if (descriptor.type !== 'CallExpression' || descriptor.arguments.length !== 5 || descriptor.arguments[0].value !== 'store' ||
                    descriptor.arguments[1].value !== 1 || descriptor.arguments[2].type !== 'Identifier' || descriptor.arguments[4].value !== null) continue;
                const scope = descriptor.arguments[2].name, factory = descriptor.arguments[3];
                if (!fn(factory) || factory.params.length !== 1 || factory.params[0].type !== 'Identifier' || factory.body.type !== 'BlockStatement' || factory.body.body.length !== 1) continue;
                const getter = factory.body.body[0];
                if (getter.type !== 'ReturnStatement' || getter.argument?.type !== 'CallExpression' || getter.argument.arguments.length || getter.argument.callee.object?.name !== factory.params[0].name) continue;
                if (!direct(f, 'VariableDeclarator').some(v => v.id.name === scope && v.init?.type === 'Identifier')) continue;
                observe(f);
                edit(call.start, call.end, `(function(${result}){try{window.__kaspPresenceStore(${result})}catch(__kaspPresenceIgnored){}return ${result}})(${text(call)})`);
                status.storeHooks++;
            }
        }
        if (profile !== 'store') {
            const groups = new Map();
            for (const a of assignments) {
                if (a.operator !== '=' || !own(a.left) || a.right.type !== 'NewExpression' || a.right.arguments.length !== 1 || !['battleId','maxPeople'].includes(a.right.arguments[0].value)) continue;
                const scope = scopeOf(a);
                if (!groups.has(scope)) groups.set(scope, []);
                groups.get(scope).push(a);
            }
            const group = unique([...groups.entries()].filter(([, items]) => ['battleId','maxPeople'].every(label => items.some(a => a.right.arguments[0].value === label))), 'presence-capacity-settings-missing-or-ambiguous');
            const idMeta = unique(group[1].filter(a => a.right.arguments[0].value === 'battleId'), 'presence-battle-id-slot-ambiguous');
            const limitMeta = unique(group[1].filter(a => a.right.arguments[0].value === 'maxPeople'), 'presence-capacity-slot-ambiguous');
            const idSlot = prop(idMeta.left), limitSlot = prop(limitMeta.left);
            observe(idMeta, { idSlot: `property:${idSlot}` }); observe(limitMeta, { limitSlot: `property:${limitSlot}` });
            const isWrite = (call, slot) => call?.type === 'CallExpression' && call.arguments.length === 1 && call.callee.type === 'MemberExpression' &&
                prop(call.callee.object) === slot && call.callee.object.object.type === 'CallExpression';
            const pairs = [];
            const paired = list => { for (let i=0; i<list.length-1; i++) {
                const id = list[i], limit = list[i+1];
                if (isWrite(id, idSlot) && isWrite(limit, limitSlot) && same(id.callee.object.object, limit.callee.object.object) && scopeOf(id) === scopeOf(limit)) pairs.push({ id, limit, f: scopeOf(id) });
            } };
            for (const seq of sequences) paired(seq.expressions);
            for (const block of blocks) paired(block.body.map(n => n.type === 'ExpressionStatement' ? n.expression : null));
            if (!pairs.length) fail('presence-capacity-writes-missing');
            const seen = new Set(), locals = new Map();
            for (const pair of pairs) {
                if (seen.has(pair.limit.start)) continue; seen.add(pair.limit.start);
                if (!fn(pair.f) || pair.f.body.type !== 'BlockStatement') fail('presence-capacity-scope-unsupported');
                let local = locals.get(pair.f);
                if (!local) {
                    local = { id: fresh('__kaspPresenceId'), limit: fresh('__kaspPresenceLimit') }; locals.set(pair.f, local);
                    let at = pair.f.body.start + 1;
                    for (const s of pair.f.body.body) { if (!s.directive) break; at = s.end; }
                    edit(at, at, `;var ${local.id},${local.limit};`);
                }
                observe(pair.f, { idSlot: `property:${idSlot}`, limitSlot: `property:${limitSlot}` });
                const idArg = pair.id.arguments[0], limitArg = pair.limit.arguments[0];
                edit(idArg.start, idArg.end, `(${local.id}=(${text(idArg)}))`);
                const native = source.slice(pair.limit.start, limitArg.start) + `(${local.limit}=(${text(limitArg)}))` + source.slice(limitArg.end, pair.limit.end);
                edit(pair.limit.start, pair.limit.end, `(function(${result}){try{window.__kaspPresenceCapacity(${local.id},${local.limit})}catch(__kaspPresenceIgnored){}return ${result}})(${native})`);
                status.capacityHooks++;
            }
        }
        if (profile !== 'capacity' && !status.storeHooks) fail('presence-store-getters-missing');
        // Use an outer function template if selected hooks are nested inside the same native scope.
        for (const [node, roles] of [...owners]) {
            const outer = [...owners.keys()].find(other => other !== node && other.start <= node.start && other.end >= node.end);
            if (outer) { observe(outer, roles); owners.delete(node); }
        }
        status.hooked = status.ready = true;
        edit(0, 0, MARKER + JSON.stringify(status) + '*/\n');
        plan.edits = edits.sort((a,b)=>a.start-b.start||a.end-b.end);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true });
    } catch (error) {
        status.hooked = status.ready = false; status.issues.push(error.message); plan.edits = []; plan.templates = [];
    }
    return plan;
}
module.exports = { analyzeBattlePresence };
