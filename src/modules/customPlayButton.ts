import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('customPlayButton');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';

export const customPlayButton = lifecycle.initialize(() => {
    let initialized = false;
    let buttonsCreated = false;
    let autoQueueState = 0;
    type QueueMode = { names: string[]; isDirect: boolean };
    let targetMode: QueueMode | null = null;
    let lastSearchingState: boolean | null = null;
    let failSafeTimer: number | null = null;

    const BUTTON_WIDTH = 3.5;
    const ROW_GAP = 0.5;
    const BUTTONS_COUNT = 7;
    const MAIN_WIDTH = (BUTTON_WIDTH * BUTTONS_COUNT) + (ROW_GAP * (BUTTONS_COUNT - 1));
    const WIDE_BUTTON_WIDTH = (MAIN_WIDTH - ROW_GAP) / 2;
    const MAIN_HEIGHT = 8.5;
    const BUTTON_HEIGHT = 3;
    const TOTAL_BG_HEIGHT = MAIN_HEIGHT + ROW_GAP + BUTTON_HEIGHT + ROW_GAP + BUTTON_HEIGHT;
    const BG_URL = chrome.runtime.getURL("assets/playButton.png");
    const LOCK_ICON_URL = 'https://s.eu.tankionline.com/static/images/lockButtonPlay.4bb62c08.svg';

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

    function isSearching() {
        return !!document.querySelector(gameDOM.play.disabled);
    }

    function simulateClick(el: HTMLElement) {
        if (!el) return false;
        el.click();
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        return true;
    }

    function matchText(text: string, names: string[]) {
        const upper = text.trim().toUpperCase();
        return names.some(n => upper === n.toUpperCase());
    }

    function clickSpecificCard(modeNames: string[]) {
        const allCards = document.querySelectorAll(gameDOM.play.cards);
        for (const card of Array.from(allCards)) {
            const h2 = card.querySelector('h2');
            if (h2 && matchText(h2.textContent || '', modeNames)) return simulateClick(card as HTMLElement);
        }
        return false;
    }

    function processAutoQueue() {
        if (autoQueueState === 0 || !targetMode) return;
        if (autoQueueState === 1) {
            if (targetMode.isDirect) {
                if (clickSpecificCard(targetMode.names)) {
                    autoQueueState = 0; targetMode = null; document.body.classList.remove('kasp-autoqueue-active');
                }
            } else {
                if (clickSpecificCard(modesButtonNames)) autoQueueState = 2;
            }
        } else if (autoQueueState === 2) {
            if (clickSpecificCard(targetMode.names)) {
                autoQueueState = 0; targetMode = null; document.body.classList.remove('kasp-autoqueue-active');
            }
        }
    }

    function startAutoQueue(modeData: QueueMode) {
        if (isSearching()) return;
        targetMode = modeData;
        const playButton = document.querySelector(gameDOM.play.container) as HTMLElement;
        if (playButton && !playButton.classList.contains(gameDOM.classes.disabledPlay)) {
            autoQueueState = 1;
            document.body.classList.add('kasp-autoqueue-active');
            if (failSafeTimer) lifecycle.cancelTimeout(failSafeTimer);
            failSafeTimer = lifecycle.timeout(() => {
                autoQueueState = 0;
                document.body.classList.remove('kasp-autoqueue-active');
            }, 1500);
            simulateClick(playButton);
        }
    }

    function handleModeHotkey(e: KeyboardEvent): void {
        if (e.repeat) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        const ae = document.activeElement as HTMLElement | null;
        if (ae && (
            ae.tagName === 'INPUT' ||
            ae.tagName === 'TEXTAREA' ||
            ae.tagName === 'SELECT' ||
            ae.isContentEditable
        )) return;

        if (state.currentScreen !== 'lobby' && state.currentScreen !== 'loading') return;

        if (!utils.getSetting('k_ext_btn', false)) return;

        if (isSearching()) return;
        if (autoQueueState !== 0) return;

        if (document.querySelector(gameDOM.dialogs.container)) return;

        let handled = false;

        if (e.code === 'Space') {
            startAutoQueue(quickBattleMode);
            handled = true;
        }
        else if (e.code === 'ShiftLeft') {
            startAutoQueue(wideModes[1]);
            handled = true;
        }
        else if (e.code === 'ShiftRight') {
            startAutoQueue(wideModes[0]);
            handled = true;
        }
        else {
            const m = e.code.match(/^Digit([1-7])$/) || e.code.match(/^Numpad([1-7])$/);
            if (m) {
                const idx = parseInt(m[1], 10) - 1;
                const mode = modes[idx];
                if (mode) {
                    startAutoQueue(mode);
                    handled = true;
                }
            }
        }

        if (handled) {
            e.preventDefault();
        }
    }

    function syncButtonStates(force = false) {
        const searching = isSearching();
        if (!force && searching === lastSearchingState) return;
        lastSearchingState = searching;
        const currentLang = state.lang;

        const playButton = document.querySelector(gameDOM.play.container) as HTMLElement;
        if (playButton) {
            const bgLayer = playButton.querySelector('.custom-main-bg-layer') as HTMLElement;
            const innerBtn = (playButton.querySelector(gameDOM.play.button) || playButton) as HTMLElement;
            let customText = innerBtn.querySelector('.custom-main-text') as HTMLElement;
            let lockDiv = innerBtn.querySelector('.main-lock-icon') as HTMLElement;

            if (searching) {
                playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                playButton.style.cursor = 'default';
                if (bgLayer) bgLayer.style.filter = 'brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)';
                if (customText) customText.style.display = 'none';
                if (!lockDiv) {
                    lockDiv = document.createElement('div');
                    lockDiv.className = 'main-lock-icon';
                    lockDiv.style.cssText = `width: 2.625em; height: 2.8125em; background-color: #a7a7a7; -webkit-mask-image: url(${LOCK_ICON_URL}); -webkit-mask-size: contain; -webkit-mask-position: center; -webkit-mask-repeat: no-repeat; mask-image: url(${LOCK_ICON_URL}); mask-size: contain; mask-position: center; mask-repeat: no-repeat; z-index: 2; position: relative;`;
                    innerBtn.appendChild(lockDiv);
                } else {
                    lockDiv.style.display = 'block';
                    lockDiv.style.backgroundColor = '#868686';
                }
            } else {
                playButton.style.boxShadow = 'rgba(254, 255, 254, 0.25) 0 0 0 0.0625em';
                playButton.style.cursor = 'pointer';
                if (bgLayer) bgLayer.style.filter = 'none';
                if (lockDiv) lockDiv.style.display = 'none';
                if (customText) {
                    customText.style.display = 'flex';
                    const targetText = currentLang === 'RU' ? 'БЫСТРЫЙ БОЙ' : 'QUICK BATTLE';
                    if (customText.textContent !== targetText) customText.textContent = targetText;
                }
            }
        }

        document.querySelectorAll('.wide-mode-btn-text').forEach(spanEl => {
            const span = spanEl as HTMLElement;
            const modeIndex = parseInt(span.dataset.index || '0', 10);
            if (wideModes[modeIndex]) span.textContent = wideModes[modeIndex].labels[currentLang];
        });

        const quickWrapper = document.getElementById('quick-play-wrapper');
        if (quickWrapper) {
            quickWrapper.querySelectorAll('.custom-mode-button').forEach(btnEl => {
                const btn = btnEl as HTMLElement;
                const bgLayer = btn.querySelector('.custom-btn-bg-layer') as HTMLElement;
                const iconDiv = btn.querySelector('.mode-icon-el') as HTMLElement;
                const textSpan = btn.querySelector('.wide-mode-btn-text') as HTMLElement;
                if (searching) {
                    btn.style.pointerEvents = 'none'; btn.style.cursor = 'default';
                    btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0em 0em 0em 1px';
                    if (bgLayer) bgLayer.style.filter = 'brightness(0.35) sepia(0) hue-rotate(160deg) saturate(3)';
                    if (iconDiv) iconDiv.style.backgroundColor = '#a7a7a7';
                    if (textSpan) textSpan.style.color = '#a7a7a7';
                } else {
                    btn.style.pointerEvents = 'auto'; btn.style.cursor = 'pointer';
                    btn.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em';
                    if (bgLayer) bgLayer.style.filter = 'none';
                    if (iconDiv) iconDiv.style.backgroundColor = '#ffffff';
                    if (textSpan) textSpan.style.color = '#ffffff';
                }
            });
        }
    }

    function createQuickButtons(playButton: HTMLElement) {
        if (!playButton || buttonsCreated) return;
        buttonsCreated = true;
        const currentLang = state.lang;
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
            contentWrapper.appendChild(img); contentWrapper.appendChild(text); el.appendChild(contentWrapper);
            lifecycle.listen(el, 'mouseenter', () => { if (!isSearching()) el.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; });
            lifecycle.listen(el, 'mouseleave', () => { if (!isSearching()) el.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; });
            lifecycle.listen(el, 'click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
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
            lifecycle.listen(el, 'mouseenter', () => { if (!isSearching()) el.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; });
            lifecycle.listen(el, 'mouseleave', () => { if (!isSearching()) el.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; });
            lifecycle.listen(el, 'click', (e) => { e.stopPropagation(); startAutoQueue(mode); });
            row3.appendChild(el);
        });

        quickWrapper.appendChild(row2); quickWrapper.appendChild(row3);
        if (playButton.parentElement) playButton.parentElement.appendChild(quickWrapper);
        lifecycle.ownDOM(quickWrapper, element => element.remove());
    }

    function applyStyles(playButton: HTMLElement) {
        lifecycle.ownDOM(playButton, element => { delete element.dataset.overridden; });
        const container = (playButton.closest(gameDOM.common.flexDiv) || playButton.parentElement?.parentElement) as HTMLElement;
        const mainMenu = document.querySelector(gameDOM.play.mainMenu) as HTMLElement;
        if (container) {
            const commit = lifecycle.preserve(container, ['margin-left', 'height', 'margin-top', 'width', 'flex-direction', 'align-items', 'overflow', 'z-index', 'position']);
            container.style.marginLeft = '5em'; container.style.height = 'auto';
            container.style.marginTop = '10em'; container.style.width = '31.25em';
            container.style.flexDirection = 'column'; container.style.alignItems = 'flex-start';
            container.style.overflow = 'visible'; container.style.zIndex = '5';
            container.style.position = 'relative';
            commit();
        }
        if (playButton) {
            const commit = lifecycle.preserve(playButton, ['width', 'height', 'position', 'overflow', 'border-radius', 'transition', 'box-shadow']);
            playButton.style.width = `${MAIN_WIDTH}em`; playButton.style.height = `${MAIN_HEIGHT}em`;
            playButton.style.position = 'relative'; playButton.style.overflow = 'hidden';
            playButton.style.borderRadius = '0.5rem'; playButton.style.transition = 'box-shadow 0.2s ease-in-out, opacity 0.2s ease-in';
            lifecycle.listen(playButton, 'mouseenter', () => { if (!isSearching()) { playButton.style.boxShadow = 'rgb(255, 255, 255) 0 0 0 0.2em'; commit(); } });
            lifecycle.listen(playButton, 'mouseleave', () => { if (!isSearching()) { playButton.style.boxShadow = 'rgba(255, 255, 255, 0.25) 0 0 0 0.0625em'; commit(); } });
            const innerBtn = (playButton.querySelector(gameDOM.play.button) || playButton) as HTMLElement;
            const commitInner = lifecycle.preserve(innerBtn, ['background-image'], ['custom-inner-btn']);
            innerBtn.style.backgroundImage = 'none'; innerBtn.classList.add('custom-inner-btn');
            commitInner();
            let bgLayer = innerBtn.querySelector('.custom-main-bg-layer') as HTMLElement;
            if (!bgLayer) {
                bgLayer = document.createElement('div'); bgLayer.className = 'custom-main-bg-layer';
                bgLayer.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-image: url(${BG_URL}); background-size: ${MAIN_WIDTH}em ${TOTAL_BG_HEIGHT}em; background-position: 0em 0em; background-repeat: no-repeat; transition: filter 0.2s ease-in-out; pointer-events: none; z-index: 1;`;
                innerBtn.insertBefore(bgLayer, innerBtn.firstChild);
            }
            let customText = innerBtn.querySelector('.custom-main-text') as HTMLElement;
            if (!customText) {
                customText = document.createElement('div'); customText.className = 'custom-main-text';
                customText.style.cssText = `position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 2; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 2.75em; font-weight: 500; color: #ffffff; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-transform: uppercase; transition: color 0.2s ease-in-out; pointer-events: none;`;
                innerBtn.appendChild(customText);
            }
            if (!playButton.dataset.overridden) {
                lifecycle.listen(playButton, 'click', (e) => {
                    if (e.isTrusted && !isSearching()) { targetMode = quickBattleMode; autoQueueState = 1; }
                });
            }
            commit();
        }
        if (mainMenu) { const commit = lifecycle.preserve(mainMenu, ['margin-top']); mainMenu.style.marginTop = '1em'; commit(); }
        createQuickButtons(playButton);
        playButton.dataset.overridden = 'true';
        syncButtonStates(true);
    }

    lifecycle.onCleanup(() => { autoQueueState=0;targetMode=null;document.body.classList.remove('kasp-autoqueue-active');document.getElementById('kasp-playbtn-styles')?.remove();document.getElementById('quick-play-wrapper')?.remove();document.querySelectorAll<HTMLElement>('[data-overridden="true"]').forEach(node=>{node.querySelectorAll('.custom-main-bg-layer, .custom-main-text, .main-lock-icon').forEach(child=>child.remove());node.removeAttribute('data-overridden');}); });

    return () => {
        if (!utils.getSetting('k_ext_btn', false)) return;

        if (state.currentScreen === 'battle') return;

        if (!initialized) {
            initialized = true;
            utils.injectStyle(`
                        ${gameDOM.play.hiddenNativeDecorations} { display: none !important; }
                        .custom-inner-btn > *:not(.custom-main-bg-layer):not(.main-lock-icon):not(.custom-main-text):not(.kasp-left-art-slice) { display: none !important; }
                        ${gameDOM.play.untreatedContainer} { opacity: 0 !important; pointer-events: none !important; }
                        
                        ${gameDOM.play.autoQueueCards.split(', ').map(selector => `body.kasp-autoqueue-active ${selector}`).join(', ')} {
                            opacity: 0 !important; visibility: hidden !important; transition: none !important; animation: none !important;
                        }
                    `, 'kasp-playbtn-styles');

            lifecycle.listen(document, 'keydown', handleModeHotkey);

            lifecycle.interval(() => {
                if (autoQueueState !== 0) processAutoQueue();
            }, 50);
        }

        const playButton = document.querySelector(gameDOM.play.untreatedContainer) as HTMLElement;
        if (playButton) {
            buttonsCreated = false;
            applyStyles(playButton);
        }

        if (buttonsCreated) {
            syncButtonStates();
        }
    };
}, () => {});
