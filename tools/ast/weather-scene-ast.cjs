const walk=require('acorn-walk');
const {compileTemplates}=require('./overdrive-templates.cjs');
const prop=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null;
const own=n=>n?.type==='MemberExpression'&&n.object.type==='ThisExpression';
const nodes=(root,type)=>{const out=[];walk.full(root,n=>{if(n.type===type)out.push(n);});return out;};
const type=m=>m.left.object?.type==='CallExpression'?m.left.object.arguments[0]?.name:null;
/** Optional, independently validated scene contracts. Missing evidence disables the
 * matching capability rather than guessing fields or touching native draw calls. */
function weatherScene(source,{methods,functions,scopes,renderer,schema:rain}){
 const edits=[],templates=[],capabilities={},issues=[];
 const unique=(xs,name)=>{if(xs.length!==1)throw Error(name+':'+xs.length);return xs[0];};
 function capability(name,build){
  try{const local=[],owners=new Map(),shared=new Map(),searches=new Map();
   const role=(key,value,kind='property')=>{shared.set(kind+':'+value,'scene_'+key);return value;};
   const observe=n=>{if(!owners.has(n))owners.set(n,{});};
   const add=(at,text)=>local.push({start:at,end:at,expected:'',before:source.slice(at-24,at),after:source.slice(at,at+24),text});
   build({role,observe,add,owners,shared,anchor:(owner,literal,margin)=>searches.set(owner,{literal,margin})});
   for(const [owner,roles]of owners){const fields=new Set(nodes(owner,'MemberExpression').map(prop)),ids=new Set(nodes(owner,'Identifier').map(n=>n.name));
    for(const [key,value]of shared)if(key.startsWith('property:')?fields.has(key.slice(9)):ids.has(key.slice(11)))roles[value]=key;}
   const compiled=[];
   for(const [owner,roles]of owners){
    const sequences=nodes(owner,'SequenceExpression');
    const markers=sequences.map(n=>({start:n.start,end:n.end,text:''}));
    for(const call of nodes(owner,'CallExpression'))if(call.callee.type==='FunctionExpression')markers.push({start:call.callee.start,end:call.callee.end,text:''});
    const wrappers=markers.length;
    for(const n of nodes(owner,'NewExpression'))if(n.arguments.length===0&&n.end===n.callee.end)markers.push({start:n.end,end:n.end,text:''});
    const actual=local.filter(e=>e.start>=owner.start&&e.end<=owner.end);
    const results=compileTemplates(source,[...markers,...actual],new Map([[owner,roles]]),{evidence:true,sharedKeys:shared});
    for(const template of results){
     for(let i=0;i<markers.length;i++)template.pattern=i<wrappers?template.pattern.replace(`(?<e${i}start>)`,'\\s*\\(?\\s*').replace(`(?<e${i}end>)`,'\\s*\\)?')
      :template.pattern.replace(`(?<e${i}start>)(?<e${i}end>)`,'(?:\\s*\\(\\s*\\))?');
     for(let i=markers.length;i<markers.length+actual.length;i++)template.pattern=template.pattern.replace(`\\s*(?<e${i}start>)(?<e${i}end>)\\}`,`\\s*;?\\s*(?<e${i}start>)(?<e${i}end>)\\}`);
     if(searches.has(owner))template.search=searches.get(owner);
     template.edits=template.edits.slice(markers.length);template.pattern=template.pattern.replaceAll('\\s*\\}','\\s*;?\\s*\\}');compiled.push(template);
    }
   }
   if(!compiled.length)throw Error('no-templates');edits.push(...local);templates.push(...compiled);capabilities[name]=true;
  }catch(error){capabilities[name]=false;issues.push(name+':'+error.message);}
 }
 capability('map',({role,observe,add})=>{
  const literals=(n,label)=>nodes(n,'Literal').some(v=>v.value===label);
  const family=(label,required)=>unique(methods.filter(m=>prop(m.left)==='toString'&&literals(m.right,label)&&
   required.every(key=>methods.some(g=>type(g)===type(m)&&scopes.get(g.right)===scopes.get(m.right)&&literals(g.right,key)))),'map-'+label);
  const getter=(family,label)=>{const m=unique(methods.filter(g=>type(g)===type(family)&&scopes.get(g.right)===scopes.get(family.right)&&literals(g.right,label)),label);
   observe(m);return {method:prop(m.left),field:prop(unique(nodes(m.right,'MemberExpression').filter(own),'field-'+label))};};
  const geom=family('CollisionGeometry [',['boxes','planes','triangles']),box=family('CollisionBox [',['position','rotation','size']);
  const plane=family('CollisionPlane [',['position','rotation']),tri=family('CollisionTriangle [',['position','rotation','v0','v1','v2']);
  for(const [label,f]of [['geometry',geom],['box',box],['plane',plane],['triangle',tri]]){role('mapClass_'+label,type(f),'identifier');observe(f);}
  const s={},get=(key,f,label)=>{const value=getter(f,label);s[key]=role(key,value.field);return value;};
  const boxes=get('boxes',geom,'boxes'),planes=get('planes',geom,'planes'),triangles=get('triangles',geom,'triangles');
  for(const [key,f,label]of [['boxPosition',box,'position'],['boxRotation',box,'rotation'],['size',box,'size'],['planePosition',plane,'position'],['planeRotation',plane,'rotation'],
   ['trianglePosition',tri,'position'],['triangleRotation',tri,'rotation'],['v0',tri,'v0'],['v1',tri,'v1'],['v2',tri,'v2']])get(key,f,label);
  for(const key of ['width','length']){
   const field=unique(nodes(plane.right,'BinaryExpression').filter(n=>own(n.right)&&nodes(n.left,'Literal').at(-1)?.value===key+' = '),'plane-'+key);
   s[key]=role(key,prop(field.right));observe(plane);
  }
  const convert=unique(functions.filter(f=>f.params.length===1&&[boxes.method,planes.method,triangles.method].every(p=>nodes(f,'CallExpression').some(c=>prop(c.callee)===p))),'map-converter');observe(convert);
  const returned=unique(nodes(convert,'ReturnStatement').filter(n=>n.argument?.type==='Identifier'),'map-list-return').argument.name;
  s.count=role('count',prop(unique(nodes(convert,'CallExpression').filter(c=>c.callee.object?.name===returned&&c.arguments.length===0),'map-list-count').callee));
  s.get=role('get',prop(unique(nodes(convert,'CallExpression').filter(c=>c.callee.object?.type==='CallExpression'&&c.callee.object.callee.object?.name===returned&&c.callee.object.arguments.length===1),'map-list-get').callee.object.callee));
  const vector=unique(functions.filter(f=>scopes.get(f)===scopes.get(convert)&&f.params.length===2&&nodes(f,'CallExpression').some(c=>c.callee.object?.name===f.params[1].name&&c.arguments.length===3&&c.arguments.every(a=>a.type==='MemberExpression'&&a.object.name===f.params[0].name))),'map-vector');observe(vector);
  const xyz=nodes(vector,'CallExpression').find(c=>c.arguments.length===3);xyz.arguments.forEach((p,i)=>{s[['x','y','z'][i]]=role('map'+['x','y','z'][i],prop(p));});
  const map=family('BattleMap [',['collisionGeometry','staticGeometry']),mapGetter=getter(map,'collisionGeometry');
  const capture=unique([...functions,...methods.map(m=>m.right)].flatMap(f=>nodes(f.body,'VariableDeclaration')).filter(v=>v.declarations.some(d=>d.init?.type==='CallExpression'&&d.init.callee.name===convert.id.name&&d.init.arguments[0]?.type==='CallExpression'&&prop(d.init.arguments[0].callee)===mapGetter.method))
   .filter((n,i,a)=>a.indexOf(n)===i),'main-map-collision-declaration');
  const input=capture.declarations.find(d=>d.init?.callee.name===convert.id.name).init.arguments[0];observe(capture);
  add(capture.end,`;try{window.__kaspRain?.map(${source.slice(input.start,input.end)},${JSON.stringify(s)});}catch(_kiMapError){}`);
 });
 capability('lighting',({role,observe,add})=>{
  const field=unique(nodes(renderer,'AssignmentExpression').filter(n=>n.left.type==='MemberExpression'&&n.left.computed&&n.left.property.value===8&&n.left.object.type==='AssignmentExpression'&&own(n.left.object.right?.object)),'lighting-array');
  const binding=field.left.object,buffer=binding.right;role('lightingData',prop(buffer));role('lightingBuffer',prop(buffer.object));
  const colours=nodes(renderer,'CallExpression').filter(c=>c.arguments.length===4&&c.arguments[0].value===0&&own(c.arguments[2]?.object)&&prop(c.arguments[2].object)===prop(buffer.object)&&[0,4].includes(c.arguments[3].value));
  if(colours.length!==2)throw Error('lighting-colour-writes');
  const tail=unique(nodes(renderer,'AssignmentExpression').filter(n=>n.left.type==='MemberExpression'&&n.left.computed&&n.left.property.value===10&&n.left.object.name===binding.left.name&&prop(n.right)===rain.z),'lighting-direction-tail');
  observe({type:'SequenceExpression',expressions:[...colours,field,tail],start:Math.min(...colours.map(n=>n.start)),end:tail.end});
  const upload=unique(nodes(renderer,'CallExpression').filter(c=>own(c.callee.object)&&prop(c.callee.object)===prop(buffer.object)&&c.arguments.length===1&&own(c.arguments[0])&&prop(c.arguments[0])===rain.gl),'lighting-upload');observe(upload);
  add(upload.start,`(()=>{let _kiLightRestore;try{_kiLightRestore=window.__kaspRain?.lighting(${source.slice(buffer.start,buffer.end)});}catch(_kiLightError){}try{return `);
  add(upload.end,`}finally{try{_kiLightRestore?.();}catch(_kiLightError){}}})()`);
 });
 capability('tanks',({role,observe,add})=>{
  const setup=unique(methods.filter(m=>nodes(m.right,'Literal').some(n=>n.value==='hull-main')&&nodes(m.right,'Literal').some(n=>n.value==='hull-static-top')),'tank-body-setup');
  const family=methods.filter(m=>type(m)===type(setup)&&scopes.get(m.right)===scopes.get(setup.right));
  const dimensions=nodes(setup.right,'CallExpression').find(c=>own(c.callee.object)&&c.arguments.length===1&&c.arguments[0].type==='MemberExpression'&&c.arguments[0].object.name===setup.right.params[1].name);
  if(!dimensions)throw Error('tank-dimensions');observe(setup);
  const update=unique(family.filter(m=>m.right.params.length===1&&nodes(m.right,'CallExpression').some(c=>c.callee.type==='Identifier'&&c.arguments[0]?.type==='ThisExpression')&&nodes(m.right,'IfStatement').some(n=>n.test.type==='UnaryExpression'&&own(n.test.argument))),'tank-interpolation');observe(update);
  const active=nodes(update.right,'IfStatement').find(n=>n.test.type==='UnaryExpression'&&own(n.test.argument)).test.argument;
  const helperCall=nodes(update.right,'CallExpression').find(c=>c.callee.type==='Identifier'&&c.arguments[0]?.type==='ThisExpression');
  const helper=unique(functions.filter(f=>f.id.name===helperCall.callee.name&&scopes.get(f)===scopes.get(update.right)),'tank-interpolation-helper');
  const ctor=unique(functions.filter(f=>f.id.name===type(setup)&&scopes.get(f)===scopes.get(setup.right)),'tank-constructor');
  const fields=nodes(ctor,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='NewExpression');
  const vectorType=unique(fields.filter(n=>prop(n.left)===prop(dimensions.callee.object)),'tank-vector').right.callee.name;
  const vectors=new Set(fields.filter(n=>n.right.callee.name===vectorType).map(n=>prop(n.left)));
  const position=unique(nodes(helper,'CallExpression').filter(c=>c.arguments.length===3&&c.callee.object?.type==='MemberExpression'&&vectors.has(prop(c.callee.object))&&c.callee.object.object.name===helper.params[0].name&&c.arguments[2].name===helper.params[1].name&&c.arguments[0].type==='MemberExpression'),'tank-position');
  observe(unique(helper.body.body.filter(n=>n.start<=position.start&&n.end>=position.end),'tank-position-evidence'));
  const matrix=unique(nodes(helper,'CallExpression').filter(c=>c.arguments.length===2&&prop(c.arguments[1])===prop(position.callee.object)&&c.callee.object?.type==='MemberExpression'&&c.callee.object.object.name===helper.params[0].name),'tank-pose-matrix');
  const exporter=unique(methods.filter(m=>m.right.params.length===1&&nodes(m.right,'AssignmentExpression').filter(n=>n.left.type==='MemberExpression'&&n.left.computed&&n.left.object.name===m.right.params[0].name&&n.left.property.value===15&&n.right.value===1).length===1&&nodes(m.right,'AssignmentExpression').filter(n=>own(n.right)&&n.left.type==='MemberExpression'&&n.left.computed).length===12),'matrix-array-export');observe(exporter);
  const s={position:role('tankPosition',prop(position.callee.object)),size:role('tankSize',prop(dimensions.callee.object)),active:role('tankActive',prop(active)),matrix:role('tankMatrix',prop(matrix.callee.object))};
  for(const n of nodes(exporter.right,'AssignmentExpression'))if(own(n.right)&&n.left.computed)s['m'+n.left.property.value]=role('matrix'+n.left.property.value,prop(n.right));
  const main=unique(nodes(setup.right,'VariableDeclarator').filter(n=>n.init?.type==='CallExpression'&&n.init.arguments.length===0&&n.init.callee.object?.type==='MemberExpression'&&n.init.callee.object.object.name===setup.right.params[1].name),'hull-main-description');
  const boxCreator=unique(methods.filter(m=>prop(m.left)===prop(main.init.callee)&&scopes.get(m.right)===scopes.get(setup.right)),'hull-box-creator');observe(boxCreator);
  const size=unique(nodes(boxCreator.right,'CallExpression').filter(c=>c.callee.type==='Identifier'&&c.arguments.length===1&&own(c.arguments[0])),'hull-box-half-size');
  const localPose=unique(nodes(boxCreator.right,'CallExpression').filter(c=>c.arguments.length===1&&own(c.arguments[0])&&c.callee.object?.type==='MemberExpression'),'hull-local-pose');
  const listDeclaration=unique(nodes(setup.right,'VariableDeclarator').filter(n=>n.init?.type==='MemberExpression'&&n.init.object.name===setup.right.params[1].name&&nodes(setup.right,'CallExpression').some(c=>prop(c.callee)===prop(main.init.callee)&&c.callee.object?.type==='CallExpression'&&c.callee.object.callee.object?.name===n.id.name)),'hull-box-list');
  s.halfSize=role('hullHalfSize',prop(size.arguments[0]));s.boxMatrix=role('hullLocalMatrix',prop(localPose.arguments[0]));
  const count=unique(nodes(setup.right,'CallExpression').filter(c=>c.callee.object?.name===listDeclaration.id.name&&c.arguments.length===0),'hull-list-count');
  const get=unique(nodes(setup.right,'CallExpression').filter(c=>c.callee.object?.name===listDeclaration.id.name&&c.arguments.length===1),'hull-list-get');
  s.count=role('count',prop(count.callee));s.get=role('get',prop(get.callee));
  add(setup.right.body.end-1,`;try{window.__kaspRain?.hull(this,${source.slice(main.init.callee.object.start,main.init.callee.object.end)},${source.slice(listDeclaration.init.start,listDeclaration.init.end)},Object.assign(${JSON.stringify(s)},__KI_RAIN_SCHEMA__));}catch(_kiHullError){}`);
  // Public capture runs after native interpolation and never changes a tank.
  add(update.right.body.end-1,`;try{window.__kaspRain?.tank(this,Object.assign(${JSON.stringify(s)},__KI_RAIN_SCHEMA__));}catch(_kiTankError){}`);
 });
 capability('environment',({role,observe,add})=>{
  const dto=unique(methods.filter(m=>prop(m.left)==='toString'&&nodes(m.right,'Literal').some(n=>n.value==='BattleCreateParameters [')),'battle-theme-dto');observe(dto);
  const label=unique(nodes(dto.right,'BinaryExpression').filter(n=>n.operator==='+'&&nodes(n.left,'Literal').at(-1)?.value==='theme = '&&n.right.type==='CallExpression'&&prop(n.right.callee)==='toString'),'battle-theme-field');
  const theme=role('mapTheme',prop(label.right.callee.object));
  const info=unique(methods.filter(m=>prop(m.left)==='toString'&&nodes(m.right,'Literal').some(n=>n.value==='BattleParamInfoCC [')),'battle-param-info');observe(info);
  role('battleParamInfoType',type(info),'identifier');
  const getter=unique(methods.filter(m=>type(m)===type(info)&&scopes.get(m.right)===scopes.get(info.right)&&nodes(m.right,'Literal').some(n=>n.value==='parameters')),'battle-parameter-getter');observe(getter);
  role('parametersGetter',prop(getter.left));
  const capture=unique(methods.flatMap(m=>nodes(m.right,'NewExpression')).filter(n=>n.arguments.length===4&&n.arguments[2].type==='CallExpression'&&prop(n.arguments[2].callee)===prop(getter.left)&&n.arguments[1].type==='MemberExpression'&&n.arguments[1].object.name===n.arguments[2].callee.object?.name),'battle-parameter-dispatch');observe(capture);
  const arg=capture.arguments[2],id=source.slice(capture.arguments[0].start,capture.arguments[0].end);
  add(arg.start,`((_kiParams)=>{try{window.__kaspRain?.environment(String(${id}),String(_kiParams.${theme}));}catch(_kiEnvironmentError){}return _kiParams;})(`);add(arg.end,')');
 });
 capability('terrainSeason',({role,observe,add})=>{
  // Match the map's actual snow-material branch, not program construction:
  // programs are cached across summer/winter maps and do not prove a draw.
  const ctor=unique(functions.filter(f=>nodes(f,'Literal').some(n=>n.value==='BattleMapProgram_')),'map-program');
  const sampler=unique(nodes(ctor,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='CallExpression'&&n.right.arguments[0]?.value==='snowTexture'),'map-snow-sampler');
  const flag=sampler.right.arguments[1];
  if(!own(flag?.object))throw Error('map-snow-flag');
  role('mapProgram',ctor.id.name,'identifier');role('mapSnowSampler',prop(sampler.left));role('mapProgramSettings',prop(flag.object));role('mapSnowFlag',prop(flag));observe(ctor);
  const bind=unique(methods.filter(m=>scopes.get(m.right)===scopes.get(ctor)&&m.right.params.length===3&&nodes(m.right,'MemberExpression').some(n=>prop(n)===prop(sampler.left))),'map-snow-bind');
  const branch=unique(nodes(bind.right,'IfStatement').filter(n=>n.consequent.type==='BlockStatement'&&nodes(n.test,'MemberExpression').some(p=>prop(p)===prop(flag)&&prop(p.object)===prop(flag.object))&&nodes(n.consequent,'MemberExpression').some(p=>prop(p)===prop(sampler.left))),'map-snow-draw-branch');
  observe(bind);add(branch.consequent.start+1,';try{window.__kaspRain?.terrainSnow(arguments[0],__KI_RAIN_SCHEMA__);}catch(_kiSeasonError){}');
 });
 capability('treeWind',({role,observe,add,shared})=>{
  shared.set('property:'+rain.gl,'gl');shared.set('property:'+rain.context,'context');
  const shaderMethods=methods.filter(m=>nodes(m.right,'Literal').some(n=>typeof n.value==='string'&&(n.value.includes('getPositionModifiedByWind')||n.value.includes('const float windStrength = 10.'))));
  if(shaderMethods.length!==4)throw Error('tree-vertex-shaders:'+shaderMethods.length);
  for(const method of shaderMethods){
   const ret=unique(nodes(method.right,'ReturnStatement'),'tree-shader-return'),arg=ret.argument;observe(ret);
   const instanced=nodes(arg,'Literal').some(n=>typeof n.value==='string'&&n.value.includes('timeAndWindStrength'));
   add(arg.start,`((_kiShader)=>{try{return window.__kaspRain?.treeShader(_kiShader,${instanced})??_kiShader;}catch(_kiTreeError){return _kiShader;}})(`);add(arg.end,')');
  }
 });
 capability('skyTone',({role,observe,add,shared})=>{
  shared.set('property:'+rain.gl,'gl');shared.set('property:'+rain.context,'context');
  const fragment=unique(methods.filter(m=>nodes(m.right,'Literal').some(n=>typeof n.value==='string'&&n.value.includes('uniform samplerCube skyboxTexture;'))),'skybox-fragment');
  const ret=unique(nodes(fragment.right,'ReturnStatement'),'skybox-return');observe(ret);
  add(ret.argument.start,'((_kiSky)=>{try{return window.__kaspRain?.skyShader(_kiSky)??_kiSky;}catch(_kiSkyError){return _kiSky;}})(');add(ret.argument.end,')');
  const mapping=unique(methods.filter(m=>type(m)===type(fragment)&&scopes.get(m.right)===scopes.get(fragment.right)&&nodes(m.right,'Literal').some(n=>n.value==='skyboxTexture')),'skybox-uniform-map');observe(mapping);
  const sampler=unique(nodes(mapping.right,'AssignmentExpression').filter(n=>own(n.left)&&n.right.type==='CallExpression'&&n.right.arguments[0]?.value==='skyboxTexture'),'skybox-sampler');
  role('skySampler',prop(sampler.left));
  const uniform=unique(methods.filter(m=>m!==mapping&&nodes(m.right,'MemberExpression').some(n=>prop(n)===prop(sampler.left))&&m.right.params.length===4),'skybox-uniform-bind');observe(uniform);
  add(uniform.right.body.end-1,`;try{window.__kaspRain?.skyUniform(${uniform.right.params[0].name}.${rain.gl}.${rain.context});}catch(_kiSkyError){}`);
 });
 capability('fogSuppression',({role,observe,add,shared})=>{
  for(const key of ['gl','context','red','green','blue'])shared.set('property:'+rain[key],key);
  const decl=unique(methods.filter(m=>nodes(m.right,'Literal').some(n=>typeof n.value==='string'&&n.value.includes('uniform vec3 uFogParams;')&&n.value.includes('uniform vec4 uFogColor;'))),'native-fog-declaration');
  const binders=methods.filter(m=>type(m)===type(decl)&&scopes.get(m.right)===scopes.get(decl.right)&&[5,7].includes(m.right.params.length)&&nodes(m.right,'CallExpression').some(c=>c.arguments.length===5&&c.arguments[2]?.object?.name===m.right.params[0].name));
  if(binders.length!==2)throw Error('native-fog-binders:'+binders.length);
  role('nativeFogClass',type(decl),'identifier');observe(decl);
  const strength=arg=>{
   add(arg.start,'((_kiFog)=>{try{return window.__kaspRain?.nativeFogStrength(_kiFog)??_kiFog;}catch(_kiFogError){return _kiFog;}})(');add(arg.end,')');
  };
  for(const binder of binders){
   observe(binder);role('nativeFogBinder'+binder.right.params.length,prop(binder.left));const args=binder.right.params.map(p=>p.name);
   const range=unique(nodes(binder.right,'CallExpression').filter(c=>c.arguments.length===5&&c.arguments[1]?.object?.name===args[0]&&prop(c.arguments[1])===rain.gl),'native-fog-range');strength(range.arguments[4]);
  }
  const sky=unique(methods.flatMap(m=>nodes(m.right,'CallExpression')).filter(c=>c.arguments.length===5&&prop(c.callee)==='m3f'&&[rain.red,rain.green,rain.blue].every((p,i)=>prop(c.arguments[i+1])===p)&&nodes(c.arguments[4],'MemberExpression').some(n=>prop(n)==='u62_1')),'sky-fog-upload');
  observe(unique(methods.filter(m=>nodes(m.right,'CallExpression').includes(sky)),'sky-fog-owner'));strength(sky.arguments[4]);
 });
 capability('dropZones',({role,observe,add,shared,anchor})=>{
  shared.set('property:'+rain.gl,'gl');shared.set('property:'+rain.context,'context');
  const all=[...functions.flatMap(f=>nodes(f,'AssignmentExpression'))].filter((n,i,a)=>a.indexOf(n)===i);
  const assignment=unique(all.filter(n=>n.right.type==='NewExpression'&&n.right.arguments[0]?.value==='DropZones'&&n.right.arguments[1]?.value===8),'drop-zone-layer');
  const binding=assignment.left.name;role('dropZoneEnum',binding,'identifier');observe(assignment);
  const scope=scopes.get(scopes.get(assignment.right));
  const helper=unique(functions.filter(f=>scopes.get(f)===scope&&nodes(f,'ReturnStatement').some(r=>r.argument?.type==='SequenceExpression'&&r.argument.expressions.at(-1)?.name===binding)),'drop-zone-helper');role('dropZoneLayer',helper.id.name,'identifier');observe(helper);anchor(helper,'DropZones',Math.abs(helper.start-assignment.start)*2+1024);
  const call=unique(nodes(renderer,'CallExpression').filter(c=>c.arguments[0]?.type==='ThisExpression'&&c.arguments[1]?.type==='CallExpression'&&c.arguments[1].callee.name===helper.id.name),'drop-zone-dispatch');
  const context=nodes(renderer,'SequenceExpression').filter(n=>n.start<=call.start&&n.end>=call.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];observe(context||call);
  add(call.start,'(()=>{let _kiDropRestore;try{_kiDropRestore=window.__kaspRain?.dropZones(this.'+rain.gl+'.'+rain.context+');}catch(_kiDropError){}try{return ');add(call.end,';}finally{try{_kiDropRestore?.();}catch(_kiDropError){}}})()');
 });
 return {edits,templates,capabilities,issues};
}
module.exports={weatherScene};
