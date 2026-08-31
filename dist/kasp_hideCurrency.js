"use strict";
(function () {
    if (window !== window.top) {
        return;
    }
    'use strict';
    if (localStorage.getItem('k_hideCurrency') !== 'true')
        return;
    function isBattleActive() {
        return !!document.querySelector('.BattleHudComponentStyle-hudContainer');
    }
    function getLang() {
        return document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('ru') ? 'RU' : 'EN';
    }
    function getHiddenText() {
        return getLang() === 'RU' ? 'Скрыто' : 'Hidden';
    }
    const style = document.createElement('style');
    style.textContent = `
        #currency-tooltip {
            position: fixed;
            z-index: 999999;
            background: rgba(15, 17, 21, 0.95);
            border: 0.08em solid rgba(255, 255, 255, 0.15);
            padding: 0.6em 1em;
            border-radius: 0.5em;
            font-family: BaseFontMedium, FallbackFontMedium, sans-serif;
            font-size: 1.1em;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.6);
            display: none;
            transition: opacity 0.15s ease;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .currency-masked {
            cursor: pointer !important;
            letter-spacing: 0.05em !important;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    }
    else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
    const tooltip = document.createElement('div');
    tooltip.id = 'currency-tooltip';
    function appendTooltip() {
        if (document.body) {
            document.body.appendChild(tooltip);
        }
        else {
            document.addEventListener('DOMContentLoaded', appendTooltip);
        }
    }
    appendTooltip();
    function getCurrencyStyle(span) {
        if (span.closest('.ksc-22'))
            return 'color: rgb(255, 102, 102);';
        if (span.closest('.ksc-24'))
            return 'color: rgb(0, 215, 255);';
        if (span.closest('.UserScoreComponentStyle-coinBlock'))
            return 'color: rgb(255, 188, 9);';
        return 'color: #fff;';
    }
    function updateTooltipPosition(e) {
        const offsetX = 15;
        const offsetY = 18;
        tooltip.style.left = (e.clientX + offsetX) + 'px';
        tooltip.style.top = (e.clientY + offsetY) + 'px';
    }
    function processSpan(span) {
        const text = span.textContent?.trim() || '';
        const targetText = getHiddenText();
        if (text && text !== targetText && /\d/.test(text)) {
            span.dataset.originalValue = text;
            span.textContent = targetText;
        }
        if (!span.classList.contains('currency-masked')) {
            span.classList.add('currency-masked');
            const parentElement = (span.closest('.HeaderCommonStyle-icons') || span.parentElement);
            if (parentElement && !parentElement.dataset.tooltipAttached) {
                parentElement.dataset.tooltipAttached = 'true';
                parentElement.addEventListener('mouseenter', (e) => {
                    const customStyle = getCurrencyStyle(span);
                    const val = span.dataset.originalValue || span.textContent;
                    tooltip.innerHTML = `<span style="font-family: BaseFontMedium, FallbackFontMedium; font-style: normal; font-weight: 500; font-size: 1.125em; line-height: 1.313em; text-transform: uppercase; word-spacing: 0.1em; ${customStyle}">${val}</span>`;
                    tooltip.style.display = 'block';
                    updateTooltipPosition(e);
                });
                parentElement.addEventListener('mousemove', updateTooltipPosition);
                parentElement.addEventListener('mouseleave', () => tooltip.style.display = 'none');
            }
        }
    }
    let rootContainer = null;
    const observerConfig = { childList: true, subtree: true, characterData: true };
    const observer = new MutationObserver(() => {
        if (isBattleActive())
            return;
        observer.disconnect();
        const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
        spans.forEach(s => processSpan(s));
        if (rootContainer)
            observer.observe(rootContainer, observerConfig);
    });
    const initObserver = () => {
        rootContainer = document.getElementById('app-root') || document.body;
        if (rootContainer)
            observer.observe(rootContainer, observerConfig);
        const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
        spans.forEach(s => processSpan(s));
    };
    if (document.body || document.getElementById('app-root'))
        initObserver();
    else
        document.addEventListener('DOMContentLoaded', initObserver);
    setInterval(() => {
        if (isBattleActive())
            return;
        const spans = document.querySelectorAll('.ksc-22 span, .ksc-24 span, .UserScoreComponentStyle-coinBlock span, .HeaderCommonStyle-icons span');
        spans.forEach(s => processSpan(s));
    }, 500);
})();
