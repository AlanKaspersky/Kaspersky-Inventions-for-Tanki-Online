/** Bridge between obfuscated game bonus models and extension modules. */
export const OVERDRIVE_BOX_MODEL = '1647333199409';
export const BONUS_PICKUP_MESSAGE = 'kasp:bonus-pickup';

export interface BonusPosition { x: number; y: number; z: number; }
export interface BonusPickup { model: string; position: BonusPosition | null; }

export function readBonusPosition(value: unknown): BonusPosition | null {
    if (!value || typeof value !== 'object') return null;
    try {
        const point = value as Record<string, unknown>;
        const coordinates = 'x' in point ? [point.x, point.y, point.z]
            : [point.f20_1, point.g20_1, point.h20_1];
        if (!coordinates.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))) return null;
        const [x, y, z] = coordinates as number[];
        return { x, y, z };
    } catch { return null; }
}

export interface BonusDiagnosticRecord {
    kind: string;
    [key: string]: unknown;
}

/** Bounded, detached snapshots: no resource meshes or live game references in the log. */
export function snapshotBonusArgument(value: unknown): unknown {
    const visited = new Set<object>();
    let budget = 120;
    function walk(current: unknown, depth: number): unknown {
        if (typeof current === 'string') return current.slice(0, 160);
        if (current === null || typeof current === 'number' || typeof current === 'boolean') return current;
        if (typeof current !== 'object') return `[${typeof current}]`;
        if (visited.has(current)) return '[cycle]';
        visited.add(current);
        const id = modelId(current);
        if (id) return { longId: id };
        if (depth >= 3 || budget-- <= 0) return '[depth/budget limit]';
        const result: Record<string, unknown> = {};
        try {
            const keys = Object.keys(current);
            for (const key of keys.slice(0, 12)) {
                try { result[key] = walk((current as Record<string, unknown>)[key], depth + 1); }
                catch { result[key] = '[inaccessible]'; }
            }
            if (keys.length > 12) result.__omittedFields = keys.length - 12;
        } catch { return '[inaccessible]'; }
        return result;
    }
    return walk(value, 0);
}

export function createBonusDiagnostics(
    output: (record: BonusDiagnosticRecord) => void,
    initiallyEnabled = false,
    now: () => number = Date.now,
) {
    let enabled = initiallyEnabled;
    const records: BonusDiagnosticRecord[] = [];
    return {
        record(record: BonusDiagnosticRecord): void {
            if (!enabled) return;
            try {
                const snapshot = { at: now(), ...record };
                records.push(snapshot);
                if (records.length > 200) records.shift();
                output(snapshot);
            } catch { /* Debugging must not interrupt the game. */ }
        },
        enable(value = true): void { enabled = value; },
        clear(): void { records.length = 0; },
        export(): string { return JSON.stringify(records, null, 2); },
    };
}

function modelId(value: unknown): string | null {
    if (!value || typeof value !== 'object') return null;
    try {
        const keys = Object.keys(value);
        if (keys.length !== 2) return null;
        const fields = keys.map(key => (value as Record<string, unknown>)[key]);
        if (!fields.every(field => typeof field === 'number')) return null;
        const id = String(value);
        return /^-?\d{4,20}$/.test(id) ? id : null;
    } catch { return null; }
}

function findModel(value: unknown, depth = 0, visited = new Set<object>()): string | null {
    if (!value || typeof value !== 'object' || depth > 3 || visited.has(value)) return null;
    visited.add(value);
    const direct = modelId(value);
    if (direct) return direct;
    try {
        for (const key of Object.keys(value).slice(0, 20)) {
            let child: unknown;
            try { child = (value as Record<string, unknown>)[key]; } catch { continue; }
            const found = findModel(child, depth + 1, visited);
            if (found) return found;
        }
    } catch { /* Game objects may contain inaccessible properties. */ }
    return null;
}

function bonusModels(value: unknown, excludedField?: string): Array<string | null> {
    if (!value || typeof value !== 'object') return [];
    const models: Array<string | null> = [];
    try {
        for (const key of Object.keys(value).slice(0, 8)) {
            if (key === excludedField) continue;
            let child: unknown;
            try { child = (value as Record<string, unknown>)[key]; } catch { continue; }
            if (child && typeof child === 'object') models.push(findModel(child));
        }
    } catch { /* Ignore incomplete bonus data. */ }
    return models;
}

export function createBonusPickupBridge(
    emit: (model: string, position?: BonusPosition | null) => void,
    diagnose?: (record: BonusDiagnosticRecord) => void,
    diagnosticEnabled: () => boolean = () => !!diagnose,
) {
    const soundModels = new Map<string, string | null>();
    const pending = new Map<unknown, Array<{ model: string | null }>>();
    function log(record: BonusDiagnosticRecord): void {
        try { diagnose?.(record); } catch { /* Keep the original game path alive. */ }
    }
    function resolve(data: unknown, excludedField?: string): string | null {
        const candidate = bonusModels(data, excludedField)[0] || (excludedField ? null : findModel(data));
        return candidate && (soundModels.has(candidate) ? soundModels.get(candidate) || null : candidate);
    }
    return {
        register(data: unknown, instanceId?: unknown, x?: unknown, y?: unknown, z?: unknown): void {
            const [box, sound] = bonusModels(data);
            if (box && sound) {
                if (!soundModels.has(sound)) soundModels.set(sound, box);
                else if (soundModels.get(sound) !== box) soundModels.set(sound, null);
            }
            if (diagnosticEnabled()) {
                const position = [x, y, z].every(value => typeof value === 'number' && Number.isFinite(value))
                    ? { x, y, z } : null;
                log({ kind: 'register', model: box, sound, instanceId: snapshotBonusArgument(instanceId), position,
                    coordinateArguments: position ? undefined : [x, y, z].map(snapshotBonusArgument) });
            }
        },
        pickup<T>(data: T): T {
            // Always return the exact input; the inserted expression must preserve game behavior.
            try {
                const box = resolve(data);
                log({ kind: 'pickup-model', model: box });
                if (box) emit(box);
            } catch { /* Extension failures must never interrupt a game pickup. */ }
            return data;
        },
        prepare(data: unknown, field: string): unknown {
            // Read the original first argument exactly once, before the caller evaluates the second.
            const sound = (data as Record<string, unknown>)[field];
            try {
                const entry = { model: resolve(data, field) };
                const entries = pending.get(sound) || [];
                entries.push(entry);
                pending.set(sound, entries);
                log({ kind: 'pickup-model', model: entry.model });
                // Aborted calls must not leak a model into a future, unrelated sound event.
                Promise.resolve().then(() => {
                    const stack = pending.get(sound);
                    if (!stack) return;
                    const index = stack.indexOf(entry);
                    if (index >= 0) stack.splice(index, 1);
                    if (!stack.length) pending.delete(sound);
                });
            } catch { /* Keep the original argument even if observation fails. */ }
            return sound;
        },
        context(first: unknown, second: unknown): void {
            try {
                const entries = pending.get(first);
                const entry = entries?.pop();
                if (entries && !entries.length) pending.delete(first);
                const model = entry?.model || null;
                const position = readBonusPosition(second);
                if (diagnosticEnabled()) log({
                    kind: 'pickup-context',
                    model,
                    position,
                    paired: !!entry,
                    argument1: snapshotBonusArgument(first),
                    argument2: snapshotBonusArgument(second),
                });
                if (model) emit(model, position);
            } catch { /* Optional observations must not affect sound playback. */ }
        },
    };
}

export function patchBonusPickups(code: string, report?: (record: BonusDiagnosticRecord) => void): string {
    let pickupHook = false;
    let contextHook = false;
    let registrationHooks = 0;
    const pickup = /[\w$]+\([\w$]+\)\.(\w+)=function\((\w+),(\w+)\)\{\w+\(this,this\.\w+,\2,\3,"bonus pickup"\)\}/.exec(code);
    if (pickup) {
        // Observe actual method arguments once, after the caller has evaluated them.
        const original = pickup[0];
        const openingEnd = original.indexOf('{') + 1;
        const observed = original.slice(0, openingEnd) +
            'try{window.__kaspBonusContext&&window.__kaspBonusContext(' + pickup[2] + ',' + pickup[3] + ')}catch(_kaspBonusError){};' +
            original.slice(openingEnd);
        code = code.replace(original, () => observed);
        contextHook = true;
        const call = new RegExp('\\.' + pickup[1] + '\\(([\\w$]+\\([\\w$]+\\))\\.([\\w$]+),');
        pickupHook = call.test(code);
        code = code.replace(call, '.' + pickup[1] + '(window.__kaspBonusPrepare($1,"$2"),');
    }
    // Match the registration constructor only when its body contains the collision handler.
    const registration = /([\w$]+\([\w$]+\)\.\w+=function\(([\w$]+),([\w$]+),([\w$]+),([\w$]+),([\w$]+),[\w$]+\)\{)(var \w+,\w+,\w+=this\.\w+\.\w+\(\);)/g;
    code = code.replace(registration, (match, opening: string, id: string, data: string, x: string, y: string, z: string, locals: string, offset: number) => {
        if (!code.slice(offset, offset + 900).includes('onBonusCollision')) return match;
        registrationHooks++;
        return opening + 'window.__kaspBonusRegister(' + [data, id, x, y, z].join(',') + ');' + locals;
    });
    try { report?.({ kind: 'hooks', pickupHook, contextHook, registrationHooks }); } catch { }
    return code;
}
