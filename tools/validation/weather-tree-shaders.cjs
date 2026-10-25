const {parse}=require('acorn'),walk=require('acorn-walk');
const nodes=(root,type)=>{const out=[];walk.full(root,n=>{if(n.type===type)out.push(n);});return out;};
const property=n=>n?.type==='MemberExpression'?n.property.name:null;
/** Read native GLSL expressions without executing the game bundle. The tiny
 * interpreter accepts only its string/flag assembly and the two native helpers. */
function nativeTreeShaders(source,kind=false){
 const skybox=kind===true,backdrop=kind==='backdrop';
 const ast=parse(source,{ecmaVersion:'latest'}),methods=nodes(ast,'AssignmentExpression').filter(n=>n.right.type==='FunctionExpression');
 const has=(m,text)=>nodes(m.right,'Literal').some(n=>typeof n.value==='string'&&n.value.includes(text));
 const unique=(items,label)=>{if(items.length!==1)throw Error(label+':'+items.length);return items[0];};
 const shaders=methods.filter(m=>{if(skybox)return has(m,'uniform samplerCube skyboxTexture;');if(backdrop){const text=nodes(m.right,'Literal').map(n=>typeof n.value==='string'?n.value:'').join('');return text.includes('color.rgb *= light;')&&text.includes('vec3 staticLight = 2')&&(text.includes('uniform sampler2D mainTexture;')||text.includes('uniform sampler2D controlTexture;'));}return has(m,'getPositionModifiedByWind')||has(m,'const float windStrength = 10.');});
 if(shaders.length!==(skybox?1:backdrop?2:4))throw Error('Unexpected native shader count');
 const helper=anchor=>{
  const decl=unique(methods.filter(m=>has(m,anchor)),'helper-'+anchor),type=decl.left.object.arguments[0].name;
  return methods.filter(m=>m.left.object?.type==='CallExpression'&&m.left.object.arguments[0]?.name===type);
 };
 const near=helper('uniform mat4 uWorldMatrix;'),fog=helper('uniform mat4 uModelViewMatrix;');
 function evaluate(n,flags,locals={},helpers={}){
  if(n.type==='Literal')return n.value;
  if(n.type==='Identifier'&&Object.hasOwn(locals,n.name))return locals[n.name];
  if(n.type==='UnaryExpression'&&n.operator==='!')return !evaluate(n.argument,flags,locals,helpers);
  if(n.type==='BinaryExpression'&&n.operator==='+')return evaluate(n.left,flags,locals,helpers)+evaluate(n.right,flags,locals,helpers);
  if(n.type==='ConditionalExpression')return evaluate(n.test,flags,locals,helpers)?evaluate(n.consequent,flags,locals,helpers):evaluate(n.alternate,flags,locals,helpers);
  if(n.type==='MemberExpression')return flags;
  if(n.type==='CallExpression'){
   if(property(n.callee)==='equals')return false; // Exercise the valid non-AO lightmap mode.
   if(n.callee.type==='Identifier'&&n.arguments.length===0)return null;
   const args=n.arguments.map(a=>evaluate(a,flags,locals,helpers));
   if(n.callee.type==='Identifier'&&/^USE_[A-Z_]+$/.test(args[0])&&typeof args[1]==='boolean')return '#define '+args[0]+' '+Number(args[1]);
   const family=helpers[n.callee.object?.name];if(!family)throw Error('Unsupported GLSL helper');
   const m=unique(family.filter(m=>property(m.left)===property(n.callee)),'helper-method');
   const ret=unique(nodes(m.right,'ReturnStatement'),'helper-return');return evaluate(ret.argument,flags,Object.fromEntries(m.right.params.map((p,i)=>[p.name,args[i]])),helpers);
  }
  throw Error('Unsupported GLSL expression '+n.type);
 }
 return shaders.flatMap((m,index)=>{
  const calls=nodes(m.right,'CallExpression'),helpers={};
  for(const call of calls){if(property(call.callee)==='j5r')helpers[call.callee.object.name]=call.arguments[0].type==='UnaryExpression'?near:fog;
   if(backdrop&&['l5r','m5r'].includes(property(call.callee)))helpers[call.callee.object.name]=fog;}
  const ret=unique(nodes(m.right,'ReturnStatement'),'shader-return');
  const variants=[false,true];
  return variants.map(flags=>({name:property(m.left)+'-'+index+'-'+Number(flags),instanced:has(m,'timeAndWindStrength'),source:evaluate(ret.argument,flags,{},helpers)}));
 });
}
module.exports={nativeTreeShaders,nativeSkyboxShaders:source=>nativeTreeShaders(source,true),nativeMapShaders:source=>nativeTreeShaders(source,'backdrop')};

function nativeFogFragment(source){
 const ast=parse(source,{ecmaVersion:'latest'}),methods=nodes(ast,'AssignmentExpression').filter(n=>n.right.type==='FunctionExpression');
 const method=methods.find(m=>nodes(m.right,'Literal').some(n=>typeof n.value==='string'&&n.value.includes('float fogFactor = clamp(viewDistance * uFogParams.x')));
 if(!method)throw Error('Native fog formula missing');const ret=nodes(method.right,'ReturnStatement')[0],parameter=method.right.params[0].name;
 const evaluate=n=>{if(n.type==='Literal')return n.value;if(n.type==='Identifier'&&n.name===parameter)return 'color';if(n.type==='BinaryExpression'&&n.operator==='+')return evaluate(n.left)+evaluate(n.right);throw Error('Unsupported native fog expression');};
 return evaluate(ret.argument);
}
module.exports.nativeFogFragment=nativeFogFragment;
