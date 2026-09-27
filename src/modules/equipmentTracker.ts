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
        const block = cell.querySelector('.BattleTabStatisticComponentStyle-commonBlock');
        if (!block) return [];
        return Array.from(block.children);
    };

    const getOwnNickname = (): string => {
        const el = document.querySelector('.UserInfoContainerStyle-userNameRank');
        if (!el) return '';
        return (el.textContent || '').trim().replace(/^\[.*?\]\s*/, '').trim();
    };

    const findSelfRow = (): Element | null => {
        const byId = document.getElementById('selfUserBg');
        if (byId) return byId;

        const selected = document.querySelector('.BattleTabStatisticComponentStyle-selectedRowBackGround');
        if (selected) return selected;

        const own = getOwnNickname();
        if (!own) return null;
        const cells = document.querySelectorAll('.BattleTabStatisticComponentStyle-nicknameCell');
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

        const device = selfRow.querySelector('.BattleTabStatisticComponentStyle-deviceCell');
        const defence = selfRow.querySelector('.BattleTabStatisticComponentStyle-defenceCell');
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