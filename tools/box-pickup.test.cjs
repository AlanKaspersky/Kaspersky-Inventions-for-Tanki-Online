const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {test}=require('node:test');
const {parse}=require('acorn');
const {transformSync}=require('esbuild');
const runFeatureContext=require('./test-feature-context.cjs');
const patches=require('./test-client-patches.cjs');
const {analyzeBoxPickup}=require('./box-pickup-ast.cjs');
const plan=require('../src/generated/box-pickup.json').plans[0],schema=plan.schema;

function fixture(initial=false,options={}){
    let enabled=initial,now=0,next=0;
    const frames=new Map(),timers=new Map(),storage=new Map(),page=new EventTarget(),canvas={isConnected:true};
    page.document={querySelector:()=>canvas};
    page.requestAnimationFrame=cb=>{const id=++next;frames.set(id,cb);return id;};
    page.cancelAnimationFrame=id=>frames.delete(id);
    page.setInterval=cb=>{const id=++next;timers.set(id,cb);return id;};
    page.clearInterval=id=>timers.delete(id);
    const s=schema;
    class Vector{constructor(x=0,y=0,z=0){this[s.x]=x;this[s.y]=y;this[s.z]=z;}[s.vectorSet](x,y,z){this[s.x]=x;this[s.y]=y;this[s.z]=z;}}
    const log={created:0,released:0,rayCalls:0,disposed:0,pickups:0,originalGeometry:null};
    class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize;}}
    class Geometry{
        constructor(){this.attributes={position:new Attribute(new Float32Array([0,0,0]),3)};}
        setAttribute(name,value){this.attributes[name]=value;}
        dispose(){log.disposed++;}
    }
    const sharedGeometry=new Geometry();log.originalGeometry=sharedGeometry;
    const spawned=[];
    const pool={ [s.acquire](){ if(options.failAcquire)throw Error('pool failed');const box=makeBox();spawned.push(box);log.created++;return box;} };
    function makeBox(){
        const box={
            [s.pool]:pool,[s.render]:{[s.position]:new Vector(0,0,75),[s.rotation]:new Vector(),[s.scale]:new Vector(1,1,1)},
            [s.material]:{[s.glow]:{[s.colorSet](r,g,b,a){box.glow=[r,g,b,a];}}},
            [s.reset](){this.scale=1;this.alpha=1;},[s.attach](world){this.world=world;},[s.detach](){this.world=null;},
            [s.release](){assert.equal(this.returned,undefined,'renderer returned twice');this.returned=true;log.released++;},
            [s.uniformScale](value){if(options.failFlash&&value!==1)throw Error('render failed');this.scale=value;},
            [s.opacity](value){this.alpha=value;},[s.colorReset](){this.glow=[0,0,0,0];}
        };
        if(options.geometry)box[s.render].geometry=sharedGeometry;
        return box;
    }
    const world={ [s.ray](o,d,distance,mask,result){log.rayCalls++;result[s.rayPosition][s.z]=0;return true;} };
    class Hit{constructor(){this[s.rayPosition]=new Vector();}[s.rayReset](){} }
    const module={exports:{}};
    const context={module,window:page,Event,localStorage:{getItem:key=>key==='k_box_pickup'?String(enabled):storage.get(key)??null},
        performance:{now:()=>now},require:id=>id==='./clientPatches'?patches:id==='./gameDOM'?{gameDOM:{screens:{battleCanvas:'.battle'}}}:null};
    runFeatureContext(transformSync(fs.readFileSync('src/core/boxPickup.ts','utf8'),{loader:'ts',format:'cjs'}).code,context);
    const bridge=module.exports.installBoxPickup(page);if(!options.noRay)bridge.captureRay(new Hit());
    context.require('./featureRuntime').installFeatureDiagnostics(page,'page');
    const original=makeBox();
    const pickup=()=>{const anim={[s.world]:world,[s.box]:original};bridge.start(anim,original,s);return anim;};
    return {page,bridge,api:module.exports,original,world,frames,timers,spawned,canvas,log,pickup,
        setTime(value){now=value;},
        tick(value){now=value;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(now));},
        toggle(value,event=true){enabled=value;if(event)page.dispatchEvent(new Event('kasp:settings-changed'));else [...timers.values()].forEach(cb=>cb());},
        disable(){page.__kaspPageModulesDebug.disable('boxPickup');}
    };
}
test('disabled by default and no visual work or original renderer modification',()=>{
    const f=fixture();const anim=f.pickup();
    assert.equal(f.log.created,0);assert.equal(f.frames.size,0);assert.equal(f.bridge.frame(anim,()=>assert.fail()),false);
    assert.equal(f.bridge.status().enabled,false);
});
test('pickup flashes and invokes the native completion once; pieces fade and return after three seconds',()=>{
    const f=fixture(true),anim=f.pickup();let completions=0;
    assert.equal(f.bridge.status().pieces,14);assert.equal(f.frames.size,1);
    f.setTime(110);assert.equal(f.bridge.frame(anim,()=>completions++),true);assert.ok(f.original.scale>1);assert.ok(f.original.alpha<1);
    f.setTime(221);assert.equal(f.bridge.frame(anim,()=>completions++),true);
    assert.equal(completions,1);assert.equal(f.original.scale,1);assert.equal(f.original.alpha,1);
    assert.equal(f.bridge.frame(anim,()=>completions++),false);assert.equal(completions,1);
    f.tick(2600);assert.ok(f.spawned.every(box=>box.alpha>0&&box.alpha<1));
    f.tick(3001);assert.equal(f.bridge.status().pieces,0);assert.equal(f.log.released,14);assert.equal(f.frames.size,0);
});
test('toggle clears owned renderers and restores the flash; page-world polling handles isolated settings events',()=>{
    const f=fixture(true),anim=f.pickup();f.setTime(100);f.bridge.frame(anim,()=>assert.fail());
    f.toggle(false,false);
    assert.equal(f.bridge.status().pieces,0);assert.equal(f.bridge.status().flashes,0);assert.equal(f.log.released,14);
    assert.equal(f.original.scale,1);assert.equal(f.original.alpha,1);assert.equal(f.frames.size,0);
    f.toggle(true);f.pickup();assert.equal(f.bridge.status().pieces,14);
});
test('world changes, canvas removal, pagehide and feature guard dispose every owned renderer',()=>{
    for(const action of ['world','canvas','pagehide','disable']){
        const f=fixture(true);f.pickup();
        if(action==='world'){const anim={[schema.world]:{}};f.bridge.start(anim,f.original,schema);assert.equal(f.log.released,14);f.toggle(false);}
        if(action==='canvas'){f.canvas.isConnected=false;f.tick(17);}
        if(action==='pagehide')f.page.dispatchEvent(new Event('pagehide'));
        if(action==='disable')f.disable();
        assert.equal(f.frames.size,0,action);assert.equal(f.log.created,f.log.released,action);
    }
});
test('native pool capacity is bounded during many simultaneous pickups',()=>{
    const f=fixture(true);for(let i=0;i<100;i++)f.pickup();
    assert.ok(f.bridge.status().pieces<=140);assert.equal(f.frames.size,1);
    f.toggle(false);assert.equal(f.log.created,f.log.released);
});
test('shard geometry belongs to a single fragment and is restored before returning to the pool',()=>{
    const f=fixture(true,{geometry:true});f.pickup();
    assert.equal(f.original[schema.render].geometry,f.log.originalGeometry);
    assert.ok(f.spawned.every(box=>box[schema.render].geometry!==f.log.originalGeometry));
    assert.equal(new Set(f.spawned.map(box=>box[schema.render].geometry)).size,14);
    f.toggle(false);assert.ok(f.spawned.every(box=>box[schema.render].geometry===f.log.originalGeometry));
    assert.equal(f.log.disposed,14);
});
test('runtime errors fall back to the native update and repeated failures disable only this effect',()=>{
    const f=fixture(true,{failAcquire:true});
    for(let i=0;i<3;i++){const anim=f.pickup();assert.equal(f.bridge.frame(anim,()=>assert.fail()),false);}
    assert.equal(f.bridge.status().runtime.disabled,true);assert.equal(f.frames.size,0);
});
test('terrain probes are bounded per frame and fading still works without a ray class',()=>{
    const f=fixture(true);for(let i=0;i<12;i++)f.pickup();
    const before=f.log.rayCalls;f.tick(500);assert.ok(f.log.rayCalls-before<=f.api.BOX_PICKUP.rayBudget);
    f.tick(3001);assert.equal(f.log.created,f.log.released);
    const fallback=fixture(true,{noRay:true});fallback.pickup();fallback.tick(1000);fallback.tick(3001);
    assert.equal(fallback.log.rayCalls,0);assert.equal(fallback.log.created,fallback.log.released);
});
test('a flash renderer error restores the box and stops overriding native updates',()=>{
    const f=fixture(true,{failFlash:true}),anim=f.pickup();f.setTime(100);
    assert.equal(f.bridge.frame(anim,()=>assert.fail()),true);
    assert.equal(f.original.scale,1);assert.equal(f.original.alpha,1);
    assert.equal(f.bridge.frame(anim,()=>assert.fail()),false);
    f.tick(3001);assert.equal(f.log.created,f.log.released);
});

test('real game AST contract parses and coexists with other prepared hooks; templates survive renaming',
    {skip:!fs.existsSync('main.js'),timeout:60000},()=>{
    const source=fs.readFileSync('main.js','utf8');
    const prepared=analyzeBoxPickup(source);assert.equal(prepared.status.ready,true,JSON.stringify(prepared.status));
    assert.equal(prepared.edits.length,4);assert.ok(patches.validatePatchEdits(source,prepared));
    const adapted=patches.resolveTemplateEdits(source,prepared);assert.ok(adapted);
    assert.equal(adapted.edits.length,4);
    const renamed=source.replace(/\b(?:b116_1|c116_1|z115_1|b114_1|u35_1|t35_1|n23|f20_1|g20_1|h20_1|v35_1|c113_1|l116|f114|k116|p2d|b113_1|l119|f6u_1|k29|k119|z117|xy|n9m|v9q_1|d3)\b/g,name=>'native_'+name);
    const changed=patches.resolveTemplateEdits(renamed,prepared);assert.ok(changed,'renamed native fields');
    const renamedCode=patches.mergeClientPatchPlans(renamed,[{...prepared,sourceLength:renamed.length,edits:changed.edits}]).code;
    parse(renamedCode,{ecmaVersion:'latest'});
    assert.ok(renamedCode.includes('"render":"native_b114_1"'));
    assert.ok(renamedCode.includes('__kaspBoxPickup?.start'));
    const all=[];
    for(const file of fs.readdirSync('src/generated'))if(file.endsWith('.json')){
        const data=JSON.parse(fs.readFileSync('src/generated/'+file,'utf8'));
        const other=data.plans?.find(p=>p.sha256===prepared.sha256&&patches.validatePatchEdits(source,p));
        if(other)all.push(other);
    }
    const merged=patches.mergeClientPatchPlans(source,all);
    assert.equal(merged.rejected.length,0,'conflicting native hook');parse(merged.code,{ecmaVersion:'latest'});
    const unsupported=source.replace(/recyclePickupAnimation/g,'unrecognizedPickup');
    assert.equal(patches.resolveTemplateEdits(unsupported,prepared),undefined);
    assert.equal(analyzeBoxPickup('function unknown(){}').status.ready,false);
});
