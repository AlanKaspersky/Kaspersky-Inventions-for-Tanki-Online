import { state } from '../core/state';

export const zeroResists = (() => {

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

    const TAB_SELECTOR = '.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults';

    const iconStyleCache = new WeakMap<Element, { mask: string; bg: string }>();

    let isTabExpanded = localStorage.getItem('kasp_tab_expanded') === 'true';
    let initialExpandedSet = false;

    function getIconStyle(iconDiv: Element): { mask: string; bg: string } {
        const cached = iconStyleCache.get(iconDiv);
        if (cached !== undefined) return cached;
        const cs = window.getComputedStyle(iconDiv);
        const result = {
            mask: (cs.getPropertyValue('-webkit-mask-image') ||
                cs.getPropertyValue('mask-image') ||
                '').toLowerCase(),
            bg: cs.backgroundColor || '',
        };
        iconStyleCache.set(iconDiv, result);
        return result;
    }

    function getCssUrl(el: Element | null): string | null {
        if (!el) return null;
        const cs = window.getComputedStyle(el) as any;
        for (const prop of ['maskImage', 'webkitMaskImage', 'backgroundImage']) {
            const val = cs[prop];
            if (val && val !== 'none' && val !== 'initial' && val !== '') return val;
        }
        return null;
    }

    function injectHeaderShield(): void {
        const theadRows = document.querySelectorAll(':is(.BattleTabStatisticComponentStyle-containerInsideTeams, .BattleTabStatisticComponentStyle-containerInsideResults) table thead tr');
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

    function getIconUrl(lbl: Element): string {
        const iconDiv = lbl.querySelector('div');
        if (iconDiv) {
            const style = getIconStyle(iconDiv);
            const m = style.mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1].toLowerCase();
        }
        const img = lbl.querySelector('img');
        if (img) return ((img as HTMLImageElement).src || '').toLowerCase();
        return '';
    }

    function injectCompactCells(): void {
        const cells = document.querySelectorAll('.BattleTabStatisticComponentStyle-resistanceModuleCell');
        cells.forEach(cell => {
            const htmlCell = cell as HTMLElement;
            const labels = Array.from(htmlCell.children).filter(el =>
                el.classList.contains('BattleTabStatisticComponentStyle-defenceLabel') &&
                !el.closest('.kasp-compact-cell')
            ) as HTMLElement[];

            let protectLabel: HTMLElement | null = null;
            let protectIsSpectrum = false;
            let armadilloLabel: HTMLElement | null = null;

            for (const lbl of labels) {
                const url = getIconUrl(lbl);
                if (url.includes('all_resistance')) {
                    protectLabel = lbl;
                    protectIsSpectrum = true;
                    break;
                }
            }

            if (!protectIsSpectrum) {
                for (const lbl of labels) {
                    const iconDiv = lbl.querySelector('div');
                    if (!iconDiv) continue;
                    const style = getIconStyle(iconDiv);
                    const isRed = style.bg.includes('254') || style.bg.includes('255, 80') ||
                        style.bg.includes('255, 102') || style.bg.includes('254, 102');
                    if (isRed) { protectLabel = lbl; break; }
                }
            }

            for (const lbl of labels) {
                if (lbl === protectLabel) continue;
                const url = getIconUrl(lbl);
                if (url.includes('crit_resistance')) { armadilloLabel = lbl; break; }
            }

            const protectVal = protectLabel ? (protectLabel.querySelector('h3')?.textContent || 'on') : 'none';
            const armadilloVal = armadilloLabel ? (armadilloLabel.querySelector('h3')?.textContent || 'on') : 'none';
            const stateKey = `${protectIsSpectrum ? 'spec' : protectVal}_${armadilloVal}`;

            let compact = htmlCell.querySelector<HTMLElement>('.kasp-compact-cell');
            if (compact && compact.dataset.kaspState === stateKey) return;

            if (!compact) {
                compact = document.createElement('div');
                compact.className = 'kasp-compact-cell';
                htmlCell.prepend(compact);
            }
            compact.dataset.kaspState = stateKey;
            compact.innerHTML = '';

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
            compact.appendChild(slot1);

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
            compact.appendChild(slot2);
        });
    }

    function injectZeroSummary(): void {
        const tabContainer = document.querySelector(TAB_SELECTOR);
        if (!tabContainer) return;

        let summaryRow = Array.from(tabContainer.children).find(el =>
            el.className.includes('-flexCenterAlignCenter') && !el.className.toLowerCase().includes('header')
        ) as HTMLElement;

        if (!summaryRow) {
            summaryRow = document.createElement('div');
            summaryRow.className = '-flexCenterAlignCenter kasp-custom-summary-row';
            const optionsContainer = tabContainer.querySelector('.BattleTabStatisticComponentStyle-commonContainerIconOptions');
            if (optionsContainer) optionsContainer.before(summaryRow);
            else tabContainer.appendChild(summaryRow);
        }

        const presentResistances = new Set<string>();
        const children = Array.from(summaryRow.children);
        children.forEach(child => {
            if (child.classList.contains('kasp-zero-summary')) return;
            const icon = child.querySelector('div') || child;
            const maskImg = getCssUrl(icon);
            if (!maskImg) return;
            const match = maskImg.match(/\/([a-zA-Z_]+)_resistance(?:\.[0-9a-f]+)?\.(?:svg|webp|png)/);
            if (match && match[1]) presentResistances.add(match[1]);
        });

        const zeroBlocks = summaryRow.querySelectorAll('.kasp-zero-summary');
        zeroBlocks.forEach(block => {
            const turret = block.getAttribute('data-turret');
            if (turret && presentResistances.has(turret)) block.remove();
        });

        Object.keys(RESISTANCE_MAP).forEach((turret: string) => {
            if (!presentResistances.has(turret) && !summaryRow.querySelector(`.kasp-zero-summary[data-turret="${turret}"]`)) {
                const zeroLabel = document.createElement('div');
                zeroLabel.className = 'kasp-zero-summary -flexStart';
                zeroLabel.setAttribute('data-turret', turret);
                zeroLabel.style.cssText = 'display: flex !important; align-items: center !important; justify-content: flex-start !important; margin-right: 0.75em !important; cursor: default !important; opacity: 1 !important; pointer-events: none !important;';

                const iconDiv = document.createElement('div');
                iconDiv.className = '-maskImageContain -maskImage';
                iconDiv.style.cssText = `background-color: #5cfc47 !important; height: 1em !important; width: 1em !important; margin-right: 0.1875em !important; -webkit-mask-image: url('${RESISTANCE_MAP[turret]}') !important; mask-image: url('${RESISTANCE_MAP[turret]}') !important; -webkit-mask-size: contain !important; mask-size: contain !important; -webkit-mask-repeat: no-repeat !important; mask-repeat: no-repeat !important; -webkit-mask-position: center center !important; mask-position: center center !important;`;

                const textSpan = document.createElement('span');
                textSpan.className = '-regular';
                textSpan.innerHTML = '&#215;0';
                textSpan.style.cssText = 'font-size: 0.875em !important; color: #5cfc47 !important; font-family: BaseFontRegular, FallbackFontRegular, sans-serif !important; font-style: normal !important; font-weight: normal !important;';

                zeroLabel.appendChild(iconDiv);
                zeroLabel.appendChild(textSpan);
                summaryRow.appendChild(zeroLabel);
            }
        });
    }

    function injectToggleButton() {
        if (isTabExpanded && !initialExpandedSet && document.body) {
            document.body.classList.add('kasp-tab-expanded');
            initialExpandedSet = true;
        }

        const tabContainer = document.querySelector(TAB_SELECTOR);
        if (!tabContainer) return;

        const summaryRow = Array.from(tabContainer.children).find(el => el.className.includes('-flexCenterAlignCenter') && !el.className.toLowerCase().includes('header'));

        if (!summaryRow || document.getElementById('kasp-tab-toggle-btn')) return;

        if (window.getComputedStyle(summaryRow).position === 'static') {
            (summaryRow as HTMLElement).style.position = 'relative';
        }

        const btn = document.createElement('div');
        btn.id = 'kasp-tab-toggle-btn';
        btn.className = isTabExpanded ? 'kasp-active-toggle' : '';
        btn.title = state.lang === 'RU' ? 'Всегда показывать все модули' : 'Always show all modules';
        btn.innerHTML = `<div class="kasp-toggle-icon" style="-webkit-mask-image: url('${SHIELD_ICON_URL}'); mask-image: url('${SHIELD_ICON_URL}');"></div>`;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            isTabExpanded = !isTabExpanded;
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
        injectHeaderShield();
        injectCompactCells();
        injectZeroSummary();
        injectToggleButton();
    }

    function update(): void { sync(); }
    return { sync, update };
})();