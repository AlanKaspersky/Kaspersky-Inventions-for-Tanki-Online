const walk = require('acorn-walk');
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';

/** Identify the actual Terminator weapon component, rather than the equipped garage item. */
function criticalVehicle({ functions, methods, assignments, variables, direct, unique, observe, contract }) {
    const getters = functions.filter(f => f.params.length === 1 && f.params[0].type === 'Identifier' && (() => {
        let found = false;
        walk.full(f, n => { if (n.type === 'Literal' && n.value === 'terminatorWeapon') found = true; });
        return found;
    })());
    const slots = getters.flatMap(f => direct(variables, f).filter(v => v.init?.type === 'MemberExpression' &&
        v.init.object.name === f.params[0].name).map(v => ({ getter: f, field: prop(v.init) })));
    const candidates = [];
    for (const slot of slots) for (const assignment of assignments) {
        const call = assignment.right;
        if (!own(assignment.left) || prop(assignment.left) !== slot.field || call.type !== 'CallExpression' ||
            call.arguments.length !== 1 || call.callee.object?.type !== 'CallExpression' || !own(call.callee.object.callee)) continue;
        const token = call.arguments[0];
        const type = token.type === 'CallExpression' && token.callee.name === contract.token && token.arguments.length === 1
            && token.arguments[0].type === 'Identifier' ? token.arguments[0].name :
            !contract.token && token.type === 'Identifier' ? token.name : null;
        if (type) candidates.push({ ...slot, assignment, type });
    }
    const selected = unique(candidates, 'critical-terminator-component-missing-or-ambiguous');
    const cacheOwner = unique(methods.filter(m => m.f.start <= selected.assignment.start && m.f.end >= selected.assignment.end),
        'critical-terminator-cache-owner-ambiguous');
    observe(selected.getter, { terminatorSlot: `property:${selected.field}` });
    observe(cacheOwner.node, { terminatorWeapon: `identifier:${selected.type}`, terminatorSlot: `property:${selected.field}` });
    const optionalOwners = methods.filter(m => direct(assignments, m.f).some(a => {
        const call = a.right, token = call?.arguments?.[0];
        return own(a.left) && call.type === 'CallExpression' && prop(call.callee) === contract.optional &&
            call.arguments.length === 1 && (contract.token ? token?.type === 'CallExpression' && token.callee.name === contract.token &&
                token.arguments.length === 1 && token.arguments[0].name === contract.hudType : token?.name === contract.hudType);
    }));
    const optionalOwner = unique(optionalOwners, 'critical-vehicle-optional-lookup-ambiguous');
    observe(optionalOwner.node);
    return { type: selected.type, optionalOwner };
}
module.exports = { criticalVehicle };
