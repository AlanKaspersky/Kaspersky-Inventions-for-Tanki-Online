// Isolated DOM/image QA; does not use the user's Electron/browser profile.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium, browserOptions, root } = require('./runtime.cjs');
process.chdir(root);

(async () => {
    const bundle = (await build({ stdin: { contents: `import {customTrophies} from './src/modules/customTrophies';
        import {featureScope} from './src/core/featureRuntime';
        window.trophyQA={update:customTrophies,scope:featureScope('customTrophies')};`, resolveDir: path.resolve('.') },
        bundle: true, write: false, format: 'iife', plugins: [{ name: 'fixture', setup(build) {
            build.onResolve({ filter: /\/core\/(state|accountIdentity)$/ }, args => ({ path: args.path.split('/').pop(), namespace: 'fixture' }));
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'state'
                ? 'export const state=window.trophyState;' : 'export const getVerifiedAccount=()=>window.trophyAccount;' }));
        } }] })).outputFiles[0].text;
    const server = http.createServer((req, res) => {
        if (req.url === '/qa.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(bundle); }
        if (req.url === '/database/trophies.json') { res.setHeader('Content-Type', 'application/json'); return res.end(fs.readFileSync('database/trophies.json')); }
        if (/^\/assets\/trophy-(unfavorite|favorite)\.svg$/.test(req.url)) {
            res.setHeader('Content-Type', 'image/svg+xml'); return res.end(fs.readFileSync('.' + req.url));
        }
        res.setHeader('Content-Type', 'text/html');
        res.end(`<!doctype html><body><main><div class="BattlePassLobbyComponentStyle-menuBattlePass"></div></main>
            <div class="PaintsCollectionComponentStyle-favoriteIconContainer" id="native-paint-star"></div>
            <section id="quests"></section><section id="results"></section><script>
            window.trophyState={lang:'EN',currentScreen:'loading'};window.trophyAccount={userId:'1001'};
            window.chrome={runtime:{getURL:p=>location.origin+'/'+p}};
            localStorage.setItem('kasp_trophies_favorites_uid_1001',JSON.stringify([
                {id:'ricochet',type:'turret',current:38,max:100},
                {id:'viking',type:'hull',current:1000,max:5000000}]));
            </script><script src="/qa.js"></script>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch(browserOptions);
        const page = await browser.newPage();
        const errors = [], external = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:')) external.push(request.url()); });
        const origin = 'http://127.0.0.1:' + server.address().port;
        await page.goto(origin);
        const report = await page.evaluate(async () => {
            const qa = window.trophyQA, key = 'kasp_trophies_favorites_uid_1001';
            const check = (condition, message) => { if (!condition) throw Error(message); };
            const stored = () => JSON.parse(localStorage.getItem(key));
            await qa.update();
            let tile = document.querySelector('.custom-trophy-item');
            check(tile.querySelector('.custom-trophy-percent').textContent === '38%', 'legacy percent lost');
            check(tile.querySelector('.custom-trophy-text').textContent === '—', 'legacy percent rendered as points');
            document.querySelector('#quests').innerHTML = `<div id="ricochet" class="MainQuestComponentStyle-cardPlayCommon">Ricochet
                <h4>38 / 100</h4><h4>1&nbsp;941&nbsp;451 / 5&nbsp;000&nbsp;000</h4></div>
                <div id="viking" class="TableMainQuestComponentStyle-commonTableMainQuest"><span>Viking</span><div>Earn reputation</div><h4>1000/5000000</h4></div>
                <div id="unrelated" class="MainQuestComponentStyle-cardPlayCommon">Increases reputation<h4>1/100</h4></div>`;
            await qa.update();
            check(document.querySelectorAll('[data-kasp-trophy-star]').length === 2, 'stars depend on stale loading screen');
            check(stored()[0].current === 1941451 && stored()[0].max === 5000000, 'exact score not preferred');
            check(!document.querySelector('#unrelated [data-kasp-trophy-star]'), 'substring matched wrong equipment');
            const replacementParent = document.createElement('main'); document.body.append(replacementParent);
            replacementParent.append(document.querySelector('.BattlePassLobbyComponentStyle-menuBattlePass'));
            await qa.update();
            check(document.querySelector('#custom-trophy-panel').parentElement === replacementParent, 'panel retained an obsolete native parent');
            let mutations = 0;
            const observer = new MutationObserver(records => { mutations += records.length; });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
            for (let i = 0; i < 10; i++) await qa.update();
            await new Promise(resolve => setTimeout(resolve, 0)); observer.disconnect();
            check(mutations === 0, 'unchanged ticks keep mutating trophy DOM: ' + mutations);
            // React can hydrate an existing text node without adding/removing nodes.
            const value = document.querySelector('#ricochet h4:last-of-type');
            value.firstChild.nodeValue = '2 000 000 / 5 000 000';
            await new Promise(resolve => setTimeout(resolve, 120));
            check(stored()[0].current === 2000000, 'characterData hydration was not observed');
            value.firstChild.nodeValue = '—';
            await qa.update();
            check(stored()[0].current === 2000000, 'percent placeholder erased known exact score');
            document.querySelector('#results').innerHTML = `<div class="BattleResultQuestProgressComponentStyle-container">Ricochet
                <h4 class="BattleResultQuestProgressComponentStyle-text">2000000/5000000</h4>
                <h4 class="BattleResultQuestProgressComponentStyle-text" style="opacity:0">2100000/5000000</h4></div>`;
            await qa.update();
            check(stored()[0].current === 2100000, 'hidden final animated total ignored');
            document.querySelector('#results').textContent = '';
            document.querySelector('#viking h4').textContent = '0/6000000'; await qa.update();
            document.querySelector('#viking h4').textContent = '0/7000000'; await qa.update();
            check(stored()[1].max === 7000000, 'target-only change ignored');
            // A saved favorite can be removed immediately; click reads live progress.
            document.querySelector('#ricochet [data-kasp-trophy-star]').click();
            check(!stored().some(row => row.id === 'ricochet'), 'favorite not removed');
            value.firstChild.nodeValue = '2200000/5000000';
            document.querySelector('#ricochet [data-kasp-trophy-star]').click();
            check(stored().find(row => row.id === 'ricochet').current === 2200000, 'click used stale captured progress');
            const stale = document.querySelector('#ricochet [data-kasp-trophy-star]');
            document.querySelector('#ricochet').firstChild.nodeValue = 'Hammer'; stale.click();
            check(!stored().some(row => row.id === 'hammer'), 'recycled card accepted stale click');
            await qa.update();
            const originalWrite = Storage.prototype.setItem;
            Storage.prototype.setItem = () => { throw new DOMException('quota', 'QuotaExceededError'); };
            document.querySelector('#ricochet [data-kasp-trophy-star]').click();
            await qa.update(); Storage.prototype.setItem = originalWrite;
            check(!qa.scope.status().disabled && qa.scope.status().failures === 0, 'quota error disabled trophies');
            localStorage.setItem(key, JSON.stringify([{id:'viking',type:'hull',current:3000,max:5000000}]));
            document.querySelector('#quests').textContent = '';
            window.dispatchEvent(new StorageEvent('storage', { key }));
            await new Promise(resolve => setTimeout(resolve, 0));
            check(document.querySelectorAll('.custom-trophy-item').length === 1, 'other-tab change ignored');
            window.trophyAccount = null; await qa.update();
            check(!document.querySelector('#custom-trophy-panel'), 'logout left favorites visible');
            check(document.querySelector('#native-paint-star'), 'native paint star was removed');
            window.trophyAccount = {userId:'1001'};
            document.querySelector('#quests').innerHTML = '<div class="MainQuestComponentStyle-cardPlayCommon">Viking<h4>3000/5000000</h4></div>';
            await qa.update();
            const image = document.querySelector('[data-kasp-trophy-star] img'); await image.decode();
            check(image.naturalWidth > 0 && image.src.endsWith('/assets/trophy-favorite.svg'), 'packaged favorite icon did not load');
            image.parentElement.click(); await image.decode();
            check(image.naturalWidth > 0 && image.src.endsWith('/assets/trophy-unfavorite.svg'), 'packaged empty icon did not load');
            const status = qa.scope.status(); qa.scope.dispose();
            check(!document.querySelector('[data-kasp-trophy-star], .card-type-list, .card-type-grid, #custom-trophy-panel'), 'cleanup left decorations');
            return { idleMutations: mutations, imageWidth: image.naturalWidth, status };
        });
        // A transient packaged database failure must recover without reloading the game.
        const retry = await browser.newPage(); let attempts = 0;
        await retry.route('**/database/trophies.json', async route => {
            attempts++;
            if (attempts === 1) await route.fulfill({ status: 503, body: 'temporary' }); else await route.continue();
        });
        await retry.goto(origin);
        await retry.waitForFunction(() => document.querySelector('#custom-trophy-panel'), null, { timeout: 13000 });
        assert.equal(attempts, 2);
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log(JSON.stringify({ ...report, dictionaryAttempts: attempts, errors, externalRequests: external }, null, 2));
    } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
