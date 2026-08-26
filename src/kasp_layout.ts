(function() {
    'use strict';

    const style = document.createElement('style');
    style.textContent = `
        .UserScoreComponentStyle-coinsContainer {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-end !important;
            margin-right: 1.2em !important;
            margin-left: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            min-width: 0 !important;
            width: auto !important;
        }

        div:has(> .HeaderCommonStyle-icons + .HeaderCommonStyle-icons) {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-end !important;
            margin-right: 4em !important;
            margin-left: 0 !important;
            padding: 0 !important;
            border: none !important;
            background: transparent !important;
            min-width: 0 !important;
            width: auto !important;
        }

        div:has(> .HeaderCommonStyle-icons + .HeaderCommonStyle-icons) + div {
            margin-left: -2em !important;
        }

        .HeaderCommonStyle-icons,
        .UserScoreComponentStyle-coinBlock {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-end !important;
            min-width: 0 !important;
            width: auto !important;
            border: none !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
        }

        .UserScoreComponentStyle-addRubyCrystal,
        .UserScoreComponentStyle-addCoins {
            display: none !important;
        }

        .HeaderCommonStyle-icons img[src*="ruby"],
        .HeaderCommonStyle-icons img[src*="crystal"],
        .UserScoreComponentStyle-coinIcon {
            width: 1em !important;
            height: 1em !important;
            margin: 0 !important;
            transition: transform 0.2s ease !important;
            display: block !important;
        }

        .HeaderCommonStyle-icons:hover img[src*="ruby"],
        .HeaderCommonStyle-icons:hover img[src*="crystal"],
        .HeaderCommonStyle-icons:hover .UserScoreComponentStyle-coinIcon {
            transform: translateY(-4px) !important;
        }

        .HeaderCommonStyle-icons span,
        .UserScoreComponentStyle-coinsContainer span,
        .UserScoreComponentStyle-coinBlock span {
            font-family: BaseFontMedium, FallbackFontMedium !important;
            font-weight: 500 !important;
            font-size: 1.125em !important;
            line-height: 1.313em !important;
            text-transform: uppercase !important;
            white-space: nowrap !important;
            margin-left: 0.6em !important;
        }

        .HeaderCommonStyle-icons:has(img[src*="ruby"]) span {
            color: rgb(255, 102, 102) !important;
            margin-top: 0.1em !important;
        }

        .HeaderCommonStyle-icons:has(img[src*="crystal"]) span {
            color: rgb(0, 215, 255) !important;
        }

        .UserScoreComponentStyle-coinBlock span {
            color: rgb(255, 212, 42) !important;
        }
    `;

    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
    }
})();