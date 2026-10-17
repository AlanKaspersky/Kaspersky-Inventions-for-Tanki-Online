import { clientPatchHeader, clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';
import { createNativeFeature } from './nativeFeature';
import { knownCriticalDevice } from './criticalDevices';
import type { CriticalDevice } from './criticalDevices';

export interface CriticalHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
    juggernautHook?: boolean;
}
export interface CriticalPatchPlan extends PreparedPatchPlan {
    format: 'ki-critical-ast-v1';
    status: CriticalHookStatus;
    schema: CriticalSchema;
}
export type CriticalSchema = Record<string, string>;
const MARKER = '/*ki-critical-ast:v1:';
const unavailable = (issue: string): CriticalHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

function criticalHeader(code: string, schema: CriticalSchema, status: CriticalHookStatus): string {
    return clientPatchHeader(code, MARKER, status, 'try{window.__kaspCriticalBridge.configure(' + JSON.stringify(schema) + ')}catch(__kaspCriticalIgnored){}');
}

export async function selectCriticalPlan(code: string, plans: readonly CriticalPatchPlan[]): Promise<CriticalPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-critical-ast-v1' && plan.status.ready && plan.status.juggernautHook && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-critical-ast-v1' || !plan.status.ready || !plan.status.juggernautHook) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        const schema: CriticalSchema = {};
        let valid = true;
        for (const key of Object.keys(plan.schema)) {
            const value = adapted.roles.get(key);
            if (!value || !/^[$A-Z_a-z][$\w]*$/.test(value)) { valid = false; break; }
            schema[key] = value;
        }
        if (!valid || !['weaponField', 'deviceField', 'materialField', 'foregroundField'].every(key => schema[key])) continue;
        const status: CriticalHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: criticalHeader(code, schema, status) });
        return { ...plan, sourceLength: code.length, sha256: '', schema, status, edits };
    } catch { }
    return undefined;
}

export function patchCriticalIndicator(code: string, report?: (status: CriticalHookStatus) => void, plan?: CriticalPatchPlan): string {
    const done = (result: string, status: CriticalHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('critical-mapping-unavailable'));
    if (plan.format !== 'ki-critical-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!plan.status.juggernautHook) return done(code, unavailable('critical-vehicle-mapping-unavailable'));
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('critical-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}

export interface CriticalSample {
    attached: boolean;
    stateEvents: number;
    weapon: 'Smoky' | 'Thunder' | 'Hammer' | null;
    weaponId: string | null;
    deviceId: string | null;
    deviceName: string | null;
    ready: boolean | null;
    painted: boolean;
    updates: number;
    frames: number;
    reason: string;
    error: string | null;
    shotEvents: number;
    hitEvents: number;
    lifeEvents: number;
    source: 'server' | 'device-cycle' | 'supercharge' | null;
    supercharge: boolean;
    juggernaut: boolean;
    awaitingPostSuperchargeCritical: boolean;
    postSuperchargeShots: number;
}
export interface CriticalBridge {
    configure(schema: CriticalSchema): void;
    ready(actor: unknown, entity: unknown, ready: unknown): void;
    reset(actor: unknown, entity: unknown): void;
    equipment(entity: unknown, info: unknown): void;
    attach(owner: unknown, bar: unknown, red: unknown): void;
    frame(owner: unknown, entity: unknown): void;
    detach(owner: unknown): void;
    eventType(prototype: object, kind: 'shot' | 'life', field: string): void;
    event(entity: unknown, value: unknown): void;
    damage(entity: unknown, collection: unknown, kind: unknown): void;
    supercharge(entity: unknown, active: unknown): void;
    juggernaut(entity: unknown, active: unknown): void;
}
type DeviceIdentity = { id: string; name?: string; baseItemId?: string; properties?: CriticalDevice['properties'] };
const object = (value: unknown): value is object => !!value && typeof value === 'object';
const ownValue = (value: unknown, key: string | undefined): unknown => object(value) && key ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
const identity = (value: unknown): string | null => {
    if (value == null) return null;
    try { const id = String(value); return /^\d{1,20}$/.test(id) && id !== '0' ? id : null; } catch { return null; }
};
function supportedDevice(name?: string): CriticalSample['weapon'] {
    const text = name?.trim().toLowerCase().replace(/ё/g, 'е');
    if (text === 'sorted ammunition' || text === 'упорядоченная боеукладка') return 'Smoky';
    if (text === 'strict ammunition load' || text === 'строгая погрузка боеприпасов') return 'Thunder';
    if (text === 'revolver' || text === 'револьвер') return 'Hammer';
    return null;
}

function cycleProfile(device: DeviceIdentity | null) {
    const value = (key: string) => {
        const entries = device?.properties?.filter(p => p.property === key && p.operation === 'OVERRIDE_VALUE');
        return entries?.length === 1 ? entries[0].value : NaN;
    };
    const start = value('START_CRITICAL_HIT_CHANCE'), after = value('AFTER_CRIT_CRITICAL_HIT_CHANCE');
    const max = value('MAX_CRITICAL_HIT_CHANCE'), delta = value('CRITICAL_CHANCE_DELTA');
    return max === 1 && delta > 0 && delta <= 1 && Number.isFinite(start) && start >= -20 && start <= 1 &&
        Number.isFinite(after) && after >= -20 && after <= 0 ? { start, after, delta, max } : null;
}

export function createCriticalIndicator(resolveDevice: (id: string) => DeviceIdentity | null) {
    let schema: CriticalSchema | null = null;
    let actors = new WeakMap<object, { actor: object; ready: boolean; updates: number }>();
    const equipment = new WeakMap<object, { weaponId: string | null; deviceId: string | null }>();
    type Bar = { material: object; original: unknown; red: unknown; painted: boolean };
    const bars = new Map<object, Bar>();
    const events = new WeakMap<object, { kind: 'shot' | 'life'; field: string }>();
    let cycles = new WeakMap<object, { state: string; spawned: boolean; chance: number | null }>();
    let charged = new WeakSet<object>();
    const juggernauts = new WeakSet<object>();
    let recovering = new WeakSet<object>();
    type PostSupercharge = { shots: number; initialized: boolean; normalSeen: boolean; criticalShot: number | null };
    let postSupercharge = new WeakMap<object, PostSupercharge>();
    let shotEvents = 0, hitEvents = 0, lifeEvents = 0;
    let stateEvents = 0;
    type FrameSample = Omit<CriticalSample, 'attached' | 'stateEvents' | 'shotEvents' | 'hitEvents' | 'lifeEvents'>;
    let sample: FrameSample = { weapon: null, weaponId: null, deviceId: null, deviceName: null,
        ready: null, painted: false, updates: 0, frames: 0, reason: 'pending-local-hud', error: null, source: null, supercharge: false,
        awaitingPostSuperchargeCritical: false, postSuperchargeShots: 0, juggernaut: false };
    const deviceFor = (entity: object) => {
        if (juggernauts.has(entity)) return null;
        const item = equipment.get(entity);
        const device = item?.deviceId ? resolveDevice(item.deviceId) ?? knownCriticalDevice(item.deviceId) : null;
        return device && device.id === item?.deviceId && (!device.baseItemId || device.baseItemId === item.weaponId) ? device : null;
    };
    const preparedCycle = (entity: object) => {
        const device = deviceFor(entity), profile = cycleProfile(device);
        let cycle = cycles.get(entity);
        const post = postSupercharge.get(entity), weapon = supportedDevice(device?.name);
        if (post && !post.initialized && profile && weapon && post.shots <= 256) {
            cycle ??= { state: 'ACTIVE', spawned: false, chance: null };
            cycle.chance = profile.after - profile.delta;
            for (let i = 0; i < post.shots; i++) {
                if (cycle.chance >= profile.max) post.criticalShot = i + 1;
                cycle.chance = cycle.chance >= profile.max ? profile.after : Math.min(profile.max, cycle.chance + profile.delta);
            }
            cycle.spawned = false; cycles.set(entity, cycle); post.initialized = true;
            recovering.delete(entity);
        }
        if (cycle && profile && cycle.spawned && cycle.chance === null) cycle.chance = profile.start;
        return { device, profile, cycle };
    };
    const paint = (bar: Bar, ready: boolean) => {
        if (!schema) return;
        const descriptor = Object.getOwnPropertyDescriptor(bar.material, schema.foregroundField);
        if (!descriptor || !('value' in descriptor) || !descriptor.writable) throw Error('Native reload color is unavailable.');
        if (descriptor.value !== bar.red && descriptor.value !== bar.original) bar.original = descriptor.value;
        const color = ready ? bar.red : bar.original;
        if (descriptor.value !== color) (bar.material as Record<string, unknown>)[schema.foregroundField] = color;
        bar.painted = ready;
    };
    const bridge: CriticalBridge = {
        configure(value) {
            if (!['weaponField', 'deviceField', 'materialField', 'foregroundField']
                .every(key => typeof value?.[key] === 'string' && /^[$A-Z_a-z][$\w]*$/.test(value[key]))) return;
            for (const bar of bars.values()) try { paint(bar, false); } catch { }
            bars.clear(); schema = { ...value };
        },
        ready(actor, entity, value) {
            if (!schema || !object(actor) || !object(entity) || typeof value !== 'boolean') return;
            if (juggernauts.has(entity)) return;
            stateEvents++;
            recovering.delete(entity);
            postSupercharge.delete(entity);
            const old = actors.get(entity);
            actors.set(entity, { actor, ready: value, updates: (old?.actor === actor ? old.updates : 0) + 1 });
        },
        reset(_actor, entity) {
            if (object(entity)) { actors.delete(entity); cycles.delete(entity); charged.delete(entity); recovering.delete(entity); postSupercharge.delete(entity); }
        },
        equipment(entity, info) {
            if (!schema || !object(entity)) return;
            const next = { weaponId: identity(ownValue(info, schema.weaponField)), deviceId: identity(ownValue(info, schema.deviceField)) };
            const old = equipment.get(entity);
            if (old && (old.weaponId !== next.weaponId || old.deviceId !== next.deviceId)) {
                actors.delete(entity); cycles.delete(entity);
                recovering.delete(entity);
                postSupercharge.delete(entity);
            }
            equipment.set(entity, next);
        },
        attach(owner, mesh, red) {
            if (!schema || !object(owner)) return;
            bridge.detach(owner);
            const material = ownValue(mesh, schema.materialField), original = ownValue(material, schema.foregroundField);
            if (!object(material) || !object(original) || !object(red)) {
                sample = { ...sample, reason: 'native-material-unavailable', error: 'Native reload material or color is missing.' };
                return;
            }
            bars.set(owner, { material, original, red, painted: false });
        },
        frame(owner, entity) {
            if (!schema || !object(owner)) return;
            const bar = bars.get(owner); if (!bar) return;
            const next: FrameSample = { weapon: null, weaponId: null, deviceId: null, deviceName: null, ready: null,
                painted: false, updates: 0, frames: sample.frames + 1, reason: 'no-local-tank', error: null, source: null, supercharge: false,
                awaitingPostSuperchargeCritical: false, postSuperchargeShots: 0, juggernaut: false };
            try {
                if (object(entity)) {
                    const item = equipment.get(entity), state = actors.get(entity);
                    next.weaponId = item?.weaponId ?? null; next.deviceId = item?.deviceId ?? null;
                    const resolved = next.deviceId ? resolveDevice(next.deviceId) ?? knownCriticalDevice(next.deviceId) : null;
                    const device = resolved?.id === next.deviceId ? resolved : null;
                    next.deviceName = device?.name ?? null;
                    next.juggernaut = juggernauts.has(entity);
                    if (!next.juggernaut && device && (!device.baseItemId || device.baseItemId === next.weaponId)) next.weapon = supportedDevice(device.name);
                    const ready = state?.ready;
                    const { profile, cycle } = preparedCycle(entity);
                    next.supercharge = charged.has(entity);
                    const post = postSupercharge.get(entity);
                    next.awaitingPostSuperchargeCritical = !!post;
                    next.postSuperchargeShots = post?.shots ?? 0;
                    next.updates = state?.updates ?? 0;
                    if (cycle && cycle.state !== 'ACTIVE') next.reason = 'tank-not-active';
                    else if (next.supercharge) { next.ready = true; next.source = 'supercharge'; next.reason = 'supercharge-active'; }
                    else if (next.juggernaut) next.reason = 'juggernaut-weapon';
                    else if (!item) next.reason = 'waiting-equipment';
                    else if (!device) next.reason = 'waiting-device-metadata';
                    else if (!next.weapon) next.reason = 'unsupported-device';
                    else if (typeof ready === 'boolean') { next.ready = ready; next.source = 'server'; next.reason = ready ? 'critical-ready' : 'normal-shot'; }
                    else if (profile && cycle?.chance !== null && cycle?.chance !== undefined) {
                        next.ready = cycle.chance >= profile.max; next.source = 'device-cycle';
                        next.reason = next.ready ? 'critical-ready' : 'normal-shot';
                    } else next.reason = 'waiting-spawn-or-confirmed-critical';
                }
                paint(bar, next.ready === true); next.painted = bar.painted;
            } catch (error) {
                try { paint(bar, false); } catch { }
                next.error = String(error); next.reason = 'native-color-error';
            }
            sample = next;
        },
        detach(owner) {
            if (!object(owner)) return;
            const bar = bars.get(owner);
            if (bar) { try { paint(bar, false); } catch { } bars.delete(owner); }
            if (!bars.size) sample = { ...sample, weapon: null, deviceId: null, deviceName: null, weaponId: null, ready: null, painted: false, supercharge: false,
                awaitingPostSuperchargeCritical: false, postSuperchargeShots: 0, juggernaut: false, reason: 'hud-detached' };
        },
        eventType(prototype, kind, field) {
            if (object(prototype) && (kind === 'shot' || kind === 'life')) events.set(prototype, { kind, field });
        },
        event(entity, value) {
            if (!object(entity) || !object(value)) return;
            const type = events.get(Object.getPrototypeOf(value)); if (!type) return;
            if (type.kind === 'life') {
                const state = String(ownValue(value, type.field));
                if (!['DEAD', 'DEAD_PHANTOM', 'SEMI_ACTIVE', 'ACTIVE', 'DISABLED', 'TELEPORT'].includes(state)) return;
                lifeEvents++;
                const old = cycles.get(entity);
                if (state === 'SEMI_ACTIVE' && old?.state !== state) {
                    charged.delete(entity); recovering.delete(entity);
                    postSupercharge.delete(entity);
                    actors.delete(entity); cycles.set(entity, { state, spawned: true, chance: null });
                } else if (state === 'DEAD' || state === 'DEAD_PHANTOM') {
                    charged.delete(entity); recovering.delete(entity);
                    postSupercharge.delete(entity);
                    actors.delete(entity); cycles.set(entity, { state, spawned: false, chance: null });
                } else if (old) old.state = state;
                else cycles.set(entity, { state, spawned: false, chance: null });
                return;
            }
            shotEvents++;
            if (juggernauts.has(entity)) return;
            const { device, profile, cycle } = preparedCycle(entity);
            if (charged.has(entity)) {
                actors.delete(entity);
                recovering.add(entity);
                if (cycle) { cycle.chance = null; cycle.spawned = false; }
                return;
            }
            const post = postSupercharge.get(entity);
            if (post && (!cycle || cycle.state === 'ACTIVE')) {
                post.shots++;
                if (profile && cycle?.chance !== null && cycle?.chance !== undefined && cycle.chance >= profile.max) post.criticalShot = post.shots;
            }
            if (!supportedDevice(device?.name) || !profile || !cycle || cycle.chance === null || cycle.state !== 'ACTIVE') return;
            const critical = cycle.chance >= profile.max;
            cycle.chance = critical ? profile.after : Math.min(profile.max, cycle.chance + profile.delta);
            actors.delete(entity);
        },
        damage(entity, collection, kind) {
            if (!schema || !object(entity) || !object(collection)) return;
            const { device, profile } = preparedCycle(entity), weapon = supportedDevice(device?.name);
            if (!profile || !weapon || charged.has(entity)) return;
            const native = collection as Record<string, unknown>;
            const size = native[schema.damageSize], item = native[schema.damageItem];
            if (typeof size !== 'function' || typeof item !== 'function') return;
            const length: unknown = size.call(collection);
            if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0 || length > 128) return;
            let critical = false, normal = false;
            for (let i = 0; i < length; i++) {
                const hit: unknown = item.call(collection, i);
                if (ownValue(hit, schema.damageKind) !== kind) continue;
                const flag = ownValue(hit, schema.damageCritical);
                if (flag === true) critical = true; else if (flag === false) normal = true;
            }
            if (!critical && !normal) return;
            hitEvents++;
            const post = postSupercharge.get(entity);
            if (post && weapon) {
                if (normal && !critical) {
                    post.normalSeen = true;
                    if (post.criticalShot === post.shots) post.criticalShot = null;
                    return;
                }
                if (!critical || normal || !post.shots || (!post.normalSeen && post.criticalShot === null)) return;
                const cycle = cycles.get(entity);
                if (!cycle || cycle.state !== 'ACTIVE') return;
                const laterShots = post.criticalShot === null ? 0 : post.shots - post.criticalShot;
                if (laterShots > 256) return;
                cycle.chance = profile.after;
                for (let i = 0; i < laterShots; i++) cycle.chance = cycle.chance >= profile.max ? profile.after : Math.min(profile.max, cycle.chance + profile.delta);
                cycle.spawned = false; postSupercharge.delete(entity); recovering.delete(entity); actors.delete(entity);
                return;
            }
            if (recovering.has(entity)) {
                if (normal && !critical) recovering.delete(entity);
                return;
            }
            const cycle = cycles.get(entity) ?? { state: 'ACTIVE', spawned: false, chance: null };
            if (cycle.state !== 'ACTIVE') return;
            if (cycle.chance !== null) return;
            if (critical && normal) { cycle.chance = null; cycle.spawned = false; }
            else if (critical) { cycle.chance = profile.after; cycle.spawned = false; }
            else if (cycle.chance !== null) cycle.chance = Math.min(profile.max, cycle.chance + profile.delta);
            cycles.set(entity, cycle); actors.delete(entity);
        },
        supercharge(entity, active) {
            if (!object(entity) || typeof active !== 'boolean') return;
            if (active) { charged.add(entity); postSupercharge.delete(entity); }
            else {
                const ended = charged.delete(entity);
                if (ended) {
                    actors.delete(entity);
                    const device = deviceFor(entity), weapon = supportedDevice(device?.name);
                    if (!juggernauts.has(entity) && (!device || weapon)) {
                        postSupercharge.set(entity, { shots: 0, initialized: false, normalSeen: false, criticalShot: null });
                        preparedCycle(entity);
                    }
                }
            }
        },
        juggernaut(entity, active) {
            if (!object(entity) || typeof active !== 'boolean' || juggernauts.has(entity) === active) return;
            if (active) juggernauts.add(entity); else juggernauts.delete(entity);
            actors.delete(entity);
            const lifecycle = cycles.get(entity)?.state;
            if (lifecycle) cycles.set(entity, { state: lifecycle, spawned: !active && lifecycle === 'SEMI_ACTIVE', chance: null });
            else cycles.delete(entity);
            recovering.delete(entity); postSupercharge.delete(entity);
        },
    };
    return { bridge, suspend() {
        for (const bar of bars.values()) try { paint(bar, false); } catch { }
        actors = new WeakMap(); cycles = new WeakMap(); charged = new WeakSet(); recovering = new WeakSet(); postSupercharge = new WeakMap();
        sample = { ...sample, painted: false, ready: null, source: null, reason: 'disabled' };
    }, status: (): CriticalSample => ({ ...sample, attached: bars.size > 0, stateEvents, shotEvents, hitEvents, lifeEvents }) };
}

export function installCriticalIndicator(target: Window): void {
    const engine = createCriticalIndicator(id => target.__kaspAugmentsDebug?.device?.(id) ?? null);
    const control = createNativeFeature(target, 'criticalIndicator', 'k_critical_indicator');
    control.track(engine, engine.suspend);
    let mapping: CriticalHookStatus | null = null;
    target.__kaspCriticalBridge = Object.fromEntries(Object.entries(engine.bridge).map(([key, method]) => [key,
        (...args: unknown[]) => {
            if (!control.active() && !['configure', 'attach', 'detach', 'equipment', 'eventType', 'juggernaut'].includes(key)) return;
            if (key === 'detach') { try { return (method as (...args: unknown[]) => unknown)(...args); } catch { return; } }
            return control.observe(() => {
                const result = (method as (...args: unknown[]) => unknown)(...args);
                if (key === 'frame' && engine.status().error) throw Error(engine.status().error!);
                return result;
            });
        }])) as unknown as CriticalBridge;
    target.__kaspCriticalDebug = {
        status: () => ({ ...engine.status(), mapping: mapping && { ...mapping, issues: [...mapping.issues] }, runtime: control.status() }),
        reportHook: value => { mapping = { ...value, issues: [...value.issues] }; },
    };
}

