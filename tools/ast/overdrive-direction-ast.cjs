const { parse } = require('acorn');
const walk = require('acorn-walk');
const { createHash } = require('node:crypto');
const { analyzeArcade } = require('./arcade-ast.cjs');
const { compileTemplates } = require('./overdrive-templates.cjs');

function analyzeOverdriveDirection(source, suppliedContract) {
    const status = { ready: false, hooked: false, strategy: 'ast-plan', issues: [] };
    const plan = { format: 'ki-overdrive-direction-v1', sha256: createHash('sha256').update(source).digest('hex'),
        sourceLength: source.length, status, edits: [], templates: [], temporaries: [] };
    const prop = node => node?.type === 'MemberExpression' ? node.computed ? node.property.value : node.property.name : null;
    const own = node => node?.type === 'MemberExpression' && node.object.type === 'ThisExpression';
    const proto = node => node?.type === 'CallExpression' && node.arguments.length === 1 ? node.arguments[0].name
        : prop(node) === 'prototype' ? node.object.name : null;
    const unique = (items, reason) => { if (items.length !== 1) throw Error(reason); return items[0]; };
    try {
        const contract = suppliedContract || analyzeArcade(source, { exposeContract: true }).contract;
        if (!contract) throw Error('direction-local-hud-unavailable');
        const ast = parse(source, { ecmaVersion: 'latest' }), parents = new WeakMap(), functions = [], methods = [];
        walk.fullAncestor(ast, (node, _, ancestors) => {
            parents.set(node, ancestors[ancestors.length - 2]);
            if (node.type === 'FunctionDeclaration') functions.push(node);
            if (node.type === 'AssignmentExpression' && ['FunctionExpression', 'ArrowFunctionExpression'].includes(node.right.type) && proto(node.left.object))
                methods.push({ node, fn: node.right, type: proto(node.left.object), name: prop(node.left) });
        });
        const nodes = (root, type) => { const found = []; walk.full(root, node => { if (node.type === type) found.push(node); }); return found; };
        const labels = root => nodes(root, 'Literal').map(node => node.value);
        const scope = node => { for (let p = parents.get(node); p; p = parents.get(p)) if (/Function/.test(p.type)) return p; return ast; };
        const frame = unique(methods.filter(method => method.fn.start < contract.frameAt && method.fn.end > contract.frameAt), 'direction-frame-ambiguous');
        const gameScope = scope(frame.node);
        const scopedMethods = methods.filter(method => scope(method.node) === gameScope);
        const owners = new Map(), shared = new Map();
        const observe = node => { if (!owners.has(node)) owners.set(node, {}); };
        const role = (kind, name, label) => shared.set(`${kind}:${name}`, label);
        const vector = unique(methods.filter(method => method.name === 'toString' && labels(method.fn).includes('Vector3 (')), 'direction-vector-schema-ambiguous');
        const vectorFields = [...new Set(nodes(vector.fn, 'MemberExpression').filter(own).map(prop))];
        if (vectorFields.length !== 3) throw Error('direction-vector-fields-ambiguous');
        const copy = unique(methods.filter(method => method.type === vector.type && scope(method.node) === scope(vector.node) && method.fn.params.length === 1 &&
            vectorFields.every(field => nodes(method.fn, 'AssignmentExpression').some(node => own(node.left) && prop(node.left) === field &&
                prop(node.right) === field && node.right.object.name === method.fn.params[0].name))), 'direction-vector-copy-ambiguous');
        observe(vector.node); observe(copy.node);

        const physics = [];
        for (const getter of functions.filter(fn => scope(fn) === gameScope && labels(fn).includes('tankPhysics'))) {
            const field = nodes(getter, 'VariableDeclarator').find(node => prop(node.init) && node.init.object.name === getter.params[0]?.name);
            if (!field) continue;
            for (const method of scopedMethods) for (const assignment of nodes(method.fn, 'AssignmentExpression')) {
                const call = assignment.right, token = call.arguments?.[0];
                if (!own(assignment.left) || prop(assignment.left) !== prop(field.init) || call.type !== 'CallExpression' || call.arguments.length !== 1 ||
                    call.callee.object?.type !== 'CallExpression' || !own(call.callee.object.callee)) continue;
                const type = contract.token ? token?.type === 'CallExpression' && token.callee.name === contract.token && token.arguments.length === 1 ? token.arguments[0].name : null : token?.name;
                if (type) physics.push({ getter, method, type, slot: prop(field.init) });
            }
        }
        const physicsTypes = [...new Set(physics.map(item => item.type))].filter(type => scopedMethods.some(method =>
            method.type === type && labels(method.fn).includes('body')));
        const physicsType = unique(physicsTypes, 'direction-physics-component-ambiguous');
        const physicsEvidence = physics.find(item => item.type === physicsType);
        observe(physicsEvidence.getter); observe(physicsEvidence.method.node);
        const body = unique(scopedMethods.filter(method => method.type === physicsType && labels(method.fn).includes('body')), 'direction-body-getter-ambiguous');
        const spawn = unique(scopedMethods.filter(method => method.type === physicsType && labels(method.fn).includes('onSpawn')), 'direction-spawn-model-ambiguous');
        const positions = nodes(spawn.fn, 'CallExpression').filter(call => prop(call.callee) === copy.name && call.arguments.length === 1).map(call => {
            const position = call.callee.object, state = position?.object, root = state?.object;
            return root?.type === 'CallExpression' && prop(root.callee) === body.name && root.arguments.length === 0
                ? { position: prop(position), state: prop(state) } : null;
        }).filter(Boolean);
        const position = unique(positions, 'direction-body-position-ambiguous');
        observe(body.node); observe(spawn.node);

        const controller = unique(scopedMethods.filter(method => labels(method.fn).includes('handleCameraPointerEvent') && labels(method.fn).includes('handleMouseWheel')), 'direction-camera-controller-ambiguous');
        const bearings = scopedMethods.filter(method => method.type === controller.type).flatMap(method => nodes(method.fn, 'MemberExpression').flatMap(node => {
            const rotation = node.object, camera = rotation?.object, world = camera?.object;
            return prop(node) === vectorFields[2] && world?.type === 'CallExpression' && own(world.callee) &&
                prop(world.callee) === contract.world && world.arguments.length === 0
                ? [{ method, camera: prop(camera), rotation: prop(rotation) }] : [];
        }));
        const bearing = unique([...new Map(bearings.map(item => [`${item.camera}:${item.rotation}`, item])).values()], 'direction-camera-rotation-ambiguous');
        observe(controller.node); observe(bearing.method.node); observe(frame.node);
        const cleanup = unique(scopedMethods.filter(method => method.fn.start < contract.cleanupEnd && method.fn.end >= contract.cleanupEnd), 'direction-cleanup-ambiguous');
        const local = unique(functions.filter(fn => fn.id.name === contract.localTank && scope(fn) === gameScope), 'direction-local-tank-ambiguous');
        observe(cleanup.node); observe(local);
        for (const [name, label] of [[contract.localTank, 'localTank'], [physicsType, 'physicsType']]) role('identifier', name, label);
        role('identifier', vector.type, 'vectorType');
        role('identifier', frame.type, 'hudType');
        role('identifier', controller.type, 'cameraController');
        role('property', physicsEvidence.slot, 'physicsSlot');
        if (contract.barField) role('property', contract.barField, 'barField');
        role('property', copy.name, 'vectorCopy');
        vectorFields.forEach((field, index) => role('property', field, ['vectorX', 'vectorY', 'vectorZ'][index]));
        if (contract.token) role('identifier', contract.token, 'token');
        for (const [name, label] of [[contract.world, 'world'], [contract.optional, 'optional'], [body.name, 'bodyGetter'],
            [position.state, 'bodyState'], [position.position, 'bodyPosition'], [bearing.camera, 'camera'], [bearing.rotation, 'rotation']]) role('property', name, label);
        for (const [node, roles] of owners) walk.fullAncestor(node, (child, _, ancestors) => {
            if (child.type === 'MemberExpression') {
                const key = `property:${prop(child)}`;
                if (shared.has(key)) roles[shared.get(key)] = key;
            }
            if (child.type !== 'Identifier') return;
            const parent = ancestors[ancestors.length - 2];
            const key = `${parent?.type === 'MemberExpression' && parent.property === child ? 'property' : 'identifier'}:${child.name}`;
            if (shared.has(key)) roles[shared.get(key)] = key;
        });
        const fresh = base => { while (source.includes(base)) base += '_'; plan.temporaries.push(base); return base; };
        const owner = fresh('__kiDirectionOwner'), world = fresh('__kiDirectionWorld'), tank = fresh('__kiDirectionTank'), component = fresh('__kiDirectionPhysics');
        const token = contract.token ? `${contract.token}(${physicsType})` : physicsType;
        const frameText = `,(function(${owner}){try{if(window.__kaspOverdriveDirection&&window.__kaspOverdriveDirection.wanted()){var ${world}=${owner}.${contract.world}(),${tank}=${contract.localTank}(${world}),${component}=${tank}&&${tank}.${contract.optional}(${token});window.__kaspOverdriveDirection.capture(${component}?${component}.${body.name}().${position.state}.${position.position}:null,${world}.${bearing.camera}.${bearing.rotation})}}catch(__kiDirectionIgnored){try{window.__kaspOverdriveDirection.capture(null,null)}catch(__kiDirectionIgnored){}}})(${contract.frameOwner})`;
        const edit = (at, text) => ({ start: at, end: at, expected: '', before: source.slice(Math.max(0, at - 24), at), after: source.slice(at, at + 24), text });
        status.ready = status.hooked = true;
        plan.edits = [edit(0, '/*ki-overdrive-direction:v1:' + JSON.stringify(status) + '*/\n'), edit(contract.frameAt, frameText),
            edit(contract.cleanupEnd - 1, ';try{window.__kaspOverdriveDirection&&window.__kaspOverdriveDirection.capture(null,null)}catch(__kiDirectionIgnored){}')].sort((a, b) => a.start - b.start);
        plan.templates = compileTemplates(source, plan.edits, owners, { evidence: true, sharedKeys: shared });
    } catch (error) { status.ready = status.hooked = false; status.issues.push(error.message); plan.edits = []; plan.templates = []; }
    return plan;
}
module.exports = { analyzeOverdriveDirection };
