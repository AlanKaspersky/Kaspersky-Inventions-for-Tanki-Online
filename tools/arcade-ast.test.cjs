const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { parse } = require('acorn');
const { analyzeArcade } = require('./arcade-ast.cjs');
const { analyzeOverdrive } = require('./overdrive-ast.cjs');
const { mergeClientPatchPlans } = require('./test-client-patches.cjs');
const fixture = name => fs.readFileSync(path.join(__dirname,name),'utf8').match(/const source = `([\s\S]*?)`;/)[1];

test('both AST plans apply to original offsets together; conflicting or stale plans cannot remove valid patches', () => {
    const source=fixture('arcade-reload.test.cjs')+'\n'+fixture('overdrive-ast.test.cjs');
    const arcade=analyzeArcade(source),overdrive=analyzeOverdrive(source);
    assert.equal(arcade.status.ready,true);assert.equal(overdrive.status.ready,true);
    const merged=mergeClientPatchPlans(source,[overdrive,arcade]);
    assert.equal(merged.rejected.length,0);parse(merged.code,{ecmaVersion:'latest'});
    assert.ok(merged.code.includes('__kaspArcadeHudCreate'));assert.ok(merged.code.includes('__kaspBonusPrepare'));
    const alone=mergeClientPatchPlans(source,[overdrive]);
    const bad={...arcade,edits:arcade.edits.map((e,i)=>i===1?{...e,before:'stale'}:e)};
    assert.equal(mergeClientPatchPlans(source,[overdrive,bad]).code,alone.code);
    const collision={...arcade,edits:[overdrive.edits.find(e=>e.end>e.start)]};
    const result=mergeClientPatchPlans(source,[overdrive,collision]);
    assert.equal(result.code,alone.code);assert.equal(result.rejected[0],collision);
});

test('arcade CLI validates generated syntax without executing the input and preserves working plans on failure', () => {
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ki-arcade-ast-')),input=path.join(dir,'main.js'),output=path.join(dir,'plans.json');
    const run=()=>spawnSync(process.execPath,[path.join(__dirname,'prepare-arcade.cjs'),input,'--out',output],{encoding:'utf8'});
    try{
        const source="throw new Error('DO_NOT_EXECUTE');\n"+fixture('arcade-reload.test.cjs');
        fs.writeFileSync(input,source);let result=run();assert.equal(result.status,0,result.stderr);
        const data=JSON.parse(fs.readFileSync(output,'utf8'));assert.equal(data.format,'ki-arcade-plans-v1');assert.equal(data.plans[0].status.ready,true);
        assert.equal(fs.readFileSync(input,'utf8'),source);
        const previous=fs.readFileSync(output,'utf8');fs.writeFileSync(input,source.replace('progressBarMaterial','removedMaterial'));
        result=run();assert.equal(result.status,1);assert.equal(fs.readFileSync(output,'utf8'),previous);
    }finally{for(const file of[input,output])if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir);}
});
