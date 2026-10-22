const {parse}=require('acorn');
const walk=require('acorn-walk');
const {generate}=require('astring');
const {createHash}=require('node:crypto');
const {compileTemplates}=require('./overdrive-templates.cjs');
const prop=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;
const own=n=>n?.type==='MemberExpression'&&n.object.type==='ThisExpression';
const fn=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const nodes=(root,type)=>{const result=[];walk.full(root,n=>{if(n.type===type)result.push(n);});return result;};
const direct=(root,type)=>{const result=[];walk.fullAncestor(root,(n,_,a)=>{if(n.type===type&&a.findLast(fn)===root)result.push(n);});return result;};
const proto=n=>n?.type==='CallExpression'&&n.arguments.length===1&&n.arguments[0].type==='Identifier'?n.arguments[0].name:
    prop(n)==='prototype'&&n.object.type==='Identifier'?n.object.name:null;
function analyzeBoxPickup(source){
    const plan={format:'ki-box-pickup-v1',sourceLength:source.length,sha256:createHash('sha256').update(source).digest('hex'),
        status:{ready:false,issues:[]},edits:[],templates:[]};
    const unique=(list,issue)=>{if(list.length!==1)throw Error(issue+':'+list.length);return list[0];};
    try{
        const ast=parse(source,{ecmaVersion:'latest'}),methods=[],constructors=[],calls=[],callOwners=new WeakMap(),callScopes=new WeakMap();
        const scopes=new WeakMap();
        walk.ancestor(ast,{
            FunctionDeclaration(n,a){constructors.push(n);scopes.set(n,a.slice(0,-1).findLast(fn));},
            AssignmentExpression(n,a){const type=proto(n.left?.object);if(type&&n.right.type==='FunctionExpression')methods.push({node:n,type,name:prop(n.left),fn:n.right,scope:a.findLast(fn)});},
            CallExpression(n,a){calls.push(n);callOwners.set(n,a.slice(0,-1).findLast(fn));callScopes.set(n,a.filter(fn));}
        });
        let activeScope;
        const of=type=>methods.filter(m=>m.type===type&&m.scope===activeScope);
        const schema={},owners=new Map(),shared=new Map();
        const observe=m=>owners.set(m.node||m,{});
        const role=(key,value,kind='property')=>{if(!value||!/^[\w$]+$/.test(value))throw Error('missing-'+key);schema[key]=value;shared.set(kind+':'+value,key);return value;};
        const tick=unique(methods.filter(m=>m.fn.params.length===2&&[300,.8,.2].every(value=>nodes(m.fn,'Literal').some(n=>n.value===value))&&
            m.fn.body.body.some(n=>n.type==='IfStatement'&&n.alternate?.type==='BlockStatement')),'pickup-update');
        activeScope=tick.scope;
        const native=of(tick.type);observe(tick);
        const branch=unique(tick.fn.body.body.filter(n=>n.type==='IfStatement'&&n.alternate?.type==='BlockStatement'),'pickup-finish').alternate;
        const cleanupCall=unique(nodes(branch,'CallExpression').filter(n=>own(n.callee)&&n.arguments.length===0),'pickup-cleanup-call');
        const cleanup=unique(native.filter(m=>m.name===prop(cleanupCall.callee)),'pickup-cleanup');observe(cleanup);
        const start=unique(native.filter(m=>m.fn.params.length===2&&direct(m.fn,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='Identifier'&&m.fn.params.some(p=>p.name===n.right.name)).length===2),'pickup-start');observe(start);
        const assigns=direct(start.fn,'AssignmentExpression');
        role('box',prop(unique(assigns.filter(n=>own(n.left)&&n.right.name===start.fn.params[0].name),'pickup-box').left));
        role('callback',prop(unique(assigns.filter(n=>own(n.left)&&n.right.name===start.fn.params[1].name),'pickup-callback').left));
        role('world',prop(unique(direct(start.fn,'CallExpression').filter(n=>own(n.callee.object)&&n.arguments.length===1&&n.arguments[0].type==='ThisExpression'),'pickup-world').callee.object));
        const pickupCtor=unique(constructors.filter(c=>c.id.name===tick.type&&scopes.get(c)===activeScope),'pickup-constructor');observe(pickupCtor);
        const rotationRead=direct(start.fn,'CallExpression').filter(c=>c.callee.object?.name===start.fn.params[0].name&&c.arguments.length===1&&own(c.arguments[0])).sort((a,b)=>a.start-b.start)[0];
        if(!rotationRead)throw Error('box-rotation-getter');
        unique(nodes(pickupCtor,'AssignmentExpression').filter(n=>own(n.left)&&prop(n.left)===prop(rotationRead.arguments[0])&&n.right.type==='NewExpression'),'pickup-rotation-vector');
        const rotationMethods=methods.filter(m=>m.scope===activeScope&&m.name===prop(rotationRead.callee)&&m.fn.params.length===1);
        const rotationGetter=unique(rotationMethods.filter(m=>nodes(m.fn,'CallExpression').some(c=>own(c.arguments[0]?.object))),'box-rotation-method');observe(rotationGetter);
        const base=of(rotationGetter.type);
        const rotationField=unique(nodes(rotationGetter.fn,'MemberExpression').filter(n=>own(n.object)),'rotation-field');
        role('render',prop(rotationField.object));role('rotation',prop(rotationField));
        const transform=unique(base.filter(m=>m.fn.params.length===1&&direct(m.fn,'CallExpression').some(c=>c.arguments.length===2&&c.arguments.every(a=>own(a.object))&&
            c.arguments[0].object.property.name===schema.render&&prop(c.arguments[0])===schema.rotation)),'box-transform');observe(transform);
        const transformCall=unique(direct(transform.fn,'CallExpression').filter(c=>c.arguments.length===2),'box-transform-call');
        role('position',prop(transformCall.arguments[1]));
        const positionSetter=unique(base.filter(m=>m.fn.params.length===3&&direct(m.fn,'CallExpression').some(c=>own(c.callee.object?.object)&&prop(c.callee.object.object)===schema.render&&prop(c.callee.object)===schema.position&&c.arguments.every((a,i)=>a.name===m.fn.params[i]?.name))),'position-setter');observe(positionSetter);
        role('vectorSet',prop(unique(direct(positionSetter.fn,'CallExpression'),'position-vector-call').callee));
        const scaleGetter=unique(methods.filter(m=>m.scope===activeScope&&m.fn.params.length===0&&direct(m.fn,'ReturnStatement').some(n=>own(n.argument?.object?.object)&&prop(n.argument.object.object)===schema.render&&prop(n.argument.object)!==schema.position&&prop(n.argument.object)!==schema.rotation)),'box-scale-getter');observe(scaleGetter);
        role('x',prop(direct(scaleGetter.fn,'ReturnStatement')[0].argument));
        const vectorSets=methods.filter(m=>m.name===schema.vectorSet&&m.fn.params.length===3&&direct(m.fn,'AssignmentExpression').some(n=>own(n.left)&&prop(n.left)===schema.x&&n.right.name===m.fn.params[0].name));
        const components=new Map();
        for(const m of vectorSets){
            const fields=m.fn.params.map(p=>direct(m.fn,'AssignmentExpression').filter(n=>own(n.left)&&n.right.name===p.name)).map(list=>list.length===1?prop(list[0].left):null);
            if(fields.every(Boolean))components.set(fields.join(','),m);
        }
        const vectorSet=unique([...components.values()],'vector-set');
        vectorSet.fn.params.slice(0,3).forEach((p,i)=>role(['x','y','z'][i],prop(unique(direct(vectorSet.fn,'AssignmentExpression').filter(n=>own(n.left)&&n.right.name===p.name),'vector-component').left)));
        role('scale',prop(direct(scaleGetter.fn,'ReturnStatement')[0].argument.object));
        const boxMethods=of(scaleGetter.type);
        const release=unique(boxMethods.filter(m=>m.fn.params.length===0&&direct(m.fn,'CallExpression').some(c=>own(c.callee.object)&&c.arguments.length===1&&c.arguments[0].type==='ThisExpression')),'box-release');observe(release);
        const returnCall=unique(direct(release.fn,'CallExpression').filter(c=>own(c.callee.object)),'box-pool-return');
        role('pool',prop(returnCall.callee.object));role('release',release.name);
        const poolGet=unique(base.filter(m=>m.fn.params.length===1&&direct(m.fn,'AssignmentExpression').some(n=>own(n.left)&&n.right.name===m.fn.params[0].name)&&
            direct(m.fn,'CallExpression').some(c=>c.callee.object?.name===m.fn.params[0].name&&c.arguments.length===1&&own(c.arguments[0])&&prop(c.arguments[0])===schema.render)),'box-attach');observe(poolGet);role('attach',poolGet.name);
        const detach=unique(direct(release.fn,'CallExpression').filter(c=>own(c.callee)&&c.arguments.length===0),'box-detach-call');role('detach',prop(detach.callee));
        observe(unique(base.filter(m=>m.name===schema.detach),'box-detach'));
        const reset=unique(boxMethods.filter(m=>m.fn.params.length===0&&direct(m.fn,'CallExpression').some(c=>own(c.callee)&&c.arguments.length===3&&c.arguments.every(a=>a.value===0))),'box-reset');observe(reset);role('reset',reset.name);
        const materialCall=unique(direct(reset.fn,'CallExpression').filter(c=>own(c.callee.object)&&c.arguments.length===1&&own(c.arguments[0])),'box-material');role('material',prop(materialCall.arguments[0]));
        const colorReset=unique(direct(reset.fn,'CallExpression').filter(c=>own(c.callee)&&c.arguments.length===1&&c.arguments[0].value===null),'box-color-reset');role('colorReset',prop(colorReset.callee));
        const colorMethod=unique(boxMethods.filter(m=>m.name===schema.colorReset),'box-color-method');observe(colorMethod);
        const glowCall=unique(nodes(colorMethod.fn,'CallExpression').filter(c=>own(c.callee.object?.object)&&prop(c.callee.object.object)===schema.material&&c.arguments.length===4&&c.arguments.every(a=>a.value===0)),'box-glow');role('glow',prop(glowCall.callee.object));role('colorSet',prop(glowCall.callee));
        const scaleCall=unique(direct(reset.fn,'CallExpression').filter(c=>own(c.callee)&&c.arguments[0]?.value===1&&
            boxMethods.some(m=>m.name===prop(c.callee)&&direct(m.fn,'CallExpression').some(c=>own(c.callee.object)&&prop(c.callee.object)===schema.render))),'box-uniform-scale');role('uniformScale',prop(scaleCall.callee));observe(unique(boxMethods.filter(m=>m.name===schema.uniformScale),'uniform-scale'));
        const opacityCandidates=nodes(tick.fn,'CallExpression').filter(c=>c.arguments.length===1&&c.callee.type==='MemberExpression'&&c.callee.object.type==='Identifier'&&
            base.some(m=>m.name===prop(c.callee)&&direct(m.fn,'AssignmentExpression').some(n=>own(n.left)&&n.right.name===m.fn.params[0]?.name)));
        const opacity=unique(opacityCandidates,'box-opacity');role('opacity',prop(opacity.callee));observe(unique(base.filter(m=>m.name===schema.opacity),'box-opacity-method'));
        const boxCtor=unique(constructors.filter(c=>c.id.name===scaleGetter.type&&scopes.get(c)===activeScope),'box-constructor');observe(boxCtor);
        // Factory uses the same native pool as the selected pickup box. It never shares a live renderer.
        const factoryOwner=unique(methods.filter(m=>m.scope===activeScope&&nodes(m.fn,'NewExpression').some(n=>n.callee.name===scaleGetter.type)),'box-factory-owner');observe(factoryOwner);
        const checkout=unique(direct(factoryOwner.fn,'ReturnStatement').flatMap(n=>nodes(n,'CallExpression')).filter(c=>c.callee.object?.type==='CallExpression'&&c.arguments.length===0),'box-pool-factory');
        role('acquire',prop(checkout.callee));
        const add=(at,text)=>plan.edits.push({start:at,end:at,expected:'',text,before:source.slice(Math.max(0,at-24),at),after:source.slice(at,at+24)});
        const pickupOwner=unique(methods.filter(m=>m.scope===activeScope&&nodes(m.fn,'CallExpression').some(c=>prop(c.callee)===start.name&&c.arguments.length===2)),'bonus-pickup-owner');observe(pickupOwner);
        const bonusCtor=unique(constructors.filter(c=>c.id.name===pickupOwner.type&&scopes.get(c)===activeScope),'bonus-constructor');
        const hitFields=new Set(nodes(bonusCtor,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='NewExpression').map(n=>prop(n.left)));
        const rays=calls.filter(c=>callScopes.get(c).includes(activeScope)&&c.arguments.length===5&&c.arguments[2].value===1e10&&c.arguments[3].value===16&&hitFields.has(prop(c.arguments[4])));
        const ray=unique(rays.filter(c=>{
            const owner=callOwners.get(c),hit=prop(c.arguments[4]);
            return nodes(owner,'CallExpression').some(n=>prop(n.callee.object)===hit&&n.arguments.length===0);
        }),'ground-ray');
        const rayOwner=callOwners.get(ray);observe(rayOwner);
        role('ray',prop(ray.callee));
        const hitField=prop(ray.arguments[4]);
        const rayOwners=[...new Set(rays.filter(c=>prop(c.arguments[4])===hitField&&prop(c.callee)===schema.ray).map(c=>callOwners.get(c)))];
        rayOwners.forEach(observe);
        const resultFields=[...new Set(rayOwners.flatMap(owner=>nodes(owner,'MemberExpression').filter(n=>prop(n)===schema.z&&prop(n.object?.object)===hitField).map(n=>prop(n.object))))];
        role('rayPosition',unique(resultFields,'ray-position'));
        role('rayReset',prop(unique(nodes(rayOwner,'CallExpression').filter(c=>prop(c.callee.object)===hitField&&c.arguments.length===0),'ray-reset').callee));
        const hitCtor=unique(constructors.filter(c=>scopes.get(c)===activeScope&&nodes(c,'AssignmentExpression').some(n=>own(n.left)&&prop(n.left)===hitField&&n.right.type==='NewExpression')),'ray-result-constructor');observe(hitCtor);
        add(hitCtor.body.end-1,`;try{window.__kaspBoxPickup?.captureRay(this.${hitField});}catch(_kaspBoxError){}`);
        const setup=`;try{window.__kaspBoxPickup?.start(this,${start.fn.params[0].name},${JSON.stringify(schema)});}catch(_kaspBoxError){}`;
        add(start.fn.body.end-1,setup);
        const finish=source.slice(branch.start+1,branch.end-1);
        add(tick.fn.body.start+1,`if(window.__kaspBoxPickup?.frame(this,()=>{${finish}}))return;`);
        add(cleanup.fn.body.start+1,'try{window.__kaspBoxPickup?.stop(this);}catch(_kaspBoxError){}');
        plan.edits.sort((a,b)=>a.start-b.start);
        shared.set('identifier:'+tick.type,'pickupType');
        shared.set('identifier:'+scaleGetter.type,'boxType');
        shared.set('identifier:'+rotationGetter.type,'baseType');
        shared.set('identifier:'+factoryOwner.type,'factoryType');
        shared.set('identifier:'+pickupOwner.type,'bonusType');
        const pickupPool=unique(constructors.filter(c=>scopes.get(c)===activeScope&&nodes(c,'Literal').some(n=>n.value==='recyclePickupAnimation')&&nodes(c,'NewExpression').some(n=>n.callee.name===tick.type)),'pickup-animation-pool');
        const ordered=new Map([[pickupPool,{}],[factoryOwner.node,{}],[boxCtor,{}],[transform.node,{}],[pickupCtor,{}],[hitCtor,{}],...owners]);
        for(const [owner] of ordered){
            const properties=new Set(nodes(owner,'MemberExpression').map(prop));
            const identifiers=new Set(nodes(owner,'Identifier').map(n=>n.name));
            ordered.set(owner,Object.fromEntries([...shared].filter(([key])=>key.startsWith('property:')?properties.has(key.slice(9)):identifiers.has(key.slice(11))).map(([key,value])=>[value,key])));
        }
        plan.templates=compileTemplates(source,plan.edits,ordered,{evidence:true,sharedKeys:shared});
        plan.schema=schema;plan.status.ready=true;
    }catch(error){plan.status.issues.push(error.message);plan.edits=[];plan.templates=[];}
    return plan;
}
module.exports={analyzeBoxPickup};
