const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const { webcrypto } = require('node:crypto');
const lexical = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/clientLexical.ts'), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: lexical });
const moduleRef = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync(path.join(__dirname, '../src/core/clientPatches.ts'), 'utf8'),
    { loader: 'ts', format: 'cjs' }).code, { module: moduleRef, crypto: webcrypto, TextEncoder,
        require: id => { if (id === './clientLexical') return lexical.exports; throw Error('Unexpected import: ' + id); } });
module.exports = moduleRef.exports;
