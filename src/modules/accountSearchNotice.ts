import { featureScope } from '../core/featureRuntime';
import { getVerifiedAccount } from '../core/accountIdentity';
import { ACCOUNT_IDENTITY_MESSAGE } from '../core/accountId';
import { readPageMessage } from '../core/pageMessages';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';

const lifecycle = featureScope('accountSearchNotice');

export const accountSearchNotice = lifecycle.initialize(() => {
    let notice: HTMLElement | null = null, label: HTMLElement | null = null;
    let showTimer: number | null = null, removeTimer: number | null = null, identityTimer: number | null = null;
    let initialized = false;
    const searching = () => state.currentScreen === 'lobby'
        && !!document.querySelector(gameDOM.play.mainMenu) && !getVerifiedAccount();
    function remove(): void {
        notice?.remove(); notice = label = null;
        if (removeTimer !== null) lifecycle.cancelTimeout(removeTimer);
        removeTimer = null;
    }
    function hide(): void {
        if (showTimer !== null) lifecycle.cancelTimeout(showTimer);
        showTimer = null;
        if (!notice || removeTimer !== null) return;
        if (notice.dataset.visible !== 'true') { remove(); return; }
        notice.dataset.visible = 'false';
        removeTimer = lifecycle.timeout(remove, 200);
    }
    function caption(): void {
        const text = state.lang === 'RU' ? 'Поиск ID аккаунта' : 'Searching for account ID';
        if (label && label.textContent !== text) label.textContent = text;
    }
    function show(): void {
        showTimer = null;
        if (!searching()) return;
        const root = document.querySelector(gameDOM.common.appContainer) || document.body;
        if (!root) return;
        notice = document.createElement('div');
        notice.id = 'kasp-account-search-notice';
        notice.className = 'kasp-lobby-has-art';
        notice.setAttribute('role', 'status');
        notice.setAttribute('aria-live', 'polite');
        notice.setAttribute('aria-atomic', 'true');
        const art = document.createElement('span');
        art.className = 'kasp-lobby-art-slice';
        art.setAttribute('aria-hidden', 'true');
        art.style.setProperty('--kasp-art-image', `url(${JSON.stringify(chrome.runtime.getURL('assets/art1.png'))})`);
        label = document.createElement('span');
        label.className = 'kasp-account-search-label';
        notice.append(art, label); caption(); root.appendChild(notice);
        const target = notice;
        // Give the initial hidden style a paint before starting the transition.
        lifecycle.frame(() => lifecycle.frame(() => {
            if (notice === target && searching()) target.dataset.visible = 'true';
        }));
    }
    function sync(): void {
        if (!initialized) {
            initialized = true;
            lifecycle.listen(window, 'message', event => {
                if (!readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE) || identityTimer !== null) return;
                identityTimer = lifecycle.timeout(() => { identityTimer = null; sync(); }, 0);
            });
        }
        if (!searching()) { hide(); return; }
        if (notice && !notice.isConnected) remove();
        if (notice) {
            if (removeTimer !== null) {
                lifecycle.cancelTimeout(removeTimer); removeTimer = null;
                notice.dataset.visible = 'true';
            }
            caption(); return;
        }
        if (showTimer === null) showTimer = lifecycle.timeout(show, 600);
    }
    lifecycle.onCleanup(remove);
    return sync;
}, () => {});
