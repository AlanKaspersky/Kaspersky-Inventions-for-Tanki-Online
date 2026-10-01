const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');

const root = path.join(__dirname, '..');
function compile(file) {
    return transformSync(fs.readFileSync(path.join(root, file), 'utf8'), { loader: 'ts', format: 'cjs' }).code;
}
const markupModule = { exports: {} };
vm.runInNewContext(compile('src/core/historyMarkup.ts'), { module: markupModule, URL });
const { escapeHistoryHtml, getHistoryImageUrl, renderHistoryTemplate } = markupModule.exports;

function fixture() {
    class Element {
        constructor() {
            this.innerHTML = '';
            this.style = {};
            this.classList = { add() {}, remove() {} };
        }
        addEventListener() {}
        removeEventListener() {}
        querySelector() { return null; }
    }
    const content = new Element();
    content.appendChild = element => { content.detail = element; };
    const context = {
        module: { exports: {} }, URL, console,
        localStorage: { getItem: () => 'TestPlayer' },
        chrome: { runtime: { getURL: file => file } },
        document: {
            querySelector: selector => selector === '.custom-history-content' ? content : null,
            createElement: () => new Element(),
        },
        window: { clearTimeout() {}, setTimeout: callback => { callback(); return 0; } },
        fetch: async file => ({ ok: true, text: async () => fs.readFileSync(path.join(root, file), 'utf8') }),
    };
    const cache = new Map();
    function load(file) {
        if (cache.has(file)) return cache.get(file).exports;
        const module = { exports: {} };
        cache.set(file, module);
        const require = name => {
            const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) + '.ts';
            if (dependency === 'src/core/historyMarkup.ts') return markupModule.exports;
            if (dependency === 'src/core/state.ts') return { state: { lang: 'EN' } };
            if (dependency === 'src/core/dataLoader.ts') return { DataLoader: { getMapInfo: () => null, translateMap: value => value } };
            if (dependency === 'src/core/modal.ts') return {};
            if (dependency === 'src/modules/equipmentTracker.ts') return {};
            return load(dependency);
        };
        vm.runInNewContext(compile(file), { ...context, module, require });
        return module.exports;
    }
    const account = { getNickname: () => 'TestPlayer', updateNickname: () => true };
    const views = load('src/modules/battleHistory/views.ts').createHistoryViews(account);
    const { validateImportedBattle } = load('src/modules/battleHistory/validation.ts');
    const { historyTranslations: t } = load('src/modules/battleHistory/localization.ts');
    return { ...views, validateImportedBattle, t, content };
}

const image = 'https://s.eu.tankionline.com/static/images/rank.svg';
function battle(overrides = {}) {
    return {
        nickname: 'TestPlayer', date: 1700000000000, status: 'Victory', map: 'Arena', mode: 'TDM', top: '1',
        reputation: 100, kills: 10, deaths: 5, kd: 2, crystals: 20, stars: 3,
        turretIcon: image, turretAugmentIcon: '', hullIcon: image, hullAugmentIcon: '',
        teamScoreMy: 10, teamScoreEnemy: 5,
        players: [{ name: 'Игрок & Friend', rank: image, gs: 1000, score: 100, kills: 10, deaths: 5,
            kd: 2, crystals: 20, stars: 3, isEnemy: false, isMe: true }],
        ...overrides,
    };
}

test('template values are escaped once and replacement tokens stay literal', () => {
    const value = `<img src="x" onerror='attack()'> & {{rows}} $& $\` $'`;
    const html = renderHistoryTemplate('{{value}} {{rows}}', { value, rows: '<tr><td>safe</td></tr>' }, ['rows']);
    assert.equal(html, escapeHistoryHtml(value) + ' <tr><td>safe</td></tr>');
    assert.ok(html.includes('{{rows}}'));
    assert.ok(html.includes('$&'));
    assert.ok(!html.includes('<img'));
});

test('image URLs accept game HTTPS assets and reject schemes, markup and spoofed hosts', () => {
    assert.equal(getHistoryImageUrl(image), image);
    assert.equal(getHistoryImageUrl('https://s.eu.tankionline.com/123/image.webp?a=1&b=2'),
        'https://s.eu.tankionline.com/123/image.webp?a=1&b=2');
    for (const url of [
        'javascript:attack()', 'data:image/svg+xml,<svg onload="attack()">',
        'http://s.eu.tankionline.com/image.png', '//s.eu.tankionline.com/image.png',
        'https://tankionline.com.attacker.test/image.svg', 'https://eviltankionline.com/image.svg',
        'https://tankionline.com@attacker.test/image.svg', 'https://user@tankionline.com/image.svg',
        'https://s.eu.tankionline.com:444/image.svg', 'https://s.eu.tankionline.com/code.html',
        `${image}" onerror="attack()`, 'https://s.eu.tankionline.com/image.svg\n',
    ]) assert.equal(getHistoryImageUrl(url), '', url);
});

test('imports preserve ordinary text but remove unsafe equipment and rank URLs', () => {
    const f = fixture();
    const input = battle({ map: '<svg onload="attack()">', turretIcon: `${image}"><img id="attack">` });
    input.players[0].name = '<img id="attack">';
    input.players[0].rank = 'javascript:attack()';
    const accepted = f.validateImportedBattle(input);
    assert.ok(accepted);
    assert.equal(accepted.map, input.map);
    assert.equal(accepted.players[0].name, input.players[0].name);
    assert.equal(accepted.turretIcon, '');
    assert.equal(accepted.players[0].rank, '');
    assert.equal(accepted.hullIcon, image);
});

test('cards protect previously stored records, text fields and all equipment image fields', async () => {
    const f = fixture();
    const payload = '<img id="attack" src=x onerror="attack()">';
    const input = battle({ map: payload, mode: payload, top: payload });
    for (const key of ['turretIcon', 'turretAugmentIcon', 'hullIcon', 'hullAugmentIcon']) {
        input[key] = `${image}">${payload}`;
    }
    const card = await f.buildBattleCard(input, f.t.EN, 'EN');
    assert.ok(!card.innerHTML.includes('<img id="attack"'));
    assert.ok(!card.innerHTML.includes('onerror="'));
    assert.ok(card.innerHTML.includes(escapeHistoryHtml(payload.toUpperCase())));
    assert.ok(card.innerHTML.includes(escapeHistoryHtml('#' + payload)));
    assert.equal((card.innerHTML.match(/bh-equip-placeholder/g) || []).length, 4);
});

test('detail view escapes player names, map, mode and DM placement and rejects rank markup', async () => {
    const f = fixture();
    const payload = '<svg id="attack" onload="attack()">';
    const input = battle({ status: 'DM', mode: payload, map: payload, top: payload });
    input.players[0].name = payload;
    input.players[0].rank = `${image}" onerror="attack()`;
    await f.renderDetailedMatch(input, f.t.EN, 'EN');
    const html = f.content.detail.innerHTML;
    assert.ok(!html.includes('<svg id="attack"'));
    assert.ok(!html.includes('onerror="'));
    assert.ok(html.includes(`<span class="player-name">${escapeHistoryHtml(payload)}</span>`));
    assert.ok(html.includes(escapeHistoryHtml('#' + payload + ' PLACE')));
    assert.ok(html.includes('<tbody>'));
    assert.ok(html.includes('<tr class="current-player">'));
});

test('valid histories keep images, team rows, localization and literal placeholder-like text', async () => {
    const f = fixture();
    const input = battle({ mode: '{{teamScoreStat}} $&', map: 'Арена & Arena' });
    assert.ok(f.validateImportedBattle(input));
    const card = await f.buildBattleCard(input, f.t.RU, 'RU');
    assert.ok(card.innerHTML.includes(`src="${image}"`));
    assert.ok(card.innerHTML.includes('{{TEAMSCORESTAT}} $&amp;'));
    assert.ok(card.innerHTML.includes('АРЕНА &amp; ARENA'));
    await f.renderDetailedMatch(input, f.t.RU, 'RU');
    const html = f.content.detail.innerHTML;
    assert.ok(html.includes('{{teamScoreStat}} $&amp;'));
    assert.ok(html.includes('Игрок &amp; Friend'));
    assert.ok(html.includes(`src="${image}"`));
    assert.ok(!html.includes('&lt;tr'));
});

test('invalid record shapes are still rejected', () => {
    const f = fixture();
    for (const value of [null, [], battle({ date: 0 }), battle({ kd: NaN }), battle({ players: [{}] }),
        battle({ turretIcon: {} }), battle({ nickname: 123 })]) {
        assert.equal(f.validateImportedBattle(value), null);
    }
});
