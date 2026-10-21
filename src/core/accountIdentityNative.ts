import type { BattlePresenceHookStatus } from './battlePresence';
import { ACCOUNT_IDENTITY_MESSAGE, ACCOUNT_IDENTITY_REQUEST, normalizeAccountId } from './accountId';
import type { AccountSnapshot, VerifiedAccount } from './accountId';
import { featureScope } from './featureRuntime';
import { postPageMessage, readPageMessage } from './pageMessages';
export { normalizeAccountId } from './accountId';

interface IdentityModel {
    path: string;
    model: string;
    fields: Record<string, string>;
}

function methodSource(value: object): string {
    for (let prototype: object | null = value, depth = 0; prototype && depth < 5; depth++, prototype = Object.getPrototypeOf(prototype)) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'toString');
        if (!descriptor) continue;
        return typeof descriptor.value === 'function' ? Function.prototype.toString.call(descriptor.value) : '';
    }
    return '';
}

type NativeSchema = { model: string; fields: Map<string, string> };
const nativeSchemas = new Map<string, NativeSchema>();
const prototypeSchemas = new WeakMap<object, NativeSchema>();
function nativeSchema(value: object) {
    // Generated model prototypes are stable throughout this game bundle.
    const prototype = Object.getPrototypeOf(value) as object | null;
    const ownMethod = Object.getOwnPropertyDescriptor(value, 'toString');
    const cached = !ownMethod && prototype ? prototypeSchemas.get(prototype) : undefined;
    if (cached) return cached;
    const source = methodSource(value);
    let schema = nativeSchemas.get(source);
    if (!schema) {
        const fields = new Map<string, string>();
        for (const match of source.matchAll(/\b([A-Za-z][\w]*)=.{0,35}?this\.([\w$]+)/g)) fields.set(match[1], match[2]);
        schema = { model: /["']([A-Za-z][\w$]*)\(/.exec(source)?.[1] || '', fields };
        if (nativeSchemas.size >= 512) nativeSchemas.clear();
        nativeSchemas.set(source, schema);
    }
    if (!ownMethod && prototype) prototypeSchemas.set(prototype, schema);
    return schema;
}
function nativeField(value: object, label: string, schema = nativeSchema(value)): unknown {
    const key = schema.fields.get(label);
    return key ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
}

interface NativeBinding { value: object; path: string[]; schema: NativeSchema }
// TOState.user is the authoritative local owner. Inspect only the store's direct
// slots, yielding between them; unrelated services and remote users are not traversed.
function* directUser(store: object, error: (cause: unknown) => void): Generator<void, NativeBinding | null> {
    const states: NativeBinding[] = [], seen = new Set<object>();
    const inspect = (value: object, path: string[]) => {
        if (seen.has(value)) return;
        seen.add(value);
        try {
            const schema = nativeSchema(value);
            if (schema.model === 'TOState') states.push({ value, path, schema });
        } catch (cause) { error(cause); }
    };
    yield;
    inspect(store, []);
    if (!states.length) {
        let keys: string[];
        try { keys = Object.getOwnPropertyNames(store); } catch (cause) { error(cause); return null; }
        if (keys.length > 32) return null;
        for (const key of keys) {
            yield;
            try {
                const value = Object.getOwnPropertyDescriptor(store, key)?.value;
                if (value && typeof value === 'object') inspect(value, [key]);
            } catch (cause) { error(cause); }
        }
    }
    if (states.length !== 1) return null;
    const state = states[0], key = state.schema.fields.get('user');
    if (!key) return null;
    try {
        const value = Object.getOwnPropertyDescriptor(state.value, key)?.value;
        if (!value || typeof value !== 'object') return null;
        const schema = nativeSchema(value);
        return schema.model === 'User' ? { value, path: [...state.path, key], schema } : null;
    } catch (cause) { error(cause); return null; }
}
function resolvePath(root: object, path: readonly string[]): object | null {
    let value: unknown = root;
    for (const key of path) {
        if (!value || typeof value !== 'object') return null;
        value = Object.getOwnPropertyDescriptor(value, key)?.value;
    }
    return value && typeof value === 'object' ? value : null;
}

// Yield between properties as well as models: a wide container must not consume a whole frame.
function* visitModels(root: object, depthLimit: number, budget: number,
    visit: (binding: NativeBinding) => boolean, error: (cause: unknown) => void): Generator<void> {
    const queue: Array<{ value: object; path: string[] }> = [{ value: root, path: [] }];
    const seen = new Set<object>();
    for (let head = 0; head < queue.length && seen.size < budget; head++) {
        yield;
        const { value, path } = queue[head];
        if (seen.has(value)) continue;
        seen.add(value);
        try {
            if (typeof Node !== 'undefined' && value instanceof Node) continue;
            if (!visit({ value, path, schema: nativeSchema(value) }) || path.length >= depthLimit) continue;
            const keys = Object.getOwnPropertyNames(value);
            for (let index = 0; index < keys.length && index < budget * 2 && queue.length < budget * 2; index++) {
                yield;
                const key = keys[index];
                try {
                    const child = Object.getOwnPropertyDescriptor(value, key)?.value;
                    if (child && typeof child === 'object') queue.push({ value: child, path: [...path, key] });
                } catch (cause) { error(cause); }
            }
        } catch (cause) { error(cause); }
    }
}

export function createNativeAccountReader(store: object) {
    let users: NativeBinding[] = [], remote: NativeBinding[] = [];
    let localJob: Generator<void> | null = null, remoteJob: Generator<void> | null = null;
    let account: VerifiedAccount | null = null, players: AccountSnapshot['players'] = [];
    let nextDiscovery = 0, nextAccountDiscovery = 0, nextPlayers = 0, slices = 0, lastError: string | null = null;
    let invalidPath = false, publishPending = false, direct = false;
    const error = (cause: unknown) => { lastError = String(cause); };
    const discover = () => {
        const foundUsers: NativeBinding[] = [], foundRemote: NativeBinding[] = [];
        localJob = (function* () {
            const owner = yield* directUser(store, error);
            if (owner) {
                users = [owner]; invalidPath = false; direct = true; publishPending = true;
                yield;
            }
            yield* visitModels(store, 4, 4000, binding => {
                if (binding.schema.model === 'User') { foundUsers.push(binding); return false; }
                if (binding.schema.model === 'RemoteUserDataStorage') { foundRemote.push(binding); return false; }
                return binding.schema.model !== 'RemoteUserData';
            }, error);
            users = owner ? [owner] : foundUsers; remote = foundRemote; direct = owner !== null;
            invalidPath = false;
            nextAccountDiscovery = Date.now() + 1000;
            nextDiscovery = Date.now() + 5000;
        })();
        nextAccountDiscovery = Date.now() + 1000;
        nextDiscovery = Date.now() + 5000;
    };
    const snapshot = (): AccountSnapshot => {
        const accounts: VerifiedAccount[] = [];
        for (const binding of users) try {
            if (resolvePath(store, binding.path) !== binding.value) { invalidPath = true; continue; }
            const field = (label: string) => nativeField(binding.value, label, binding.schema);
            if (field('isUserPropertiesLoaded') !== true) continue;
            const userId = normalizeAccountId(field('id')), nickname = field('uid'), clanTag = field('clanTag');
            if (userId && typeof nickname === 'string' && nickname.trim()) {
                accounts.push({ userId, nickname, clanTag: typeof clanTag === 'string' ? clanTag : '' });
            }
        } catch (cause) { invalidPath = true; error(cause); }
        const next = !invalidPath && accounts.length === 1 ? accounts[0] : null;
        if (next?.userId !== account?.userId) { players = []; remoteJob = null; nextPlayers = 0; }
        account = next;
        return { account, players: account ? players : [] };
    };
    const refresh = () => {
        snapshot();
        if (!localJob && ((invalidPath || !users.length) && Date.now() >= nextAccountDiscovery
            || account && !remote.length && Date.now() >= nextDiscovery)) discover();
        // Remote nicknames/IDs are secondary; never delay the local account for them.
        if (!account || localJob || remoteJob || Date.now() < nextPlayers) return;
        const binding = remote[0];
        if (!binding) return;
        nextPlayers = Date.now() + 5000;
        try {
            if (resolvePath(store, binding.path) !== binding.value) { remote = []; players = []; nextPlayers = 0; return; }
            const root = nativeField(binding.value, 'userIdToData', binding.schema);
            if (!root || typeof root !== 'object') { players = []; return; }
            const found = new Map<string, string>(), owner = account.userId;
            remoteJob = (function* () {
                yield* visitModels(root, 5, 6000, item => {
                    if (item.schema.model !== 'RemoteUserData') return true;
                    const userId = normalizeAccountId(nativeField(item.value, 'userId', item.schema));
                    const nickname = nativeField(item.value, 'uid', item.schema);
                    if (userId && typeof nickname === 'string' && nickname.trim()) found.set(userId, nickname);
                    return false;
                }, error);
                if (snapshot().account?.userId === owner && resolvePath(store, binding.path) === binding.value
                    && nativeField(binding.value, 'userIdToData', binding.schema) === root) {
                    players = [...found].map(([userId, nickname]) => ({ userId, nickname }));
                    nextPlayers = Date.now() + 5000;
                } else { players = []; nextPlayers = 0; }
            })();
        } catch (cause) { error(cause); }
    };
    discover();
    return {
        refresh, snapshot,
        pending: () => localJob !== null || remoteJob !== null,
        step(): boolean {
            const job = localJob || remoteJob;
            if (!job) return false;
            const start = performance.now();
            slices++;
            try {
                for (let operations = 0; operations < 64; operations++) {
                    const result = job.next();
                    if (publishPending) { publishPending = false; return true; }
                    if (result.done) {
                        if (localJob === job) localJob = null;
                        if (remoteJob === job) remoteJob = null;
                        refresh();
                        return true;
                    }
                    if (performance.now() - start >= 2) break;
                }
            } catch (cause) {
                error(cause);
                if (localJob === job) localJob = null;
                if (remoteJob === job) remoteJob = null;
                return true;
            }
            return false;
        },
        status: () => ({ pending: localJob ? 'account' : remoteJob ? 'players' : null, direct, slices, lastError,
            userPaths: users.map(binding => binding.path.join('.')) }),
    };
}

export function inspectIdentityStores(stores: readonly object[]): {
    models: Array<{ path: string; model: string; labels: string[] }>;
    identities: IdentityModel[];
    visited: number;
    truncated: boolean;
} {
    const models: Array<{ path: string; model: string; labels: string[] }> = [];
    const identities: IdentityModel[] = [];
    const seen = new Set<object>();
    const queue: Array<{ value: object; depth: number; path: string }> = stores.map((value, i) => ({ value, depth: 0, path: `store${i}` }));
    const schemas = new Map<string, { model: string; fields: Map<string, string> }>();
    let head = 0, truncated = false;
    while (head < queue.length && seen.size < 6000) {
        const { value, depth, path } = queue[head++];
        if (seen.has(value)) continue;
        seen.add(value);
        const source = methodSource(value);
        let schema = schemas.get(source);
        if (!schema) {
            const model = /["']([A-Za-z][\w$]*)\(/.exec(source)?.[1] || '';
            const fields = new Map<string, string>();
            for (const match of source.matchAll(/\b([A-Za-z][\w]*)=.{0,35}?this\.([\w$]+)/g)) fields.set(match[1], match[2]);
            schema = { model, fields };
            schemas.set(source, schema);
        }
        const descriptors = Object.getOwnPropertyDescriptors(value);
        if (schema.model && /user|account|profile|auth|login/i.test(schema.model) && models.length < 100) {
            models.push({ path, model: schema.model, labels: [...schema.fields.keys()].slice(0, 60) });
        }
        const identity: Record<string, string> = {};
        for (const label of ['id', 'userId', 'accountId', 'selfUserId', 'currentUserId', 'uid', 'nickname', 'userName']) {
            if (label === 'id' && schema.model !== 'User') continue;
            const key = schema.fields.get(label) || label;
            const native = descriptors[key]?.value;
            if (label === 'id' || label.endsWith('Id')) {
                const id = normalizeAccountId(native);
                if (id) identity[label] = id;
            } else if (typeof native === 'string' && native.length <= 100) identity[label] = native;
        }
        if (Object.keys(identity).length && identities.length < 100) identities.push({ path, model: schema.model, fields: identity });
        if (depth >= 7) continue;
        const entries = Object.entries(descriptors);
        if (entries.length > 100) truncated = true;
        for (const [key, descriptor] of entries.slice(0, 100)) {
            const child = descriptor.value;
            if (!child || typeof child !== 'object' || key === '__proto__') continue;
            if (typeof Node !== 'undefined' && child instanceof Node) continue;
            if (queue.length >= 12000) { truncated = true; break; }
            queue.push({ value: child, depth: depth + 1, path: `${path}.${key}` });
        }
    }
    return { models, identities, visited: seen.size, truncated: truncated || head < queue.length };
}

export function installAccountIdentityNative(page: Window): {
    capture(value: object): void;
    reportMapping(status: BattlePresenceHookStatus): void;
} {
    const lifecycle = featureScope('accountIdentity');
    const seenStores = new WeakSet<object>();
    let storeCount = 0;
    let currentStore: object | null = null;
    let reader: ReturnType<typeof createNativeAccountReader> | null = null;
    let work: number | null = null;
    let publishedOwner: string | null = null;
    let mapping: BattlePresenceHookStatus | null = null;
    const bridge = page as Window & { __kaspAccountDebug?: { status(): object; inspect(): object } };
    bridge.__kaspAccountDebug = {
        status() {
            return { captured: currentStore !== null, stores: storeCount, mapping,
                account: reader?.snapshot().account || null, discovery: reader?.status(), runtime: lifecycle.status() };
        },
        inspect() {
            try { return { ...this.status(), ...inspectIdentityStores(currentStore ? [currentStore] : []) }; }
            catch (error) { return { captured: currentStore !== null, stores: storeCount, mapping, error: String(error) }; }
        },
    };
    const publish = () => {
        const snapshot = reader?.snapshot() || { account: null, players: [] };
        publishedOwner = snapshot.account?.userId || null;
        postPageMessage(page, { type: ACCOUNT_IDENTITY_MESSAGE, snapshot });
    };
    const schedule = (delay = 8) => {
        if (work !== null || !reader?.pending() || lifecycle.disabled) return;
        work = lifecycle.timeout(() => {
            work = null;
            if (reader?.step()) publish();
            schedule();
        }, delay);
    };
    const poll = () => { reader?.refresh(); publish(); schedule(); };
    lifecycle.listen(page, 'message', event => {
        if (readPageMessage(event, page, ACCOUNT_IDENTITY_REQUEST)) poll();
    });
    lifecycle.interval(poll, 1000);
    lifecycle.onCleanup(() => { currentStore = null; reader = null; work = null;
        postPageMessage(page, { type: ACCOUNT_IDENTITY_MESSAGE, snapshot: { account: null, players: [] } }); });
    return {
        capture(value) {
            if (lifecycle.disabled) return;
            if (value === currentStore) {
                // Native initialization can finish between heartbeats. Once the
                // user path is known, a store access can publish it immediately.
                if (!publishedOwner && reader?.snapshot().account) publish();
                return;
            }
            if (work !== null) { lifecycle.cancelTimeout(work); work = null; }
            currentStore = value;
            reader = createNativeAccountReader(value);
            if (!seenStores.has(value)) {
                seenStores.add(value);
                storeCount++;
            }
            publish();
            schedule(0);
        },
        reportMapping(status) { mapping = { ...status, issues: [...status.issues] }; },
    };
}
