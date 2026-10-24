const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test'),{transformSync}=require('esbuild'),{parse}=require('acorn'),walk=require('acorn-walk');
const runFeatureContext=require("../helpers/feature-context.cjs"),patches=require("../helpers/client-patches.cjs");
const {analyzeKillFeedPrivacy}=require("../../ast/kill-feed-privacy-ast.cjs");
const source=`
function ActionLog(){this.a="ActionsLog";this.b="ActionsLog";this.c="ActionsLog";this.d="ActionsLog";this.indices=new Int16Array(1680);this.dirty=!1;this.entries=[];this.drawn=[];this.font={table:{entries:fontGlyphs}};}
proto(ActionLog).paint=function(t,n){if(this.dirty){this.drawn=[];for(const row of this.entries)parts(this,row,0,0);this.dirty=!1;}};
function parts(log,row,x,y){var item=row;return item instanceof Icon?0:item instanceof Name?glyphs(log,x,y,null,item):0;}
function glyphs(log,x,y,row,item){return function(log,x,y,text,color,time){for(var i=0;i<text.length;i++){var table=log.font.table,code=text.charCodeAt(i),glyph=table.entries[code];x+=glyph.advance;}log.drawn.push(text);return text;}(log,x,y,item.nick,item.color,0);}
function Part(){}function Icon(){}function Name(text){this.nick=text;this.color='red';}
Name.prototype=Object.create(Part.prototype);Name.prototype.constructor=Name;
proto(Part).width=function(font,size){return this instanceof Icon?22:this instanceof Name?function(text,font){var width=0;for(var i=0;i<text.length;i++){var table=font.table,code=text.charCodeAt(i);width+=table.entries[code].advance;}return width;}(this.nick,font):0;};
`;
const fontGlyphs=Object.fromEntries([...Array.from({length:95},(_,i)=>i+32),...[...'Скрыто'].map(c=>c.charCodeAt(0))].map(code=>[code,{advance:1}]));
function fixture(initial=true){
 let enabled=initial,own='Kaspersky',language='en';
 const timers=new Set(),page=new EventTarget();page.location={origin:'https://tankionline.com',hostname:'tankionline.com'};
 page.setInterval=cb=>(timers.add(cb),cb);page.clearInterval=cb=>timers.delete(cb);
 const document={documentElement:{lang:'en'}};
 const module={exports:{}},context={module,window:page,document,localStorage:{getItem:key=>key==='k_hideNicknameXP'?String(enabled):key==='language_store_key'?language:null},
  require:id=>id==='./clientPatches'?patches:id==='./accountId'?{ACCOUNT_IDENTITY_MESSAGE:'kasp:account-identity'}:id==='./accountIdentity'?{
   getAccountIdentity:()=>own?{nickname:own}:null,parseAccountIdentity:text=>({nickname:text.trim().replace(/^\[.*?\]\s*/,'')})}:null};
 runFeatureContext(transformSync(fs.readFileSync('src/core/killFeedPrivacy.ts','utf8'),{loader:'ts',format:'cjs'}).code,context);
 const bridge=module.exports.installKillFeedPrivacy(page);
 context.require('./featureRuntime').installFeatureDiagnostics(page,'page');
 return {page,bridge,api:module.exports,document,text:value=>bridge.text(value,fontGlyphs),
  toggle(value){enabled=value;page.dispatchEvent(new Event('kasp:settings-changed'));},
  language(value){language=value;for(const cb of timers)cb();},
  own(value){own=value;for(const cb of timers)cb();},
  native(nickname){const event=new Event('message');Object.defineProperties(event,{source:{value:page},origin:{value:page.location.origin},
   data:{value:{type:'kasp:account-identity',snapshot:{account:nickname?{userId:'1001',nickname,clanTag:''}:null,players:[]}}}});page.dispatchEvent(event);},
  disable(){page.__kaspPageModulesDebug.disable('killFeedPrivacy');}
 };
}
test('masks exact local nicknames with or without a clan tag, in both languages; leaves all other text intact',()=>{
 const f=fixture();for(const name of ['Kaspersky','[CLAN] Kaspersky',' [ABC] Kaspersky '])assert.equal(f.text(name),'Hidden');
 for(const text of ['OtherPlayer','Kaspersky123','NotKaspersky','Kaspersky destroyed somebody','Hidden',''])assert.equal(f.text(text),text);
 f.language('ru');assert.equal(f.text('[CLAN] Kaspersky'),'Скрыто');
 assert.equal(f.text(42),42);assert.equal(f.text(null),null);
});
test('known native identity supports HUD-only screens and explicit invalidation removes the mask',()=>{
 const f=fixture();f.own(null);assert.equal(f.text('Kaspersky'),'Kaspersky');
 f.native('Kaspersky');assert.equal(f.text('Kaspersky'),'Hidden');
 f.native(null);assert.equal(f.text('Kaspersky'),'Kaspersky');
});
test('existing renderer entries update on toggles, language and account changes; quarantine restores native output',()=>{
 const f=fixture(),renderer={dirty:false};f.bridge.refresh(renderer,'dirty');assert.equal(renderer.dirty,true);
 renderer.dirty=false;f.bridge.refresh(renderer,'dirty');assert.equal(renderer.dirty,false);
 f.toggle(false);assert.equal(renderer.dirty,true);assert.equal(f.text('Kaspersky'),'Kaspersky');
 renderer.dirty=false;f.toggle(true);assert.equal(renderer.dirty,true);
 f.language('ru');assert.equal(f.text('Kaspersky'),'Скрыто');
 f.own('Another');assert.equal(f.text('Kaspersky'),'Kaspersky');assert.equal(f.text('Another'),'Скрыто');
 renderer.dirty=false;f.disable();assert.equal(renderer.dirty,true);assert.equal(f.text('Another'),'Another');
});

test('replacement uses only glyphs present in the current native atlas, without exposing the nickname',()=>{
 const f=fixture();f.language('ru');
 const latin=Object.fromEntries([...Object.entries(fontGlyphs)].filter(([key])=>Number(key)<128));
 assert.equal(f.bridge.text('Kaspersky',latin),'Hidden');
 assert.equal(f.bridge.text('Kaspersky',{...latin,[105]:null}),'');
 assert.equal(f.bridge.text('Kaspersky',{}),'');
 assert.equal(f.bridge.text('Kaspersky'), '');
 assert.equal(f.bridge.text('Opponent',{}),'Opponent');
 f.language('en');assert.equal(f.bridge.text('Kaspersky',latin),'Hidden');
 f.toggle(false);assert.equal(f.bridge.text('Kaspersky',{}),'Kaspersky');
});
test('offline patch masks text and width consistently without changing original message objects or colors',async()=>{
 const plan=analyzeKillFeedPrivacy(source);assert.equal(plan.status.ready,true,JSON.stringify(plan.status));assert.equal(plan.edits.length,3);
 const f=fixture(),context={window:f.page,proto:type=>type.prototype,fontGlyphs};
 vm.runInNewContext(patches.mergeClientPatchPlans(source,[plan]).code,context);
 const log=new context.ActionLog(),attacker=new context.Name('[TAG] Kaspersky'),victim=new context.Name('Opponent');
 log.entries=[attacker,new context.Icon(),victim];log.paint();
 assert.deepEqual([...log.drawn],['Hidden','Opponent']);assert.equal(attacker.width(log.font),6);assert.equal(victim.width(log.font),8);
 assert.equal(attacker.nick,'[TAG] Kaspersky');assert.equal(attacker.color,'red');
 f.language('ru');log.paint();assert.deepEqual([...log.drawn],['Скрыто','Opponent']);assert.equal(attacker.width(log.font),6);
 f.toggle(false);log.paint();assert.deepEqual([...log.drawn],['[TAG] Kaspersky','Opponent']);assert.equal(attacker.width(log.font),attacker.nick.length);
 const renamed=source.replace(/ActionLog/g,'RenamedLog').replace(/\bdirty\b/g,'changed').replace(/\bnick\b/g,'caption').replace(/\bglyphs\b/g,'letters');
 const adapted=await f.api.selectKillFeedPrivacyPlan(renamed,[plan]);assert.ok(adapted);assert.ok(f.api.killFeedPrivacyPlanValid(renamed,adapted));
 assert.equal(analyzeKillFeedPrivacy(source.replace(/ActionsLog/g,'UnknownLog')).status.ready,false);
 assert.equal(analyzeKillFeedPrivacy(source.replace('var table=font.table','var table=font.otherTable')).status.ready,false);
 assert.equal(await f.api.selectKillFeedPrivacyPlan(source+source,[plan]),undefined);
});
test('real native action-log mapping survives renaming and merges with existing features',
 {skip:!fs.existsSync('main.js'),timeout:60000},()=>{
 const source=fs.readFileSync('main.js','utf8'),plan=analyzeKillFeedPrivacy(source);
 assert.equal(plan.status.ready,true,JSON.stringify(plan.status));assert.equal(plan.edits.length,3);
 assert.ok(patches.resolveTemplateEdits(source,plan));
 const renamed=source.replace(/\bu11l_1\b/g,'privateDisplayText').replace(/\bk11i_1\b/g,'privateDirtyFlag')
  .replace(/\bo11h_1\b/g,'privateFont').replace(/\bg63_1\b/g,'privateGlyphTable').replace(/\bm63_1\b/g,'privateGlyphEntries');
 const adapted=patches.resolveTemplateEdits(renamed,plan);assert.ok(adapted);
 const changed=patches.mergeClientPatchPlans(renamed,[{...plan,sourceLength:renamed.length,edits:adapted.edits}]).code;
 parse(changed,{ecmaVersion:'latest'});assert.ok(changed.includes('__kaspKillFeedPrivacy?.text(e.privateDisplayText,'));
 assert.ok(changed.includes('e.privateDisplayText,t.privateFont.privateGlyphTable.privateGlyphEntries'));
 // Execute the actual game's width and glyph loops: the previous lightweight fixture
 // could not catch a missing bitmap glyph crashing every subsequent render frame.
 const glyphEdit=plan.edits.find(e=>e.expected&&!e.expected.startsWith('this.'));
 const widthEdit=plan.edits.find(e=>e.expected.startsWith('this.'));
 const ast=parse(source,{ecmaVersion:'latest'}),functions=[],assignments=[];
 walk.full(ast,n=>{if(n.type==='FunctionDeclaration')functions.push(n);if(n.type==='AssignmentExpression')assignments.push(n);});
 const glyph=functions.filter(n=>n.start<=glyphEdit.start&&n.end>=glyphEdit.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
 const width=assignments.filter(n=>n.start<=widthEdit.start&&n.end>=widthEdit.end&&n.right.type==='FunctionExpression').sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0];
 const helpers=['ret','eet'].map(name=>functions.find(n=>n.id.name===name&&Math.abs(n.start-glyph.start)<10000));
 assert.ok(helpers.every(Boolean));
 const patchedNode=node=>{
  let text=source.slice(node.start,node.end);
  for(const edit of [...plan.edits].reverse())if(edit.start>=node.start&&edit.end<=node.end)
   text=text.slice(0,edit.start-node.start)+edit.text+text.slice(edit.end-node.start);
  return text;
 };
 const f=fixture();f.language('ru');
 const native={window:f.page,Zq:type=>type.prototype,nI:{v64:()=>1},G$:(text,index)=>text.charCodeAt(index),H$:code=>code,
  Nq:(a,b)=>a*b,tT:value=>value,aet:()=>{},uet:()=>{},oet:()=>{},x$:()=>{throw Error('Unexpected action-log part');}};
 vm.runInNewContext(`function zet(){}function det(){}det.prototype=Object.create(zet.prototype);
 function get(text){this.u11l_1=text;this.v11l_1={};}get.prototype=Object.create(zet.prototype);
 ${[...helpers,glyph,width].map(patchedNode).join(';\n')}`,native,{timeout:1000});
 const iterable=items=>({t(){let i=0;return {u:()=>i<items.length,v:()=>items[i++]};}});
 const self=new native.get('[TAG] Kaspersky'),other=new native.get('Opponent'),icon=new native.det();
 const scenarios={selfDestruction:[icon,self],equipmentChange:[icon,self],kill:[self,icon,other],death:[other,icon,self]};
 const makeFont=characters=>({c63_1:16,g63_1:{m63_1:Object.fromEntries([...characters].map(c=>[c.charCodeAt(0),{
  t63_1:1,r63_1:0,p63_1:1,s63_1:0,q63_1:1,u63_1:0,v63_1:1,w63_1:0,x63_1:1}]))}});
 const latin=Array.from({length:95},(_,i)=>String.fromCharCode(i+32)).join('');
 const log={o11h_1:makeFont(latin),q11h_1:0,b11i_1:0};
 const row=items=>({r11l_1:iterable(items),s11l_1:0});
 f.page.__kaspKillFeedPrivacy={text:value=>value==='[TAG] Kaspersky'?'Скрыто':value};
 assert.throws(()=>native.ret(log,row(scenarios.selfDestruction)),/t63_1/,'reproduces the reported crash with the previous replacement');
 f.page.__kaspKillFeedPrivacy=f.bridge;
 for(const characters of [latin,latin+'Скрыто',latin.replace('H','')]){
  log.o11h_1=makeFont(characters);
  const replacement=f.bridge.text(self.u11l_1,log.o11h_1.g63_1.m63_1);
  assert.equal(replacement,characters.includes('С')?'Скрыто':characters.includes('H')?'Hidden':'');
  for(const [event,items] of Object.entries(scenarios)){
   const before=log.b11i_1,entry=row(items),expected=items.reduce((sum,item)=>sum+22+6+(item===self?replacement.length:item===other?8:0),0);
   assert.equal(native.ret(log,entry),expected,event+' width');
   native.eet(log,entry,0,0);
   assert.equal(log.b11i_1-before,replacement.length+(items.includes(other)?8:0),event+' geometry');
   assert.equal(self.u11l_1,'[TAG] Kaspersky');assert.equal(other.u11l_1,'Opponent');
  }
 }
 const all=[];for(const file of fs.readdirSync('src/generated'))if(file.endsWith('.json')){
  const data=JSON.parse(fs.readFileSync('src/generated/'+file,'utf8'));
  const match=data.plans?.find(p=>p.sha256===plan.sha256&&patches.validatePatchEdits(source,p));if(match)all.push(match);
 }
 const merged=patches.mergeClientPatchPlans(source,all);assert.equal(merged.rejected.length,0);parse(merged.code,{ecmaVersion:'latest'});
});
