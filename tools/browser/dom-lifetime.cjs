// Isolated browser/GC regression. Never opens the game or the user's profile.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium, browserOptions, root } = require('./runtime.cjs');
process.chdir(root);

(async () => {
    const bundle = (await build({ stdin: { contents: `
        import {featureScope, createFeatureScope} from './src/core/featureRuntime';
        import {customPaints} from './src/modules/customPaints';
        import {customFriends} from './src/modules/customFriends';
        import {augmentSpecs} from './src/modules/augmentSpecs';
        window.domQA={customPaints,customFriends,augmentSpecs,createFeatureScope,
            scopes:['customPaints','customFriends','augmentSpecs','screenPresentation'].map(id=>featureScope(id))};`, resolveDir: root },
        bundle: true, write: false, format: 'iife', plugins: [{ name: 'fixture', setup(build) {
            build.onResolve({ filter: /\/core\/(state|utils|dataLoader|accountIdentity|augmentCatalog|gameAugments)$/ }, args =>
                ({ path: args.path.split('/').pop(), namespace: 'fixture' }));
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: ({
                state: `export const state=window.qaState;`,
                utils: `export const utils={getSetting:()=>true};`,
                dataLoader: `const device={id:'100',name:'Fixture',previewIcon:window.qaImage,locale:'EN',description:'Fixture',
                    advantages:[],disadvantages:[],neutral:[],modifiers:{DAMAGE:1.5}};
                    export const DataLoader={isReady:()=>true,getPaint:src=>({ru:src.includes('blue')?'Синий':'Красный',en:src.includes('blue')?'Blue':'Red'}),getDevice:()=>device};`,
                accountIdentity: `export const getAccountIdentity=()=>({clanTag:'[QA]'}),getVerifiedAccount=()=>({userId:'1001'}),
                    getPlayerUserId=()=>null,getAccountIdentityRevision=()=>1,parseAccountIdentity=text=>({nickname:text});`,
                augmentCatalog: `export const AUGMENTS_UPDATED='qa:augments';`,
                gameAugments: `export const AUGMENT_CARDS_UPDATED='qa:cards',activeGarageCardSection=()=> 'augments',isAugmentPreviewUrl=()=>true;`,
            })[args.path] }));
        } }] })).outputFiles[0].text;
    const server = http.createServer((req, res) => {
        res.setHeader('Content-Type', req.url === '/qa.js' ? 'text/javascript' : 'text/html');
        res.end(req.url === '/qa.js' ? bundle : `<!doctype html><body><script>
            window.qaState={lang:'EN',currentScreen:'garage'};
            window.qaImage='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
            </script><script src="/qa.js"></script>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch(browserOptions);
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:') ? route.continue() : route.abort());
        await page.goto('http://127.0.0.1:' + server.address().port);
        const session = await page.context().newCDPSession(page);
        await page.evaluate(() => {
            const qa = window.domQA;
            qa.refs = [];
            qa.check = (condition, message) => { if (!condition) throw Error(message); };
            qa.mount = async () => {
                window.qaState.currentScreen = 'garage';
                const screen = document.createElement('section');
                screen.innerHTML = `<div class="PaintsCollectionComponentStyle-commonBlockFOrInfoAndCaptionCategory"><div class="PaintsCollectionComponentStyle-captionPaint"></div></div>
                    <div class="ListItemsComponentStyle-itemsContainer"><div><div class="garage-item" style="display:grid"><img class="GarageItemComponentStyle-mainImg" src="/blue.svg"></div></div></div>
                    <div class="FriendListComponentStyle-scrollCommunity"><div class="FriendListComponentStyle-blockList" style="display:flex"><span class="FriendListComponentStyle-offline">Offline</span></div></div>
                    <div><img class="SkinCellStyle-iconCell" data-kasp-augment-id="100" src="/unavailable.fixture.svg"></div>
                    <img class="DeviceButtonComponentStyle-deviceIcon">
                    <div><span>Damage</span></div><span class="native-stat" style="display:inline-block">100</span>`;
                document.body.append(screen);
                screen.style.opacity = '.5';
                const commit = qa.scopes[3].preserve(screen, ['opacity']);
                screen.style.opacity = '1'; commit();
                qa.scopes[3].listen(screen, 'qa:event', () => screen.setAttribute('data-clicked', 'true'));
                qa.customPaints();
                const input = screen.querySelector('input'); input.value = 'Red'; input.dispatchEvent(new Event('input'));
                qa.customFriends();
                screen.querySelectorAll('.custom-filter-btn')[1].click();
                qa.augmentSpecs(); await Promise.resolve();
                qa.check(screen.querySelector('.garage-item').style.display === 'none', 'paint filtering failed');
                qa.check(screen.querySelector('.FriendListComponentStyle-blockList').style.display === 'none', 'friend filtering failed');
                qa.check(screen.querySelector('.custom-live-stat')?.textContent === '150', 'augment stats failed');
                qa.check(screen.querySelector('.kasp-unavailable-device-card'), 'unavailable augment was not decorated');
                return screen;
            };
            qa.cycles = async count => {
                for (let i = 0; i < count; i++) {
                    const screen = await qa.mount();
                    for (const node of [screen, ...screen.querySelectorAll('*')]) qa.refs.push(new WeakRef(node));
                    screen.remove();
                    // Simulate the screen dispatcher no longer calling garage/friend features.
                    window.qaState.currentScreen = 'battle';
                }
            };
        });
        const batches = [];
        for (let batch = 0; batch < 3; batch++) {
            await page.evaluate(() => window.domQA.cycles(100));
            await page.waitForTimeout(2300);
            await session.send('HeapProfiler.collectGarbage');
            const report = await page.evaluate(() => ({
                retained: window.domQA.refs.filter(ref => ref.deref()).length,
                tracked: window.domQA.refs.length,
                scopes: window.domQA.scopes.map(scope => scope.status()),
            }));
            assert.equal(report.retained, 0, 'removed screen nodes remain strongly reachable');
            for (const scope of report.scopes) {
                assert.equal(scope.domNodes, 0, scope.id + ' retained detached ownership');
                assert.equal(scope.failures, 0, scope.id + ' threw an error');
                assert.ok(scope.listeners <= 6, scope.id + ' retained per-screen listeners');
            }
            batches.push(report);
        }
        await page.evaluate(async () => {
            const qa = window.domQA, screen = await qa.mount();
            // Reusing a long-detached native UI must keep its existing filter buttons usable.
            screen.remove(); qa.saved = screen;
        });
        await page.waitForTimeout(2300);
        await page.evaluate(() => {
            const qa = window.domQA, screen = qa.saved; document.body.append(screen);
            qa.customFriends();
            qa.check(screen.querySelector('.FriendListComponentStyle-blockList').style.display === 'none', 'reused list lost active filter');
            screen.querySelector('.custom-filter-btn').click();
            qa.check(screen.querySelector('.FriendListComponentStyle-blockList').style.display === 'flex', 'reused sidebar lost click handler');
            qa.customPaints();
            screen.querySelector('input').value = ''; screen.querySelector('input').dispatchEvent(new Event('input'));
            qa.check(screen.querySelector('.garage-item').style.display === '', 'reused search handler stopped working');
            qa.scopes.forEach(scope => scope.dispose());
            qa.check(screen.querySelector('.native-stat').style.display === 'inline-block', 'stat display not restored');
            qa.check(!screen.querySelector('.custom-live-stat'), 'stat replacement not removed');
            qa.check(screen.style.opacity === '0.5', 'presentation not restored');
            qa.saved = null; screen.remove();
        });
        await page.evaluate(() => {
            const qa = window.domQA;
            qa.listenerScope = qa.createFeatureScope('detached-listener-regression');
            qa.listenerButton = document.createElement('button');
            qa.listenerCalls = 0; qa.nativeCalls = 0;
            document.body.append(qa.listenerButton);
            qa.listenerButton.addEventListener('click', () => qa.nativeCalls++);
            for (let i = 0; i < 3; i++) qa.listenerScope.listen(qa.listenerButton, 'click', () => qa.listenerCalls++);
            qa.listenerButton.remove();
        });
        await page.waitForTimeout(2300);
        await page.evaluate(() => {
            const qa = window.domQA;
            document.body.append(qa.listenerButton); qa.listenerButton.click();
            qa.check(qa.listenerCalls === 0, 'expired handlers still fire although diagnostics show zero');
            qa.check(qa.nativeCalls === 1, 'native handler was removed');
            qa.check(qa.listenerScope.status().listeners === 0 && qa.listenerScope.status().resources === 0, 'listener registries not empty');
            qa.listenerScope.listen(qa.listenerButton, 'click', () => qa.listenerCalls++);
            qa.listenerButton.click(); qa.check(qa.listenerCalls === 1, 'rebinding does not fire exactly once');
            qa.listenerScope.dispose(); qa.listenerButton.click();
            qa.check(qa.listenerCalls === 1, 'disposal left a live handler');
            qa.listenerButton.remove(); qa.listenerButton = null;
        });
        assert.deepEqual(errors, []);
        const output = path.join(root, 'artifacts/qa/dom-lifetime'); fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ cycles: 300, batches, errors }, null, 2));
        console.log('DOM lifetime: 300 garage/friend/search cycles; all ' + batches.at(-1).tracked + ' detached nodes collected; reused controls, real listener removal, rebinding and disposal passed.');
    } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
