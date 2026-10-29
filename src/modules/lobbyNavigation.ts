import { featureScope } from '../core/featureRuntime';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';

const lifecycle = featureScope('lobbyNavigation');

// Decorate existing targets; the game and customPlayButton retain their handlers.
export const lobbyNavigation = lifecycle.initialize(() => {
    const cards = new Map<HTMLElement, { layer: HTMLSpanElement; hadClass: boolean }>();
    let root: HTMLElement | null = null, group: HTMLElement | null = null;
    let hadRootClass = false, hadGroupClass = false;
    let initialized = false, queued = false;
    let observer: MutationObserver | null = null, resize: ResizeObserver | null = null;
    let observed: HTMLElement[] = [];
    const art = `url(${JSON.stringify(chrome.runtime.getURL('assets/art3.jpg'))})`;
    const links = [
        { id: 'esports', ru: 'Киберспорт', en: 'Esports', ruURL: 'https://tankisport.com/', enURL: 'https://tankisport.com/' },
        { id: 'forum', ru: 'Форум', en: 'Forum', ruURL: 'https://ru.tankiforum.com/', enURL: 'https://en.tankiforum.com/' },
        { id: 'ratings', ru: 'Рейтинги', en: 'Ratings', ruURL: 'https://ratings.tankionline.com/ru/', enURL: 'https://ratings.tankionline.com/en' },
        { id: 'wiki', ru: 'Энциклопедия', en: 'Wiki', ruURL: 'https://ru.tankiwiki.com', enURL: 'https://en.tankiwiki.com' },
    ];
    function syncLinks(): void {
        const footer = root?.querySelector(gameDOM.navigation.footer);
        if (!footer) return;
        let list = footer.querySelector<HTMLUListElement>('.kasp-lobby-links');
        if (!list) {
            list = document.createElement('ul');
            list.className = 'kasp-lobby-links';
            for (const link of links) {
                const item = document.createElement('li');
                item.className = gameDOM.classes.footerEntry + ' kasp-lobby-link';
                const anchor = document.createElement('a');
                anchor.dataset.kaspLobbyLink = link.id;
                anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
                const icon = document.createElement('span');
                icon.className = 'kasp-lobby-link-icon'; icon.setAttribute('aria-hidden', 'true');
                anchor.appendChild(icon); item.appendChild(anchor); list.appendChild(item);
            }
            footer.appendChild(list);
        }
        for (const link of links) {
            const anchor = list.querySelector<HTMLAnchorElement>(`[data-kasp-lobby-link="${link.id}"]`);
            if (!anchor) continue;
            const label = state.lang === 'RU' ? link.ru : link.en;
            const url = state.lang === 'RU' ? link.ruURL : link.enURL;
            if (anchor.getAttribute('href') !== url) anchor.setAttribute('href', url);
            if (anchor.title !== label) { anchor.title = label; anchor.setAttribute('aria-label', label); }
        }
    }
    function releaseCard(card: HTMLElement): void {
        const record = cards.get(card);
        if (!record) return;
        record.layer.remove();
        if (!record.hadClass) card.classList.remove('kasp-left-card');
        cards.delete(card);
    }
    function release(): void {
        observer?.disconnect(); resize?.disconnect(); observed = [];
        for (const card of cards.keys()) releaseCard(card);
        root?.querySelectorAll('.kasp-lobby-links').forEach(list => list.remove());
        if (!hadRootClass) root?.classList.remove('kasp-lobby-left');
        if (!hadGroupClass) group?.classList.remove('kasp-left-play-group');
        root = group = null;
    }
    function schedule(): void {
        if (queued) return;
        queued = true;
        lifecycle.microtask(() => { queued = false; sync(); });
    }
    function ownMutation(change: MutationRecord): boolean {
        if (change.target instanceof Element && change.target.classList.contains('kasp-left-art-slice')) return true;
        if (change.type !== 'childList') return false;
        const nodes = [...Array.from(change.addedNodes), ...Array.from(change.removedNodes)];
        return nodes.length > 0 && nodes.every(node => node instanceof Element && node.classList.contains('kasp-left-art-slice'));
    }
    function setStyle(element: HTMLElement, name: string, value: string): void {
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }
    function sync(): void {
        if (!initialized) {
            initialized = true;
            lifecycle.listen(window, 'resize', schedule);
            observer = lifecycle.observer(changes => { if (changes.some(change => !ownMutation(change))) schedule(); });
            if (typeof ResizeObserver !== 'undefined') resize = new ResizeObserver(lifecycle.guard(schedule));
        }
        const nextRoot = document.querySelector<HTMLElement>(gameDOM.lobbyNavigation.root);
        const play = nextRoot?.querySelector<HTMLElement>(gameDOM.play.container);
        const nextGroup = play?.closest<HTMLElement>(gameDOM.common.flexDiv) ?? play?.parentElement ?? null;
        if (nextRoot !== root || nextGroup !== group) {
            release(); root = nextRoot; group = nextGroup;
            hadRootClass = !!root?.classList.contains('kasp-lobby-left');
            hadGroupClass = !!group?.classList.contains('kasp-left-play-group');
        }
        if (!root) return;
        if (!root.classList.contains('kasp-lobby-left')) root.classList.add('kasp-lobby-left');
        if (group && !group.classList.contains('kasp-left-play-group')) group.classList.add('kasp-left-play-group');
        syncLinks();
        const current = Array.from(root.querySelectorAll<HTMLElement>(gameDOM.lobbyNavigation.cards));
        for (const card of cards.keys()) if (!current.includes(card)) releaseCard(card);
        for (const card of current) {
            const existing = cards.get(card);
            if (!existing) {
                const layer = document.createElement('span');
                layer.className = 'kasp-left-art-slice'; layer.setAttribute('aria-hidden', 'true');
                cards.set(card, { layer, hadClass: card.classList.contains('kasp-left-card') });
                card.appendChild(layer);
            } else if (existing.layer.parentElement !== card) card.appendChild(existing.layer);
            if (!card.classList.contains('kasp-left-card')) card.classList.add('kasp-left-card');
        }
        const next = [root, ...(group ? [group] : []), ...current];
        if (observed.length !== next.length || observed.some((node, i) => node !== next[i])) {
            observer?.disconnect(); resize?.disconnect(); observed = next;
            observer?.observe(root, { childList: true, subtree: true, characterData: true,
                attributes: true, attributeFilter: ['class', 'style'] });
            for (const node of next) resize?.observe(node);
        }
        const measured = current.map(card => ({ card, rect: card.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && rect.height > 0);
        if (!measured.length) return;
        const left = Math.min(...measured.map(({ rect }) => rect.left));
        const top = Math.min(...measured.map(({ rect }) => rect.top));
        const right = Math.max(...measured.map(({ rect }) => rect.right));
        const bottom = Math.max(...measured.map(({ rect }) => rect.bottom));
        for (const { card, rect } of measured) {
            const layer = cards.get(card)!.layer;
            const scaleX = card.offsetWidth ? rect.width / card.offsetWidth || 1 : 1;
            const scaleY = card.offsetHeight ? rect.height / card.offsetHeight || 1 : 1;
            setStyle(layer, '--kasp-left-art', art);
            setStyle(layer, '--kasp-left-art-width', `${(right - left) / scaleX}px`);
            setStyle(layer, '--kasp-left-art-height', `${(bottom - top) / scaleY}px`);
            setStyle(layer, '--kasp-left-art-x', `${-(rect.left - left) / scaleX - card.clientLeft}px`);
            setStyle(layer, '--kasp-left-art-y', `${-(rect.top - top) / scaleY - card.clientTop}px`);
        }
    }
    lifecycle.onCleanup(release);
    return sync;
}, () => {});
