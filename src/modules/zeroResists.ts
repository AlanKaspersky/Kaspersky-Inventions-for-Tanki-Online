import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('zeroResists');
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { createTabExpansion } from './tabExpansion';

export const zeroResists = lifecycle.initialize(() => {

    const SHIELD_ICON_URL = chrome.runtime.getURL("assets/modulesTAB.svg");

    const RESISTANCE_MAP: Record<string, string> = {
        'mine': 'https://s.eu.tankionline.com/static/images/mine_resistance.dd581c90.svg',
        'crit': 'https://s.eu.tankionline.com/static/images/crit_resistance.94e32312.svg',
        'firebird': 'https://s.eu.tankionline.com/static/images/firebird_resistance.785a9d6b.svg',
        'freeze': 'https://s.eu.tankionline.com/static/images/freeze_resistance.33bdf642.svg',
        'isis': 'https://s.eu.tankionline.com/static/images/isis_resistance.30a69ffc.svg',
        'tesla': 'https://s.eu.tankionline.com/static/images/tesla_resistance.3e686c8e.svg',
        'hammer': 'https://s.eu.tankionline.com/static/images/hammer_resistance.6c549d29.svg',
        'twins': 'https://s.eu.tankionline.com/static/images/twins_resistance.ad189f61.svg',
        'ricochet': 'https://s.eu.tankionline.com/static/images/ricochet_resistance.8247beaa.svg',
        'vulcan': 'https://s.eu.tankionline.com/static/images/vulcan_resistance.824f6f0e.svg',
        'smoky': 'https://s.eu.tankionline.com/static/images/smoky_resistance.845afc14.svg',
        'rocket_launcher': 'https://s.eu.tankionline.com/static/images/rocket_launcher_resistance.b7dfd64f.svg',
        'thunder': 'https://s.eu.tankionline.com/static/images/thunder_resistance.6d7f4531.svg',
        'tsunami': 'https://s.eu.tankionline.com/static/images/tsunami_resistance.6200aad9.svg',
        'scorpio': 'https://s.eu.tankionline.com/static/images/scorpio_resistance.e8f1787f.svg',
        'artillery': 'https://s.eu.tankionline.com/static/images/artillery_resistance.9b4cbc34.svg',
        'railgun': 'https://s.eu.tankionline.com/static/images/railgun_resistance.636a554f.svg',
        'gauss': 'https://s.eu.tankionline.com/static/images/gauss_resistance.bb8f409c.svg',
        'shaft': 'https://s.eu.tankionline.com/static/images/shaft_resistance.0778fd3e.svg'
    };

    const TAB_SELECTOR = gameDOM.statistics.teams;

    let isTabExpanded = localStorage.getItem('kasp_tab_expanded') === 'true';
    let initialExpandedSet = false;
    const expansion = createTabExpansion(lifecycle);

    type ReadStyle = (element: Element) => CSSStyleDeclaration;

    function getCssUrl(el: Element | null, readStyle: ReadStyle): string | null {
        if (!el) return null;
        const cs = readStyle(el);
        for (const prop of ['maskImage', 'webkitMaskImage', 'backgroundImage'] as const) {
            const val = cs[prop];
            if (val && val !== 'none' && val !== 'initial' && val !== '') return val;
        }
        return null;
    }

    function injectHeaderShield(): void {
        const theadRows = document.querySelectorAll(gameDOM.statistics.headerRows);
        theadRows.forEach(row => {
            if (row.querySelector('.kasp-defence-th')) return;

            const gsHeader = row.children[1];
            if (gsHeader) {
                const th = document.createElement('th');
                th.className = 'kasp-defence-th';
                th.innerHTML = `<img src="${SHIELD_ICON_URL}" alt="" class="kasp-shield-img">`;
                gsHeader.after(th);
            }
        });
    }

    function getIconUrl(lbl: Element, iconDiv: Element | null, readStyle: ReadStyle): string {
        if (iconDiv) {
            const style = readStyle(iconDiv);
            const mask = style.getPropertyValue('-webkit-mask-image') || style.getPropertyValue('mask-image');
            const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1].toLowerCase();
        }
        const img = lbl.querySelector('img');
        if (img) return ((img as HTMLImageElement).src || '').toLowerCase();
        return '';
    }

    function injectCompactCells(readStyle: ReadStyle): void {
        const cells = document.querySelectorAll(gameDOM.statistics.resistanceCell);
        const updates = Array.from(cells, cell => {
            const htmlCell = cell as HTMLElement;
            const labels = Array.from(htmlCell.children).filter(el =>
                el.classList.contains(gameDOM.classes.defenceLabel) &&
                !el.closest('.kasp-compact-cell')
            ) as HTMLElement[];

            let redLabel: HTMLElement | null = null;
            let spectrumLabel: HTMLElement | null = null;
            const criticalLabels: HTMLElement[] = [];

            for (const lbl of labels) {
                const iconDiv = lbl.querySelector('div');
                const url = getIconUrl(lbl, iconDiv, readStyle);
                if (!spectrumLabel && url.includes('all_resistance')) spectrumLabel = lbl;
                if (url.includes('crit_resistance')) criticalLabels.push(lbl);
                if (!redLabel && iconDiv) {
                    const bg = readStyle(iconDiv).backgroundColor;
                    const isRed = bg.includes('254') || bg.includes('255, 80') ||
                        bg.includes('255, 102') || bg.includes('254, 102');
                    if (isRed) redLabel = lbl;
                }
            }

            const protectLabel = spectrumLabel || redLabel;
            const protectIsSpectrum = spectrumLabel !== null;
            const armadilloLabel = criticalLabels.find(lbl => lbl !== protectLabel) ?? null;

            const stateKey = JSON.stringify([protectIsSpectrum, protectLabel?.outerHTML ?? null, armadilloLabel?.outerHTML ?? null]);

            const compact = htmlCell.querySelector<HTMLElement>('.kasp-compact-cell');
            return { htmlCell, compact, protectLabel, protectIsSpectrum, armadilloLabel, stateKey };
        });

        for (const update of updates) {
            const { htmlCell, protectLabel, protectIsSpectrum, armadilloLabel, stateKey } = update;
            let { compact } = update;
            if (compact && compact.dataset.kaspState === stateKey) continue;
            if (!compact) {
                compact = document.createElement('div');
                compact.className = 'kasp-compact-cell';
            }

            const slot1 = document.createElement('div');
            slot1.className = 'kasp-slot';
            if (protectLabel) {
                const clone = protectLabel.cloneNode(true) as HTMLElement;
                clone.classList.add('kasp-cloned-resist', 'kasp-protecting');
                if (protectIsSpectrum) clone.classList.add('kasp-spectrum');
                slot1.appendChild(clone);
            }
            else {
                slot1.innerHTML = '<span class="kasp-dash">—</span>';
            }
            const slot2 = document.createElement('div');
            slot2.className = 'kasp-slot';
            if (armadilloLabel) {
                const clone = armadilloLabel.cloneNode(true) as HTMLElement;
                clone.classList.add('kasp-cloned-resist', 'kasp-armadillo');
                slot2.appendChild(clone);
            }
            else {
                slot2.innerHTML = '<span class="kasp-dash">—</span>';
            }
            compact.replaceChildren(slot1, slot2);
            compact.dataset.kaspState = stateKey;
            if (!compact.parentElement) htmlCell.prepend(compact);
        }
    }

    function injectZeroSummary(readStyle: ReadStyle): void {
        const tabContainer = document.querySelector(TAB_SELECTOR);
        if (!tabContainer) return;

        let summaryRow = Array.from(tabContainer.children).find(el =>
            el.className.includes(gameDOM.classes.flexCenter) && !el.className.toLowerCase().includes(gameDOM.fragments.header)
        ) as HTMLElement;

        if (!summaryRow) {
            summaryRow = document.createElement('div');
            summaryRow.className = gameDOM.classes.flexCenter + ' kasp-custom-summary-row';
            const optionsContainer = tabContainer.querySelector(gameDOM.statistics.options);
            if (optionsContainer) optionsContainer.before(summaryRow);
            else tabContainer.appendChild(summaryRow);
        }

        const presentResistances = new Set<string>();
        const children = Array.from(summaryRow.children);
        children.forEach(child => {
            if (child.classList.contains('kasp-zero-summary')) return;
            const icon = child.querySelector('div') || child;
            const maskImg = getCssUrl(icon, readStyle);
            if (!maskImg) return;
            const match = maskImg.match(/\/([a-zA-Z_]+)_resistance(?:\.[0-9a-f]+)?\.(?:svg|webp|png)/);
            if (match && match[1]) presentResistances.add(match[1]);
        });

        const zeroBlocks = summaryRow.querySelectorAll('.kasp-zero-summary');
        const existingZeros = new Set<string>();
        zeroBlocks.forEach(block => {
            const turret = block.getAttribute('data-turret');
            if (turret && presentResistances.has(turret)) block.remove();
            else if (turret) existingZeros.add(turret);
        });

        const fragment = document.createDocumentFragment();
        Object.keys(RESISTANCE_MAP).forEach((turret: string) => {
            if (!presentResistances.has(turret) && !existingZeros.has(turret)) {
                const zeroLabel = document.createElement('div');
                zeroLabel.className = `kasp-zero-summary ${gameDOM.classes.flexStart}`;
                zeroLabel.setAttribute('data-turret', turret);
                zeroLabel.style.cssText = 'display: flex !important; align-items: center !important; justify-content: flex-start !important; margin-right: 0.75em !important; cursor: default !important; opacity: 1 !important; pointer-events: none !important;';

                const iconDiv = document.createElement('div');
                iconDiv.className = gameDOM.classes.mask;
                iconDiv.style.cssText = `background-color: #5cfc47 !important; height: 1em !important; width: 1em !important; margin-right: 0.1875em !important; -webkit-mask-image: url('${RESISTANCE_MAP[turret]}') !important; mask-image: url('${RESISTANCE_MAP[turret]}') !important; -webkit-mask-size: contain !important; mask-size: contain !important; -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important; -webkit-mask-position: center center !important; mask-position: center center !important;`;

                const textSpan = document.createElement('span');
                textSpan.className = gameDOM.classes.regular;
                textSpan.innerHTML = '&#215;0';
                textSpan.style.cssText = 'font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important;';

                zeroLabel.appendChild(iconDiv);
                zeroLabel.appendChild(textSpan);
                fragment.appendChild(zeroLabel);
            }
        });
        if (fragment.childNodes.length) summaryRow.appendChild(fragment);
    }

    function injectToggleButton() {
        if (isTabExpanded && !initialExpandedSet && document.body) {
            document.body.classList.add('kasp-tab-expanded');
            initialExpandedSet = true;
        }

        const tabContainer = document.querySelector(TAB_SELECTOR);
        if (!tabContainer) return;

        const summaryRow = Array.from(tabContainer.children).find(el => el.className.includes(gameDOM.classes.flexCenter) && !el.className.toLowerCase().includes(gameDOM.fragments.header));

        if (!summaryRow || document.getElementById('kasp-tab-toggle-btn')) return;

        if (window.getComputedStyle(summaryRow).position === 'static') {
            (summaryRow as HTMLElement).style.position = 'relative';
        }

        const btn = document.createElement('div');
        btn.id = 'kasp-tab-toggle-btn';
        btn.className = isTabExpanded ? 'kasp-active-toggle' : '';
        btn.title = state.lang === 'RU' ? 'Всегда показывать все модули' : 'Always show all modules';
        btn.innerHTML = `<div class="kasp-toggle-icon" style="-webkit-mask-image: url('${SHIELD_ICON_URL}'); mask-image: url('${SHIELD_ICON_URL}');"></div>`;
        lifecycle.listen(btn, 'click', (e) => {
            e.stopPropagation();
            const nextExpanded = !isTabExpanded;
            expansion.setExpanded(nextExpanded);
            isTabExpanded = nextExpanded;
            localStorage.setItem('kasp_tab_expanded', String(isTabExpanded));

            if (isTabExpanded) {
                document.body.classList.add('kasp-tab-expanded');
                btn.classList.add('kasp-active-toggle');
            } else {
                document.body.classList.remove('kasp-tab-expanded');
                btn.classList.remove('kasp-active-toggle');
            }
        });

        summaryRow.appendChild(btn);
    }

    function sync(): void {
        if (!document.querySelector(TAB_SELECTOR)) return;
        const styles = new WeakMap<Element, CSSStyleDeclaration>();
        const readStyle: ReadStyle = element => {
            let style = styles.get(element);
            if (!style) {
                style = window.getComputedStyle(element);
                styles.set(element, style);
            }
            return style;
        };
        injectHeaderShield();
        injectCompactCells(readStyle);
        injectZeroSummary(readStyle);
        injectToggleButton();
    }

    function update(): void { sync(); }
    lifecycle.onCleanup(() => { document.body.classList.remove('kasp-tab-expanded');document.querySelectorAll('.kasp-defence-th, .kasp-compact-cell, .kasp-zero-summary, #kasp-tab-toggle-btn, .kasp-custom-summary-row').forEach(node=>node.remove()); });

    return { sync, update };
}, { sync() {}, update() {} });
