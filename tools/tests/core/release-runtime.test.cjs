const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {validateRuntime}=require('../../build/validate-runtime.cjs');
function fixture(run){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ki-package-test-'));
 const manifest={content_scripts:[{js:['dist/main.js'],css:['styles/main.css']}],web_accessible_resources:[{resources:['dist/kasp_game_gate.js']}],declarative_net_request:{rule_resources:[{path:'rules/game.json',enabled:true}]}};
 const write=(file,data)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);};
 write('manifest.json',JSON.stringify(manifest));write('dist/main.js','void 0;');write('styles/main.css','body{}');write('dist/kasp_game_gate.js','void 0;');
 write('rules/game.json',JSON.stringify([{action:{redirect:{extensionPath:'/dist/kasp_game_gate.js'}}}]));
 try{run({root,manifest,write,save:()=>write('manifest.json',JSON.stringify(manifest))});}
 finally{fs.rmSync(root,{recursive:true,force:true});}
}
test('release runtime validation accepts complete source and packaged layouts',()=>fixture(({root})=>assert.doesNotThrow(()=>validateRuntime(root))));
test('release rejects missing or empty gate, injector and stylesheet',()=>{
 for(const file of ['dist/kasp_game_gate.js','dist/main.js','styles/main.css'])for(const empty of [true,false])fixture(({root,write})=>{
  if(empty)write(file,'');else fs.unlinkSync(path.join(root,file));
  assert.throws(()=>validateRuntime(root),/Missing or invalid packaged runtime file/);
 });
});
test('release rejects an inaccessible gate and disabled or missing network rules',()=>{
 for(const mode of ['inaccessible','disabled','no-rules'])fixture(({root,manifest,save})=>{
  if(mode==='inaccessible')manifest.web_accessible_resources=[];
  else if(mode==='disabled')manifest.declarative_net_request.rule_resources[0].enabled=false;
  else manifest.declarative_net_request.rule_resources=[];
  save();assert.throws(()=>validateRuntime(root),/gate|network rules/);
 });
});
test('release rejects runtime paths outside the package',()=>fixture(({root,manifest,save})=>{
 manifest.content_scripts[0].js=['../outside.js'];save();assert.throws(()=>validateRuntime(root),/invalid packaged runtime file/);
}));
