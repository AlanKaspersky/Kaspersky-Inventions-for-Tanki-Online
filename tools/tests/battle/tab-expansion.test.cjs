const assert=require('node:assert/strict');
const fs=require('node:fs');
const {test}=require('node:test');
const {transformSync}=require('esbuild');
const run=require('../helpers/feature-context.cjs');
function fixture(){
 const classes=new Set(),cleanups=[];
 const body={classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)}};
 const module={exports:{}};
 run(transformSync(fs.readFileSync('src/modules/tabExpansion.ts','utf8'),{loader:'ts',format:'cjs'}).code,{module,document:{body,querySelectorAll(){throw Error('No layout queries allowed');}},window:{getComputedStyle(){throw Error('No width snapshots allowed');}}});
 const api=module.exports.createTabExpansion({onCleanup:fn=>cleanups.push(fn)});
 return{...api,classes,cleanups};
}
test('resistance pin switches instantly without measuring or moving the native tables',()=>{
 const f=fixture();f.setExpanded(true);assert.ok(f.classes.has('kasp-tab-expanded'));
 f.setExpanded(true);f.setExpanded(false);assert.equal(f.classes.size,0);
 f.setExpanded(true);assert.equal(f.classes.size,1);
});
test('feature cleanup releases the pinned resistance view',()=>{
 const f=fixture();f.setExpanded(true);f.cleanups.forEach(fn=>fn());assert.equal(f.classes.size,0);
});
