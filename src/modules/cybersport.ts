import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { createCybersportSettings } from './cybersportSettings';

export const cybersport = (() => {
    let row: HTMLElement | null = null;
    let sport: HTMLElement | null = null;
    let card: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let chosen = false;
    let selectionUntil = 0;
    let forwarding = false;
    let scheduled = false;
    let modeUntil = 0;
    let modeTimer: ReturnType<typeof setTimeout> | null = null;
    let esportsRoot: HTMLElement | null = null;
    let mapRow: HTMLElement | null = null;
    let mapObserver: MutationObserver | null = null;
    let rejectedSelection: HTMLElement | null = null;
    const mapCards = new Set<HTMLElement>();
    const mapColumns = new Set<HTMLElement>();
    const allowedMaps = new Set([
        '/601/107774/12/176/30061777033536/image.webp',
        '/601/107774/12/213/30061777063716/image.webp',
        '/601/107774/12/330/30061777035270/image.webp',
        '/601/107774/12/277/31343433343114/image.webp',
        '/601/107774/13/14/30061777055502/image.webp',
        '/634/136431/332/233/31627506673770/image.webp',
        '/601/107774/13/55/30061777053474/image.webp',
    ]);

    const labels = {
        RU: { name: 'Киберспорт', select: 'Выбрать', selected: 'Выбрано' },
        EN: { name: 'Esports', select: 'Choose', selected: 'Chosen' },
    };
    const text = (element: Element | null, value: string) => {
        if (element && element.textContent !== value) element.textContent = value;
    };
    const findSport = (container: HTMLElement): HTMLElement | null => {
        const nativeCards = Array.from(container.children).filter((element): element is HTMLElement =>
            element instanceof HTMLElement && element.matches(gameDOM.battleCreate.formatCard) &&
            !element.classList.contains('kasp-cybersport-card'));
        return nativeCards.find(element => /^(?:спорт|sport)$/i.test(
            element.querySelector(gameDOM.battleCreate.formatName)?.textContent?.trim() || '')) ||
            nativeCards.find(element => {
                const image = element.querySelector(gameDOM.battleCreate.formatImage);
                return image && getComputedStyle(image).backgroundImage.includes('battle_pick_sport_mode');
            }) || null;
    };
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => { scheduled = false; sync(); });
    };
    const settings = createCybersportSettings(schedule);
    const cancelModeSelection = () => {
        modeUntil = 0;
        if (modeTimer !== null) clearTimeout(modeTimer);
        modeTimer = null;
    };
    const selectMode = (container: HTMLElement | null) => {
        if (!modeUntil) return;
        if (Date.now() >= modeUntil) { cancelModeSelection(); return; }
        const ctf = Array.from(container?.querySelectorAll<HTMLElement>(gameDOM.battleCreate.modeCard) || [])
            .find(element => Array.from(element.querySelectorAll('h2'))
                .some(label => label.textContent?.trim() === 'CTF'));
        if (ctf) {
            cancelModeSelection();
            ctf.click();
        } else if (modeTimer === null) {
            modeTimer = setTimeout(() => { modeTimer = null; sync(); }, 100);
        }
    };
    const clearMaps = () => {
        mapObserver?.disconnect(); mapObserver = null;
        mapRow?.removeAttribute('data-kasp-esports-maps');
        mapCards.forEach(element => element.removeAttribute('data-kasp-esports-map'));
        mapColumns.forEach(element => element.removeAttribute('data-kasp-esports-column'));
        mapCards.clear(); mapColumns.clear();
        mapRow = rejectedSelection = null;
    };
    const allowsMap = (element: HTMLElement): boolean => {
        const background = getComputedStyle(element).backgroundImage;
        for (const match of background.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
            try {
                const path = new URL(match[1].trim(), location.href).pathname;
                if (!allowedMaps.has(path)) continue;
                if (path === '/601/107774/12/330/30061777035270/image.webp') {
                    const name = element.querySelector(gameDOM.battleCreate.mapName)?.textContent
                        ?.replace(/\s+/g, ' ').trim() || '';
                    return /^(?:red alert|ред алерт) (?:mm|мм)$/i.test(name);
                }
                return true;
            } catch {}
        }
        return false;
    };
    const syncMaps = (container: HTMLElement | null) => {
        if (!esportsRoot || container?.closest(gameDOM.battleCreate.root) !== esportsRoot) {
            clearMaps(); return;
        }
        const cards = Array.from(container.querySelectorAll(gameDOM.battleCreate.mapName))
            .map(label => label.parentElement)
            .filter((element): element is HTMLElement => element instanceof HTMLElement &&
                element.matches(gameDOM.battleCreate.formatImage) && element.parentElement?.parentElement === container);
        if (!cards.length) { clearMaps(); return; }
        if (mapRow !== container) {
            clearMaps(); mapRow = container;
            mapObserver = new MutationObserver(schedule);
            mapObserver.observe(container, { childList: true, subtree: true, characterData: true,
                attributes: true, attributeFilter: ['class', 'style'] });
        }
        if (!container.hasAttribute('data-kasp-esports-maps')) container.setAttribute('data-kasp-esports-maps', '');
        const allowed: HTMLElement[] = [];
        let excludedSelected: HTMLElement | null = null;
        const currentCards = new Set(cards);
        const currentColumns = new Set(cards.map(element => element.parentElement!));
        for (const element of mapCards) if (!currentCards.has(element)) {
            element.removeAttribute('data-kasp-esports-map'); mapCards.delete(element);
        }
        for (const element of mapColumns) if (!currentColumns.has(element)) {
            element.removeAttribute('data-kasp-esports-column'); mapColumns.delete(element);
        }
        for (const element of cards) {
            const show = allowsMap(element);
            const value = show ? 'allowed' : 'excluded';
            if (element.getAttribute('data-kasp-esports-map') !== value) {
                element.setAttribute('data-kasp-esports-map', value);
            }
            mapCards.add(element);
            const column = element.parentElement!;
            if (!column.hasAttribute('data-kasp-esports-column')) column.setAttribute('data-kasp-esports-column', '');
            mapColumns.add(column);
            if (show) allowed.push(element);
            else if (element.querySelector(gameDOM.battleCreate.selectedMap)) excludedSelected = element;
        }
        if (!excludedSelected) rejectedSelection = null;
        else if (allowed.length && excludedSelected !== rejectedSelection) {
            rejectedSelection = excludedSelected;
            allowed[0].click();
            if (mapRow?.isConnected) mapRow.scrollLeft = 0;
        }
    };
    const cancelEsports = () => {
        settings.clear();
        esportsRoot = null;
        chosen = false;
        selectionUntil = 0;
        cancelModeSelection();
        clearMaps();
    };
    const onNativeClick = (event: MouseEvent) => {
        if (forwarding || !(event.target instanceof Element)) return;
        const selected = event.target.closest(gameDOM.battleCreate.formatCard);
        if (selected && selected !== card && selected.parentElement === row) {
            cancelEsports();
            schedule();
        }
    };
    const cleanup = () => {
        observer?.disconnect(); observer = null;
        row?.removeEventListener('click', onNativeClick, true);
        sport?.removeAttribute('data-kasp-cybersport-source-active');
        sport?.lastElementChild?.querySelector('h2')?.removeAttribute('data-kasp-select-label');
        card?.remove();
        row = sport = card = null;
        chosen = false;
        selectionUntil = 0;
    };
    const select = () => {
        if (!sport?.isConnected || !row?.contains(sport)) return;
        esportsRoot = sport.closest<HTMLElement>(gameDOM.battleCreate.root);
        chosen = true;
        selectionUntil = Date.now() + 1000;
        cancelModeSelection();
        modeUntil = Date.now() + 5000;
        forwarding = true;
        try { sport.click(); }
        catch (error) { cancelEsports(); throw error; }
        finally { forwarding = false; schedule(); }
    };
    function sync(): void {
        if (esportsRoot && !esportsRoot.isConnected) cancelEsports();
        let container = document.querySelector<HTMLElement>(gameDOM.battleCreate.formats);
        if (esportsRoot && container && container.closest(gameDOM.battleCreate.root) !== esportsRoot) cancelEsports();
        selectMode(container);
        container = document.querySelector<HTMLElement>(gameDOM.battleCreate.formats);
        syncMaps(container);
        settings.sync(esportsRoot);
        const nativeSport = container && findSport(container);
        if (!container || !nativeSport) { cleanup(); return; }
        if (row !== container || sport !== nativeSport || !card?.isConnected) {
            cleanup(); row = container; sport = nativeSport;
            chosen = esportsRoot !== null;
            card = nativeSport.cloneNode(true) as HTMLElement;
            card.classList.add('kasp-cybersport-card');
            card.removeAttribute('id');
            card.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
            card.setAttribute('role', 'button');
            card.tabIndex = 0;
            card.style.setProperty('--kasp-cybersport-image', `url("${chrome.runtime.getURL('assets/cybersport.png')}")`);
            card.addEventListener('click', event => {
                event.preventDefault(); event.stopPropagation(); select();
            });
            card.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault(); event.stopPropagation();
                if (!event.repeat) select();
            });
            row.insertBefore(card, nativeSport.nextSibling);
            row.addEventListener('click', onNativeClick, true);
            observer = new MutationObserver(schedule);
            observer.observe(row, { childList: true, subtree: true, characterData: true,
                attributes: true, attributeFilter: ['class'] });
        }
        const nativeSelected = sport.classList.contains('FormatsSectionComponentStyle-selectedCard');
        if (nativeSelected) selectionUntil = 0;
        else if (Date.now() >= selectionUntil) cancelEsports();
        const active = chosen && nativeSelected;
        const label = labels[state.lang];
        text(card.querySelector(gameDOM.battleCreate.formatName), label.name);
        text(card.querySelector(gameDOM.battleCreate.formatDescription),
            sport.querySelector(gameDOM.battleCreate.formatDescription)?.textContent || '');
        text(card.querySelector(gameDOM.battleCreate.formatCount),
            sport.querySelector(gameDOM.battleCreate.formatCount)?.textContent || '');
        text(card.lastElementChild?.querySelector('h2') || null, active ? label.selected : label.select);
        card.classList.toggle('FormatsSectionComponentStyle-selectedCard', active);
        card.classList.toggle('FormatsSectionComponentStyle-unSelectedCard', !active);
        const pressed = String(active);
        if (card.getAttribute('aria-pressed') !== pressed) card.setAttribute('aria-pressed', pressed);
        sport.toggleAttribute('data-kasp-cybersport-source-active', active);
        const nativeAction = sport.lastElementChild?.querySelector('h2');
        if (active && nativeAction?.getAttribute('data-kasp-select-label') !== label.select) {
            nativeAction?.setAttribute('data-kasp-select-label', label.select);
        } else if (!active) nativeAction?.removeAttribute('data-kasp-select-label');
        if (sport.nextSibling !== card) row.insertBefore(card, sport.nextSibling);
        if (chosen && !nativeSelected && Date.now() < selectionUntil) schedule();
    }
    return sync;
})();
