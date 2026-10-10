import { gameDOM } from './gameDOM';

export const BATTLE_PRESENCE_MESSAGE = 'kasp:battle-presence';
export interface BattlePresence {
    map: string;
    mode?: string;
    remaining?: number;
    players?: number;
    maxPlayers?: number;
}

export function parseBattleClock(text: string): number | undefined {
    const match = /^\s*(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\s*$/.exec(text);
    if (!match || Number(match[3]) > 59 || match[1] && Number(match[2]) > 59) return undefined;
    return Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

const schemas = new WeakMap<Function, Map<string, string>>();
function field(object: object, label: string): unknown {
    const method = object.toString;
    if (typeof method !== 'function') return undefined;
    let schema = schemas.get(method);
    if (!schema) {
        schema = new Map();
        const code = Function.prototype.toString.call(method);
        for (const match of code.matchAll(/\b([A-Za-z]+)=.{0,35}?this\.([\w$]+)/g)) schema.set(match[1], match[2]);
        schemas.set(method, schema);
    }
    const key = schema.get(label);
    return key ? Object.getOwnPropertyDescriptor(object, key)?.value : undefined;
}
function type(object: object, name: string): boolean {
    return typeof object.toString === 'function' && Function.prototype.toString.call(object.toString).includes(`"${name}(`);
}
function children(object: object): object[] {
    return Object.values(Object.getOwnPropertyDescriptors(object)).slice(0, 100)
        .filter(descriptor => 'value' in descriptor && descriptor.value && typeof descriptor.value === 'object')
        .map(descriptor => descriptor.value);
}

/** Reads current store data, not whichever lobby battle happens to be selected. */
export function readBattlePresence(store: object, capacities?: ReadonlyMap<string, number>): BattlePresence | null {
    const seen = new Set<object>(), objects: object[] = [];
    const pending: Array<[object, number]> = [[store, 0]];
    let stats: object | undefined, users: object | undefined;
    while (pending.length && seen.size < 1000) {
        // Visit reducer states before their deep resource graphs exhaust the budget.
        const [object, depth] = pending.shift()!;
        if (seen.has(object)) continue;
        seen.add(object); objects.push(object);
        if (type(object, 'BattleStatistics')) stats = object;
        if (type(object, 'BattleUsers')) users = object;
        if (depth < 5 && !Array.isArray(object) && typeof (object as { z2?: unknown }).z2 !== 'function') {
            children(object).forEach(child => pending.push([child, depth + 1]));
        }
    }
    if (!stats || field(stats, 'battleLoaded') !== true) return null;
    const map = field(stats, 'mapNameWithoutMode') || field(stats, 'mapName');
    if (typeof map !== 'string' || !map.trim()) return null;
    const result: BattlePresence = { map: map.trim() };
    const mode = String(field(stats, 'mode') || '').toUpperCase();
    const modes = /^(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/;
    const suffix = /\s+(TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i.exec(String(field(stats, 'mapName') || ''))?.[1];
    if (modes.test(mode)) result.mode = mode;
    else if (suffix) result.mode = suffix.toUpperCase();
    const remaining = field(stats, 'remainingTimeInSec');
    if (typeof remaining === 'number' && Number.isFinite(remaining) && remaining >= 0) result.remaining = remaining;
    const battleId = field(stats, 'battleId');
    const capacity = battleId == null ? undefined : capacities?.get(String(battleId));
    if (capacity !== undefined) result.maxPlayers = capacity;
    for (const object of objects) {
        if (result.maxPlayers !== undefined) break;
        const lookup = (object as { z2?: (key: unknown) => unknown }).z2;
        if (typeof lookup !== 'function' || !battleId) continue;
        try {
            const params = lookup.call(object, battleId);
            if (!params || typeof params !== 'object' || !type(params, 'BattleParams')) continue;
            const limit = field(params, 'maxPeopleCount');
            const mode = field(params, 'battleMode') as { k3_1?: number } | undefined;
            // The game's lobby uses modes 0/1 as single-player tables; other modes have two teams.
            if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0 && typeof mode?.k3_1 === 'number') {
                result.maxPlayers = limit * (mode.k3_1 <= 1 ? 1 : 2);
            }
            break;
        } catch { /* Some collections use a different key type. */ }
    }
    if (users) {
        const online = field(users, 'onlineUsers') as { t?: () => { u(): boolean; v(): unknown } } | undefined;
        const teams = field(users, 'teams') as { z2?: (id: unknown) => unknown } | undefined;
        if (typeof online?.t === 'function' && typeof teams?.z2 === 'function') {
            let count = 0, budget = 1000;
            const iterator = online.t();
            while (iterator.u() && budget-- > 0) {
                const team = teams.z2(iterator.v());
                if (team != null && !/SPECTATOR/i.test(String(team))) count++;
            }
            if (budget > 0 && (result.maxPlayers === undefined || count <= result.maxPlayers)) result.players = count;
        }
    }
    return result;
}

/** Observe the server's total capacity together with the battle ID that it belongs to. */
export function patchBattleCapacity(code: string): string {
    const capacity = /this\.([\w$]+)=new [\w$]+\(["']maxPeople["']\)/.exec(code)?.[1];
    const id = /this\.([\w$]+)=new [\w$]+\(["']battleId["']\)/.exec(code)?.[1];
    if (!capacity || !id) return code;
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Both assignments must use the same settings object; never mix lobby/map limits.
    const assignments = new RegExp(`([\\w$]+\\([\\w$]+\\))\\.${escape(id)}\\.[\\w$]+\\(([\\w$]+\\(\\)\\.[\\w$]+\\(\\)\\.[\\w$]+\\(\\))\\),\\1\\.${escape(capacity)}\\.[\\w$]+\\(([\\w$]+\\.[\\w$]+)\\)`, 'g');
    return code.replace(assignments, (whole, _settings, battleId, limit) =>
        `${whole},(function(){try{window.__kaspPresenceCapacity(${battleId},${limit})}catch(__kaspIgnored){}})()`);
}

/** Observe resolved DI store getters by their semantic label, regardless of minified names. */
export function patchBattlePresence(code: string, report?: (matches: number) => void): string {
    let matches = 0;
    const getter = /function\(\)\{var ([\w$]+)=([\w$]+);return (this\.[\w$]+\.[\w$]+\(this,[\w$]+\(["']store["'],1,\1,function\(([\w$]+)\)\{return \4\.[\w$]+\(\)\},null\)\))\}/g;
    const patched = code.replace(getter, (_whole, variable, scope, expression) => {
        matches++;
        // Preserve the original return value and exceptions; observation cannot break a getter.
        return `function(){var ${variable}=${scope};var __kaspStore=${expression};try{window.__kaspPresenceStore(__kaspStore)}catch(__kaspIgnored){}return __kaspStore}`;
    });
    report?.(matches);
    return patched;
}

export function installBattlePresence(page: Window): void {
    if (!navigator.userAgent.includes('Electron')) return;
    let store: object | null = null;
    const capacities = new Map<string, number>();
    const bridge = page as Window & {
        __kaspPresenceStore?: (value: unknown) => unknown;
        __kaspPresenceCapacity?: (id: unknown, limit: unknown) => void;
        __kaspPresenceBattleDebug?: () => BattlePresence | null;
        __kaspPresenceStoreDebug?: () => { captured: boolean; error: string | null };
    };
    bridge.__kaspPresenceStore = value => {
        if (value && typeof value === 'object') store = value;
        return value;
    };
    bridge.__kaspPresenceCapacity = (id, limit) => {
        if (id == null || typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0 || limit > 1000) return;
        capacities.set(String(id), limit);
        if (capacities.size > 32) capacities.delete(capacities.keys().next().value!);
    };
    let error: string | null = null;
    let latest: BattlePresence | null = null;
    let lastMap: string | undefined, lastRemaining: number | undefined, deadline: number | undefined;
    const poll = () => {
        try { latest = store ? readBattlePresence(store, capacities) : null; error = null; }
        catch (cause) { latest = null; error = String(cause); }
        if (latest) {
            const timer = document.querySelector(gameDOM.presence.timer);
            if (timer) latest.remaining = parseBattleClock(timer.textContent || '');
            else {
                // BattleStatistics may retain the initial duration between server updates.
                if (latest.map !== lastMap || latest.remaining !== lastRemaining) {
                    deadline = latest.remaining === undefined ? undefined : Date.now() + latest.remaining * 1000;
                }
                lastRemaining = latest.remaining;
                latest.remaining = deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            }
            lastMap = latest.map;
        } else { lastMap = undefined; lastRemaining = undefined; deadline = undefined; }
        page.postMessage({ type: BATTLE_PRESENCE_MESSAGE, battle: latest, at: Date.now() }, page.location.origin);
    };
    bridge.__kaspPresenceBattleDebug = () => latest;
    bridge.__kaspPresenceStoreDebug = () => ({ captured: store !== null, error });
    page.setInterval(poll, 1000);
}
