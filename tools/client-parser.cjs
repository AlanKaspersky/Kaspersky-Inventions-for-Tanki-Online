const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parse, version } = require('acorn');

const usage = 'Usage: npm run parse:client -- <main.js> [--module] [--ast <output.json>]';

// Development-only: parse the supplied file without evaluating any game code.
function parseClient(file, sourceType = 'script') {
    const input = path.resolve(file);
    const bytes = fs.readFileSync(input);
    const ast = parse(bytes.toString('utf8'), { ecmaVersion: 'latest', sourceType, locations: true });
    return { input, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ast };
}

function main(args) {
    if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
    let input, output, sourceType = 'script';
    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--module') sourceType = 'module';
        else if (arg === '--ast') {
            output = args[++index];
            if (!output || output.startsWith('--')) throw new Error('--ast requires an output file.');
        } else if (arg.startsWith('-') || input) throw new Error(usage);
        else input = arg;
    }
    if (!input) throw new Error(usage);
    if (output && path.resolve(output).toLowerCase() === path.resolve(input).toLowerCase()) {
        throw new Error('AST output must differ from the input file.');
    }
    const result = parseClient(input, sourceType);
    if (output) {
        // ESTree's bigint/raw fields preserve BigInt literals in JSON; BigInt values themselves
        // are not JSON-serializable. RegExp literals also retain their native regex/raw fields.
        const json = JSON.stringify(result.ast, (_, value) => typeof value === 'bigint' ? null : value);
        fs.writeFileSync(path.resolve(output), json + '\n', { flag: 'wx' });
    }
    console.log(JSON.stringify({ input: result.input, parser: `acorn@${version}`, sourceType,
        bytes: result.bytes, sha256: result.sha256, statements: result.ast.body.length,
        ...(output ? { ast: path.resolve(output) } : {}) }, null, 2));
}

if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) {
        console.error(`[client-parser] ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { parseClient };
