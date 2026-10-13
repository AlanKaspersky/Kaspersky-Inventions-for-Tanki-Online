import { gameDOM } from './gameDOM';
import { clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';

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
    if (typeof object.toString !== 'function') return false;
    const code = Function.prototype.toString.call(object.toString);
    return code.includes(`"${name}(`) || code.includes(`'${name}(`);
}
function children(object: object): object[] {
    return Object.values(Object.getOwnPropertyDescriptors(object)).slice(0, 100)
        .filter(descriptor => 'value' in descriptor && descriptor.value && typeof descriptor.value === 'object')
        .map(descriptor => descriptor.value);
}

export function readBattleKind(stats: object): 'MM' | 'PRO' | null {
    if (field(stats, 'battleLoaded') === false) return null;
    const matchmaking = field(stats, 'isMMBattle');
    return typeof matchmaking === 'boolean' ? matchmaking ? 'MM' : 'PRO' : null;
}

export function readBattlePresence(store: object, capacities?: ReadonlyMap<string, number>): BattlePresence | null {
    const seen = new Set<object>(), objects: object[] = [];
    const pending: Array<[object, number]> = [[store, 0]];
    let stats: object | undefined, users: object | undefined;
    while (pending.length && seen.size < 1000) {
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
            if (typeof limit === 'number' && Number.isInteger(limit) && limit > 0 && typeof mode?.k3_1 === 'number') {
                result.maxPlayers = limit * (mode.k3_1 <= 1 ? 1 : 2);
            }
            break;
        } catch {}
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

export interface BattlePresenceHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
    storeHooks?: number;
    capacityHooks?: number;
}
export interface BattlePresencePatchPlan extends PreparedPatchPlan {
    format: 'ki-battle-presence-ast-v1';
    status: BattlePresenceHookStatus;
    profile: 'complete' | 'store' | 'capacity';
}
const MARKER = '/*ki-battle-presence-ast:v1:';
const unavailable = (issue: string): BattlePresenceHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

/** Native store getters and capacity writes are discovered offline; compatible builds use prepared templates. */
export async function selectBattlePresencePlan(code: string, plans: readonly BattlePresencePatchPlan[]): Promise<BattlePresencePatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-battle-presence-ast-v1' && plan.profile === 'complete' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-battle-presence-ast-v1' || plan.profile !== 'complete' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        const status: BattlePresenceHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: MARKER + JSON.stringify(status) + '*/\n' });
        return { ...plan, sourceLength: code.length, sha256: '', status, edits };
    } catch { }
    return undefined;
}

/** Validate all native store and capacity hooks before applying any edit. */
export function patchBattlePresence(code: string, report?: (status: BattlePresenceHookStatus) => void, plan?: BattlePresencePatchPlan): string {
    const done = (result: string, status: BattlePresenceHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('battle-presence-mapping-unavailable'));
    if (plan.format !== 'ki-battle-presence-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('battle-presence-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
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
