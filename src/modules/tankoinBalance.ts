import { featureScope } from '../core/featureRuntime';
import { getAccountIdentity, getVerifiedAccount } from '../core/accountIdentity';
import { ACCOUNT_IDENTITY_MESSAGE } from '../core/accountId';
import { readPageMessage } from '../core/pageMessages';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';

const lifecycle = featureScope('tankoinBalance');
const PANEL_ID = 'kasp-tankoin-balance';
const COIN_ICON = 'https://s.eu.tankionline.com/static/images/coin.3a16e831.svg';
const STORAGE_PREFIX = 'kasp_tankoin_balance_uid_';

function parseBalance(value: string | null | undefined): string | null {
    const text = value?.trim() || '';
    return text.length <= 64 && /^\d[\d\s]*$/.test(text) ? text : null;
}

function readBalance(element: HTMLElement | null): string | null {
    return parseBalance(element?.textContent) ?? parseBalance(element?.dataset.originalValue);
}

export const tankoinBalance = lifecycle.initialize(() => {
    let owner: string | null = null;
    let ownerId: string | null = null;
    let balance: string | null = null;
    let lastSaveAttempt: string | null = null;
    let iconUrl = COIN_ICON;
    let panel: HTMLElement | null = null;
    let iconContainer: HTMLElement | null = null;
    let image: HTMLImageElement | null = null;
    let value: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let sources: HTMLElement[] = [];
    let initialized = false;
    const presentedOwners = new Set<string>();

    function removePanel(): void {
        panel?.remove();
        panel = iconContainer = image = value = null;
    }

    function sync(): void {
        if (!initialized) {
            initialized = true;
            lifecycle.listen(window, 'kasp:settings-changed', sync);
            lifecycle.listen(window, 'storage', sync);
            lifecycle.listen(window, 'message', event => {
                if (readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE)) sync();
            });
        }
        const account = getVerifiedAccount();
        const nickname = getAccountIdentity()?.nickname || account?.nickname || null;
        if (nickname !== owner && (!account || account.userId !== ownerId)) {
            ownerId = null;
            balance = null;
            lastSaveAttempt = null;
            iconUrl = COIN_ICON;
            removePanel();
        }
        owner = nickname;
        if (account && account.userId !== ownerId) {
            if (ownerId !== null) balance = null;
            ownerId = account.userId;
            let cached: string | null = null;
            try { cached = parseBalance(localStorage.getItem(STORAGE_PREFIX + ownerId)); } catch {}
            balance ??= cached;
            lastSaveAttempt = cached;
        }
        const breadcrumbs = document.querySelector<HTMLElement>(gameDOM.account.currencyHeader);
        const currencies = (breadcrumbs || document).querySelector<HTMLElement>(gameDOM.account.currencyGroup);
        const header = breadcrumbs || currencies?.parentElement || null;
        const native = header?.querySelector<HTMLElement>(`${gameDOM.account.tankoinContainer}:not(#${PANEL_ID})`) || null;
        const exchange = document.querySelector<HTMLElement>(gameDOM.account.exchangeBalance);
        const nextSources = [native, exchange].filter((element): element is HTMLElement => !!element);
        if (sources.length !== nextSources.length || sources.some((element, index) => element !== nextSources[index])) {
            observer ??= lifecycle.observer(sync);
            observer.disconnect();
            sources = nextSources;
            for (const source of sources) observer.observe(source, { childList: true, subtree: true, characterData: true });
        }
        const observed = readBalance(exchange) ?? readBalance(native?.querySelector<HTMLElement>(gameDOM.account.tankoinBalance) || null);
        if (observed !== null) balance = observed;
        if (account && account.userId === ownerId && balance !== null && balance !== lastSaveAttempt) {
            lastSaveAttempt = balance;
            try { localStorage.setItem(STORAGE_PREFIX + ownerId, balance); } catch {}
        }
        const sourceIcon = (exchange ? document.querySelector<HTMLImageElement>(gameDOM.account.exchangeIcon) : null)
            || native?.querySelector<HTMLImageElement>(gameDOM.account.tankoinIcon);
        if (sourceIcon?.src) iconUrl = sourceIcon.src;
        if (!header || native || state.currentScreen === 'lobby' && !account) {
            if (header && native && account) presentedOwners.add(account.userId);
            removePanel(); return;
        }
        if (!panel?.isConnected || panel.parentElement !== header) {
            removePanel();
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.className = gameDOM.classes.tankoinContainer
                + (state.currentScreen === 'lobby' && account && !presentedOwners.has(account.userId) ? ' kasp-lobby-reveal' : '');
            iconContainer = document.createElement('div');
            iconContainer.className = gameDOM.classes.currencyIcon;
            const block = document.createElement('div');
            block.className = gameDOM.classes.tankoinBlock;
            image = document.createElement('img');
            image.className = gameDOM.classes.tankoinIcon;
            image.alt = '';
            value = document.createElement('span');
            block.append(image, value);
            iconContainer.appendChild(block);
            panel.appendChild(iconContainer);
            header.insertBefore(panel, currencies?.parentElement === header ? currencies : header.firstChild);
        }
        if (account) presentedOwners.add(account.userId);
        if (image!.getAttribute('src') !== iconUrl) image!.src = iconUrl;
        const hidden = utils.getSetting('k_hideCurrency', false) && balance !== null;
        const text = hidden ? (state.lang === 'RU' ? 'Скрыто' : 'Hidden') : balance ?? '—';
        if (value!.textContent !== text) value!.textContent = text;
        if (hidden) {
            value!.dataset.originalValue = balance!;
            if (iconContainer!.getAttribute('data-tooltip') !== balance) iconContainer!.setAttribute('data-tooltip', balance!);
        } else {
            delete value!.dataset.originalValue;
            iconContainer!.removeAttribute('data-tooltip');
        }
        iconContainer!.classList.toggle('currency-masked', hidden);
        const hint = balance === null
            ? (state.lang === 'RU' ? 'Откройте магазин или обмен рубинов, чтобы обновить баланс танкоинов.'
                : 'Open the shop or Ruby exchange to refresh the Tankoin balance.')
            : (state.lang === 'RU' ? 'Танкоины' : 'Tankoins');
        if (panel.title !== hint) panel.title = hint;
    }

    lifecycle.onCleanup(() => {
        observer?.disconnect();
        sources = [];
        balance = owner = ownerId = lastSaveAttempt = null;
        removePanel();
    });
    return sync;
}, () => {});
