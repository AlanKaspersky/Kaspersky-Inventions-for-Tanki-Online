import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('changeCounter');
import { gameDOM } from '../core/gameDOM';
import { readPageMessage } from '../core/pageMessages';
export const changeCounter = lifecycle.initialize(() => {
    const CACHE_KEY = 'kasp_player_changes_cache';
    const playerChanges = new Map<string, number>();
    let isUpdating = false;
    let isInBattle = false;

    try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached) as Record<string, number>;
            for (const [nick, count] of Object.entries(parsed)) {
                playerChanges.set(nick, count);
            }
        }
    }
    catch (e) { }

    const saveCache = (): void => {
        const obj: Record<string, number> = {};
        playerChanges.forEach((count, nick) => { obj[nick] = count; });
        sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    };

    const clearCache = (): void => {
        playerChanges.clear();
        sessionStorage.removeItem(CACHE_KEY);
    };

    lifecycle.listen(window, 'message', (e) => {
        const message = readPageMessage(e, window, 'kasp:battle-kind');
        if (message) window.__kaspBattleKind = message.detail;
    });

    lifecycle.listen(window, 'message', (e) => {
        const message = readPageMessage(e, window, 'kasp:useraction');
        if (!message || message.detail[2] !== 'CHANGE_EQUIPMENT') return;
        const detail = message.detail;

        const nickname = detail[1];
        if (!nickname) return;

        playerChanges.set(nickname, (playerChanges.get(nickname) ?? 0) + 1);
        saveCache();
        if (document.querySelector(gameDOM.statistics.container)) {
            update();
        }
    });

    lifecycle.listen(document, 'kasp:battle:id', () => {
        clearCache();
        update();
    });

    function checkBattleCanvas(): void {
        const currentInBattle = !!document.querySelector(gameDOM.screens.battleCanvas);
        if (currentInBattle !== isInBattle) {
            isInBattle = currentInBattle;
            if (!isInBattle) {
                clearCache();
                update();
            }
        }
    }

    function sync(): void {
        const container = document.querySelector(gameDOM.statistics.container);
        if (!container) return;

        const headerRows = container.querySelectorAll('table > thead > tr');
        for (let i = 0; i < headerRows.length; i++) {
            const row = headerRows[i];
            if (!row.querySelector('.kasp-change-th')) {
                const th = document.createElement('th');
                th.className = 'kasp-change-th';
                th.innerHTML = '<div></div>';
                row.appendChild(th);
            }
        }

        const bodyRows = container.querySelectorAll('table > tbody > tr');
        for (let i = 0; i < bodyRows.length; i++) {
            const row = bodyRows[i];
            let td = row.querySelector<HTMLElement>('.kasp-change-td');
            if (!td) {
                td = document.createElement('td');
                td.className = 'kasp-change-td';
                row.appendChild(td);
            }
            const cell = row.querySelector(gameDOM.statistics.nickname);
            if (!cell) continue;
            const nickname = (cell.textContent || '').replace(/^\[.*?\]\s*/, '').trim();
            if (!nickname) continue;
            const count = playerChanges.get(nickname) ?? 0;
            const hasClass = td.classList.contains('kasp-changed');
            if (count > 0 && !hasClass) td.classList.add('kasp-changed');
            else if (count === 0 && hasClass) td.classList.remove('kasp-changed');
        }
    }

    function update(): void { sync(); }

    lifecycle.onCleanup(() => { document.querySelectorAll('.kasp-change-th, .kasp-change-td').forEach(node=>node.remove()); });

    return {
        onTick: () => { checkBattleCanvas(); },
        sync,
        update,
    };
}, { onTick() {}, sync() {}, update() {} });
