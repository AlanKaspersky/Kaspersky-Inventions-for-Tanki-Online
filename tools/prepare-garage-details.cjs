const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('acorn');
const { analyzeGarageDetails } = require('./garage-details-ast.cjs');

const usage = 'Usage: npm run prepare:garage-details -- <main.js> [--out <plans.json>]';
function main(args) {
    if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
    let input, output = path.join(__dirname, '../src/generated/garage-details.json');
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--out') {
            output = args[++index];
            if (!output || output.startsWith('--')) throw new Error('--out requires a file.');
        } else if (args[index].startsWith('-') || input) throw new Error(usage);
        else input = args[index];
    }
    if (!input) throw new Error(usage);
    if (path.resolve(input).toLowerCase() === path.resolve(output).toLowerCase()) throw new Error('The input game bundle cannot be overwritten.');
    const source = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
    const plan = analyzeGarageDetails(source);
    console.log(JSON.stringify({ input: path.resolve(input), sha256: plan.sha256, status: plan.status }, null, 2));
    if (!plan.status.ready) throw new Error('Garage details mapping is incomplete or ambiguous; existing plans were not changed.');
    let patched = source;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    parse(patched, { ecmaVersion: 'latest', sourceType: 'script' });
    const data = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, 'utf8')) : { format: 'ki-garage-details-plans-v1', plans: [] };
    if (data.format !== 'ki-garage-details-plans-v1' || !Array.isArray(data.plans)) throw new Error('Unsupported output file format.');
    data.plans = data.plans.filter(entry => entry.sha256 !== plan.sha256);
    data.plans.push({ ...plan, sourceName: path.basename(input) });
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
    console.log(`Prepared ${plan.edits.length} edits: ${path.resolve(output)}`);
}
if (require.main === module) {
    try { main(process.argv.slice(2)); }
    catch (error) { console.error(`[prepare-garage-details] ${error.message}`); process.exitCode = 1; }
}
module.exports = { main };
