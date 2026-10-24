const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { parseClient } = require("../../parser/client-parser.cjs");
const cli = path.join(__dirname, "../../parser/client-parser.cjs");

function fixture(run) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-parser-'));
    try { run(dir); }
    finally {
        for (const name of ['main.js', 'ast.json', 'executed']) {
            const file = path.join(dir, name);
            if (fs.existsSync(file)) fs.unlinkSync(file);
        }
        fs.rmdirSync(dir);
    }
}

test('parsing preserves source offsets and never executes game code; modules are explicit', () => fixture(dir => {
    const input = path.join(dir, 'main.js');
    const source = `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'executed'))}, 'bad');\nconst id=123n; const pattern=/a+/g;`;
    fs.writeFileSync(input, source);
    const result = parseClient(input);
    assert.equal(result.bytes, Buffer.byteLength(source));
    assert.match(result.sha256, /^[0-9a-f]{64}$/);
    const statement = result.ast.body[1];
    assert.equal(source.slice(statement.start, statement.end), 'const id=123n;');
    assert.equal(statement.loc.start.line, 2);
    assert.equal(fs.existsSync(path.join(dir, 'executed')), false);
    fs.writeFileSync(input, 'export const value=1;');
    assert.throws(() => parseClient(input), SyntaxError);
    assert.equal(parseClient(input, 'module').ast.sourceType, 'module');
}));

test('CLI exports JSON AST, reports invalid syntax and protects input and existing outputs', () => fixture(dir => {
    const input = path.join(dir, 'main.js'), output = path.join(dir, 'ast.json');
    const source = 'const id=123n; const pattern=/a+/g;';
    fs.writeFileSync(input, source);
    const run = args => spawnSync(process.execPath, [cli, input, ...args], { encoding: 'utf8' });
    const result = run(['--ast', output]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ast, output);
    const ast = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(ast.type, 'Program');
    assert.equal(ast.body[0].declarations[0].init.bigint, '123');
    assert.deepEqual(ast.body[1].declarations[0].init.regex, { pattern: 'a+', flags: 'g' });
    assert.equal(run(['--ast', output]).status, 1);
    assert.equal(run(['--ast', input]).status, 1);
    assert.equal(fs.readFileSync(input, 'utf8'), source);
    fs.writeFileSync(input, 'const = ;');
    const failed = run([]);
    assert.equal(failed.status, 1); assert.match(failed.stderr, /Unexpected token/);
}));
