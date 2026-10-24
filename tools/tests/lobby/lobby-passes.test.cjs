const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const runFeatureContext = require("../helpers/feature-context.cjs");
const dom = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/core/gameDOM.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, { module: dom });
const moduleValue = { exports: {} };
runFeatureContext(transformSync(fs.readFileSync('src/modules/lobbyPasses.ts', 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
    module: moduleValue,
    getComputedStyle: element => ({ transform: element.computed || 'none' }),
    DOMMatrixReadOnly: class {
        constructor(value) {
            const parts = /^matrix\(([^)]+)\)$/.exec(value)?.[1].split(',').map(Number);
            if (!parts || parts.length !== 6 || !parts.every(Number.isFinite)) throw Error('invalid matrix');
            this.a = parts[0]; this.b = parts[1];
        }
    },
    require: name => ({ '../core/gameDOM': dom.exports, '../core/state': { state: { lang: 'RU' } } }[name]),
});
const { readStarProgress, readCircleProgress } = moduleValue.exports;
const circle = (...angles) => ({ children: [{}, { children: angles.map(angle => typeof angle === 'string'
    ? { style: { transform: angle } } : angle) }] });

test('challenge progress uses native star totals, including zero, whitespace and completion', () => {
    assert.equal(readStarProgress('16/20'), 80);
    assert.equal(readStarProgress('0 / 20'), 0);
    assert.equal(readStarProgress('1\u00a0000 / 2\u00a0000'), 50);
    assert.equal(readStarProgress('25 / 20'), 100);
    for (const input of ['20', '', '16/0', 'not ready', '-1/20']) assert.equal(readStarProgress(input), null);
});

test('elite ring reads both native half-ring ranges and distinguishes zero from a full turn', () => {
    assert.equal(readCircleProgress(circle('rotateZ(0deg)')), 0);
    assert.equal(readCircleProgress(circle('rotateZ(90deg)')), 25);
    assert.equal(readCircleProgress(circle('rotateZ(180deg)')), 50);
    assert.equal(readCircleProgress(circle('rotateZ(180deg)', 'rotateZ(270deg)')), 75);
    assert.equal(readCircleProgress(circle('rotateZ(180deg)', 'rotateZ(360deg)')), 100);
    assert.equal(readCircleProgress(circle('rotate(0.5turn)', 'rotate(1turn)')), 100);
    assert.equal(readCircleProgress(circle(`rotate(${Math.PI / 2}rad)`)), 25);
});

test('computed matrices preserve native progress when circular children are hidden by the custom presentation', () => {
    const matrix = value => ({ style: {}, computed: value });
    assert.equal(readCircleProgress(circle(matrix('matrix(1,0,0,1,0,0)'))), 0);
    assert.equal(readCircleProgress(circle(matrix('matrix(0,1,-1,0,0,0)'))), 25);
    assert.equal(readCircleProgress(circle(matrix('matrix(-1,0,0,-1,0,0)'), matrix('matrix(0,-1,1,0,0,0)'))), 75);
    assert.equal(readCircleProgress(circle(matrix('matrix(-1,0,0,-1,0,0)'), matrix('matrix(1,0,0,1,0,0)'))), 100);
});

test('missing and incompatible ring layouts do not invent an elite progress value', () => {
    for (const input of [null, {}, circle(), circle('none'), circle('rotate(270deg)'), circle('rotate(90deg)', 'rotate(270deg)'),
        circle('rotate(180deg)', 'rotate(60deg)'), circle('matrix(bad)'), circle('rotate(180deg)', 'rotate(270deg)', 'rotate(360deg)')]) {
        assert.equal(readCircleProgress(input), null);
    }
});
