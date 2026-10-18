import { featureScope } from '../core/featureRuntime';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';

const lifecycle = featureScope('lobbyPasses');
const selectors = gameDOM.lobbyPasses;
export function readStarProgress(value: string): number | null {
    const match = /^(\d+)\/(\d+)$/.exec(value.replace(/\s/g, ''));
    if (!match || +match[2] <= 0) return null;
    const percent = +match[1] / +match[2] * 100;
    return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null;
}

export function readCircleProgress(circle: Element | null): number | null {
    const halves = circle?.children?.[1]?.children;
    if (!halves || halves.length < 1 || halves.length > 2) return null;
    function angle(element: Element): number | null {
        const value = (element as HTMLElement).style.transform || getComputedStyle(element).transform;
        const direct = /^rotate(?:Z)?\(\s*([-+\d.e]+)(deg|rad|turn)\s*\)$/i.exec(value);
        let degrees: number;
        if (direct) degrees = +direct[1] * (direct[2] === 'rad' ? 180 / Math.PI : direct[2] === 'turn' ? 360 : 1);
        else {
            if (!value || value === 'none') return null;
            try { const matrix = new DOMMatrixReadOnly(value); degrees = Math.atan2(matrix.b, matrix.a) * 180 / Math.PI; }
            catch { return null; }
        }
        return Number.isFinite(degrees) ? (degrees % 360 + 360) % 360 : null;
    }
    const first = angle(halves[0]);
    if (first === null || first > 180.01) return null;
    let degrees = first;
    if (halves.length === 2) {
        const second = angle(halves[1]);
        if (first < 179.99 || second === null || second > 0.01 && second < 180) return null;
        degrees = second < 0.01 ? 360 : second;
    }
    return Math.round(degrees / 3.6 * 100) / 100;
}

export const lobbyPasses = lifecycle.initialize(() => {
    const records = new Map<HTMLElement, 'challenge' | 'elite'>();
    let sources: HTMLElement[] = [], observer: MutationObserver | null = null;
    let resize: ResizeObserver | null = null, initialized = false, queued = false;
    let trophiesParent: HTMLElement | null = null;
    const TROPHY_TOP = '--kasp-lobby-trophies-top';
    const TROPHY_LEFT = '--kasp-lobby-trophies-left', TROPHY_WIDTH = '--kasp-lobby-trophies-width';
    const previousTrophyStyles = new Map<string, { value: string; priority: string }>();
    const artLayers = new Map<HTMLElement, HTMLSpanElement>();
    let announcementBody: HTMLElement | null = null;
    const ANNOUNCEMENT_HEIGHT = '--kasp-announcement-height';
    const artImage = `url(${JSON.stringify(chrome.runtime.getURL('assets/art1.png'))})`;
    const properties = ['--kasp-pass-left', '--kasp-pass-top', '--kasp-pass-width', '--kasp-star-progress',
        '--kasp-star-meter-display', '--kasp-elite-progress', '--kasp-elite-meter-opacity'];
    function restoreTrophies(): void {
        if (!trophiesParent) return;
        for (const [key, previous] of previousTrophyStyles) {
            if (previous.value) trophiesParent.style.setProperty(key, previous.value, previous.priority);
            else trophiesParent.style.removeProperty(key);
        }
        previousTrophyStyles.clear();
        trophiesParent = null;
    }
    function release(root: HTMLElement): void {
        root.classList.remove('kasp-lobby-pass-card', `kasp-pass-${records.get(root)}`);
        root.removeAttribute('data-kasp-pass-lang');
        for (const key of properties) root.style.removeProperty(key);
        records.delete(root);
    }
    function decorate(root: HTMLElement, kind: 'challenge' | 'elite'): void {
        if (records.has(root) && records.get(root) !== kind) release(root);
        records.set(root, kind);
        if (!root.classList.contains('kasp-lobby-pass-card') || !root.classList.contains(`kasp-pass-${kind}`))
            root.classList.add('kasp-lobby-pass-card', `kasp-pass-${kind}`);
        if (root.getAttribute('data-kasp-pass-lang') !== state.lang) root.setAttribute('data-kasp-pass-lang', state.lang);
    }
    function setStyle(element: HTMLElement, key: string, value: string): void {
        if (element.style.getPropertyValue(key) !== value) element.style.setProperty(key, value);
    }
    function sizeAnnouncement(root: HTMLElement | null): void {
        const body = root?.querySelector<HTMLElement>(selectors.announcementBody) ?? null;
        if (announcementBody !== body) {
            announcementBody?.style.removeProperty(ANNOUNCEMENT_HEIGHT);
            announcementBody = body;
        }
        const caption = body?.querySelector<HTMLElement>(selectors.announcementCaption);
        if (!body || !caption || !body.offsetWidth) return;
        const timer = body.querySelector<HTMLElement>(selectors.announcementTimer);
        const css = getComputedStyle(body);
        const px = (value: string) => parseFloat(value) || 0;
        const content = Math.max(caption.scrollHeight, timer?.scrollHeight ?? 0);
        const height = Math.max(px(css.minHeight), content + px(css.paddingTop) + px(css.paddingBottom)
            + px(css.borderTopWidth) + px(css.borderBottomWidth));
        setStyle(body, ANNOUNCEMENT_HEIGHT, `${Math.ceil(height)}px`);
    }
    function clearPanorama(): void {
        for (const [card, layer] of artLayers) {
            layer.remove(); card.classList.remove('kasp-lobby-has-art');
        }
        artLayers.clear();
    }
    function paintPanorama(challenge: HTMLElement, elite: HTMLElement | null, trophies: HTMLElement | null, announcement: HTMLElement | null): void {
        const cards = [challenge, ...(elite ? [elite] : []),
            ...(announcement ? [announcement] : []),
            ...Array.from(trophies?.querySelectorAll<HTMLElement>('.custom-trophy-item') || [])];
        const measured = cards.map(card => ({ card, rect: card.getBoundingClientRect() }))
            .filter(item => item.rect.width > 0 && item.rect.height > 0);
        if (!measured.length) { clearPanorama(); return; }
        const current = new Set(measured.map(item => item.card));
        for (const [card, layer] of artLayers) if (!current.has(card)) {
            layer.remove(); card.classList.remove('kasp-lobby-has-art'); artLayers.delete(card);
        }
        const left = Math.min(...measured.map(item => item.rect.left));
        const top = Math.min(...measured.map(item => item.rect.top));
        const right = Math.max(...measured.map(item => item.rect.right));
        const bottom = Math.max(...measured.map(item => item.rect.bottom));
        for (const { card, rect } of measured) {
            let layer = artLayers.get(card);
            if (layer?.parentElement !== card) {
                layer?.remove();
                layer = document.createElement('span');
                layer.className = 'kasp-lobby-art-slice';
                layer.setAttribute('aria-hidden', 'true');
                card.appendChild(layer); artLayers.set(card, layer);
            }
            setStyle(layer, '--kasp-art-image', artImage);
            const scaleX = card.offsetWidth ? rect.width / card.offsetWidth || 1 : 1;
            const scaleY = card.offsetHeight ? rect.height / card.offsetHeight || 1 : 1;
            setStyle(layer, '--kasp-art-width', String((right - left) / scaleX) + 'px');
            setStyle(layer, '--kasp-art-height', String((bottom - top) / scaleY) + 'px');
            setStyle(layer, '--kasp-art-x', String(-(rect.left - left) / scaleX - card.clientLeft) + 'px');
            setStyle(layer, '--kasp-art-y', String(-(rect.top - top) / scaleY - card.clientTop) + 'px');
            if (!card.classList.contains('kasp-lobby-has-art')) card.classList.add('kasp-lobby-has-art');
        }
    }
    function progress(root: HTMLElement, kind: 'star' | 'elite', value: number | null): void {
        if (kind === 'elite') setStyle(root, '--kasp-elite-meter-opacity', value === null ? '0' : '1');
        else setStyle(root, '--kasp-star-meter-display', value === null ? 'none' : 'block');
        if (value !== null) setStyle(root, `--kasp-${kind}-progress`, `${value}%`);
        else root.style.removeProperty(`--kasp-${kind}-progress`);
    }
    function coordinates(root: HTMLElement, x: number, y: number) {
        const parent = root.offsetParent as HTMLElement | null;
        if (!parent) return { x, y, scaleX: 1 };
        const rect = parent.getBoundingClientRect();
        const scaleX = parent.offsetWidth ? rect.width / parent.offsetWidth || 1 : 1;
        const scaleY = parent.offsetHeight ? rect.height / parent.offsetHeight || 1 : 1;
        return { x: (x - rect.left) / scaleX + parent.scrollLeft - parent.clientLeft,
            y: (y - rect.top) / scaleY + parent.scrollTop - parent.clientTop, scaleX };
    }
    function position(challenge: HTMLElement, elite: HTMLElement | null): void {
        const rect = challenge.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const font = parseFloat(getComputedStyle(challenge).fontSize) || 16;
        let bottom = rect.bottom;
        if (elite) {
            const point = coordinates(elite, rect.left, rect.bottom + font * .5);
            setStyle(elite, '--kasp-pass-left', `${point.x}px`); setStyle(elite, '--kasp-pass-top', `${point.y}px`);
            setStyle(elite, '--kasp-pass-width', `${rect.width / point.scaleX}px`);
            bottom = elite.getBoundingClientRect().bottom;
        }
        if (trophiesParent !== challenge.parentElement) {
            restoreTrophies(); trophiesParent = challenge.parentElement;
            for (const key of [TROPHY_TOP, TROPHY_LEFT, TROPHY_WIDTH]) previousTrophyStyles.set(key, {
                value: trophiesParent?.style.getPropertyValue(key) || '',
                priority: trophiesParent?.style.getPropertyPriority(key) || ''
            });
        }
        if (trophiesParent) {
            const point = coordinates(challenge, rect.left, bottom + font);
            setStyle(trophiesParent, TROPHY_TOP, `${point.y}px`);
            setStyle(trophiesParent, TROPHY_LEFT, `${point.x}px`);
            setStyle(trophiesParent, TROPHY_WIDTH, `${rect.width / point.scaleX}px`);
        }
    }
    function schedule(): void {
        if (queued) return;
        queued = true; lifecycle.microtask(() => { queued = false; sync(); });
    }
    function sync(): void {
        if (!initialized) {
            initialized = true; lifecycle.listen(window, 'resize', schedule);
            observer = lifecycle.observer(changes => {
                if (changes.some(change => !(change.type === 'attributes' && change.attributeName === 'style'
                    && sources.includes(change.target as HTMLElement)))) schedule();
            });
            if (typeof ResizeObserver !== 'undefined') resize = new ResizeObserver(lifecycle.guard(schedule));
        }
        const challenge = document.querySelector<HTMLElement>(selectors.challenge), elite = document.querySelector<HTMLElement>(selectors.elite);
        const trophies = document.getElementById('custom-trophy-panel');
        const announcement = document.querySelector<HTMLElement>(selectors.announcement);
        sizeAnnouncement(announcement);
        const next = [challenge, elite, trophies, announcement].filter((root): root is HTMLElement => !!root);
        if (sources.length !== next.length || sources.some((root, index) => root !== next[index])) {
            observer?.disconnect(); resize?.disconnect(); sources = next;
            for (const root of sources) {
                observer?.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
                resize?.observe(root);
            }
        }
        for (const root of records.keys()) if (!next.includes(root)) release(root);
        const stars = challenge?.querySelector(selectors.stars)?.textContent?.trim();
        if (!challenge || !stars || !challenge.querySelector(selectors.tracks)) {
            for (const root of records.keys()) release(root);
            restoreTrophies(); clearPanorama(); return;
        }
        decorate(challenge, 'challenge'); progress(challenge, 'star', readStarProgress(stars));
        let decoratedElite: HTMLElement | null = null;
        if (elite && elite.querySelector(selectors.eliteLevel)) {
            decorate(elite, 'elite'); progress(elite, 'elite', readCircleProgress(elite.querySelector(selectors.eliteCircle)));
            decoratedElite = elite;
        } else if (elite && records.has(elite)) release(elite);
        position(challenge, decoratedElite);
        paintPanorama(challenge, decoratedElite, trophies, announcement);
    }
    lifecycle.onCleanup(() => {
        observer?.disconnect(); resize?.disconnect(); sources = [];
        announcementBody?.style.removeProperty(ANNOUNCEMENT_HEIGHT); announcementBody = null;
        for (const root of records.keys()) release(root);
        restoreTrophies();
        clearPanorama();
    });
    return sync;
}, () => {});

