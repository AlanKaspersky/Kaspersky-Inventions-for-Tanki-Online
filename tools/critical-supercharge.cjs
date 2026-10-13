const walk = require('acorn-walk');
const { generate } = require('astring');
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';

/** Observe the server supercharge model, including an already active effect on battle entry. */
function addSupercharge({ methods, calls, variables, returns, scope, direct, dispatch, unique, fail, observe, edit, schema }) {
    const labels = root => { const out = []; walk.full(root, n => { if (n.type === 'Literal') out.push(n.value); }); return out; };
    const cc = unique(methods.filter(m => m.name === 'toString' && labels(m.f).includes('TankSuperchargeCC [')), 'critical-supercharge-schema-ambiguous');
    const fields = [];
    walk.full(cc.f, n => {
        const prefix = n.type === 'BinaryExpression' && n.operator === '+' ? n.left.type === 'BinaryExpression' ? n.left.right : n.left : null;
        if (prefix?.value === 'superchargeEnabled = ' && own(n.right)) fields.push(prop(n.right));
    });
    schema.superchargeEnabledField = unique(fields, 'critical-supercharge-enabled-field-ambiguous');
    const candidates = [];
    for (const method of methods.filter(m => m.f.params.length === 3)) walk.full(method.f, n => {
        if (n.type === 'LogicalExpression' && n.operator === '&&' && prop(n.left) === schema.superchargeEnabledField &&
            n.left.object.type === 'CallExpression' && own(n.left.object.callee) && n.left.object.arguments.length === 0 &&
            n.right.type === 'CallExpression' && own(n.right.callee) && n.right.arguments.length === 0) candidates.push({ method, n });
    });
    const { method: boot, n } = unique(candidates, 'critical-supercharge-initialization-ambiguous');
    const modelMethods = methods.filter(m => m.type === boot.type && scope(m.node) === scope(boot.node));
    const enable = unique(modelMethods.filter(m => m.name === prop(n.right.callee)), 'critical-supercharge-enable-ambiguous');
    const emitted = m => direct(calls, m.f).filter(c => prop(c.callee) === prop(dispatch.callee) && c.arguments.length === 1 && c.arguments[0].type === 'Identifier');
    const disable = unique(modelMethods.filter(m => m !== enable && m.f.params.length === 0 && emitted(m).length === 1), 'critical-supercharge-disable-ambiguous');
    const roles = { superchargeModel: `identifier:${boot.type}`, superchargeEnable: `property:${enable.name}` };
    observe(cc.node, { superchargeEnabledField: `property:${schema.superchargeEnabledField}` });
    observe(boot.node, { ...roles, superchargeEnabledField: `property:${schema.superchargeEnabledField}` });
    const wire = unique(methods.filter(m => m.f.params.length === 2 && [enable.name, disable.name].every(name =>
        direct(calls, m.f).some(c => own(c.callee) && prop(c.callee) === name && c.arguments.length === 0))), 'critical-supercharge-wire-ambiguous');
    observe(wire.node, { superchargeEnable: roles.superchargeEnable, superchargeDisable: `property:${disable.name}` });
    edit(n.left.start, n.left.end, `(function(__kaspSuperchargeValue){try{window.__kaspCriticalBridge.supercharge(${boot.f.params[0].name},__kaspSuperchargeValue)}catch(__kaspCriticalIgnored){}return __kaspSuperchargeValue})(${generate(n.left)})`);
    for (const [method, active] of [[enable, true], [disable, false]]) {
        if (method.f.params.length || direct(returns, method.f).length) fail('critical-supercharge-control-flow-unsupported');
        const event = unique(emitted(method), 'critical-supercharge-event-ambiguous');
        const entity = unique(direct(variables, method.f).filter(v => v.id.type === 'Identifier' &&
            v.init?.type === 'CallExpression' && own(v.init.callee) && v.init.arguments.length === 1 &&
            event.callee.object?.name === v.id.name), 'critical-supercharge-entity-ambiguous');
        observe(method.node, { superchargeModel: roles.superchargeModel,
            [active ? 'superchargeEnable' : 'superchargeDisable']: `property:${method.name}` });
        edit(method.f.body.end - 1, method.f.body.end - 1,
            `;try{window.__kaspCriticalBridge.supercharge(${entity.id.name},${active})}catch(__kaspCriticalIgnored){}`);
    }
}
module.exports = { addSupercharge };
