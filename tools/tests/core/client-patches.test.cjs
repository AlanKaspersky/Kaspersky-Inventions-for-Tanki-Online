const runFeatureContext = require("../helpers/feature-context.cjs");
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { webcrypto } = require('node:crypto');
const { tokenizer } = require('acorn');
const { transformSync } = require('esbuild');
const api = require("../helpers/client-patches.cjs");

test('lexical guard excludes regular expressions after controls, blocks and declarations', () => {
    for (const code of [
        'if (ready) /nativeProbe/.test(text);', 'while (ready) /nativeProbe/.exec(text);',
        'for (;;) /nativeProbe/.exec(text);', 'with (obj) /nativeProbe/.test(text);',
        'async function f(){for await (const item of stream) /nativeProbe/.test(item)}',
        '\uFEFF\u00A0/nativeProbe/.test(text);',
        'if\u00A0(ready) /nativeProbe/.test(text);',
        'switch (ready) { case 1: {} /nativeProbe/.test(text); default: {} /other/.test(text); }',
        'switch (ready) { case ready ? 1 : 2: {} /nativeProbe/.test(text); }',
        'label: {} /nativeProbe/.test(text);',
        'function f(){label:while(true){break label\n/nativeProbe/.test(text)}}',
        'if (ready) {} /nativeProbe/.test(text);', 'function f() {} /nativeProbe/.test(text);',
        'class C {} /nativeProbe/.test(text);', 'try {} catch {} /nativeProbe/.test(text);',
        'const f = function() { function g() {} /nativeProbe/.test(text) };',
        'const f = () => { if (ready) /nativeProbe/.test(text) };',
        String.raw`if (ready) /* comment */ /[\]nativeProbe]/.test(text);`,
        'if (ready) /[a/b]nativeProbe\\//g.test(text);',
        'function f(){return\n{} /nativeProbe/.test(text)}',
    ]) {
        const offset = code.indexOf('nativeProbe');
        assert.equal(api.codeOffsets(code, new Set([offset])).has(offset), false, code);
    }
});

test('division, object/function expressions, member keywords and template substitutions remain code', () => {
    for (const code of [
        'const x = value / nativeProbe / denominator;', 'const x = (value) / nativeProbe;',
        'const x = ({ a: 1 }) / nativeProbe;', 'const x = function() {} / nativeProbe;',
        'const x = class {} / nativeProbe;', 'const x = (() => {}) / nativeProbe;',
        'const x = object.return / nativeProbe;', 'const x = object.if(value) / nativeProbe;',
        'const x = value++ / nativeProbe;', 'const x = .1e-2 / nativeProbe;',
        'const x = `text ${nativeProbe()}`;', 'const x = `text ${`inner ${nativeProbe()}`}`;',
    ]) {
        const offset = code.indexOf('nativeProbe');
        assert.equal(api.codeOffsets(code, new Set([offset])).has(offset), true, code);
    }
    for (const code of ['"nativeProbe";', '// nativeProbe\nvar x;', '/* nativeProbe */',
        '`nativeProbe ${realCode()}`', '`x ${/nativeProbe/.test(value)}`']) {
        const offset = code.indexOf('nativeProbe');
        assert.equal(api.codeOffsets(code, new Set([offset])).has(offset), false, code);
    }
    for (const lineEnd of ['\r', '\u2028', '\u2029']) {
        const code = '// comment' + lineEnd + 'nativeProbe();';
        const offset = code.indexOf('nativeProbe');
        assert.equal(api.codeOffsets(code, new Set([offset])).has(offset), true, code);
    }
});

test('lexical filtering agrees with the offline tokenizer on mixed regex/division/template syntax', () => {
    const code = 'function f(x){if(x) /[a/b]+/g.test(x);else x=x/2;return `raw ${x / 2} ${/a/.test(x)}`;}';
    const offsets = new Set(), expected = new Map();
    for (const token of tokenizer(code, { ecmaVersion: 'latest' })) {
        // Acorn uses the same closing-brace token for a block and a template delimiter.
        if (token.type.label === 'eof' || token.type.label === '}' || token.end === token.start) continue;
        const offset = token.start + Math.min(1, token.end - token.start - 1);
        offsets.add(offset);
        expected.set(offset, !['regexp', 'string', 'template', '`', '${'].includes(token.type.label));
    }
    const valid = api.codeOffsets(code, offsets);
    for (const [offset, value] of expected) assert.equal(valid.has(offset), value, code.slice(offset, offset + 20));
});

test('all selectors share one SHA calculation per source and release it after injection', async () => {
    const compile = source => transformSync(source, { loader: 'ts', format: 'cjs' }).code;
    const lexical = { exports: {} }, module = { exports: {} }; let digests = 0;
    runFeatureContext(compile(fs.readFileSync('src/core/clientLexical.ts', 'utf8')), { module: lexical });
    runFeatureContext(compile(fs.readFileSync('src/core/clientPatches.ts', 'utf8')), {
        module, TextEncoder, require: () => lexical.exports,
        crypto: { subtle: { digest(...args) { digests++; return webcrypto.subtle.digest(...args); } } },
    });
    const code = 'const original = 1;', p = module.exports;
    const hashes = await Promise.all(Array.from({ length: 10 }, () => p.clientSourceHash(code)));
    assert.equal(new Set(hashes).size, 1); assert.equal(digests, 1);
    await p.clientSourceHash(code); assert.equal(digests, 1);
    p.releaseClientPatchContext('another source'); await p.clientSourceHash(code); assert.equal(digests, 1);
    p.releaseClientPatchContext(code); await p.clientSourceHash(code); assert.equal(digests, 2);
    await p.clientSourceHash(code + ' '); assert.equal(digests, 3);
});

test('shared configuration headers preserve native strictness and simultaneous header insertions', () => {
    for (const code of ['"other"; /*native*/ "use strict";\nfunction check(){return this===undefined}',
        '"use strict"\nfunction check(){return this===undefined}',
        '"use strict" /*comment before semicolon*/;\nfunction check(){return this===undefined}',
        '"use strict"\n// comment after ASI\nfunction check(){return this===undefined}',
        '"use strict"\u2028function check(){return this===undefined}', 'function check(){return this===undefined}']) {
        const plan = text => ({ sourceLength: code.length, edits: [{ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text }] });
        const headers = ['augments', 'critical'].map(name => plan(api.clientPatchHeader(code, '/*' + name + ':', {}, 'try{window.configure()}catch(ignored){}')));
        for (const order of [headers, [...headers].reverse()]) {
            const merged = api.mergeClientPatchPlans(code, order), context = { window: {} };
            assert.equal(merged.rejected.length, 0); runFeatureContext(merged.code, context);
            assert.equal((0, context.check)(), code.includes('use strict'));
        }
    }
    const expression = '"use strict"\n(function(){})();';
    assert.equal(api.clientPatchHeader(expression, '/*header:', {}, 'setup();').includes('"use strict";'), false);
});
