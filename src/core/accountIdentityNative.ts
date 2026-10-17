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

const nativeSchemas = new Map<string, { model: string; fields: Map<string, string> }>();
function nativeSchema(value: object) {
    const source = methodSource(value);
    let schema = nativeSchemas.get(source);
    if (!schema) {
        const fields = new Map<string, string>();
        for (const match of source.matchAll(/\b([A-Za-z][\w]*)=.{0,35}?this\.([\w$]+)/g)) fields.set(match[1], match[2]);
        schema = { model: /["']([A-Za-z][\w$]*)\(/.exec(source)?.[1] || '', fields };
        if (nativeSchemas.size >= 512) nativeSchemas.clear();
        nativeSchemas.set(source, schema);
    }
    return schema;
}
function nativeField(value: object, label: string): unknown {
    const key = nativeSchema(value).fields.get(label);
    return key ? Object.getOwnPropertyDescriptor(value, key)?.value : undefined;
}
function visitModels(root: object, depthLimit: number, budget: number, visit: (value: object, model: string) => void): void {
    const queue: Array<[object, number]> = [[root, 0]], seen = new Set<object>();
    for (let head = 0; head < queue.length && seen.size < budget; head++) {
        const [value, depth] = queue[head];
        if (seen.has(value) || typeof Node !== 'undefined' && value instanceof Node) continue;
        seen.add(value);
        visit(value, nativeSchema(value).model);
        if (depth >= depthLimit) continue;
        for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value)).slice(0, budget)) {
            const child = descriptor.value;
            if (child && typeof child === 'object' && queue.length < budget * 2) queue.push([child, depth + 1]);
        }
    }
}

export function readNativeAccountSnapshot(store: object): AccountSnapshot {
    const accounts: VerifiedAccount[] = [], remote: object[] = [];
    visitModels(store, 3, 500, (value, model) => {
        if (model === 'User' && nativeField(value, 'isUserPropertiesLoaded') === true) {
            const userId = normalizeAccountId(nativeField(value, 'id'));
            const nickname = nativeField(value, 'uid'), clanTag = nativeField(value, 'clanTag');
            if (userId && typeof nickname === 'string' && nickname.trim()) {
                accounts.push({ userId, nickname, clanTag: typeof clanTag === 'string' ? clanTag : '' });
            }
        } else if (model === 'RemoteUserDataStorage') {
            const data = nativeField(value, 'userIdToData');
            if (data && typeof data === 'object') remote.push(data);
        }
    });
    if (accounts.length !== 1) return { account: null, players: [] };
    const players = new Map<string, string>();
    for (const root of remote.slice(0, 1)) visitModels(root, 5, 6000, (value, model) => {
        if (model !== 'RemoteUserData') return;
        const userId = normalizeAccountId(nativeField(value, 'userId')), nickname = nativeField(value, 'uid');
        if (userId && typeof nickname === 'string' && nickname.trim()) players.set(userId, nickname);
    });
    return { account: accounts[0], players: [...players].map(([userId, nickname]) => ({ userId, nickname })) };
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
    let mapping: BattlePresenceHookStatus | null = null;
    const bridge = page as Window & { __kaspAccountDebug?: { status(): object } };
    bridge.__kaspAccountDebug = {
        status() {
            try { return { captured: currentStore !== null, stores: storeCount, mapping,
                account: currentStore ? readNativeAccountSnapshot(currentStore).account : null, ...inspectIdentityStores(currentStore ? [currentStore] : []) }; }
            catch (error) { return { captured: currentStore !== null, stores: storeCount, mapping, error: String(error) }; }
        },
    };
    const publish = () => {
        let snapshot: AccountSnapshot = { account: null, players: [] };
        try { if (currentStore) snapshot = readNativeAccountSnapshot(currentStore); } catch (error) { lifecycle.fail(error); }
        postPageMessage(page, { type: ACCOUNT_IDENTITY_MESSAGE, snapshot });
    };
    page.addEventListener('message', event => {
        if (readPageMessage(event, page, ACCOUNT_IDENTITY_REQUEST)) publish();
    });
    lifecycle.interval(publish, 1000);
    lifecycle.onCleanup(() => { currentStore = null; postPageMessage(page, { type: ACCOUNT_IDENTITY_MESSAGE, snapshot: { account: null, players: [] } }); });
    return {
        capture(value) {
            if (lifecycle.disabled) return;
            currentStore = value;
            if (!seenStores.has(value)) {
                seenStores.add(value);
                storeCount++;
            }
        },
        reportMapping(status) { mapping = { ...status, issues: [...status.issues] }; },
    };
}
