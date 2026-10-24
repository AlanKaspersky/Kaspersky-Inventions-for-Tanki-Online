const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const acorn = require('acorn');
const walk = require('acorn-walk');
const root = path.resolve(__dirname, "../../..");
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function sources(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
        const name = directory + '/' + entry.name;
        return entry.isDirectory() ? sources(name) : name.endsWith('.ts') ? [name] : [];
    });
}
test('TypeScript contains no explicit any tokens', () => {
    const violations = [];
    for (const file of sources('src')) {
        for (const token of acorn.tokenizer(read(file), { ecmaVersion: 'latest', locations: true })) {
            if (token.type.label === 'name' && token.value === 'any') violations.push(`${file}:${token.loc.start.line}`);
        }
    }
    assert.deepEqual(violations, []);
});
test('native game selector and class literals in TypeScript are centralized in gameDOM', () => {
    const violations = [];
    const native = /\b[A-Za-z_][\w-]*(?:Style|Component)-[\w-]+|\bksc-\d+\b|\.-(?:activeMenu|whiteSpaceNoWrap|backgroundImage\w*)\b/g;
    for (const file of sources('src').filter(file => file !== 'src/core/gameDOM.ts' && !file.endsWith('.d.ts'))) {
        const code = transformSync(read(file), { loader: 'ts', format: 'esm' }).code;
        const check = value => {
            for (const match of value.matchAll(native)) if (!match[0].startsWith('kasp-')) violations.push(`${file}: ${match[0]}`);
        };
        walk.simple(acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module' }), {
            Literal(node) { if (typeof node.value === 'string') check(node.value); },
            TemplateElement(node) { check(node.value.cooked || ''); },
        });
    }
    assert.deepEqual(violations, []);
});
test('package metadata, documented versions/license and local release gates agree', () => {
    const pkg = JSON.parse(read('package.json')), lock = JSON.parse(read('package-lock.json'));
    const manifest = JSON.parse(read('manifest.json'));
    assert.equal(pkg.version, manifest.version);
    assert.equal(lock.version, pkg.version);
    assert.equal(lock.packages[''].version, pkg.version);
    assert.equal(pkg.license, 'UNLICENSED');
    assert.equal(lock.packages[''].license, pkg.license);
    for (const file of ['README.md', 'DOCUMENTATION.md']) {
        assert.ok(read(file).includes(pkg.version), `${file}: missing current version`);
        assert.ok(read(file).includes('`UNLICENSED`'), `${file}: missing license`);
        assert.ok(!/There is no `npm test`/.test(read(file)), `${file}: obsolete test instructions`);
    }
    assert.equal(pkg.scripts.test, 'node tools/run-tests.cjs');
    assert.equal(pkg.scripts.check, 'npm run typecheck && npm test');
    assert.ok(pkg.scripts.build.startsWith('npm run check &&'));
    assert.ok(pkg.scripts['build:zip'].startsWith('npm run check &&'));
});
