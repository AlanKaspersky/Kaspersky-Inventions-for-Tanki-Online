import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('hideCurrency');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';

export const hideCurrency = lifecycle.initialize(() => {
    let initialized = false;
    let interval: number | undefined;
    const masked = new Map<HTMLElement, {
        value: string; parent: HTMLElement; tooltip: string | null; hadClass: boolean;
    }>();

    function getHiddenText() {
        return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
    }

    function processSpan(span: HTMLElement) {
        if (span.closest('#kasp-tankoin-balance')) return;
        const text = span.textContent?.trim() || '';
        const targetText = getHiddenText();
        const parent = (span.closest(gameDOM.account.currencyIcon) || span.parentElement) as HTMLElement | null;
        if (!parent) return;
        let record = masked.get(span);
        if (record && record.parent !== parent) { restore(span); record = undefined; }
        if (/\d/.test(text)) {
            if (record) record.value = text;
            else {
                record = { value: text, parent, tooltip: parent.getAttribute('data-tooltip'),
                    hadClass: parent.classList.contains('currency-masked') };
                masked.set(span, record);
            }
        }
        if (!record) return;
        if (span.dataset.originalValue !== record.value) span.dataset.originalValue = record.value;
        if (span.textContent !== targetText) span.textContent = targetText;
        if (parent.getAttribute('data-tooltip') !== record.value) parent.setAttribute('data-tooltip', record.value);
        if (!parent.classList.contains('currency-masked')) parent.classList.add('currency-masked');
    }

    function restore(span: HTMLElement): void {
        const record = masked.get(span);
        if (!record) return;
        if (['Hidden', 'Скрыто'].includes(span.textContent?.trim() || '')) span.textContent = record.value;
        delete span.dataset.originalValue;
        if (!record.hadClass) record.parent.classList.remove('currency-masked');
        if (record.parent.getAttribute('data-tooltip') === record.value) {
            if (record.tooltip === null) record.parent.removeAttribute('data-tooltip');
            else record.parent.setAttribute('data-tooltip', record.tooltip);
        }
        masked.delete(span);
    }

    function restoreAll(): void { for (const span of masked.keys()) restore(span); }

    function sync(): void {
        if (!utils.getSetting('k_hideCurrency', false) || state.currentScreen === 'battle') {
            lifecycle.cancelInterval(interval);
            interval = undefined;
            restoreAll();
            return;
        }
        interval ??= lifecycle.interval(sync, 500);
        for (const span of masked.keys()) if (!span.isConnected) restore(span);
        document.querySelectorAll<HTMLElement>(gameDOM.account.currencyValues).forEach(processSpan);
    }

    lifecycle.onCleanup(() => { interval = undefined; restoreAll(); });

    return () => {
        if (!initialized) {
            initialized = true;
            lifecycle.listen(window, 'kasp:settings-changed', sync);
            lifecycle.listen(window, 'storage', sync);
        }
        sync();
    };
}, () => {});
