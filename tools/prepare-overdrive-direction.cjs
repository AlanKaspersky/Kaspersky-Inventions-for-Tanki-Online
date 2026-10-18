const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');
const { analyzeOverdriveDirection } = require('./overdrive-direction-ast.cjs');
function main(args) {
    if (args.length !== 1) throw Error('Usage: node tools/prepare-overdrive-direction.cjs <client.js>');
    const source = fs.readFileSync(args[0], 'utf8').replace(/^\uFEFF/, '');
    const plan = analyzeOverdriveDirection(source);
    console.log(JSON.stringify(plan.status));
    if (!plan.status.ready) throw Error('Incomplete direction mapping; existing plans preserved.');
    let patched = source;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    parse(patched, { ecmaVersion: 'latest' });
    const output = path.join(__dirname, '../src/generated/overdrive-direction.json');
    const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')).plans : [];
    const plans = [...previous.filter(entry => entry.sha256 !== plan.sha256), plan];
    fs.writeFileSync(output, JSON.stringify({ plans }, null, 2) + '\n');
}
if (require.main === module) try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
module.exports = { main };
