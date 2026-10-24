const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

test('recovery results are bounded, unassigned, expire and never contain an owner ID', () => {
    let now = 0, sequence = 0;
    const storage = new Map(), module = { exports: {} };
    vm.runInNewContext(transformSync(fs.readFileSync('src/modules/battleHistory/unassigned.ts','utf8'), { loader:'ts',format:'cjs' }).code, {
        module, Date: { now: () => now }, crypto: { randomUUID: () => String(++sequence) },
        sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,value) },
    });
    const api = module.exports;
    for(let i=0;i<30;i++) api.stashUnassignedResult({ userId:'1001',id:99,nickname:'Same name',date:i });
    const results = api.readUnassignedResults();
    assert.equal(results.length,20); assert.ok(results.every(x=>x.owner===null && !('userId' in x.result) && !('id' in x.result)));
    api.removeUnassignedResult(results[0].id); assert.equal(api.readUnassignedResults().length,19);
    now=86400001; assert.equal(api.readUnassignedResults().length,0);
    storage.set(api.UNASSIGNED_HISTORY_KEY,'broken JSON'); assert.equal(api.readUnassignedResults().length,0);
});
