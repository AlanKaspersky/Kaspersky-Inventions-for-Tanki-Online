const { parse } = require('acorn');
const walk = require('acorn-walk');
const { generate } = require('astring');
const { createHash } = require('node:crypto');
const { compileTemplates } = require('./overdrive-templates.cjs');
const { renderArcadeEdits } = require('./arcade-render.cjs');

const FORMAT = 'ki-arcade-ast-v1', MARKER = '/*ki-arcade-ast:v1:';
const fn = n => n && ['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].includes(n.type);
const prop = n => n?.type === 'MemberExpression' ? n.computed ? typeof n.property.value === 'string' ? n.property.value : null : n.property.name : null;
const same = (a, b) => a && b && generate(a) === generate(b);
const num = n => n?.type === 'Literal' && typeof n.value === 'number' ? n.value : n?.type === 'UnaryExpression' && n.operator === '-' ? -num(n.argument) : NaN;
const own = n => n?.type === 'MemberExpression' && n.object.type === 'ThisExpression';
const nodes = (root, type) => { const list = []; walk.full(root, n => { if (!type || n.type === type) list.push(n); }); return list; };
const direct = (root, type) => { const list = []; walk.fullAncestor(root, (n, _, a) => { if (n.type === type && [...a].reverse().find(fn) === root) list.push(n); }); return list; };
const hasLabel = (root, label) => nodes(root, 'Literal').some(n => n.value === label);
const flatOr = n => n?.type === 'LogicalExpression' && n.operator === '||' ? [...flatOr(n.left), ...flatOr(n.right)] : [n];
const protoType = n => n?.type === 'CallExpression' && n.arguments.length === 1 && n.arguments[0].type === 'Identifier' ? n.arguments[0].name : prop(n) === 'prototype' ? n.object.name : null;

function analyzeArcade(input, { exposeContract = false } = {}) {
    const source = input.replace(/^\uFEFF/, ''), sha256 = createHash('sha256').update(source).digest('hex');
    if (source.startsWith(MARKER)) return { format: FORMAT, sha256, sourceLength: source.length,
        status: JSON.parse(source.slice(MARKER.length, source.indexOf('*/'))), edits: [], templates: [] };
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    const parents = new WeakMap(), methods = [], functions = [], assignments = [], calls = [];
    const labelFunctions=new Map(),labelMethods=new Map();
    const indexedLabels=new Set(['shaftWeapon','scorpioWeapon','reloadTimeComponent','progressBarMaterial','provideDefaultTitlePosition']);
    walk.fullAncestor(ast, (n, _, a) => {
        parents.set(n, a[a.length - 2]);
        if (fn(n)) functions.push(n);
        if(n.type==='Literal'&&indexedLabels.has(n.value)){
            const nativeFunction=[...a].reverse().find(fn);
            const method=[...a].reverse().find(p=>p.type==='AssignmentExpression'&&fn(p.right)&&p.left.type==='MemberExpression'&&protoType(p.left.object));
            if(!labelFunctions.has(n.value))labelFunctions.set(n.value,new Set());
            if(nativeFunction)labelFunctions.get(n.value).add(nativeFunction);
            if(!labelMethods.has(n.value))labelMethods.set(n.value,new Set());
            if(method)labelMethods.get(n.value).add(method);
        }
        if (n.type === 'CallExpression') calls.push(n);
        if (n.type === 'AssignmentExpression') {
            assignments.push(n);
            if (n.operator === '=' && fn(n.right) && n.left.type === 'MemberExpression' && protoType(n.left.object))
                methods.push({ node: n, fn: n.right, type: protoType(n.left.object), name: prop(n.left) });
        }
    });
    const status = { hooked: false, ready: false, strategy: 'ast-plan', issues: [], panel: 'local-hud' };
    const fail = issue => { throw new Error(issue); };
    const unique = (items, issue) => items.length === 1 ? items[0] : fail(issue);
    const component = type => methods.filter(m => m.type === type);
    const owner = node => {
        for (let n = node; n; n = parents.get(n)) {
            if (n.type === 'AssignmentExpression' && fn(n.right) && n.left.type === 'MemberExpression' && protoType(n.left.object)) return n;
            if (n.type === 'FunctionDeclaration') return n;
        }
        return null;
    };
    const evidence = new Set();
    const scopeOf = node => { for (let n=parents.get(node);n;n=parents.get(n)) if(fn(n)) return n; };
    const observe = node => { const unit = owner(node); if (unit) evidence.add(unit); };
    const cache = assignment => {
        const value = assignment.right;
        if (!own(assignment.left) || value.type !== 'CallExpression' || value.arguments.length !== 1 || value.callee.type !== 'MemberExpression' ||
            value.callee.object.type !== 'CallExpression' || !own(value.callee.object.callee)) return null;
        const token = value.arguments[0];
        const type = token.type === 'Identifier' ? token.name : token.type === 'CallExpression' && token.callee.type === 'Identifier' && token.arguments.length === 1 && token.arguments[0].type === 'Identifier' ? token.arguments[0].name : null;
        return type ? { node: assignment, field: prop(assignment.left), type, optional: prop(value.callee), entity: prop(value.callee.object.callee), token: token.type === 'CallExpression' ? token.callee.name : '' } : null;
    };
    const caches = assignments.map(cache).filter(Boolean);
    const lookup = label => {
        const candidates = [];
        for (const f of [...(labelFunctions.get(label)||[])].filter(f=>f.params.length===1&&f.params[0].type==='Identifier')) {
            for (const variable of direct(f, 'VariableDeclarator')) {
                if (variable.init?.type !== 'MemberExpression' || variable.init.object.name !== f.params[0].name) continue;
                for (const item of caches.filter(item => item.field === prop(variable.init))) candidates.push({ ...item, getter: f.id?.name || '', getterNode: f });
            }
        }
        const types = [...new Set(candidates.map(c => c.type))];
        if (types.length !== 1) fail(`component-${label}-missing-or-ambiguous`);
        return candidates.find(c => c.getter) || candidates[0];
    };
    try {
        const shaft = lookup('shaftWeapon'), scorpio = lookup('scorpioWeapon'), reload = lookup('reloadTimeComponent');
        if (!reload.getter) fail('reload-getter-missing');
        const local = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.params.length === 1 && direct(f, 'ReturnStatement').some(r =>
            r.argument?.type === 'CallExpression' && r.argument.callee.type === 'MemberExpression' && r.argument.callee.object.name === f.params[0].name &&
            r.argument.arguments.length === 1 && r.argument.arguments[0].value === 'LocalTank')), 'local-tank-lookup-missing-or-ambiguous');
        observe(local); observe(shaft.getterNode); observe(shaft.node);
        const init = unique(methods.filter(m => labelMethods.get('progressBarMaterial')?.has(m.node)), 'local-hud-configuration-missing-or-ambiguous');
        const hud = component(init.type), initNodes = nodes(init.fn);
        const factory = unique(initNodes.filter(n => n.type === 'NewExpression' && n.arguments.length === 4 && hasLabel(n.arguments[2], 'progressBarMaterial')), 'local-hud-factory-missing-or-ambiguous');
        const variable = parents.get(factory);
        if (variable.type !== 'VariableDeclarator' || variable.id.type !== 'Identifier' || factory.callee.type !== 'Identifier') fail('local-hud-factory-variable-missing');
        const instance = variable.id;
        const stored = unique(initNodes.filter(n => n.type === 'AssignmentExpression' && n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && same(n.right, instance) && scopeOf(n)===scopeOf(factory)), 'local-hud-storage-missing-or-ambiguous');
        const createScope = (() => { for (let n = parents.get(stored); n; n = parents.get(n)) if (fn(n)) return n; })();
        const createCalls = nodes(createScope, 'CallExpression');
        const layer = unique(createCalls.filter(n => n.callee.type === 'Identifier' && n.arguments.length === 2 && same(n.arguments[0], instance)), 'local-hud-layer-missing-or-ambiguous');
        const fill = unique(createCalls.filter(n => n.callee.type === 'MemberExpression' && same(n.callee.object, instance) && n.arguments.length === 1), 'local-hud-progress-method-missing-or-ambiguous');
        const add = unique(createCalls.filter(n => n.callee.type === 'MemberExpression' && n.callee.object.type === 'CallExpression' && n.arguments.length === 1 && same(n.arguments[0], instance)), 'local-hud-scene-missing-or-ambiguous');
        const c = { shaft: shaft.type, scorpio: scorpio.type, localTank: local.id.name, hudType: init.type,
            barType: factory.callee.name, barField: prop(stored.left), createOwner: generate(stored.left.object), createAt: stored.end,
            layer: layer.callee.name, layerArg: generate(layer.arguments[1]), fill: prop(fill.callee), scene: add.callee.object.callee.name, add: prop(add.callee) };
        const materialGetter = factory.arguments[2].callee;
        const materialField = unique(direct(materialGetter, 'VariableDeclarator').filter(n => n.init?.type === 'MemberExpression' && n.init.object.name === materialGetter.params[0].name), 'material-getter-missing');
        const material = unique(nodes(createScope, 'AssignmentExpression').filter(n => prop(n.left) === prop(materialField.init) && n.right.type === 'NewExpression' && n.right.arguments.length === 4), 'arcade-material-missing-or-ambiguous').right;
        const color = material.arguments[2];
        if (color.type !== 'CallExpression' || color.callee.type !== 'Identifier' || color.arguments.length !== 1 || !Number.isFinite(num(color.arguments[0]))) fail('arcade-material-color-missing');
        const materialArgs = [...material.arguments];
        materialArgs[1] = { type: 'CallExpression', callee: color.callee, arguments: [{ type: 'Literal', value: 0xffffff }], optional: false };
        const factoryArgs = [...factory.arguments]; factoryArgs[2] = { ...material, arguments: materialArgs };
        c.factory = generate({ ...factory, arguments: factoryArgs });
        const barBindings = root => nodes(root, 'VariableDeclarator').filter(n => prop(n.init) === c.barField).map(n => ({ node: n, id: n.id, owner: n.init.object }));
        const assignedBindings = initNodes.filter(n => n.type === 'AssignmentExpression' && n.left.type === 'Identifier' && prop(n.right) === c.barField).map(n => ({ node: n, id: n.left, owner: n.right.object }));
        const frame = unique(assignedBindings.flatMap(b => initNodes.filter(n => n.type === 'CallExpression' && same(n.callee.object, b.id) && prop(n.callee) === c.fill && scopeOf(n)===scopeOf(b.node)).map(call => ({ ...b, call }))), 'local-hud-frame-missing-or-ambiguous');
        c.frameAt = frame.call.end; c.frameOwner = generate(frame.owner);
        const visible = unique(functions.flatMap(f => direct(f, 'VariableDeclarator').filter(n => prop(n.init) === c.barField).flatMap(b =>
            direct(f, 'CallExpression').filter(n => same(n.callee.object, b.id) && n.arguments.length === 1 && n.arguments[0].type === 'Identifier' && prop(n.callee) !== c.fill)
                .map(call => ({ binding: b, call })))), 'local-hud-visibility-missing-or-ambiguous');
        c.show = prop(visible.call.callee); c.visibleAt = visible.call.end; c.visibleOwner = generate(visible.binding.init.object); c.visibleArg = generate(visible.call.arguments[0]);
        observe(visible.call);
        const cleanup = unique(hud.flatMap(m => barBindings(m.fn).flatMap(b => nodes(m.fn, 'CallExpression').filter(n => n.callee.type === 'MemberExpression' && n.callee.object.type === 'CallExpression' && n.callee.object.callee.name === c.scene && same(n.callee.object.arguments[0], {type:'ThisExpression'}) && same(n.arguments[0], b.id)).map(call => ({ m, call })))), 'local-hud-cleanup-missing-or-ambiguous');
        c.remove = prop(cleanup.call.callee); c.cleanupEnd = cleanup.m.fn.body.end; observe(cleanup.m.node);
        const world = unique(initNodes.filter(n => n.type === 'AssignmentExpression' && own(n.left) && n.right.type === 'CallExpression' && n.right.arguments.length === 1 && n.right.arguments[0].type === 'CallExpression' && own(n.right.arguments[0].callee)), 'local-hud-world-missing-or-ambiguous');
        c.world = prop(world.right.arguments[0].callee);
        const optionalCandidates = caches.filter(k => k.type === init.type);
        const optional = unique([...new Map(optionalCandidates.map(k => [`${k.optional}:${k.token}`, k])).values()], 'hud-entity-lookup-missing-or-ambiguous');
        c.optional = optional.optional; c.token = optional.token; observe(optional.node);
        const barMethods = component(c.barType);
        const constructor = unique(functions.filter(f => f.type === 'FunctionDeclaration' && f.id.name === c.barType && f.params.length>=4 && [0,1].every(i=>direct(f,'CallExpression').some(n=>own(n.callee)&&same(n.arguments[0],f.params[i])))), 'native-bar-constructor-missing-or-ambiguous');
        const setters = [0, 1].map(i => unique(direct(constructor, 'CallExpression').filter(n => own(n.callee) && same(n.arguments[0], constructor.params[i])), 'native-bar-dimensions-missing-or-ambiguous'));
        [c.setWidth, c.setHeight] = setters.map(n => prop(n.callee)); observe(constructor);
        const getter = setter => {
            const m = unique(methods.filter(m => m.name === setter && direct(m.fn,'AssignmentExpression').some(n=>own(n.left)&&n.right.type==='CallExpression'&&generate(n.right.callee)==='Math.max')), 'native-bar-setter-missing');
            const field = unique(direct(m.fn, 'AssignmentExpression').filter(n => own(n.left) && n.right.type === 'CallExpression' && generate(n.right.callee) === 'Math.max'), 'native-bar-size-field-missing');
            c.baseBarType=m.type;c[setter===c.setWidth?'widthField':'heightField']=prop(field.left);
            const get = unique(component(m.type).filter(m => m.fn.params.length === 0 && direct(m.fn, 'ReturnStatement').some(n => own(n.argument) && prop(n.argument) === prop(field.left))), 'native-bar-size-getter-missing');
            observe(m.node); observe(get.node); return get.name;
        };
        c.width = getter(c.setWidth); c.height = getter(c.setHeight);
        const placement = unique(barMethods.filter(m => m.fn.params.length === 2 && direct(m.fn, 'CallExpression').some(n => n.callee.type === 'Identifier' && n.arguments.length === 3 && n.arguments[0].type === 'ThisExpression' && n.arguments[1].object?.name === m.fn.params[0].name && n.arguments[2].type === 'BinaryExpression' && same(n.arguments[2].right, m.fn.params[1]))), 'local-hud-placement-missing-or-ambiguous');
        c.place = placement.name;
        c.vector = prop(unique(direct(placement.fn, 'AssignmentExpression').filter(n => own(n.left.object)), 'native-bar-vector-missing-or-ambiguous').left.object); observe(placement.node);
        const renderer = unique(barMethods.flatMap(m => direct(m.fn, 'ReturnStatement').filter(n => n.argument?.type === 'NewExpression' && n.argument.arguments.length === 1 && n.argument.arguments[0].type === 'ThisExpression').map(n => ({m,type:n.argument.callee.name}))), 'native-bar-renderer-missing-or-ambiguous');
        observe(renderer.m.node);
        const projections = component(renderer.type).flatMap(m => {
            const list = nodes(m.fn, 'CallExpression');
            return list.filter(n => n.arguments.length === 2 && n.arguments[1].type === 'MemberExpression' && n.arguments[1].object.type === 'CallExpression' && own(n.callee.object)).flatMap(project =>
                list.filter(n => n.arguments.length >= 5 && [0,1,3,4].every(i => same(n.arguments[i].object, project.arguments[1]))).map(paint => ({m, method:prop(project.callee), x:prop(paint.arguments[0]), y:prop(paint.arguments[1]), width:prop(paint.arguments[3]), height:prop(paint.arguments[4])})));
        });
        c.projection = unique(projections, 'local-hud-projection-missing-or-ambiguous'); observe(c.projection.m.node);
        const layoutNames = initNodes.filter(n => n.type === 'CallExpression' && n.arguments.length === 2 && n.arguments[1].type === 'MemberExpression' && hud.some(m => m.name === prop(n.callee))).map(n => prop(n.callee));
        const layout = unique(hud.filter(m => layoutNames.includes(m.name)), 'local-hud-resize-missing-or-ambiguous'); observe(layout.node);
        const helpers = [...new Set(calls.filter(n=>n.callee.name===reload.getter).map(scopeOf))].filter(f=>f?.type==='FunctionDeclaration');
        const progress = unique(helpers.flatMap(f => {
            const divisions = direct(f, 'BinaryExpression').filter(n => n.operator === '-' && num(n.left) === 1 && n.right.type === 'CallExpression' && n.right.callee.type === 'Identifier');
            return divisions.flatMap(div => direct(f, 'VariableDeclarator').filter(n => same(n.id, div.right.arguments[0]) && n.init?.type === 'CallExpression' && n.init.callee.type === 'Identifier').map(sub => ({f,divide:div.right.callee.name,subtract:sub.init.callee.name})));
        }), 'native-reload-progress-missing-or-ambiguous');
        c.divide = progress.divide; c.subtract = progress.subtract; observe(progress.f); observe(reload.getterNode);
        const shaftMethods = component(c.shaft);
        const state = unique(shaftMethods.flatMap(m => nodes(m.fn, 'AssignmentExpression').filter(n => n.left.type === 'MemberExpression' && n.right.type === 'CallExpression' && n.right.arguments.length === 1 && n.right.arguments[0].type === 'NewExpression' && same(n.right.arguments[0].arguments[0], n.left.object)).map(n => ({m,type:n.right.arguments[0].callee.name}))), 'shaft-state-factory-missing-or-ambiguous');
        c.cooldownType = state.type; observe(state.m.node);
        const active = unique(shaftMethods.flatMap(m => direct(m.fn, 'VariableDeclarator').filter(n => own(n.init) && direct(m.fn, 'CallExpression').some(call => same(call.callee.object,n.id) && call.arguments.length === 0)).map(n => ({m,field:prop(n.init)}))), 'shaft-active-state-missing-or-ambiguous');
        c.active = active.field; observe(active.m.node);
        const frozen = unique(shaftMethods.flatMap(m => direct(m.fn, 'LogicalExpression').map(flatOr).filter(p => p.length === 3 && own(p[0]) && own(p[1]) && p[2].type === 'CallExpression' && p[2].arguments[0]?.type === 'ThisExpression').map(p => ({m,stunned:prop(p[0]),paused:prop(p[1])}))), 'shaft-frozen-state-missing-or-ambiguous');
        c.stunned = frozen.stunned; c.paused = frozen.paused; observe(frozen.m.node);
        const primary = unique(component(c.scorpio).flatMap(m => direct(m.fn, 'ReturnStatement').filter(n => n.argument?.type === 'BinaryExpression' && n.argument.operator === '>=' && num(n.argument.right) === 1 && n.argument.left.type === 'BinaryExpression' && n.argument.left.operator === '+' && own(n.argument.left.left) && n.argument.left.right.type === 'CallExpression' && n.argument.left.right.arguments[0]?.type === 'ThisExpression').map(n => ({m,field:prop(n.argument.left.left)}))), 'scorpio-primary-progress-missing-or-ambiguous');
        c.primary = primary.field; observe(primary.m.node);
        const cooldown = unique(component(c.cooldownType).flatMap(m => {
            const values=[...direct(m.fn,'VariableDeclarator').filter(n=>n.init?.type==='ConditionalExpression').map(n=>({id:n.id,value:n.init})),
                ...direct(m.fn,'AssignmentExpression').filter(n=>n.left.type==='Identifier'&&n.right.type==='ConditionalExpression').map(n=>({id:n.left,value:n.right}))];
            return values.map(n=>{let alternate=n.value;while(alternate.type==='ConditionalExpression')alternate=alternate.alternate;return {...n,alternate}})
                .filter(n=>n.alternate.type==='CallExpression'&&n.alternate.arguments.length===2&&n.alternate.arguments[0].type==='CallExpression'&&own(n.alternate.arguments[0].callee.object)&&same(n.alternate.arguments[1].object,n.alternate.arguments[0].callee.object))
                .flatMap(n=>direct(m.fn,'AssignmentExpression').filter(a=>own(a.left)&&same(a.right,n.id)).map(a=>({m,clock:prop(n.alternate.arguments[0].callee),duration:prop(n.alternate.arguments[1]),deadline:prop(a.left)})));
        }), 'shaft-cooldown-missing-or-ambiguous');
        c.clock = cooldown.clock; c.duration = cooldown.duration; c.deadline = cooldown.deadline; observe(cooldown.m.node);
        const compare = unique(component(c.cooldownType).flatMap(m => direct(m.fn, 'BinaryExpression').filter(n => n.operator === '>=' && num(n.right) === 0 && n.left.type === 'CallExpression' && n.left.callee.type === 'Identifier' && prop(n.left.arguments[0]?.callee) === c.clock && prop(n.left.arguments[1]) === c.deadline).map(n => ({m,name:n.left.callee.name}))), 'shaft-time-comparison-missing-or-ambiguous');
        c.compare = compare.name; observe(compare.m.node);
        const provider = unique(methods.filter(m => labelMethods.get('provideDefaultTitlePosition')?.has(m.node)), 'hud-position-provider-missing-or-ambiguous');
        const siblings = direct(provider.fn, 'AssignmentExpression').map(cache).filter(Boolean);
        const supplyCache = siblings[siblings.findIndex(k => k.type === init.type)+1];
        if (supplyCache) {
            const layouts = component(supplyCache.type).filter(m => m.fn.params.length === 2).flatMap(m => {
                const rows = direct(m.fn,'CallExpression').filter(n => n.callee.type === 'Identifier' && n.arguments.length === 7 && num(n.arguments[0])===0 && same(n.arguments[1],m.fn.params[0]) && same(n.arguments[2],m.fn.params[1]));
                return rows.length===2 && same(rows[0].callee,rows[1].callee) && num(rows[0].arguments[4])<0 && num(rows[1].arguments[4])>=0 ? [{m,call:rows[1]}] : [];
            });
            const supplyLayout = layouts.length===1 ? layouts[0] : null;
            const flags = supplyLayout ? component(supplyCache.type).flatMap(m => direct(m.fn,'ConditionalExpression').filter(n => own(n.test) && n.alternate.type==='CallExpression' && same(n.alternate.callee,supplyLayout.call.callee)).map(n => ({m,field:prop(n.test)}))) : [];
            if (supplyLayout && flags.length===1) {
                c.supplies={centered:flags[0].field,entity:supplyCache.entity,optional:supplyCache.optional,token:supplyCache.token,offset:{...supplyLayout.call.arguments[4],text:source.slice(supplyLayout.call.arguments[4].start,supplyLayout.call.arguments[4].end)}};
                observe(provider.node); observe(supplyLayout.m.node); observe(flags[0].m.node);
            }
        }
        if (!c.supplies) status.issues.push('centered-supplies-layout-missing-or-ambiguous');
        c.syncMethods=hud.filter(m => m!==init && m!==cleanup.m && (nodes(m.fn,'MemberExpression').some(n=>own(n)&&prop(n)===c.barField)||m===layout)).map(m=>({end:m.fn.body.end}));
        for(const m of hud) if(c.syncMethods.some(s=>s.end===m.fn.body.end)) observe(m.node);
        observe(init.node); observe(scorpio.node);
        const edits=renderArcadeEdits(c).map(e=>({...e,expected:source.slice(e.start,e.end),before:source.slice(Math.max(0,e.start-24),e.start),after:source.slice(e.end,e.end+24)}));
        const identifierRoles=['shaft','scorpio','cooldownType','localTank','scene','layer','compare','divide','subtract','token','barType','baseBarType','hudType'];
        const propertyRoles=['barField','optional','fill','add','remove','world','show','setWidth','setHeight','width','height','widthField','heightField','place','vector','active','stunned','paused','primary','clock','duration','deadline'];
        const sharedKeys=new Map([...identifierRoles.map(k=>[`identifier:${c[k]}`,k]),...propertyRoles.map(k=>[`property:${c[k]}`,k])].filter(([k])=>!k.endsWith(':')));
        sharedKeys.set(`property:${shaft.field}`,'shaftCache');sharedKeys.set(`property:${scorpio.field}`,'scorpioCache');sharedKeys.set(`property:${reload.field}`,'reloadCache');
        if(c.supplies) for(const k of ['centered','entity']) sharedKeys.set(`property:${c.supplies[k]}`,`supply${k}`);
        for(const k of ['method','x','y','width','height']) sharedKeys.set(`property:${c.projection[k]}`,`projection${k}`);
        const owners=new Map();
        // Export discovered native symbols wherever their AST-selected definitions use them.
        const priority=[owner(local),owner(shaft.getterNode),owner(reload.getterNode),owner(primary.m.node),owner(shaft.node),owner(scorpio.node),owner(scorpio.getterNode),owner(init.node)];
        const ordered=[...new Set([...priority,...evidence].filter(Boolean))];
        for(const unit of ordered){
            const keys=new Set();walk.fullAncestor(unit,(n,_,a)=>{
                const p=a[a.length-2];
                if(n.type==='Identifier') keys.add(`${p?.type==='MemberExpression'&&p.property===n?'property':'identifier'}:${n.name}`);
                if(n.type==='MemberExpression'&&prop(n)) keys.add(`property:${prop(n)}`);
                if(n.type==='Literal'&&p?.type==='MemberExpression'&&p.computed&&p.property===n) keys.add(`property:${n.value}`);
            });
            owners.set(unit,Object.fromEntries([...sharedKeys].filter(([k])=>keys.has(k)).map(([k,role])=>[role,k])));
        }
        status.hooked=true;status.ready=true;status.runtimeControls=true;
        edits.unshift({start:0,end:0,expected:'',before:'',after:source.slice(0,24),text:`${MARKER}${JSON.stringify(status)}*/\n`});
        edits.sort((a,b)=>a.start-b.start||a.end-b.end);
        for(let i=1;i<edits.length;i++)if(edits[i-1].end>edits[i].start)fail('overlapping-arcade-edits');
        return {format:FORMAT,sha256,sourceLength:source.length,status,edits,templates:compileTemplates(source,edits,owners,{evidence:true,sharedKeys}),...(exposeContract?{contract:c}:{})};
    } catch(error){status.hooked=false;status.ready=false;status.issues.push(error.message);return {format:FORMAT,sha256,sourceLength:source.length,status,edits:[],templates:[]};}
}
module.exports={analyzeArcade,FORMAT,MARKER};
