import { featureScope } from '../core/featureRuntime';
import { readPageMessage } from '../core/pageMessages';
const lifecycle = featureScope('overdriveTimer');
import { BONUS_PICKUP_MESSAGE, OVERDRIVE_BOX_MODEL, readBonusPosition, BonusPosition } from '../core/bonusPickup';
import { gameDOM } from '../core/gameDOM';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { OVERDRIVE_DIRECTION_MESSAGE, overdriveBearing, continuousBearing } from '../core/overdriveDirection';
import type { OverdrivePose } from '../core/overdriveDirection';

export const OVERDRIVE_COOLDOWN_MS = 85_000;
export const OVERDRIVE_POINT_RADIUS = 1000;

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

export function createOverdriveLocations(now: () => number = Date.now) {
    const timers = [0, 1].map(index => ({
        id: index === 0 ? 'kasp-overdrive-timer' : 'kasp-overdrive-timer-secondary',
        position: null as BonusPosition | null,
        countdown: createOverdriveCountdown(now),
    }));
    return {
        timers,
        pickup(model: string, rawPosition?: unknown): boolean {
            if (model !== OVERDRIVE_BOX_MODEL) return false;
            const position = readBonusPosition(rawPosition);
            if (!position) {
                if (timers.every(timer => timer.position)) return false;
                return timers[0].countdown.pickup(model);
            }
            const nearest = timers.filter(timer => timer.position).map(timer => ({
                timer,
                distance: Math.hypot(position.x - timer.position!.x, position.y - timer.position!.y),
            })).sort((a, b) => a.distance - b.distance)[0];
            const selected = nearest && nearest.distance <= OVERDRIVE_POINT_RADIUS
                ? nearest.timer : timers.find(timer => !timer.position);
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

export const overdriveTimer = lifecycle.initialize(() => {
    const locations = createOverdriveLocations();
    const timers = locations.timers.map(location => ({
        location,
        panel: null as HTMLElement | null,
        time: null as HTMLElement | null,
        bearing: null as number | null,
    }));
    let pose: OverdrivePose | null = null;
    let poseAt = 0;
    let overlay: HTMLElement | null = null;
    let initialized = false;
    let battleCanvas: Element | null = null;
    let sectionOpen = false;
    let resumeUntil = 0;
    let renderInterval: number | undefined;
    let previewObserver: MutationObserver | undefined;

    function reset(): void {
        locations.reset();
        pose = null; poseAt = 0;
    }

    function removeOverlay(): void {
        overlay?.remove();
        overlay = null;
        for (const timer of timers) { timer.panel = timer.time = null; timer.bearing = null; }
    }

    function renderDirection(timer: typeof timers[number]): void {
        if (!timer.panel) return;
        const bearing = pose && Date.now() - poseAt <= 750 && timer.location.position
            ? overdriveBearing(timer.location.position, pose) : null;
        timer.panel.classList.toggle('kasp-overdrive-direction', bearing !== null);
        if (bearing === null) { timer.bearing = null; return; }
        const next = continuousBearing(timer.bearing, bearing);
        if (next !== timer.bearing) timer.panel.style.setProperty('--kasp-overdrive-bearing', `${next}deg`);
        timer.bearing = next;
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
            if (renderInterval !== undefined) lifecycle.cancelInterval(renderInterval);
            renderInterval = undefined;
            previewObserver?.disconnect();
            battleCanvas = null; sectionOpen = false; resumeUntil = 0;
            reset();
            removeOverlay();
            return;
        }
        if (initialized && renderInterval === undefined) {
            previewObserver?.observe(document.documentElement, {
                childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'], subtree: true,
            });
            renderInterval = lifecycle.interval(render, 250);
        }
        const inBattle = syncBattle();
        if (!inBattle) reset();
        const sectionVisible = isSectionVisible();
        for (const timer of timers) renderTimer(timer, inBattle && enabled && !sectionVisible);
        if (overlay && !overlay.children.length) removeOverlay();
    }

    function renderTimer(timer: typeof timers[number], visible: boolean): void {
        const seconds = timer.location.countdown.remaining();
        if (!visible || seconds === null) {
            timer.panel?.remove();
            timer.panel = timer.time = null;
            timer.bearing = null;
            return;
        }
        if (!document.body) return;
        if (!overlay?.isConnected) {
            overlay = document.createElement('div');
            overlay.id = 'kasp-overdrive-timers';
            overlay.className = 'kasp-overdrive-timers';
            document.body.appendChild(overlay);
        }
        if (!timer.panel?.isConnected) {
            timer.panel = document.createElement('div');
            timer.panel.id = timer.location.id;
            timer.panel.className = 'kasp-overdrive-timer';
            timer.time = document.createElement('strong');
            timer.panel.append(timer.time);
            overlay.appendChild(timer.panel);
        }
        const { panel, time } = timer;
        const ru = state.lang === 'RU';
        const value = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        if (time!.textContent !== value) time!.textContent = value;
        panel.classList.toggle('kasp-overdrive-soon', seconds > 0 && seconds <= 10);
        panel.classList.toggle('kasp-overdrive-ready', seconds === 0);
        renderDirection(timer);
        const hint = ru ? '85 секунд после подбора коробки. Время появления приблизительное.'
            : '85 seconds after a box pickup. Respawn time is an estimate.';
        if (panel.title !== hint) panel.title = hint;
    }

    function setup(): void {
        if (initialized) return;
        initialized = true;
        lifecycle.listen(window, 'message', event => {
            if (!utils.getSetting('k_overdrive_timer', false)) return;
            const direction = readPageMessage(event, window, OVERDRIVE_DIRECTION_MESSAGE);
            if (direction) {
                if (direction.at > Date.now() + 1000 || direction.at < poseAt || Date.now() - direction.at > 750) return;
                pose = direction.pose; poseAt = direction.at;
                for (const timer of timers) renderDirection(timer);
                return;
            }
            const message = readPageMessage(event, window, BONUS_PICKUP_MESSAGE);
            if (!message || !syncBattle()) return;
            const pickup = typeof message.detail === 'string' ? { model: message.detail, position: null } : message.detail;
            if (locations.pickup(pickup.model, pickup.position)) render();
        });
        lifecycle.listen(document, 'kasp:battle:id', () => { reset(); render(); });
        lifecycle.listen(window, 'kasp:settings-changed', render);
        lifecycle.listen(window, 'storage', render);
        previewObserver = lifecycle.observer(records => {
            if (!utils.getSetting('k_overdrive_timer', false)) return;
            const selector = `${gameDOM.screens.tankPreview}, ${gameDOM.common.container}`;
            if (records.some(record => record.type === 'childList'
                ? [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(node =>
                    (node as Element).matches?.(selector) || (node as Element).querySelector?.(selector))
                : (record.target as Element).matches(selector))) render();
        });
        render();
    }
    lifecycle.onCleanup(() => { previewObserver?.disconnect();renderInterval=undefined;reset();removeOverlay(); });

    return { setup, sync: render };
}, { setup() {}, sync() {} });
