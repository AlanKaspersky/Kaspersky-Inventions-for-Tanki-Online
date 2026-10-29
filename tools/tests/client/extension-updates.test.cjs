const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { transformSync } = require('esbuild');
const { parse } = require('acorn');

// Exercise the actual startup functions without starting Electron or touching a profile.
if (!process.env.KI_CLIENT_SOURCE) {
    test('companion client extension updates', { skip: 'Set KI_CLIENT_SOURCE to the companion client src/main.ts' }, () => {});
} else {
const source = fs.readFileSync(path.resolve(process.env.KI_CLIENT_SOURCE), 'utf8');
const javascript = transformSync(source, { loader: 'ts', format: 'esm', target: 'es2022' }).code;
const ast = parse(javascript, { ecmaVersion: 'latest', sourceType: 'module' });
const names = ['selectExtensions', 'updateAndLoadExtensions', 'updateExtension'];
const extracted = ast.body.filter(node => node.type === 'FunctionDeclaration' && names.includes(node.id?.name));
assert.equal(extracted.length, names.length);
const transpile = nodes => nodes.map(node => javascript.slice(node.start, node.end)).join('\n');
const code = transpile(extracted.filter(node => node.id.name !== 'updateExtension'));
const updateCode = transpile(extracted.filter(node => node.id.name === 'updateExtension'));
const KEY = 'official-public-key', NAME = "Tanki Online: Kaspersky's Inventions";
const base = path.resolve('profile', 'extensions');
const item = (name, manifest) => ({ path: path.join(base, name), manifest });
function fixture(installed = [], reserved = installed.map(extension => extension.path), updateFailure = null) {
    const updated = [], loaded = [], logs = [], reads = [], gates = [];
    const context = { Path:path, KASPERSKY_EXTENSION_KEY:KEY,
        FS:{existsSync:()=>true,mkdirSync(){throw Error('Unexpected write');},
            readdirSync:()=>reserved.map(directory=>({name:path.basename(directory),isDirectory:()=>true})),
            readFileSync:filename=>{reads.push(filename);const entry=installed.find(extension=>path.dirname(filename)===extension.path);if(!entry)throw Error('Invalid manifest');return JSON.stringify(entry.manifest);}},
        log:{info:value=>logs.push(value),warn:value=>logs.push(value),error:value=>logs.push(String(value))},
        updateExtension:async extension=>{updated.push(extension);if(updateFailure)throw updateFailure;},
        installKiGameGate:(_session,id)=>{gates.push(id);return 'chrome-extension://'+id+'/dist/kasp_game_gate.js';},
        session:{defaultSession:{extensions:{loadExtension:async directory=>{loaded.push(directory);return {id:'a'.repeat(32)};}}}}
    };
    vm.runInNewContext(code, context);
    return {context,updated,loaded,logs,reads,gates,
        select:()=>context.selectExtensions(installed,base,KEY,reserved),
        start:()=>context.updateAndLoadExtensions(path.dirname(base))};
}

test('store KI wins over local copies regardless of discovery order and advertised version',()=>{
    const local=item('local',{name:NAME,version:'999.0'}),store=item('managed',{name:NAME,key:KEY,version:'2.9.8'});
    for(const candidates of [[local,store],[store,local]]){
        const result=fixture(candidates).select();
        assert.equal(result.preferredKI,store);assert.deepEqual([...result.selected],[store]);
        assert.deepEqual([...result.skipped],[local]);assert.equal(local.manifest.key,undefined);
    }
});

test('local-only canonical installation requests an official update in a separate free directory',async()=>{
    const local=item('kaspersky-inventions',{name:NAME,version:'2.9.8'}),f=fixture([local]);
    await f.start();
    assert.equal(f.updated.length,1);assert.equal(f.updated[0].manifest.key,KEY);
    assert.equal(f.updated[0].path,path.join(base,'kaspersky-inventions-store'));
    assert.deepEqual(f.loaded,[path.join(base,'kaspersky-inventions-store')]);
    assert.equal(local.manifest.key,undefined);assert.ok(!f.loaded.includes(local.path));
});

test('fresh profile uses the canonical managed path and preserves unrelated extensions',async()=>{
    const fresh=fixture().select();assert.equal(fresh.preferredKI.path,path.join(base,'kaspersky-inventions'));
    assert.equal(fresh.preferredKI.manifest.key,KEY);
    const ordinary=item('other',{name:'Other',key:'other-key'}),f=fixture([ordinary]);
    await f.start();assert.equal(f.updated.length,2);assert.equal(f.updated[0].path,ordinary.path);
    assert.equal(f.updated[1].manifest.key,KEY);
    assert.deepEqual(f.loaded,[ordinary.path,path.join(base,'kaspersky-inventions')]);
});

test('directory collisions, invalid manifests and local copies never become an update destination',()=>{
    const local=item('kaspersky-inventions',{name:NAME});
    const occupied=[local.path,path.join(base,'kaspersky-inventions-store'),path.join(base,'kaspersky-inventions-store-2')];
    const result=fixture([local],occupied).select();
    assert.equal(result.preferredKI.path,path.join(base,'kaspersky-inventions-store-3'));
    assert.ok(!occupied.includes(result.preferredKI.path));
});

test('canonical official copy wins among duplicates and public-key identity survives a name change',async()=>{
    const alternate=item('old-store',{key:KEY,name:NAME}),canonical=item('kaspersky-inventions',{key:KEY,name:'Localized KI'});
    const ordinary=item('other',{name:'Other'}),f=fixture([alternate,ordinary,canonical]);
    const result=f.select();assert.equal(result.preferredKI,canonical);
    assert.deepEqual([...result.selected],[ordinary,canonical]);
    await f.start();assert.deepEqual(f.loaded,[ordinary.path,canonical.path]);
});

test('failed update check still loads the installed official copy and continues other extensions',async()=>{
    const store=item('kaspersky-inventions',{key:KEY,name:NAME,version:'2.9.8'}),ordinary=item('other',{name:'Other'});
    const f=fixture([store,ordinary],undefined,new Error('Update endpoint offline'));
    await f.start();assert.deepEqual(f.loaded,[store.path,ordinary.path]);
    assert.equal(f.updated.length,2);assert.equal(f.logs.filter(line=>line.includes('Update endpoint offline')).length,2);
});

test('client 1.0.8 installs one native gate for the selected KI extension',async()=>{
    if(!source.includes('installKiGameGate'))return;
    const store=item('kaspersky-inventions',{key:KEY,name:NAME}),ordinary=item('other',{name:'Other'}),f=fixture([store,ordinary]);
    await f.start();assert.deepEqual(f.gates,['a'.repeat(32)]);
    assert.ok(f.logs.some(line=>line.includes('[KI Game Gate] Enabled:')));
    assert.ok(!f.logs.some(line=>line.includes('Not active:')));
});

function updater(downloaded={name:NAME,version:'3.0.0'}, installFailure=false) {
    const files=new Map(),removed=[],renamed=[],extension=item('kaspersky-inventions-store',{key:KEY,version:'2.9.8',update_url:'https://updates.example.test/crx'});
    files.set(path.join(extension.path,'manifest.json'),JSON.stringify(extension.manifest));
    const context={Path:path,extensionKeyToID:()=> 'official-id',getLatestExtensionVersion:async()=>({version:'3.0.0',crx:'https://download.example.test/package.crx'}),
        application:{getPath:()=>path.resolve('temp')},
        FileDownloader:class {async download(){}},unwrapCRX:()=>Buffer.from('zip'),fixZipEntryPermissions(){},
        extractZip:async(_file,{dir})=>files.set(path.join(dir,'manifest.json'),JSON.stringify(downloaded)),
        FS:{readFileSync:filename=>files.get(filename)||Buffer.from('crx'),writeFileSync:(filename,value)=>files.set(filename,value),
            mkdtempSync:prefix=>prefix+'fixture',existsSync:directory=>[...files.keys()].some(file=>file===directory||file.startsWith(directory+path.sep)),
            renameSync:(from,to)=>{if(installFailure&&to===extension.path&&!from.endsWith('-previous'))throw Error('Directory locked');renamed.push([from,to]);
                for(const [filename,data] of [...files])if(filename.startsWith(from+path.sep)){files.delete(filename);files.set(to+filename.slice(from.length),data);}},
            rmSync:filename=>{removed.push(filename);for(const file of [...files.keys()])if(file===filename||file.startsWith(filename+path.sep))files.delete(file);}}};
    vm.runInNewContext(updateCode,context);
    return {extension,files,removed,renamed,run:()=>context.updateExtension(extension)};
}

test('store CRX without a manifest key retains its registered key and updater URL for the next launch',async()=>{
    const f=updater();await f.run();
    const installed=JSON.parse(f.files.get(path.join(f.extension.path,'manifest.json')));
    assert.equal(installed.key,KEY);assert.equal(installed.version,'3.0.0');
    assert.equal(installed.update_url,'https://updates.example.test/crx');
    const next=fixture([{path:f.extension.path,manifest:installed}]).select();
    assert.equal(next.preferredKI.path,f.extension.path);assert.equal(next.selected.length,1);
    assert.equal(f.extension.manifest.version,'3.0.0');
});

test('downloaded manifest mismatch is rejected and temporary archives are cleaned',async()=>{
    for(const downloaded of [{name:NAME,version:'2.0.0'},{name:NAME,version:'3.0.0',key:'foreign-key'}]){
        const f=updater(downloaded);await assert.rejects(f.run(),/identity\/version mismatch/);
        assert.ok(f.removed.some(filename=>filename.endsWith('.crx')));
        assert.ok(f.removed.some(filename=>filename.endsWith('.zip')));
        assert.equal(f.extension.manifest.version,'2.9.8');
        assert.equal(JSON.parse(f.files.get(path.join(f.extension.path,'manifest.json'))).version,'2.9.8');
        assert.equal(f.renamed.length,0);
    }
});

test('failed directory replacement restores the installed version without removing user files',async()=>{
    const f=updater(undefined,true);
    await assert.rejects(f.run(),/Directory locked/);
    assert.equal(JSON.parse(f.files.get(path.join(f.extension.path,'manifest.json'))).version,'2.9.8');
    assert.ok(f.renamed.some(([from,to])=>from.endsWith('-previous')&&to===f.extension.path));
    assert.ok(!f.removed.includes(f.extension.path));
});
}
