import { featureScope } from '../core/featureRuntime';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { RESISTANCE_ICONS } from '../core/turretIcons';
import { getTankiImageUrl } from '../core/imageUrl';

const lifecycle = featureScope('enemyWeapons');
const BUTTON = 'kasp-enemy-weapons-btn';
const TOOLTIP = 'kasp-enemy-weapons-tooltip';
const TURRETS_ICON = 'https://s.eu.tankionline.com/static/images/turrets.20be27f5.svg';
const WEAPONS: Record<string, [string, string]> = {
    firebird: ['Огнемёт', 'Firebird'], freeze: ['Фриз', 'Freeze'], isis: ['Изида', 'Isida'],
    tesla: ['Тесла', 'Tesla'], hammer: ['Молот', 'Hammer'], twins: ['Твинс', 'Twins'],
    ricochet: ['Рикошет', 'Ricochet'], vulcan: ['Вулкан', 'Vulcan'], smoky: ['Смоки', 'Smoky'],
    rocket_launcher: ['Страйкер', 'Striker'], thunder: ['Гром', 'Thunder'], tsunami: ['Цунами', 'Tsunami'],
    scorpio: ['Скорпион', 'Scorpion'], artillery: ['Магнум', 'Magnum'], railgun: ['Рельса', 'Railgun'],
    gauss: ['Гаусс', 'Gauss'], shaft: ['Шафт', 'Shaft'], terminator: ['Терминатор', 'Terminator'],
};
const ALIASES: Record<string, string> = { isida: 'isis', striker: 'rocket_launcher', magnum: 'artillery', scorpion: 'scorpio', jugger: 'terminator' };

function weaponKey(url: string): string | null {
    const file = url.split('/').pop()?.split('.')[0].toLowerCase().replace(/_resistance$/, '') || '';
    const key = ALIASES[file] || file;
    return Object.prototype.hasOwnProperty.call(WEAPONS, key) ? key : null;
}

function iconUrl(element: Element | null): string {
    if (!element) return '';
    const image = element.tagName.toLowerCase() === 'img' ? element : element.querySelector('img');
    const src = getTankiImageUrl(image?.getAttribute('src'));
    if (src) return src;
    const inline = (element as HTMLElement).style;
    const read = (style: CSSStyleDeclaration) => {
        for (const value of [style.maskImage, style.webkitMaskImage, style.backgroundImage]) {
            const url = getTankiImageUrl(/url\(["']?([^"')]+)["']?\)/.exec(value || '')?.[1]);
            if (url) return url;
        }
        return '';
    };
    return read(inline) || read(getComputedStyle(element));
}

export function readEnemyWeapons(tab: Element) {
    const self = tab.querySelector(gameDOM.statistics.selectedRow);
    const blue = tab.querySelector(gameDOM.statistics.blueTeam), red = tab.querySelector(gameDOM.statistics.redTeam);
    const dm = tab.querySelector(gameDOM.statistics.dmTeam);
    const enemy = self && blue?.contains(self) ? red : self && red?.contains(self) ? blue : null;
    const group = enemy || (!blue && !red && self && dm?.contains(self) ? dm : null);
    if (!group) return null;
    const counts = new Map<string, { key: string; count: number; icon: string }>();
    for (const row of group.querySelectorAll('tbody tr')) {
        if (row === self || !row.querySelector(gameDOM.statistics.nickname)) continue;
        const cell = row.querySelector(gameDOM.statistics.deviceCell);
        const icon = cell?.querySelector(gameDOM.statistics.equipment)?.firstElementChild || null;
        const source = iconUrl(icon), key = weaponKey(source) || 'unknown';
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { key, count: 1, icon: RESISTANCE_ICONS[key] || (key === 'terminator' ? source : '') || TURRETS_ICON });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const enemyWeapons = lifecycle.initialize(() => {
    let button: HTMLElement | null = null, tooltip: HTMLElement | null = null;
    let initialized = false, open = false, focused = false, interval: number | undefined;
    let size = { width: 0, height: 0 }, signature = '';

    function hide(): void {
        open = focused = false;
        lifecycle.cancelInterval(interval); interval = undefined;
        tooltip?.remove(); tooltip = null; signature = '';
        button?.setAttribute('aria-expanded', 'false');
    }
    function position(): void {
        if (!tooltip || !button) return;
        const rect = button.getBoundingClientRect();
        const x = Math.max(8, Math.min(rect.left + rect.width / 2 - size.width / 2, window.innerWidth - size.width - 8));
        const y = Math.max(8, rect.top - size.height - 10);
        tooltip.style.left = `${x}px`; tooltip.style.top = `${y}px`;
    }
    function refresh(): void {
        if (!open) return;
        const tab = document.querySelector(gameDOM.statistics.teams);
        if (!tab || !button?.isConnected || !button.getClientRects().length || !document.body) { hide(); return; }
        const data = readEnemyWeapons(tab), ru = state.lang === 'RU';
        const next = JSON.stringify([state.lang, data]);
        if (next === signature && tooltip?.isConnected) { position(); return; }
        signature = next;
        if (!tooltip) {
            tooltip = document.createElement('div'); tooltip.id = TOOLTIP;
            tooltip.setAttribute('role', 'tooltip'); document.body.appendChild(tooltip);
        }
        const contents: HTMLElement[] = [];
        if (!data || !data.length) {
            const message = document.createElement('span');
            message.textContent = !data ? (ru ? 'Не удалось определить вашу команду' : 'Your team could not be identified')
                : (ru ? 'Нет игроков противника' : 'No enemy players');
            contents.push(message);
        } else {
            const list = document.createElement('div');
            list.className = 'kasp-enemy-weapons-list';
            if (data.length > 9) {
                list.className += ' kasp-enemy-weapons-two-columns';
                list.style.gridTemplateRows = `repeat(${Math.ceil(data.length / 2)}, auto)`;
            }
            for (const entry of data) {
                const row = document.createElement('div'); row.className = 'kasp-enemy-weapon';
                const icon = document.createElement('i');
                icon.style.maskImage = icon.style.webkitMaskImage = `url("${entry.icon}")`;
                const label = document.createElement('span');
                label.textContent = WEAPONS[entry.key]?.[ru ? 0 : 1] || (ru ? 'Неизвестная пушка' : 'Unknown weapon');
                const count = document.createElement('b'); count.textContent = `×${entry.count}`;
                row.append(icon, label, count); list.appendChild(row);
            }
            contents.push(list);
        }
        tooltip.replaceChildren(...contents);
        size = { width: tooltip.offsetWidth, height: tooltip.offsetHeight }; position();
    }
    function show(): void {
        open = true;
        button?.setAttribute('aria-expanded', 'true');
        refresh();
        if (open) interval ??= lifecycle.interval(refresh, 250);
    }
    function setup(): void {
        if (initialized) return;
        initialized = true;
        lifecycle.listen(document, 'mouseover', event => {
            if (!(event.target instanceof Element) || !button?.contains(event.target)) return;
            if (event.relatedTarget instanceof Node && button.contains(event.relatedTarget)) return;
            show();
        });
        lifecycle.listen(document, 'mouseout', event => {
            if (focused || !(event.target instanceof Node) || !button?.contains(event.target)) return;
            if (!(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget)) hide();
        });
        lifecycle.listen(document, 'focusin', event => {
            if (!button || event.target !== button) return;
            focused = true; show();
        });
        for (const type of ['mousedown', 'click'] as const) lifecycle.listen(document, type, event => {
            if (!(event.target instanceof Node) || !button?.contains(event.target)) return;
            event.preventDefault(); event.stopPropagation();
        }, true);
        lifecycle.listen(document, 'focusout', event => { if (event.target === button) hide(); });
        lifecycle.listen(document, 'keydown', event => { if (event.key === 'Escape') hide(); });
        lifecycle.listen(window, 'blur', hide);
        lifecycle.listen(window, 'resize', () => {
            if (tooltip) { size = { width: tooltip.offsetWidth, height: tooltip.offsetHeight }; position(); }
        });
        lifecycle.listen(document, 'visibilitychange', () => { if (document.hidden) hide(); });
    }
    function sync(): void {
        setup();
        const tab = document.querySelector(gameDOM.statistics.teams);
        const toggle = tab?.querySelector('#kasp-tab-toggle-btn');
        if (!toggle?.parentElement) { hide(); button?.remove(); button = null; return; }
        if (!button?.isConnected || button.parentElement !== toggle.parentElement) {
            hide(); button?.remove(); button = document.createElement('div'); button.id = BUTTON;
            button.setAttribute('role', 'button'); button.tabIndex = 0;
            button.setAttribute('aria-describedby', TOOLTIP); button.setAttribute('aria-expanded', 'false');
            const icon = document.createElement('div'); icon.className = 'kasp-toggle-icon';
            icon.style.maskImage = icon.style.webkitMaskImage = `url("${TURRETS_ICON}")`;
            button.appendChild(icon); toggle.parentElement.appendChild(button);
        }
        button.setAttribute('aria-label', state.lang === 'RU' ? 'Пушки противника' : 'Enemy weapons');
        refresh();
    }
    lifecycle.onCleanup(() => { hide(); button?.remove(); button = null; });
    return { sync };
}, { sync() {} });
