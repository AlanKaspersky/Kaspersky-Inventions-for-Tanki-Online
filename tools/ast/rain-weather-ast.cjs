const {parse}=require('acorn'),walk=require('acorn-walk'),{createHash}=require('node:crypto');
const {compileTemplates}=require('./overdrive-templates.cjs');
const {weatherScene}=require('./weather-scene-ast.cjs');
const prop=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;
const nodes=(root,type)=>{const out=[];walk.full(root,n=>{if(n.type===type)out.push(n);});return out;};
function analyzeRain(source){
 const plan={format:'ki-rain-v2',sourceLength:source.length,sha256:createHash('sha256').update(source).digest('hex'),status:{ready:false,issues:[]},edits:[],templates:[],schema:{}};
 const unique=(xs,label)=>{if(xs.length!==1)throw Error(label+':'+xs.length);return xs[0];};
 try {
  const ast=parse(source,{ecmaVersion:'latest'}),methods=[],functions=[],scopes=new WeakMap();
  const isFn=n=>['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
  walk.fullAncestor(ast,(n,_,a)=>{
   if(isFn(n)||n.type==='NewExpression')scopes.set(n,a.slice(0,-1).findLast(isFn));
   if(n.type==='FunctionDeclaration')functions.push(n);
   if(n.type==='AssignmentExpression'&&n.right.type==='FunctionExpression')methods.push(n);
  });
  const renderer=unique(methods.filter(m=>m.right.params.length===2&&[32926,17664].every(v=>nodes(m.right,'Literal').some(n=>n.value===v))),'rain-renderer');
  const fn=renderer.right,cameraArg=fn.params[1].name;
  const vpCall=unique(nodes(fn,'CallExpression').filter(c=>c.arguments.length===3&&c.arguments[2].value===32&&c.arguments[0].type==='MemberExpression'&&c.arguments[0].object.name===cameraArg),'camera-vp-upload');
  const vp=prop(vpCall.arguments[0]);
  const enumNode=unique(nodes(ast,'NewExpression').filter(n=>n.arguments[0]?.value==='SpritesOnTop'&&n.arguments[1]?.value===18),'sprite-layer');
  let enumBinding,enumAssignment;
  walk.full(ast,n=>{if(n.type==='AssignmentExpression'&&n.right===enumNode){enumBinding=n.left.name;enumAssignment=n;}});
  const moduleScope=scopes.get(scopes.get(enumNode));
  const helper=unique(functions.filter(f=>scopes.get(f)===moduleScope&&nodes(f,'ReturnStatement').some(r=>r.argument?.type==='SequenceExpression'&&r.argument.expressions.at(-1)?.name===enumBinding)),'sprite-layer-helper');
  const boundary=unique(nodes(fn,'VariableDeclaration').filter(v=>v.declarations.some(d=>d.init?.type==='MemberExpression'&&nodes(d.init,'CallExpression').some(c=>c.callee.name===helper.id.name))),'before-hud-boundary');
  const skyEnum=unique(nodes(ast,'NewExpression').filter(n=>n.arguments[0]?.value==='SkyBox'&&n.arguments[1]?.value===5),'sky-layer');
  let skyBinding,skyAssignment;
  walk.full(ast,n=>{if(n.type==='AssignmentExpression'&&n.right===skyEnum){skyBinding=n.left.name;skyAssignment=n;}});
  const skyHelper=unique(functions.filter(f=>scopes.get(f)===moduleScope&&nodes(f,'ReturnStatement').some(r=>r.argument?.type==='SequenceExpression'&&r.argument.expressions.at(-1)?.name===skyBinding)),'sky-layer-helper');
  const skyDeclaration=unique(fn.body.body.filter(n=>n.type==='VariableDeclaration'&&nodes(n,'CallExpression').some(c=>c.callee.name===skyHelper.id.name)),'sky-layer-declaration');
  const skyIndex=fn.body.body.indexOf(skyDeclaration),afterSky=fn.body.body[skyIndex+2];
  const skyLoop=fn.body.body[skyIndex+1];
  if(!afterSky||afterSky.start>=boundary.start||skyLoop?.type!=='IfStatement'||nodes(skyLoop,'DoWhileStatement').length!==1)throw Error('sky-before-transparent-contract');
  // The validated contract is intentionally small. Evidence templates below bind
  // native field names across renderer, camera, context and fog methods on updates.
  const schema={gl:'y39_1',context:'f75_1',vp,camera:'t35_1',x:'f20_1',y:'g20_1',z:'h20_1',
   settings:'y38_1',fogEnabled:'n3o_1',mapFog:'o3o_1',fogStart:'c3a_1',fogEnd:'b3a_1',fogColor:'d3a_1',red:'l2r_1',green:'m2r_1',blue:'n2r_1',alpha:'o2r_1'};
  const glMethod=unique(methods.filter(m=>nodes(m.right,'CallExpression').some(c=>prop(c.callee)==='depthRange')),'webgl-context');
  if(!nodes(glMethod.right,'MemberExpression').some(n=>prop(n)===schema.context))throw Error('context-field-contract');
  const view=unique(methods.filter(m=>nodes(m.right,'MemberExpression').some(n=>prop(n)===schema.camera)&&[schema.x,schema.y,schema.z].every(p=>nodes(m.right,'MemberExpression').some(n=>prop(n)===p))&&
    nodes(m.right,'AssignmentExpression').filter(n=>n.left.computed&&n.left.property.value===15&&n.right.value===1).length===1&&nodes(m.right,'Literal').some(n=>n.value===13)),'camera-view-contract');
  const fog=unique(methods.filter(m=>nodes(m.right,'CallExpression').some(c=>prop(c.callee)==='m3f')&&nodes(m.right,'MemberExpression').some(n=>prop(n)===schema.fogColor)&&
    nodes(m.right,'MemberExpression').some(n=>prop(n)===schema.red)&&nodes(m.right,'MemberExpression').some(n=>prop(n)==='u62_1')),'fog-colour-contract');
  const fogFlags=unique(methods.filter(m=>m.right.params.length===1&&nodes(m.right,'MemberExpression').some(n=>prop(n)===schema.fogEnabled)&&nodes(m.right,'MemberExpression').some(n=>prop(n)===schema.mapFog)&&
    nodes(m.right,'ReturnStatement').some(n=>n.argument?.type==='NewExpression'&&n.argument.arguments.length===9)&&source.slice(m.start,m.end).length<1500),'fog-option-contract');
  const shared=new Map(Object.entries(schema).map(([key,value])=>['property:'+value,key]));
  // The callback is inserted inside the native function, so arguments remain valid
  // when its local parameter names change. Never template the entire render loop:
  // its hundreds of backreferences overflow regexp stacks on real minified bundles.
  const edit=(at,stage)=>({start:at,end:at,expected:'',before:source.slice(at-24,at),after:source.slice(at,at+24),text:`;try{window.__kaspRain?.frame(this,arguments[0],arguments[1],__KI_RAIN_SCHEMA__,"${stage}");}catch(_kiRainError){}`});
  const templateEdits=[edit(skyLoop.end,'sky'),edit(boundary.start,'weather')];
  plan.edits=templateEdits.map(e=>({...e,text:e.text.replace('__KI_RAIN_SCHEMA__',JSON.stringify(schema))}));
  const inside=(outer,inner)=>outer.start<=inner.start&&outer.end>=inner.end;
  const vpEvidence=nodes(fn,'SequenceExpression').filter(n=>inside(n,vpCall)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0]||vpCall;
  const distance=unique(nodes(fn,'AssignmentExpression').filter(n=>n.left.type==='MemberExpression'&&
    n.right.type==='BinaryExpression'&&n.right.operator==='/'&&n.right.left.value===1&&
    nodes(n.right,'MemberExpression').some(p=>prop(p)===schema.fogStart)&&nodes(n.right,'MemberExpression').some(p=>prop(p)===schema.fogEnd)),'fog-distance-assignment');
  const helperReturn=nodes(helper,'ReturnStatement').find(r=>r.argument?.type==='SequenceExpression'&&r.argument.expressions.at(-1)?.name===enumBinding);
  const helperEvidence={start:helper.start,end:helperReturn.argument.end};
  const skyReturn=nodes(skyHelper,'ReturnStatement').find(r=>r.argument?.type==='SequenceExpression'&&r.argument.expressions.at(-1)?.name===skyBinding);
  const skyEvidence={start:skyHelper.start,end:skyReturn.argument.end},skyPass={type:'BlockStatement',body:[skyDeclaration,skyLoop],start:skyDeclaration.start,end:skyLoop.end};
  const owners=new Map([[skyAssignment,{skyEnum:'identifier:'+skyBinding}],[skyEvidence,{skyEnum:'identifier:'+skyBinding,skyLayer:'identifier:'+skyHelper.id.name}],
    [skyPass,{skyLayer:'identifier:'+skyHelper.id.name}],[enumAssignment,{spriteEnum:'identifier:'+enumBinding}],[helperEvidence,{spriteEnum:'identifier:'+enumBinding,spriteLayer:'identifier:'+helper.id.name}]]);
  for(const owner of [vpEvidence,distance,view,glMethod,fog,fogFlags,boundary]){
   const properties=new Set(nodes(owner,'MemberExpression').map(prop));
   owners.set(owner,Object.fromEntries([...shared].filter(([key])=>properties.has(key.slice(9))).map(([key,role])=>[role,key])));
  }
  owners.get(boundary).spriteLayer='identifier:'+helper.id.name;
  owners.get(glMethod).depthRangeMethod='property:depthRange';
  plan.templates=compileTemplates(source,templateEdits,owners,{evidence:true,sharedKeys:shared});
  // A printer can wrap a comma-expression statement in parentheses. Retain its
  // complete token contract, allowing just those optional wrapper parentheses.
  for(const owner of [view,fog,skyPass]){
    const sequences=nodes(owner,'ExpressionStatement').map(n=>n.expression).filter(n=>n.type==='SequenceExpression');
    if(!sequences.length)continue;
    const markers=sequences.map(n=>({start:n.start,end:n.end,text:''}));
    const actual=owner===skyPass?[templateEdits[0]]:[];
    const [template]=compileTemplates(source,[...markers,...actual],new Map([[owner,owners.get(owner)]]),{evidence:true,sharedKeys:shared});
    for(let i=0;i<markers.length;i++)template.pattern=template.pattern.replace(`(?<e${i}start>)`,'\\(?\\s*').replace(`(?<e${i}end>)`,'\\s*\\)?');
    template.edits=template.edits.slice(markers.length);
    const role=owner===view?'camera':owner===fog?'fogColor':'skyLayer';
    const index=plan.templates.findIndex(t=>t.roles[role]&&(owner!==skyPass||t.edits.length));plan.templates[index]=template;
  }
  // Printers may parenthesize a comma expression after return. This prefix ends
  // at the expression itself, before either the closing paren or semicolon.
  for(const template of plan.templates){
    template.pattern=template.pattern.replaceAll('\\s*\\}','\\s*;?\\s*\\}');
    if(template.roles.depthRangeMethod)template.pattern=template.pattern.replace(`(?<${template.roles.depthRangeMethod}>[$A-Z_a-z][$\\w]*)`,`(?<${template.roles.depthRangeMethod}>depthRange)`);
    if(template.roles.spriteEnum&&template.roles.spriteLayer||template.roles.skyEnum&&template.roles.skyLayer){
      template.pattern=template.pattern.replace('return(?![$\\w])\\s*','return(?![$\\w])\\s*\\(?\\s*');
      template.search=template.roles.skyLayer?{literal:'SkyBox',margin:Math.abs(skyHelper.start-skyEnum.start)*2+1024}
        :{literal:'SpritesOnTop',margin:Math.abs(helper.start-enumNode.start)*2+1024};
    }
  }
  if(!plan.templates.length)throw Error('rain-templates');
  if(nodes(ast,'Literal').some(n=>n.value==='CollisionGeometry [')){
   const scene=weatherScene(source,{methods,functions,scopes,renderer:fn,schema});
   plan.scene={capabilities:scene.capabilities,issues:scene.issues};
   plan.edits.push(...scene.edits.map(e=>({...e,text:e.text.replaceAll('__KI_RAIN_SCHEMA__',JSON.stringify(schema))})));
   plan.edits.sort((a,b)=>a.start-b.start||a.end-b.end);plan.templates.push(...scene.templates);
  }
  plan.schema=schema;plan.status.ready=true;
 }catch(e){plan.status.issues.push(e.message);plan.edits=[];plan.templates=[];}
 return plan;
}
module.exports={analyzeRain};
