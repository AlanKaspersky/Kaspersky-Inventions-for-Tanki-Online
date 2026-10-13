const walk = require('acorn-walk');
const { generate } = require('astring');
const prop = n => n?.type === 'MemberExpression' ? n.computed ? n.property.value : n.property.name : null;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';

/** Discover native firing/lifecycle events and confirmed shooter damage without changing listeners. */
function addCriticalEvents({ source, methods, functions, calls, assignments, variables, returns, scope, direct, parents,
    hudScope, dispatch, unique, fail, observe, edit, schema }) {
    const labels = root => { const out = []; walk.full(root, n => { if (n.type === 'Literal') out.push(n.value); }); return out; };
    const tokenType = n => n?.type === 'CallExpression' && n.arguments.length === 1 && n.arguments[0].type === 'Identifier' ? n.arguments[0].name : null;
    const counts = new Map();
    for (const method of methods.filter(m => scope(m.node) === hudScope && labels(m.f).includes('onShot') && labels(m.f).includes('weaponAssetsComponent'))) {
        for (const call of direct(calls, method.f).filter(c => c.arguments.length === 4)) {
            const type = tokenType(call.arguments[0]);
            const ctor = functions.find(f => f.type === 'FunctionDeclaration' && f.id.name === type && scope(f) === hudScope && f.params.length === 3);
            if (ctor) counts.set(ctor, (counts.get(ctor) || 0) + 1);
        }
    }
    const maximum = Math.max(0, ...counts.values());
    if (maximum < 2) fail('critical-shot-event-evidence-missing');
    const shot = unique([...counts].filter(([, count]) => count === maximum).map(([f]) => f), 'critical-shot-event-ambiguous');
    methods.filter(m => scope(m.node) === hudScope && labels(m.f).includes('onShot') && labels(m.f).includes('weaponAssetsComponent') &&
        direct(calls, m.f).some(call => tokenType(call.arguments[0]) === shot.id.name)).slice(0, 2).forEach(m => observe(m.node));
    observe(shot);
    edit(shot.body.end - 1, shot.body.end - 1,
        ';try{window.__kaspCriticalBridge.eventType(Object.getPrototypeOf(this),"shot","")}catch(__kaspCriticalIgnored){}');

    const title = unique(methods.filter(m => scope(m.node) === hudScope && labels(m.f).includes('configureBars')), 'critical-native-title-state-unavailable');
    const gates = []; walk.full(title.f, n => {
        if (n.type === 'CallExpression' && n.arguments[0]?.value === 1 && n.arguments[1]?.type === 'UnaryExpression' && n.arguments[1].operator === '!') {
            const value = n.arguments[1].argument.arguments?.[0];
            if (value?.type === 'MemberExpression' && value.object.type === 'Identifier') gates.push(prop(value));
        }
    });
    const lifeField = unique([...new Set(gates)], 'critical-life-state-field-ambiguous');
    const life = unique(functions.filter(f => f.type === 'FunctionDeclaration' && scope(f) === hudScope && f.params.length === 2 &&
        direct(assignments, f).some(a => own(a.left) && prop(a.left) === lifeField && a.right.name === f.params[0].name)), 'critical-life-event-ambiguous');
    observe(title.node, { lifeField: `property:${lifeField}` }); observe(life, { lifeField: `property:${lifeField}` });
    edit(life.body.end - 1, life.body.end - 1,
        `;try{window.__kaspCriticalBridge.eventType(Object.getPrototypeOf(this),"life",${JSON.stringify(lifeField)})}catch(__kaspCriticalIgnored){}`);

    const emitter = unique(methods.filter(m => m.name === prop(dispatch.callee) && m.f.params.length === 1), 'critical-entity-dispatch-ambiguous');
    if (direct(returns, emitter.f).length) fail('critical-entity-dispatch-control-flow-unsupported');
    observe(emitter.node);
    const directives = emitter.f.body.body.filter(n => n.directive);
    const at = directives.length ? directives[directives.length - 1].end : emitter.f.body.start + 1;
    edit(at, at,
        `;try{window.__kaspCriticalBridge.event(this,${emitter.f.params[0].name})}catch(__kaspCriticalIgnored){}`);

    const anchor = unique(methods.filter(m => labels(m.f).includes('_showDamageForShooter_damagesCodec')), 'critical-shooter-damage-codec-unavailable');
    const callback = unique(direct(calls, anchor.f).filter(call => {
        if (!own(call.callee) || call.arguments.length !== 1) return false;
        for (let p = parents.get(call); p && p !== anchor.f.body; p = parents.get(p)) {
            if (p.type === 'BlockStatement') return labels(p).includes('_showDamageForShooter_damagesCodec');
        }
        return false;
    }), 'critical-shooter-damage-callback-ambiguous');
    const damage = unique(methods.filter(m => m.name === prop(callback.callee) && m.f.params.length === 1 &&
        direct(variables, m.f).some(v => v.init?.type === 'CallExpression' && own(v.init.callee))), 'critical-shooter-damage-model-ambiguous');
    if (direct(returns, damage.f).length) fail('critical-shooter-damage-control-flow-unsupported');
    const entity = unique(direct(variables, damage.f).filter(v => v.init?.type === 'CallExpression' && own(v.init.callee) && v.init.arguments.length === 1), 'critical-shooter-damage-entity-ambiguous');
    const dto = unique(methods.filter(m => m.name === 'toString' && labels(m.f).includes('TargetTankDamage [')), 'critical-damage-schema-unavailable');
    for (const [key, label] of [['damageCritical', 'critical'], ['damageKind', 'damageIndicatorType']]) {
        const values = []; walk.full(dto.f, n => {
            const prefix = n.type === 'BinaryExpression' && n.operator === '+' ? n.left.type === 'BinaryExpression' ? n.left.right : n.left : null;
            if (prefix?.value === label + ' = ') values.push(own(n.right) ? prop(n.right) : prop(n.right.callee?.object));
        });
        schema[key] = unique(values.filter(Boolean), 'critical-damage-field-' + label + '-ambiguous');
    }
    const collection = damage.f.params[0].name;
    const reads = direct(calls, damage.f).filter(c => c.callee.object?.name === collection);
    schema.damageSize = prop(unique(reads.filter(c => c.arguments.length === 0), 'critical-damage-size-ambiguous').callee);
    schema.damageItem = prop(unique(reads.filter(c => c.arguments.length === 1), 'critical-damage-item-ambiguous').callee);
    const kind = unique(direct(calls, damage.f).filter(c => prop(c.callee.object) === schema.damageKind && c.arguments.length === 1 && c.arguments[0].type === 'CallExpression'), 'critical-damage-kind-filter-ambiguous');
    observe(anchor.node, { damageMethod: `property:${damage.name}` });
    observe(damage.node, { damageMethod: `property:${damage.name}`, damageSize: `property:${schema.damageSize}`, damageItem: `property:${schema.damageItem}`, damageCritical: `property:${schema.damageCritical}`, damageKind: `property:${schema.damageKind}` });
    observe(dto.node, { damageCritical: `property:${schema.damageCritical}`, damageKind: `property:${schema.damageKind}` });
    edit(damage.f.body.end - 1, damage.f.body.end - 1,
        `;try{window.__kaspCriticalBridge.damage(${entity.id.name},${collection},${generate(kind.arguments[0])})}catch(__kaspCriticalIgnored){}`);
}
module.exports = { addCriticalEvents };
