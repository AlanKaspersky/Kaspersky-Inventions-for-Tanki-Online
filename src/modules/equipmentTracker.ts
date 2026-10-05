import { gameDOM } from '../core/gameDOM';
import { getAccountIdentity } from '../core/accountIdentity';

export const equipmentTracker = (() => {
    const STORAGE_KEY = 'kasp_my_equipment';
    let lastSignature = '';

    const urlFrom = (el: Element | null): string => {
        if (!el) return '';
        const cs = getComputedStyle(el);
        const bg = cs.getPropertyValue('background-image');
        if (bg && bg !== 'none') {
            const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1];
        }
        const mask = cs.getPropertyValue('-webkit-mask-image') ||
            cs.getPropertyValue('mask-image');
        if (mask && mask !== 'none') {
            const m = mask.match(/url\(["']?([^"')]+)["']?\)/);
            if (m && m[1]) return m[1];
        }
        const img = el.querySelector('img');
        if (img && (img as HTMLImageElement).src) return (img as HTMLImageElement).src;
        if (el instanceof HTMLImageElement && el.src) return el.src;
        return '';
    };

    const iconsOf = (cell: Element | null): Element[] => {
        if (!cell) return [];
        const block = cell.querySelector(gameDOM.statistics.equipment);
        if (!block) return [];
        return Array.from(block.children);
    };

    const getOwnNickname = (): string => {
        return getAccountIdentity()?.nickname || '';
    };

    const findSelfRow = (): Element | null => {
        const byId = document.getElementById(gameDOM.ids.selfRow);
        if (byId) return byId;

        const selected = document.querySelector(gameDOM.statistics.selectedRow);
        if (selected) return selected;

        const own = getOwnNickname();
        if (!own) return null;
        const cells = document.querySelectorAll(gameDOM.statistics.nickname);
        for (let i = 0; i < cells.length; i++) {
            const nick = (cells[i].textContent || '')
                .trim().replace(/^\[.*?\]\s*/, '').trim();
            if (nick === own) return cells[i].closest('tr');
        }
        return null;
    };

    const sync = (): void => {
        const selfRow = findSelfRow();
        if (!selfRow) return;

        const device = selfRow.querySelector(gameDOM.statistics.deviceCell);
        const defence = selfRow.querySelector(gameDOM.statistics.hullCell);
        if (!device && !defence) return;

        const dIcons = iconsOf(device);
        const hIcons = iconsOf(defence);

        const entry = {
            turret: urlFrom(dIcons[0] ?? null),
            turretAugment: urlFrom(dIcons[1] ?? null),
            hull: urlFrom(hIcons[0] ?? null),
            hullAugment: urlFrom(hIcons[1] ?? null),
            savedAt: Date.now(),
        };

        if (!entry.turret && !entry.hull) return;

        const sig = `${entry.turret}|${entry.turretAugment}|${entry.hull}|${entry.hullAugment}`;
        if (sig === lastSignature) return;
        lastSignature = sig;

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
        }
        catch (e) {
            console.error('[KI:equipment] save failed', e);
        }
    };

    const get = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    };

    const clear = (): void => {
        localStorage.removeItem(STORAGE_KEY);
        lastSignature = '';
    };

    return { sync, get, clear };
})();
