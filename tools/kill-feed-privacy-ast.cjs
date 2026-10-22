const {parse}=require('acorn'),walk=require('acorn-walk'),{createHash}=require('node:crypto');
const {compileTemplates}=require('./overdrive-templates.cjs');
const fn=n=>n&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type);
const prop=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;
const own=n=>n?.type==='MemberExpression'&&n.object.type==='ThisExpression';
const nodes=(root,type)=>{const out=[];walk.full(root,n=>{if(n.type===type)out.push(n);});return out;};
const direct=(root,type)=>{const out=[];walk.fullAncestor(root,(n,_,a)=>{if(n.type===type&&a.findLast(fn)===root)out.push(n);});return out;};
const proto=n=>n?.type==='CallExpression'&&n.arguments.length===1&&n.arguments[0].type==='Identifier'?n.arguments[0].name:prop(n)==='prototype'?n.object.name:null;
// Resolve local aliases in the native glyph lookup, without relying on mangled field names.
function memberPath(node,root,bindings,seen=new Set()){
 if(node?.type==='Identifier'){
  if(node.name===root)return [];
  if(seen.has(node.name))return null;
  return memberPath(bindings.get(node.name),root,bindings,new Set([...seen,node.name]));
 }
 if(node?.type!=='MemberExpression'||node.computed)return null;
 const prefix=memberPath(node.object,root,bindings,seen);
 return prefix&&[...prefix,prop(node)];
}
function analyzeKillFeedPrivacy(source){
 const plan={format:'ki-kill-feed-privacy-v1',sourceLength:source.length,sha256:createHash('sha256').update(source).digest('hex'),status:{ready:false,issues:[]},edits:[],templates:[]};
 const unique=(list,label)=>{if(list.length!==1)throw Error(label+':'+list.length);return list[0];};
 try{
  const ast=parse(source,{ecmaVersion:'latest'}),functions=[],methods=[],scopes=new WeakMap();
  walk.ancestor(ast,{
   FunctionDeclaration(n,a){functions.push(n);scopes.set(n,a.slice(0,-1).findLast(fn));},
   AssignmentExpression(n,a){const type=proto(n.left?.object);if(type&&n.right.type==='FunctionExpression')methods.push({node:n,fn:n.right,type,scope:a.findLast(fn)});}
  });
  const ctor=unique(functions.filter(f=>direct(f,'Literal').filter(n=>n.value==='ActionsLog').length>=4&&nodes(f,'NewExpression').some(n=>n.callee.name==='Int16Array'&&n.arguments[0]?.value===1680)),'action-log-renderer');
  const scope=scopes.get(ctor);
  const dirty=prop(unique(direct(ctor,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='UnaryExpression'&&n.right.operator==='!'&&n.right.argument.value===1),'action-log-dirty').left);
  const render=unique(methods.filter(m=>m.scope===scope&&m.type===ctor.id.name&&m.fn.params.length===2&&direct(m.fn,'AssignmentExpression').some(n=>own(n.left)&&prop(n.left)===dirty&&n.right.type==='UnaryExpression'&&n.right.operator==='!'&&n.right.argument.value===1)),'action-log-update');
  const callees=new Set(nodes(render.fn,'CallExpression').filter(n=>n.callee.type==='Identifier').map(n=>n.callee.name));
  const dispatcher=unique(functions.filter(f=>scopes.get(f)===scope&&callees.has(f.id.name)&&nodes(f,'BinaryExpression').filter(n=>n.operator==='instanceof').length===2),'action-log-parts');
  const called=new Set(nodes(dispatcher,'CallExpression').filter(n=>n.callee.type==='Identifier').map(n=>n.callee.name));
  const wrappers=functions.filter(f=>scopes.get(f)===scope&&called.has(f.id.name)&&f.params.length===5);
  const glyph=unique(wrappers.flatMap(f=>direct(f,'ReturnStatement').filter(n=>n.argument?.type==='CallExpression'&&n.argument.callee.type==='FunctionExpression'&&n.argument.arguments.length===6&&
    n.argument.arguments[3].object?.name===f.params[4].name).map(n=>({owner:f,read:n.argument.arguments[3]}))),'action-log-glyph-text');
  const textField=prop(glyph.read);
  const textBranch=unique(nodes(dispatcher,'ConditionalExpression').filter(n=>n.test.type==='BinaryExpression'&&n.test.operator==='instanceof'&&nodes(n.consequent,'CallExpression').some(c=>c.callee.name===glyph.owner.id.name)),'action-log-user-part');
  const labelType=textBranch.test.right.name;
  const measure=unique(methods.filter(m=>m.scope===scope&&m.fn.params.length===2&&nodes(m.fn,'BinaryExpression').some(n=>n.operator==='instanceof'&&n.right.name===labelType)&&nodes(m.fn,'MemberExpression').some(n=>own(n)&&prop(n)===textField)),'action-log-text-measure');
  const measureRead=unique(nodes(measure.fn,'MemberExpression').filter(n=>own(n)&&prop(n)===textField),'action-log-width-text');
  const glyphBody=unique(direct(glyph.owner,'ReturnStatement').filter(n=>n.argument?.callee?.type==='FunctionExpression'),'action-log-glyph-body').argument.callee;
  const bindings=new Map(nodes(glyphBody,'VariableDeclarator').filter(n=>n.id.type==='Identifier').map(n=>[n.id.name,n.init]));
  const atlasPath=unique(nodes(glyphBody,'MemberExpression').filter(n=>n.computed).map(n=>memberPath(n.object,glyphBody.params[0].name,bindings)).filter(p=>p?.length===3),'action-log-font-atlas');
  const widthBody=unique(nodes(measure.fn,'CallExpression').filter(n=>n.callee.type==='FunctionExpression'&&n.arguments.some(a=>a===measureRead)),'action-log-width-body');
  const widthBindings=new Map(nodes(widthBody.callee,'VariableDeclarator').filter(n=>n.id.type==='Identifier').map(n=>[n.id.name,n.init]));
  const fontIndex=widthBody.arguments.findIndex(n=>n.type==='Identifier'&&n.name===measure.fn.params[0].name);
  if(fontIndex<0||!nodes(widthBody.callee,'MemberExpression').some(n=>n.computed&&JSON.stringify(memberPath(n.object,widthBody.callee.params[fontIndex].name,widthBindings))===JSON.stringify(atlasPath.slice(1))))throw Error('action-log-font-atlas-mismatch');
  const glyphAtlas=[glyph.owner.params[0].name,...atlasPath].join('.');
  const widthAtlas=[measure.fn.params[0].name,...atlasPath.slice(1)].join('.');
  for(const [read,atlas] of [[glyph.read,glyphAtlas],[measureRead,widthAtlas]]){
   const original=source.slice(read.start,read.end);
   plan.edits.push({start:read.start,end:read.end,expected:original,text:`(window.__kaspKillFeedPrivacy?.text(${original},${atlas})??${original})`,before:source.slice(read.start-24,read.start),after:source.slice(read.end,read.end+24)});
  }
  const at=render.fn.body.start+1;
  plan.edits.push({start:at,end:at,expected:'',text:`try{window.__kaspKillFeedPrivacy?.refresh(this,${JSON.stringify(dirty)});}catch(_kaspPrivacyError){}`,before:source.slice(at-24,at),after:source.slice(at,at+24)});
  plan.edits.sort((a,b)=>a.start-b.start);
  const shared=new Map([['identifier:'+ctor.id.name,'rendererType'],['identifier:'+dispatcher.id.name,'parts'],['identifier:'+glyph.owner.id.name,'glyphs'],['identifier:'+labelType,'labelType'],['property:'+textField,'text'],['property:'+dirty,'dirty']]);
  atlasPath.forEach((field,index)=>shared.set('property:'+field,['font','glyphTable','glyphEntries'][index]));
  const owners=new Map();
  for(const owner of [ctor,render.node,dispatcher,glyph.owner,measure.node]){
   const props=new Set(nodes(owner,'MemberExpression').map(prop)),ids=new Set(nodes(owner,'Identifier').map(n=>n.name));
   owners.set(owner,Object.fromEntries([...shared].filter(([key])=>key.startsWith('property:')?props.has(key.slice(9)):ids.has(key.slice(11))).map(([key,role])=>[role,key])));
  }
  plan.templates=compileTemplates(source,plan.edits,owners,{evidence:true,sharedKeys:shared});
  plan.status.ready=true;
 }catch(error){plan.status.issues.push(error.message);plan.edits=[];plan.templates=[];}
 return plan;
}
module.exports={analyzeKillFeedPrivacy};
