import { BONUS_PICKUP_MESSAGE, OVERDRIVE_BOX_MODEL, readBonusPosition, BonusPosition } from '../core/bonusPickup';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';

export const OVERDRIVE_COOLDOWN_MS = 85_000;
export const OVERDRIVE_POINT_RADIUS = 250;

export function createOverdriveCountdown(now: () => number = Date.now, boxModel = OVERDRIVE_BOX_MODEL) {
    let readyAt: number | null = null;
    return {
        pickup(model: string): boolean {
            if (model !== boxModel) return false;
            readyAt = now() + OVERDRIVE_COOLDOWN_MS;
            return true;
        },
        reset(): void { readyAt = null; },
        remaining(): number | null {
            return readyAt === null ? null : Math.max(0, Math.ceil((readyAt - now()) / 1000));
        },
    };
}

/** Locations are learned only from this battle's pickups, never from a map coordinate table. */
export function createOverdriveLocations(now: () => number = Date.now) {
    const timers = [0, 1].map(index => ({
        id: index === 0 ? 'kasp-overdrive-timer' : 'kasp-overdrive-timer-secondary',
        alwaysVisible: index === 0,
        position: null as BonusPosition | null,
        countdown: createOverdriveCountdown(now),
    }));
    return {
        timers,
        pickup(model: string, rawPosition?: unknown): boolean {
            if (model !== OVERDRIVE_BOX_MODEL) return false;
            const position = readBonusPosition(rawPosition);
            if (!position) {
                // Once two points exist, an unlocated pickup cannot safely restart either one.
                if (timers.every(timer => timer.position)) return false;
                return timers[0].countdown.pickup(model);
            }
            const nearest = timers.filter(timer => timer.position).map(timer => ({
                timer,
                distance: Math.hypot(position.x - timer.position!.x, position.y - timer.position!.y,
                    position.z - timer.position!.z),
            })).sort((a, b) => a.distance - b.distance)[0];
            const selected = nearest && nearest.distance <= OVERDRIVE_POINT_RADIUS
                ? nearest.timer : timers.find(timer => !timer.position);
            // Do not assign a third, distant point to an unrelated existing deadline.
            if (!selected) return false;
            if (!selected.position) selected.position = position;
            return selected.countdown.pickup(model);
        },
        reset(): void {
            for (const timer of timers) {
                timer.position = null;
                timer.countdown.reset();
            }
        },
    };
}

export const overdriveTimer = (() => {
    const locations = createOverdriveLocations();
    const timers = locations.timers.map(location => ({
        location,
        panel: null as HTMLElement | null,
        time: null as HTMLElement | null,
    }));
    let initialized = false;
    let battleCanvas: Element | null = null;
    let sectionOpen = false;
    let resumeUntil = 0;
    let renderInterval: number | undefined;
    let previewObserver: MutationObserver | undefined;

    function reset(): void {
        locations.reset();
    }

    function isSectionVisible(): boolean {
        if (document.querySelector(gameDOM.screens.visibleTankPreview)) return true;
        return Array.from(document.querySelectorAll<HTMLElement>(gameDOM.common.container)).some(container => {
            if (!container.getClientRects().length) return false;
            const style = getComputedStyle(container);
            return style.display !== 'none' && style.visibility !== 'hidden' &&
                style.visibility !== 'collapse' && style.opacity !== '0';
        });
    }

    function syncBattle(): boolean {
        const current = document.querySelector(gameDOM.screens.battleCanvas);
        if (document.querySelector(gameDOM.results.status) || document.querySelector(gameDOM.play.mainMenu)) {
            battleCanvas = null;
            sectionOpen = false;
            return false;
        }
        if (battleCanvas && isSectionVisible()) {
            sectionOpen = true;
            resumeUntil = Date.now() + 1000;
            return true;
        }
        // The battle canvas can be remounted when closing an in-battle section.
        if (sectionOpen && !current && Date.now() < resumeUntil) return true;
        if (current !== battleCanvas) {
            battleCanvas = current;
            if (!sectionOpen || !current) reset();
        }
        sectionOpen = false;
        return !!current;
    }

    function render(): void {
        const enabled = utils.getSetting('k_overdrive_timer', false);
        if (!enabled) {
            if (renderInterval !== undefined) window.clearInterval(renderInterval);
            renderInterval = undefined;
            previewObserver?.disconnect();
            battleCanvas = null; sectionOpen = false; resumeUntil = 0;
            reset();
            for (const timer of timers) {
                timer.panel?.remove(); timer.panel = timer.time = null;
            }
            return;
        }
        if (initialized && renderInterval === undefined) {
            previewObserver?.observe(document.documentElement, {
                childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'], subtree: true,
            });
            renderInterval = window.setInterval(render, 250);
        }
        const inBattle = syncBattle();
        if (!inBattle) reset();
        const sectionVisible = isSectionVisible();
        for (const timer of timers) renderTimer(timer, inBattle && enabled && !sectionVisible);
    }

    function renderTimer(timer: typeof timers[number], visible: boolean): void {
        const seconds = timer.location.countdown.remaining();
        if (!visible || (!timer.location.alwaysVisible && seconds === null)) {
            timer.panel?.remove();
            timer.panel = timer.time = null;
            return;
        }
        if (!document.body) return;
        if (!timer.panel?.isConnected) {
            timer.panel = document.createElement('div');
            timer.panel.id = timer.location.id;
            timer.panel.className = 'kasp-overdrive-timer';
            timer.time = document.createElement('strong');
            timer.panel.append(timer.time);
            document.body.appendChild(timer.panel);
        }
        const { panel, time } = timer;
        const ru = state.lang === 'RU';
        const value = seconds === null ? '0:00'
            : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        // Avoid triggering the master DOM observer when the displayed second has not changed.
        if (time!.textContent !== value) time!.textContent = value;
        panel.classList.toggle('kasp-overdrive-soon', seconds !== null && seconds > 0 && seconds <= 10);
        panel.classList.toggle('kasp-overdrive-ready', seconds === 0);
        const hint = ru ? '85 секунд после подбора коробки. Время появления приблизительное.'
            : '85 seconds after a box pickup. Respawn time is an estimate.';
        if (panel.title !== hint) panel.title = hint;
    }

    function setup(): void {
        if (initialized) return;
        initialized = true;
        window.addEventListener('message', event => {
            if (event.source !== window || !utils.getSetting('k_overdrive_timer', false)) return;
            const message: unknown = event.data;
            if (!message || typeof message !== 'object') return;
            const { type, detail } = message as { type?: unknown; detail?: unknown };
            if (type !== BONUS_PICKUP_MESSAGE || !syncBattle()) return;
            const pickup = typeof detail === 'string' ? { model: detail, position: null }
                : detail && typeof detail === 'object' ? detail as { model?: unknown; position?: unknown } : null;
            if (!pickup || typeof pickup.model !== 'string') return;
            if (locations.pickup(pickup.model, pickup.position)) render();
        });
        document.addEventListener('kasp:battle:id', () => { reset(); render(); });
        window.addEventListener('kasp:settings-changed', render);
        window.addEventListener('storage', render);
        // Sections can mount containers or toggle their visibility without replacing the battle.
        previewObserver = new MutationObserver(records => {
            if (!utils.getSetting('k_overdrive_timer', false)) return;
            const selector = `${gameDOM.screens.tankPreview}, ${gameDOM.common.container}`;
            if (records.some(record => record.type === 'childList'
                ? [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(node =>
                    (node as Element).matches?.(selector) || (node as Element).querySelector?.(selector))
                : (record.target as Element).matches(selector))) render();
        });
        render();
    }
    return { setup, sync: render };
})();
