const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function collect(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? collect(file) : entry.isFile() && entry.name.endsWith('.test.cjs') ? [file] : [];
    });
}
const testRoot = path.join(__dirname, 'tests');
const categories = process.argv.slice(2);
const directories = categories.length ? categories.map(category => {
    if (!/^[a-z-]+$/.test(category)) throw Error('Invalid test category: ' + category);
    const directory = path.join(testRoot, category);
    if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) throw Error('Unknown test category: ' + category);
    return directory;
}) : [testRoot];
const files = [...new Set(directories.flatMap(collect))].sort();
if (!files.length) throw new Error('No test files found');
const result = spawnSync(process.execPath, ['--test', ...files], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
