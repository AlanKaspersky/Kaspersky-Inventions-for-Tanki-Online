const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const moduleFixture = { exports: {} };
vm.runInNewContext(transformSync(fs.readFileSync('src/core/trophyData.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: moduleFixture });
const { readTrophyProgress: read, chooseTrophyProgress: choose, mergeTrophyProgress: merge, normalizeTrophyFavorites: normalize, matchTrophy } = moduleFixture.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const exact = { current: 1941451, max: 5000000, percent: 38.82902 };

test('trophies distinguish native percent fractions from reputation points in every candidate order', () => {
    for (const text of ['38 / 100', '38/100', '38%', '38,5 %', '38.5%']) {
        const value = read(text);
        assert.equal(value.current, null);
        assert.equal(value.max, null);
    }
    for (const values of [['38 / 100', '1 941 451 / 5 000 000'], ['1 941 451 / 5 000 000', '38%']])
        assert.deepEqual(plain(choose(values)), exact);
});

test('reputation parsing supports localized thousands, zero and completion without loose parseInt fallbacks', () => {
    for (const separator of [' ', '\u00a0', '\u202f', ',', '.', "'", '’']) {
        assert.equal(read(`1${separator}941${separator}451 / 5${separator}000${separator}000`).current, exact.current);
    }
    assert.equal(read('0/5000000').current, 0);
    assert.equal(read('5000000/5000000').percent, 100);
    for (const bad of ['', '—', '38', '1.5/5000000', '1k/5m', '12abc/5000000', '-1/5000000', '5000001/5000000', '0/0', '1/10',
        '1 23/5 000 000', '9007199254740993/9007199254740994', '101/100', 'NaN/100', '110%', '38% / 100%'])
        assert.equal(read(bad), null, bad);
    for (const text of ['COMPLETED', 'ВЫПОЛНЕНО']) assert.equal(read(text).percent, 100);
});

test('result animations use the final total even when the earlier score is also present', () => {
    assert.equal(choose(['2400 / 5000000', '1000 / 5000000']).current, 2400);
    assert.equal(choose(['1000 / 5000000', '1000 / 6000000']), null, 'a partly replaced card is ambiguous');
    assert.equal(merge(exact, read('39/100')), exact, 'percent placeholders cannot erase exact scores');
    assert.equal(merge(exact, read('100/100')), exact, 'a rounded 100 percent cannot invent the final score');
    assert.equal(merge(exact, read('0/6000000')).max, 6000000, 'a changed target is saved even when current remains zero');
    assert.deepEqual(plain(merge(exact, read('ВЫПОЛНЕНО'))), { current: 5000000, max: 5000000, percent: 100 });
});

test('legacy percentage corruption migrates without inventing points or needing obsolete icon metadata', () => {
    const favorites = normalize([{ id: 'ricochet', type: 'turret', current: 38, max: 100 },
        { id: 'viking', type: 'hull', current: exact.current, max: exact.max }]);
    assert.deepEqual(plain(favorites[0]), { id: 'ricochet', type: 'turret', current: null, max: null, percent: 38 });
    assert.deepEqual(plain(favorites[1]), { id: 'viking', type: 'hull', ...exact });
    assert.deepEqual(plain(normalize(favorites)), plain(favorites), 'new data survives another load');
});

test('storage validation deduplicates favorites, enforces two per type and neutralizes invalid progress', () => {
    const row = (id, type = 'turret', current = 1, max = 5000000) => ({ id, type, current, max });
    const value = normalize([null, {}, row('a'), row('a'), row('b'), row('c'), row('d', 'hull', -1), row('e', 'hull', 9, 0),
        row('f', 'hull'), row('g', 'unknown'), row('x'.repeat(129))]);
    assert.deepEqual(value.map(row => row.id).join(','), 'a,b,d,e');
    assert.equal(value[2].current, null);
    assert.equal(value[3].percent, null);
    for (const bad of [null, {}, '[]', 123]) assert.equal(normalize(bad).length, 0);
});

test('equipment aliases match RU/EN word boundaries, ё/е and reject ambiguous multi-equipment descriptions', () => {
    const dictionary = JSON.parse(fs.readFileSync('database/trophies.json', 'utf8'));
    for (const [alias, entry] of Object.entries(dictionary)) assert.equal(matchTrophy(`«${alias.toUpperCase()}»`, dictionary)?.id, entry.id);
    assert.equal(matchTrophy('Огнемет', dictionary)?.id, 'firebird');
    assert.equal(matchTrophy('Viking1000/5000000', dictionary)?.id, 'viking', 'native textContent can join adjacent blocks');
    assert.equal(matchTrophy('increases reputation', dictionary), null, 'ares is not inside increases');
    assert.equal(matchTrophy('громкий удар', dictionary), null);
    assert.equal(matchTrophy('Ricochet or Viking', dictionary), null);
});
