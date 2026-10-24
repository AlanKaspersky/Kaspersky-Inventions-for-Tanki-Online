const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../../..');
const files = ['README.md', 'DOCUMENTATION.md', 'MAINTENANCE.md'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r/g, '');
const slug = text => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]+>/g, '')
    .toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
function anchors(text) {
    const result = new Set([...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map(match => match[1]));
    const seen = new Map(); let fenced = false;
    for (const line of text.split('\n')) {
        if (/^```/.test(line)) fenced = !fenced;
        const heading = !fenced && /^#{1,6} (.+)$/.exec(line);
        if (heading) { const id = slug(heading[1]), count = seen.get(id) || 0; seen.set(id, count + 1); result.add(id + (count ? '-' + count : '')); }
    }
    return result;
}
test('three root guides have balanced code fences and valid local file and section links', () => {
    const issues = [], cache = new Map(files.map(file => [file, anchors(read(file))]));
    for (const file of files) {
        let fenced = false;
        for (const line of read(file).split('\n')) {
            if (/^```/.test(line)) fenced = !fenced;
            if (fenced) continue;
            for (const match of line.matchAll(/!?\[[^\]\n]*\]\(([^\s)]+)\)/g)) {
                const link = match[1]; if (/^[a-z][\w+.-]*:/i.test(link) || link.startsWith('//')) continue;
                const [target, hash] = link.split('#'), destination = target || file;
                if (!fs.existsSync(path.join(root, destination))) issues.push(`${file}: missing ${link}`);
                else if (hash && cache.has(destination) && !cache.get(destination).has(decodeURIComponent(hash))) issues.push(`${file}: missing anchor ${link}`);
            }
        }
        assert.equal(fenced, false, file + ': unbalanced code fences');
    }
    assert.deepEqual(issues, []);
});
test('consolidated README retains all FAQ answers, publication sections and welcome credits', () => {
    const text = read('README.md');
    assert.equal((text.match(/^#### \d+\. /gm) || []).length, 74);
    for (const id of ['russian-user-guide', 'faq', 'english-publication-description', 'russian-publication-description'])
        assert.ok(text.includes(`<a id="${id}">`));
    const template = read('templates/welcome-modal.html'), tail = text.slice(text.lastIndexOf('\n## Acknowledgements'));
    for (const group of template.matchAll(/\{\{role\d\}\}<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/g)) {
        for (const name of group[1].split(/<br\s*\/?\s*>/).map(value => value.replace(/<[^>]+>/g, '').trim()).filter(Boolean))
            assert.ok(tail.includes(name), 'Missing final credit: ' + name);
    }
});
