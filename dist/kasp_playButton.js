"use strict";
(function () {
    'use strict';
    if (localStorage.getItem('k_ext_btn') === 'false')
        return;
    let buttonsCreated = false;
    const BUTTON_WIDTH = 3.5;
    const ROW_GAP = 0.5;
    const BUTTONS_COUNT = 7;
    const MAIN_WIDTH = (BUTTON_WIDTH * BUTTONS_COUNT) + (ROW_GAP * (BUTTONS_COUNT - 1));
    const WIDE_BUTTON_WIDTH = (MAIN_WIDTH - ROW_GAP) / 2;
    const MAIN_HEIGHT = 8.5;
    const BUTTON_HEIGHT = 3;
    const TOTAL_BG_HEIGHT = MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP + BUTTON_HEIGHT;
    const BG_URL = 'https://s.eu.tankionline.com/static/images/videoplay.79570900.gif';
    const LOCK_ICON_URL = 'https://s.eu.tankionline.com/static/images/lockButtonPlay.4bb62c08.svg';
    let autoQueueState = 0;
    let targetMode = null;
    let lastSearchingState = null;
    const quickBattleMode = { names: ['БЫСТРЫЙ БОЙ', 'QUICK BATTLE', 'ИГРАТЬ', 'PLAY'], isDirect: true };
    const wideModes = [
        { labels: { RU: 'PRO-БИТВЫ', EN: 'PRO BATTLES' }, names: ['PRO-БИТВЫ', 'PRO BATTLES'], icon: 'https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg', isDirect: true },
        { labels: { RU: 'СПЕЦРЕЖИМ', EN: 'FESTIVE MODE' }, names: ['Специальный режим', 'Festive mode'], icon: 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg', isDirect: true }
    ];
    const modes = [
        { icon: 'https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg', labels: { RU: 'КОМАНДНЫЙ БОЙ', EN: 'TEAM DEATHMATCH' }, names: ['КОМАНДНЫЙ БОЙ', 'TEAM DEATHMATCH'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg', labels: { RU: 'КОНТРОЛЬ ТОЧЕК', EN: 'CONTROL POINTS' }, names: ['КОНТРОЛЬ ТОЧЕК', 'CONTROL POINTS'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg', labels: { RU: 'ЗАХВАТ ФЛАГА', EN: 'CAPTURE THE FLAG' }, names: ['ЗАХВАТ ФЛАГА', 'CAPTURE THE FLAG'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg', labels: { RU: 'ОСАДА', EN: 'SIEGE' }, names: ['Осада', 'SIEGE'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg', labels: { RU: 'ДЖАГГЕРНАУТ', EN: 'JUGGERNAUT' }, names: ['ДЖАГГЕРНАУТ', 'JUGGERNAUT'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg', labels: { RU: 'РЕГБИ', EN: 'RUGBY' }, names: ['РЕГБИ', 'RUGBY'], isDirect: false },
        { icon: 'https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg', labels: { RU: 'ШТУРМ', EN: 'ASSAULT' }, names: ['ШТУРМ', 'ASSAULT'], isDirect: false }
    ];
    const modesButtonNames = ['РЕЖИМЫ', 'MODES'];
    const globalStyle = document.createElement('style');
    globalStyle.textContent = `
        .MainScreenComponentStyle-playButtonContainer div[class*="ksc-"],
        .MainScreenComponentStyle-playButtonContainer [class*="lock"]:not(.main-lock-icon),
        .MainScreenComponentStyle-playButtonContainer img[src*="lock"] { display: none !important; }
        .ClientInfoComponentStyle-container { display: none !important; }
        .custom-inner-btn > *:not(.custom-main-bg-layer):not(.main-lock-icon):not(.custom-main-text) { display: none !important; }
        .MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"]) { opacity: 0 !important; pointer-events: none !important; }
        
        body.kasp-autoqueue-active [class*="BattlePickComponentStyle"],
        body.kasp-autoqueue-active [class*="blockCard"],
        body.kasp-autoqueue-active [class*="commonStyleBlock"] { 
            opacity: 0 !important; 
            visibility: hidden !important; 
            transition: none !important; 
            animation: none !important;
        }
    `;
    if (document.head)
        document.head.appendChild(globalStyle);
    else
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(globalStyle));
    function getLang() {
        return document.documentElement.lang.toLowerCase().startsWith('ru') ? 'RU' : 'EN';
    }
    function isSearching() {
        return !!document.querySelector('.MainScreenComponentStyle-disabledButtonPlay');
    }
    function syncButtonStates(force = false) {
        const searching = isSearching();
        if (!force && searching === lastSearchingState)
            return;
        lastSearchingState = searching;
        const currentLang = getLang();
        const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer');
        if (playButton) {
            const bgLayer = playButton.querySelector('.custom-main-bg-layer');
            const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton);
            let customText = innerBtn.querySelector('.custom-main-text');
            let lockDiv = innerBtn.querySelector('.main-lock-icon');
            if (searching) {
                playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                playButton.style.cursor = 'default';
                if (bgLayer)
                    bgLayer.style.filter = 'brightness(0.35) sepia(1) hue-rotate(160deg) saturate(3)';
                if (customText)
                    customText.style.display = 'none';
                if (!lockDiv) {
                    lockDiv = document.createElement('div');
                    lockDiv.className = 'main-lock-icon';
                    lockDiv.style.cssText = `width: 2.625em; height: 2.8125em; background-color: #bed4ff; -webkit-mask-image: url(${LOCK_ICON_URL}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${LOCK_ICON_URL}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; z-index: 2; position: relative;`;
                    innerBtn.appendChild(lockDiv);
                }
                else {
                    lockDiv.style.display = 'block';
                    lockDiv.style.backgroundColor = '#bed4ff';
                }
            }
            else {
                playButton.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em';
                playButton.style.cursor = 'pointer';
                if (bgLayer)
                    bgLayer.style.filter = 'none';
                if (lockDiv)
                    lockDiv.style.display = 'none';
                if (customText) {
                    customText.style.display = 'flex';
                    const targetText = currentLang === 'RU' ? 'БЫСТРЫЙ БОЙ' : 'QUICK BATTLE';
                    if (customText.textContent !== targetText)
                        customText.textContent = targetText;
                }
            }
        }
        document.querySelectorAll('.wide-mode-btn-text').forEach(spanEl => {
            const span = spanEl;
            const modeIndex = parseInt(span.dataset.index || '0', 10);
            if (wideModes[modeIndex])
                span.textContent = wideModes[modeIndex].labels[currentLang];
        });
        const quickWrapper = document.getElementById('quick-play-wrapper');
        if (quickWrapper) {
            quickWrapper.querySelectorAll('.custom-mode-button').forEach(btnEl => {
                const btn = btnEl;
                const bgLayer = btn.querySelector('.custom-btn-bg-layer');
                const iconDiv = btn.querySelector('.mode-icon-el');
                const textSpan = btn.querySelector('.wide-mode-btn-text');
                if (searching) {
                    btn.style.pointerEvents = 'none';
                    btn.style.cursor = 'default';
                    btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                    if (bgLayer)
                        bgLayer.style.filter = 'brightness(0.35) sepia(1) hue-rotate(160deg) saturate(3)';
                    if (iconDiv)
                        iconDiv.style.backgroundColor = '#bed4ff';
                    if (textSpan)
                        textSpan.style.color = '#bed4ff';
                }
                else {
                    btn.style.pointerEvents = 'auto';
                    btn.style.cursor = 'pointer';
                    btn.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em';
                    if (bgLayer)
                        bgLayer.style.filter = 'none';
                    if (iconDiv)
                        iconDiv.style.backgroundColor = '#76ff33';
                    if (textSpan)
                        textSpan.style.color = '#76ff33';
                }
            });
        }
    }
    function applyStyles(playButton) {
        const container = (playButton.closest('div[class*="-displayFlex"]') || playButton.parentElement?.parentElement);
        const mainMenu = document.querySelector('.MainScreenComponentStyle-blockMainMenu');
        if (container) {
            container.style.marginLeft = '5em';
            container.style.height = 'auto';
            container.style.marginTop = '10em';
            container.style.width = '31.25em';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'flex-start';
            container.style.overflow = 'visible';
            container.style.zIndex = '5';
            container.style.position = 'relative';
        }
        if (playButton) {
            playButton.style.width = `${MAIN_WIDTH}em`;
            playButton.style.height = `${MAIN_HEIGHT}em`;
            playButton.style.position = 'relative';
            playButton.style.overflow = 'hidden';
            playButton.style.borderRadius = '0.5rem';
            playButton.style.transition = 'box-shadow 0.2s ease-in-out, opacity 0.2s ease-in';
            playButton.addEventListener('mouseenter', () => {
                if (!isSearching())
                    playButton.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em';
            });
            playButton.addEventListener('mouseleave', () => {
                if (!isSearching())
                    playButton.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em';
            });
            const innerBtn = (playButton.querySelector('.MainScreenComponentStyle-buttonPlay') || playButton);
            innerBtn.style.backgroundImage = 'none';
            innerBtn.classList.add('custom-inner-btn');
            let bgLayer = innerBtn.querySelector('.custom-main-bg-layer');
            if (!bgLayer) {
                bgLayer = document.createElement('div');
                bgLayer.className = 'custom-main-bg-layer';
                bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: 0em 0em; background-repeat: no-repeat; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                innerBtn.insertBefore(bgLayer, innerBtn.firstChild);
            }
            let customText = innerBtn.querySelector('.custom-main-text');
            if (!customText) {
                customText = document.createElement('div');
                customText.className = 'custom-main-text';
                customText.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 2.75em; font-weight: 500; color: #76ff33; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-transform: uppercase; transition: color 0.2s ease-in-out; pointer-events: none;`;
                innerBtn.appendChild(customText);
            }
            if (!playButton.dataset.overridden) {
                playButton.addEventListener('click', (e) => {
                    if (e.isTrusted && !isSearching()) {
                        targetMode = quickBattleMode;
                        autoQueueState = 1;
                    }
                });
            }
        }
        if (mainMenu)
            mainMenu.style.marginTop = '1em';
        createQuickButtons(playButton);
        playButton.dataset.overridden = 'true';
        syncButtonStates(true);
    }
    function createQuickButtons(playButton) {
        if (!playButton || buttonsCreated)
            return;
        buttonsCreated = true;
        const currentLang = getLang();
        const quickWrapper = document.createElement('div');
        quickWrapper.id = 'quick-play-wrapper';
        quickWrapper.style.cssText = `width: ${MAIN_WIDTH}em; display: flex; flex-direction: column; gap: ${ROW_GAP}em; margin-top: ${ROW_GAP}em; position: relative; z-index: 10; box-sizing: border-box; flex-shrink: 0;`;
        const row2 = document.createElement('div');
        row2.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
        const yOffsetRow2 = -(MAIN_HEIGHT + ROW_GAP);
        wideModes.forEach((mode, index) => {
            const el = document.createElement('div');
            el.className = 'custom-mode-button';
            const xOffset = -index * (WIDE_BUTTON_WIDTH + ROW_GAP);
            el.style.cssText = `width: ${WIDE_BUTTON_WIDTH}em; height: 100%; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
            const bgLayer = document.createElement('div');
            bgLayer.className = 'custom-btn-bg-layer';
            bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow2}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
            el.appendChild(bgLayer);
            const contentWrapper = document.createElement('div');
            contentWrapper.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.6em; pointer-events: none; position: relative; z-index: 2;';
            const img = document.createElement('div');
            img.className = 'mode-icon-el';
            img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
            const text = document.createElement('span');
            text.className = 'wide-mode-btn-text';
            text.dataset.index = index.toString();
            text.textContent = mode.labels[currentLang];
            text.style.cssText = 'font-size: 1.2em; font-weight: 500; font-family: BaseFontMedium, FallbackFontMedium; transition: color 0.2s ease-in-out;';
            contentWrapper.appendChild(img);
            contentWrapper.appendChild(text);
            el.appendChild(contentWrapper);
            el.addEventListener('mouseenter', () => { if (!isSearching())
                el.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em'; });
            el.addEventListener('mouseleave', () => { if (!isSearching())
                el.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em'; });
            el.addEventListener('click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
            row2.appendChild(el);
        });
        const row3 = document.createElement('div');
        row3.style.cssText = `display: flex; gap: ${ROW_GAP}em; width: 100%; height: ${BUTTON_HEIGHT}em;`;
        const yOffsetRow3 = -(MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP);
        modes.forEach((mode, index) => {
            const el = document.createElement('div');
            el.className = 'custom-mode-button';
            const xOffset = -index * (BUTTON_WIDTH + ROW_GAP);
            el.style.cssText = `width: ${BUTTON_WIDTH}em; height: 100%; flex-shrink: 0; cursor: pointer; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; box-sizing: border-box; overflow: hidden; position: relative; transition: box-shadow 0.2s ease-in-out;`;
            const bgLayer = document.createElement('div');
            bgLayer.className = 'custom-btn-bg-layer';
            bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-repeat: no-repeat; background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: ${xOffset}em ${yOffsetRow3}em; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
            el.appendChild(bgLayer);
            const img = document.createElement('div');
            img.className = 'mode-icon-el';
            img.title = mode.labels[currentLang];
            img.style.cssText = `width: 1.8em; height: 1.8em; pointer-events: none; flex-shrink: 0; position: relative; z-index: 2; -webkit-mask-image: url(${mode.icon}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${mode.icon}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; transition: background-color 0.2s ease-in-out;`;
            el.appendChild(img);
            el.addEventListener('mouseenter', () => { if (!isSearching())
                el.style.boxShadow = 'rgb(118, 255, 51) 0 0 0 0.2em'; });
            el.addEventListener('mouseleave', () => { if (!isSearching())
                el.style.boxShadow = 'rgba(118, 255, 51, 0.25) 0 0 0 0.0625em'; });
            el.addEventListener('click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
            row3.appendChild(el);
        });
        quickWrapper.appendChild(row2);
        quickWrapper.appendChild(row3);
        if (playButton.parentElement)
            playButton.parentElement.appendChild(quickWrapper);
    }
    function simulateClick(el) {
        if (!el)
            return false;
        el.click();
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        return true;
    }
    function matchText(text, names) {
        const upper = text.trim().toUpperCase();
        return names.some(n => upper === n.toUpperCase());
    }
    function clickSpecificCard(modeNames) {
        const allCards = document.querySelectorAll('.BattlePickComponentStyle-commonStyleBlock, .blockCard, [class*="commonStyleBlock"]');
        for (const card of Array.from(allCards)) {
            const h2 = card.querySelector('h2');
            if (h2 && matchText(h2.textContent || '', modeNames))
                return simulateClick(card);
        }
        return false;
    }
    function processAutoQueue() {
        if (autoQueueState === 0 || !targetMode)
            return;
        if (autoQueueState === 1) {
            if (targetMode.isDirect) {
                if (clickSpecificCard(targetMode.names)) {
                    autoQueueState = 0;
                    targetMode = null;
                    document.body.classList.remove('kasp-autoqueue-active');
                }
            }
            else {
                if (clickSpecificCard(modesButtonNames))
                    autoQueueState = 2;
            }
        }
        else if (autoQueueState === 2) {
            if (clickSpecificCard(targetMode.names)) {
                autoQueueState = 0;
                targetMode = null;
                document.body.classList.remove('kasp-autoqueue-active');
            }
        }
    }
    let failSafeTimer = null;
    function startAutoQueue(modeData) {
        if (isSearching())
            return;
        targetMode = modeData;
        const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer');
        if (playButton && !playButton.classList.contains('MainScreenComponentStyle-disabledButtonPlay')) {
            autoQueueState = 1;
            document.body.classList.add('kasp-autoqueue-active');
            if (failSafeTimer)
                clearTimeout(failSafeTimer);
            failSafeTimer = setTimeout(() => {
                autoQueueState = 0;
                document.body.classList.remove('kasp-autoqueue-active');
            }, 1500);
            simulateClick(playButton);
        }
    }
    const observer = new MutationObserver(() => {
        const playButton = document.querySelector('.MainScreenComponentStyle-playButtonContainer:not([data-overridden="true"])');
        if (playButton) {
            buttonsCreated = false;
            applyStyles(playButton);
        }
    });
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    }
    else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
    document.addEventListener('click', function (e) {
        const target = e.target;
        if (!target)
            return;
        const menuItem = target.closest('.PrimaryMenuItemComponentStyle-menuItemContainer');
        if (menuItem && !menuItem.classList.contains('custom-history-button')) {
            buttonsCreated = false;
            autoQueueState = 0;
            targetMode = null;
            lastSearchingState = null;
        }
    }, true);
    function gameLoop() {
        if (autoQueueState !== 0)
            processAutoQueue();
        if (buttonsCreated)
            syncButtonStates();
        requestAnimationFrame(gameLoop);
    }
    requestAnimationFrame(gameLoop);
})();
