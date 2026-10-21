const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const {transformSync}=require('esbuild');
const runFeatureContext=require('./test-feature-context.cjs');
const patches=require('./test-client-patches.cjs');
const {analyzeSupplyPrivacy}=require('./supply-privacy-ast.cjs');
const source=Array.from({length:4},(_,i)=>`function Widget${i}(){};proto(Widget${i}).count=function(n){
 if(!(n>=0))throw Error("Count must be non-negative, was "+n);
 this.label.setText(n>=10000&&n<=999999?(n/1000|0)+"k":n>=1000000?(n/1000000|0)+"m":""+n);
};`).join('\n');
function fixture(enabled=false){
 const listeners=new Map(),intervals=new Set(),page={addEventListener:(n,h)=>listeners.set(n,h),removeEventListener:n=>listeners.delete(n),
 setInterval:h=>(intervals.add(h),h),clearInterval:h=>intervals.delete(h)};
 const module={exports:{}};
 const context={module,window:page,localStorage:{getItem:()=>String(enabled)},require:()=>patches};
 runFeatureContext(transformSync(fs.readFileSync('src/core/supplyPrivacy.ts','utf8'),{loader:'ts',format:'cjs'}).code,context);
 context.require('./featureRuntime').installFeatureDiagnostics(page,'page');
 module.exports.installSupplyPrivacy(page);
 return {page,api:module.exports,toggle(value,event=true){enabled=value;if(event)listeners.get('kasp:settings-changed')();else for(const h of intervals)h();},
 disable:()=>page.__kaspPageModulesDebug.disable('supplyPrivacy')};
}
test('only the displayed count changes; toggles restore the latest native value, including zero',()=>{
 const f=fixture(),label={text:'',setText(text){this.text=text;}};
 const draw=text=>label.setText(f.page.__kaspSupplyPrivacy.text(label,'setText',text));
 draw('96k');assert.equal(label.text,'96k');
 f.toggle(true);assert.equal(label.text,'0');
 draw('95k');assert.equal(label.text,'0');
 f.toggle(false);assert.equal(label.text,'95k');
 f.toggle(true,false);assert.equal(label.text,'0');
 draw('0');f.toggle(false);assert.equal(label.text,'0');
 draw('12');f.toggle(true);f.disable();assert.equal(label.text,'12');
 draw('11');assert.equal(label.text,'11');
});
test('count renderers start masked when the saved setting is enabled',()=>{
 const f=fixture(true),label={value:'',setText(value){this.value=value;}};
 label.setText(f.page.__kaspSupplyPrivacy.text(label,'setText','61k'));
 assert.equal(label.value,'0');
 f.toggle(false);assert.equal(label.value,'61k');
});
test('offline patch changes only the text argument and retains native formatting/validation',()=>{
 const plan=analyzeSupplyPrivacy(source);assert.equal(plan.status.ready,true);assert.equal(plan.edits.length,4);
 const f=fixture(true),context={window:f.page,proto:t=>t.prototype};
 const merged=patches.mergeClientPatchPlans(source,[plan]);assert.equal(merged.rejected.length,0);
 vm.runInNewContext(merged.code,context);
 const widget=new context.Widget0();widget.label={text:'',setText(v){this.text=v;}};
 widget.count(61000);assert.equal(widget.label.text,'0');
 assert.throws(()=>widget.count(-1),/non-negative/);
 f.toggle(false);assert.equal(widget.label.text,'61k');
 widget.count(1234567);assert.equal(widget.label.text,'1m');
});
test('renderer templates survive native renaming and reject extra or incomplete candidates',async()=>{
 const plan=analyzeSupplyPrivacy(source),renamed=source.replace(/Widget/g,'Renamed').replace(/setText/g,'write').replace(/label/g,'caption').replace(/\bn\b/g,'amount');
 const f=fixture();const adapted=await f.api.selectSupplyPrivacyPlan(renamed,[plan]);
 assert.ok(adapted);assert.ok(f.api.supplyPrivacyPlanValid(renamed,adapted));
 const context={window:f.page,proto:t=>t.prototype};vm.runInNewContext(patches.mergeClientPatchPlans(renamed,[adapted]).code,context);
 const widget=new context.Renamed0();widget.caption={text:'',write(v){this.text=v;}};
 widget.count(123);f.toggle(true);assert.equal(widget.caption.text,'0');f.toggle(false);assert.equal(widget.caption.text,'123');
 assert.equal(analyzeSupplyPrivacy(source.slice(0,source.lastIndexOf('function Widget3'))).status.ready,false);
 assert.equal(analyzeSupplyPrivacy(source+source.replace(/Widget/g,'Other')).status.ready,false);
});
