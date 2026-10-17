import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('hideCurrency');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';

export const hideCurrency = lifecycle.initialize(() => {
    let initialized = false;

    function getHiddenText() {
        return state.lang === 'RU' ? 'Скрыто' : 'Hidden';
    }

    function processSpan(span: HTMLElement) {
        const text = span.textContent?.trim() || '';
        const targetText = getHiddenText();

        const parentElement = (span.closest(gameDOM.account.currencyIcon) || span.parentElement) as HTMLElement;

        if (text && text !== targetText && text !== 'Скрыто' && text !== 'Hidden' && /\d/.test(text)) {
            span.dataset.originalValue = text;
            span.textContent = targetText;
            if (parentElement) {
                parentElement.setAttribute('data-tooltip', text);
            }
        } else if (span.dataset.originalValue && parentElement && !parentElement.hasAttribute('data-tooltip')) {
            parentElement.setAttribute('data-tooltip', span.dataset.originalValue);
        }

        if (parentElement && !parentElement.classList.contains('currency-masked')) {
            parentElement.classList.add('currency-masked');
        }
    }

    lifecycle.onCleanup(() => { document.querySelectorAll<HTMLElement>('[data-original-value]').forEach(node=>{if(node.dataset.originalValue && ['Hidden','Скрыто'].includes(node.textContent?.trim() || ''))node.textContent=node.dataset.originalValue;delete node.dataset.originalValue;});document.querySelectorAll('.currency-masked').forEach(node=>{node.classList.remove('currency-masked');node.removeAttribute('data-tooltip');}); });

    return () => {
        if (!utils.getSetting('k_hideCurrency', false)) return;
        if (state.currentScreen === 'battle') return;

        if (!initialized) {
            initialized = true;

            lifecycle.interval(() => {
                if (state.currentScreen === 'battle') return;
                const spans = document.querySelectorAll(gameDOM.account.currencyValues);
                spans.forEach(node => processSpan(node as HTMLElement));
            }, 500);
        }

        const spans = document.querySelectorAll(gameDOM.account.currencyValues);
        spans.forEach(node => processSpan(node as HTMLElement));
    };
}, () => {});