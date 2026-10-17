import { clientSourceHash, resolveTemplateEdits } from './clientPatches';
export const OVERDRIVE_BOX_MODEL = '1647333199409';
export const BONUS_PICKUP_MESSAGE = 'kasp:bonus-pickup';

export interface BonusPosition { x: number; y: number; z: number; }
export interface BonusPickup { model: string; position: BonusPosition | null; }

const vectorTypes = new WeakMap<object, { x: string; y: string; z: string }>();
const bonusTypes = new WeakMap<object, { box: string; pickupSound: string }>();

function ownValue(value: unknown, field: string): unknown {
    if (!value || typeof value !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function schemaFor<T>(value: object, registry: WeakMap<object, T>): T | undefined {
    for (let prototype = Object.getPrototypeOf(value), depth = 0; prototype && depth < 8; prototype = Object.getPrototypeOf(prototype), depth++) {
        const schema = registry.get(prototype);
        if (schema) return schema;
    }
    return undefined;
}

export function registerBonusType(prototype: unknown, kind: unknown, fields: unknown): boolean {
    if (!prototype || typeof prototype !== 'object' || !fields || typeof fields !== 'object') return false;
    const keys = kind === 'vector' ? ['x', 'y', 'z'] : kind === 'bonus' ? ['box', 'pickupSound'] : [];
    const names = keys.map(key => ownValue(fields, key));
    if (!keys.length || names.some(name => typeof name !== 'string' || !name || name.length > 128) || new Set(names).size !== names.length) return false;
    if (kind === 'vector') vectorTypes.set(prototype, { x: names[0] as string, y: names[1] as string, z: names[2] as string });
    else bonusTypes.set(prototype, { box: names[0] as string, pickupSound: names[1] as string });
    return true;
}

export function readBonusPosition(value: unknown): BonusPosition | null {
    if (!value || typeof value !== 'object') return null;
    try {
        const schema = schemaFor(value, vectorTypes);
        const coordinates = schema ? [schema.x, schema.y, schema.z].map(field => ownValue(value, field))
            : ['x', 'y', 'z'].map(field => ownValue(value, field));
        if (!coordinates.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))) return null;
        const [x, y, z] = coordinates as number[];
        return { x, y, z };
    } catch { return null; }
}

export interface BonusDiagnosticRecord {
    kind: string;
    [key: string]: unknown;
}

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
            } catch { }
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
        const fields = keys.map(key => ownValue(value, key));
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
            try { child = ownValue(value, key); } catch { continue; }
            const found = findModel(child, depth + 1, visited);
            if (found) return found;
        }
    } catch { }
    return null;
}

function bonusModels(value: unknown, excludedField?: string): Array<string | null> {
    if (!value || typeof value !== 'object') return [];
    try {
        const schema = schemaFor(value, bonusTypes);
        const box = ownValue(value, schema?.box || 'box') ?? (schema ? undefined : ownValue(value, 'model'));
        const soundField = schema?.pickupSound || 'sound';
        return [findModel(box), soundField === excludedField ? null : findModel(ownValue(value, soundField))];
    } catch { }
    return [];
}

export function createBonusPickupBridge(
    emit: (model: string, position?: BonusPosition | null) => void,
    diagnose?: (record: BonusDiagnosticRecord) => void,
    diagnosticEnabled: () => boolean = () => !!diagnose,
    observePreparation: (callback: () => void) => unknown = callback => callback(),
) {
    const soundModels = new Map<string, string | null>();
    const registrations = new WeakMap<object, { model: string; position: BonusPosition }>();
    const pending = new Map<unknown, Array<{ model: string | null; position: BonusPosition | null }>>();
    function log(record: BonusDiagnosticRecord): void {
        try { diagnose?.(record); } catch { }
    }
    function resolve(data: unknown, excludedField?: string): string | null {
        const models = bonusModels(data, excludedField);
        const candidate = models[0] || (excludedField ? null : modelId(data) || models[1]);
        return candidate && (soundModels.has(candidate) ? soundModels.get(candidate) || null : candidate);
    }
    return {
        register(data: unknown, instanceId?: unknown, x?: unknown, y?: unknown, z?: unknown, instance?: unknown): void {
            const [box, sound] = bonusModels(data);
            const position = readBonusPosition(x) || readBonusPosition({ x, y, z });
            if (instance && typeof instance === 'object') {
                registrations.delete(instance);
                if (box && position) registrations.set(instance, { model: box, position });
            }
            if (box && sound) {
                if (!soundModels.has(sound)) soundModels.set(sound, box);
                else if (soundModels.get(sound) !== box) soundModels.set(sound, null);
            }
            if (diagnosticEnabled()) {
                log({
                    kind: 'register', model: box, sound, instanceId: snapshotBonusArgument(instanceId), position,
                    coordinateArguments: position ? undefined : [x, y, z].map(snapshotBonusArgument)
                });
            }
        },
        pickup<T>(data: T): T {
            try {
                const box = resolve(data);
                log({ kind: 'pickup-model', model: box });
                if (box) emit(box);
            } catch { }
            return data;
        },
        prepare(data: unknown, field: string, instance?: unknown): unknown {
            const sound = (data as Record<string, unknown>)[field];
            observePreparation(() => {
            try {
                const model = resolve(data, field);
                const registration = instance && typeof instance === 'object' ? registrations.get(instance) : null;
                const entry = { model, position: registration?.model === model ? registration.position : null };
                const entries = pending.get(sound) || [];
                entries.push(entry);
                pending.set(sound, entries);
                log({ kind: 'pickup-model', model: entry.model });
                Promise.resolve().then(() => {
                    const stack = pending.get(sound);
                    if (!stack) return;
                    const index = stack.indexOf(entry);
                    if (index >= 0) stack.splice(index, 1);
                    if (!stack.length) pending.delete(sound);
                });
            } catch { }
            });
            return sound;
        },
        context(first: unknown, second: unknown): void {
            try {
                const entries = pending.get(first);
                const entry = entries?.pop();
                if (entries && !entries.length) pending.delete(first);
                const model = entry?.model || null;
                const pickupPosition = readBonusPosition(second);
                const position = entry?.position || pickupPosition;
                if (diagnosticEnabled()) log({
                    kind: 'pickup-context',
                    model,
                    position,
                    pickupPosition,
                    positionSource: entry?.position ? 'registration' : 'pickup',
                    paired: !!entry,
                    argument1: snapshotBonusArgument(first),
                    argument2: snapshotBonusArgument(second),
                });
                if (model) emit(model, position);
            } catch { }
        },
    };
}

export interface BonusHookStatus extends BonusDiagnosticRecord {
    kind: 'hooks';
    strategy: 'ast-plan' | 'ast-template';
    pickupHook: boolean;
    pickupCalls: number;
    contextHook: boolean;
    registrationHooks: number;
    issues: string[];
    schemaIssues: string[];
    ready: boolean;
}
export interface BonusPatchPlan {
    format: 'ki-overdrive-ast-v1';
    sha256: string;
    sourceLength: number;
    status: BonusHookStatus;
    edits: Array<{ start: number; end: number; expected: string; text: string; before: string; after: string }>;
    templates?: Array<{
        pattern: string;
        roles: Partial<Record<'vectorX' | 'vectorY' | 'vectorZ' | 'box' | 'sound' | 'pickup' | 'manager', string>>;
        count: number;
        edits: Array<{ start: string; end: string; parts: Array<string | { capture: string; quoted: boolean }> }>;
    }>;
}

const PATCH_MARKER = '/*ki-overdrive-ast:v1:';
const unavailable = (issue: string): BonusHookStatus => ({ kind: 'hooks', strategy: 'ast-plan', pickupHook: false,
    pickupCalls: 0, contextHook: false, registrationHooks: 0, issues: [issue], schemaIssues: [], ready: false });

function adaptBonusPatchPlan(code: string, plan: BonusPatchPlan): BonusPatchPlan | undefined {
    if (!plan.status.ready) return undefined;
    const adapted = resolveTemplateEdits(code, plan);
    if (!adapted || new Set(['vectorX', 'vectorY', 'vectorZ'].map(role => adapted.roles.get(role))).size !== 3 ||
        adapted.roles.get('box') === adapted.roles.get('sound')) return undefined;
    const status: BonusHookStatus = { ...plan.status, strategy: 'ast-template' };
    const edits = adapted.edits;
    edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: `${PATCH_MARKER}${JSON.stringify(status)}*/\n` });
    return { ...plan, sourceLength: code.length, sha256: '', status, edits };
}

export async function selectBonusPatchPlan(code: string, plans: readonly BonusPatchPlan[]): Promise<BonusPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-overdrive-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const sha256 = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === sha256);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-overdrive-ast-v1') continue;
        const adapted = adaptBonusPatchPlan(code, plan);
        if (adapted) return adapted;
    } catch { }
    return undefined;
}

export function patchBonusPickups(code: string, report?: (record: BonusDiagnosticRecord) => void, plan?: BonusPatchPlan): string {
    const done = (result: string, status: BonusHookStatus) => { try { report?.(status); } catch {} return result; };
    if (!plan) return done(code, unavailable('bundle-mapping-missing'));
    if (code.includes(PATCH_MARKER)) return done(code, plan.status);
    if (plan.format !== 'ki-overdrive-ast-v1' || plan.sourceLength !== code.length) return done(code, unavailable('bundle-mapping-mismatch'));
    let previousEnd = 0;
    for (const edit of plan.edits) {
        if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < previousEnd || edit.end < edit.start || edit.end > code.length ||
            code.slice(edit.start, edit.end) !== edit.expected || code.slice(Math.max(0, edit.start - 24), edit.start) !== edit.before ||
            code.slice(edit.end, edit.end + 24) !== edit.after) return done(code, unavailable('bundle-edit-mismatch'));
        previousEnd = edit.end;
    }
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}
