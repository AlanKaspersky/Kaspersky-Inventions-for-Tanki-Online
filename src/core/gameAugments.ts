import { featureScope } from './featureRuntime';
import { postPageMessage, readPageMessage } from './pageMessages';
import { clientPatchHeader, clientSourceHash, resolveTemplateEdits, validatePatchEdits } from './clientPatches';
import type { PreparedPatchPlan } from './clientPatches';
import { gameDOM } from './gameDOM';
import { augmentPropertyLabel } from './augmentLabels';

export const AUGMENTS_MESSAGE = 'kasp:game-augments';
export const AUGMENTS_REQUEST = 'kasp:game-augments-request';
export const AUGMENT_CARDS_UPDATED = 'kasp:augment-cards-updated';
export const GARAGE_SKIN_CARDS_REQUEST = 'kasp:garage-skin-cards-request';
export type GarageCardSection = 'augments' | 'skins' | 'shot-color';

export function activeGarageCardSection(root: Pick<Document, 'querySelectorAll'>): GarageCardSection | null {
    const tabs = Array.from(root.querySelectorAll(gameDOM.navigation.garageTabs));
    if (tabs.length < 2 || tabs.length > 3) return null;
    const active = tabs.findIndex(tab => tab.classList.contains(gameDOM.classes.activeMenu));
    return (['augments', 'skins', 'shot-color'] as GarageCardSection[])[active] || null;
}
export type AugmentOperation = 'DELTA_PERCENT' | 'OVERRIDE_VALUE';
export interface GameAugmentProperty { operation: AugmentOperation; property: string; value: number; }
export interface GameAugment {
    id: string;
    baseItemId?: string;
    name?: string;
    description?: string;
    locale: 'RU' | 'EN';
    properties: GameAugmentProperty[];
    icons: string[];
    previewIcon?: string;
    rarity?: string;
}
type PendingGameAugment = Omit<GameAugment, 'properties'> & { properties?: GameAugmentProperty[] };
export interface GameEquipmentProperties {
    id: string;
    currentLevel: number;
    properties: Record<string, number>;
}
export interface AugmentSnapshot {
    format: 'kasp-augments-v1';
    session: string;
    revision: number;
    updatedAt: number;
    hooked: boolean;
    devices: GameAugment[];
    equipment?: GameEquipmentProperties[];
}
export interface AugmentSchema {
    objectIdMethod?: string;
    viewDeviceId?: string;
    viewPreview?: string;
    viewRarity?: string;
    imageUrlMethod?: string;
    properties: string;
    operation: string;
    property: string;
    value: string;
    name: string;
    description: string;
    deviceId?: string;
    baseItemId?: string;
    upgradeLevel?: string;
    upgradeData?: string;
    upgradeGroups?: string;
    upgradeLevels?: string;
    groupProperties?: string;
    baseProperty?: string;
    baseInitial?: string;
    baseFinal?: string;
}

function hasSchemaFields<K extends keyof AugmentSchema>(schema: Partial<AugmentSchema>, keys: readonly K[]):
    schema is Partial<AugmentSchema> & Required<Pick<AugmentSchema, K>> {
    return keys.every(key => typeof schema[key] === 'string' && schema[key] !== '');
}

export interface AugmentHookStatus {
    hooked: boolean;
    ready: boolean;
    strategy: 'ast-plan' | 'ast-template';
    issues: string[];
}
export interface AugmentPatchPlan extends PreparedPatchPlan {
    format: 'ki-augments-ast-v1';
    schema: AugmentSchema;
    status: AugmentHookStatus;
}
const AUGMENT_MARKER = '/*ki-augments-ast:v1:';
const unavailable = (issue: string): AugmentHookStatus => ({ hooked: false, ready: false, strategy: 'ast-plan', issues: [issue] });

function augmentHeader(code: string, schema: AugmentSchema, status: AugmentHookStatus): string {
    return clientPatchHeader(code, AUGMENT_MARKER, status, 'try{window.__kaspAugmentConfigure(' + JSON.stringify(schema) + ')}catch(__kaspIgnored){}');
}

export async function selectGameAugmentsPlan(code: string, plans: readonly AugmentPatchPlan[]): Promise<AugmentPatchPlan | undefined> {
    const candidates = plans.filter(plan => plan.format === 'ki-augments-ast-v1' && plan.status.ready && plan.sourceLength === code.length);
    if (candidates.length) try {
        const hash = await clientSourceHash(code);
        const exact = candidates.find(plan => plan.sha256 === hash);
        if (exact) return exact;
    } catch { }
    for (const plan of [...plans].reverse()) try {
        if (plan.format !== 'ki-augments-ast-v1' || !plan.status.ready) continue;
        const adapted = resolveTemplateEdits(code, plan);
        if (!adapted) continue;
        const schema: Partial<AugmentSchema> = {};
        for (const key of Object.keys(plan.schema) as (keyof AugmentSchema)[]) schema[key] = adapted.roles.get(key);
        if (!hasSchemaFields(schema, ['properties', 'operation', 'property', 'value', 'name', 'description', 'objectIdMethod']) ||
            Object.values(schema).some(value => typeof value !== 'string' || !/^[$A-Z_a-z][$\w]*$/.test(value))) continue;
        const status: AugmentHookStatus = { ...plan.status, strategy: 'ast-template' };
        const edits = adapted.edits;
        edits.unshift({ start: 0, end: 0, expected: '', before: '', after: code.slice(0, 24), text: augmentHeader(code, schema, status) });
        return { ...plan, sourceLength: code.length, sha256: '', schema, status, edits };
    } catch { }
    return undefined;
}

export function patchGameAugments(code: string, report?: (status: AugmentHookStatus) => void, plan?: AugmentPatchPlan): string {
    const done = (result: string, status: AugmentHookStatus) => { try { report?.(status); } catch { } return result; };
    if (code.includes(AUGMENT_MARKER)) return done(code, plan?.status || { hooked: true, ready: true, strategy: 'ast-plan', issues: [] });
    if (!plan) return done(code, unavailable('augments-mapping-unavailable'));
    if (plan.format !== 'ki-augments-ast-v1' || !plan.status.ready) return done(code, plan.status);
    if (!validatePatchEdits(code, plan)) return done(code, unavailable('augments-edit-mismatch'));
    let patched = code;
    for (const edit of [...plan.edits].reverse()) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return done(patched, plan.status);
}

function longId(value: unknown): string | null {
    if (typeof value === 'string') return /^\d{1,20}$/.test(value) ? value : null;
    if (!value || typeof value !== 'object') return null;
    try {
        const fields = Object.values(Object.getOwnPropertyDescriptors(value));
        if (fields.length !== 2 || !fields.every(field => 'value' in field && typeof field.value === 'number' && Number.isFinite(field.value))) return null;
        const id = String(value);
        return /^\d{1,20}$/.test(id) ? id : null;
    } catch { return null; }
}

export function readGameProperties(value: unknown, schema: AugmentSchema): GameAugmentProperty[] | null {
    try {
        const iterator = (value as { t(): { u(): boolean; v(): Record<string, unknown> } }).t();
        const properties: GameAugmentProperty[] = [];
        while (iterator.u()) {
            if (properties.length >= 512) return null;
            const item = iterator.v();
            const operation = String(item[schema.operation]);
            const property = String(item[schema.property]);
            const number = item[schema.value];
            if (!['DELTA_PERCENT', 'OVERRIDE_VALUE'].includes(operation) ||
                !/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof number !== 'number' || !Number.isFinite(number)) return null;
            properties.push({ operation: operation as AugmentOperation, property, value: number });
        }
        return properties;
    } catch { return null; }
}

export function readEquipmentProperties(raw: unknown, schema: AugmentSchema): Omit<GameEquipmentProperties, 'id'> | null {
    if (!hasSchemaFields(schema, ['upgradeLevel', 'upgradeData', 'upgradeGroups', 'upgradeLevels', 'groupProperties', 'baseProperty', 'baseInitial', 'baseFinal'])) return null;
    try {
        const source = raw as Record<string, unknown>;
        const currentLevel = source[schema.upgradeLevel];
        const data = source[schema.upgradeData] as Record<string, unknown>;
        const levels = data?.[schema.upgradeLevels];
        if (typeof currentLevel !== 'number' || typeof levels !== 'number' || !Number.isSafeInteger(currentLevel) || !Number.isSafeInteger(levels) || currentLevel < 0 || levels < 0 || currentLevel > levels) return null;
        const properties: Record<string, number> = {};
        const ambiguous = new Set<string>();
        type NativeList = { t(): { u(): boolean; v(): Record<string, unknown> } };
        const groups = (data[schema.upgradeGroups] as NativeList).t();
        let budget = 1024;
        while (groups.u()) {
            if (--budget < 0) return null;
            const items = (groups.v()[schema.groupProperties] as NativeList).t();
            while (items.u()) {
                if (--budget < 0) return null;
                const item = items.v();
                const property = String(item[schema.baseProperty]);
                const initial = item[schema.baseInitial], final = item[schema.baseFinal];
                if (!/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof initial !== 'number' || typeof final !== 'number' || !Number.isFinite(initial) || !Number.isFinite(final)) return null;
                const value = levels === 0 ? initial : initial + (final - initial) / levels * currentLevel;
                if (!Number.isFinite(value)) return null;
                if (Object.prototype.hasOwnProperty.call(properties, property) && properties[property] !== value) ambiguous.add(property);
                properties[property] = value;
            }
        }
        ambiguous.forEach(property => delete properties[property]);
        return { currentLevel, properties };
    } catch { return null; }
}

interface CardFiber {
    memoizedProps?: unknown;
    return?: CardFiber;
    child?: CardFiber;
    sibling?: CardFiber;
    alternate?: CardFiber;
    stateNode?: { current?: CardFiber };
}
const committedTrees = new WeakMap<object, { root: CardFiber; parents: Map<CardFiber, CardFiber | null> }>();

function closestReactProps(node: Element, maxAncestors = 4): unknown[] {
    const key = Object.keys(node).find(name => name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$'));
    let fiber = key ? (node as Element & Record<string, unknown>)[key] as CardFiber : undefined;
    if (!fiber) return [];
    let root = fiber;
    for (let depth = 0; root.return && depth < 100; depth++) root = root.return;
    const rootState = root.stateNode;
    const current = rootState?.current;
    let parents: Map<CardFiber, CardFiber | null> | undefined;
    if (rootState && current) {
        let tree = committedTrees.get(rootState);
        if (!tree || tree.root !== current) {
            parents = new Map();
            const pending: Array<[CardFiber, CardFiber | null]> = [[current, null]];
            while (pending.length && parents.size < 20000) {
                const [item, parent] = pending.pop()!;
                if (parents.has(item)) continue;
                parents.set(item, parent);
                if (item.sibling) pending.push([item.sibling, parent]);
                if (item.child) pending.push([item.child, item]);
            }
            tree = { root: current, parents };
            committedTrees.set(rootState, tree);
        }
        parents = tree.parents;
        if (!parents.has(fiber)) fiber = fiber.alternate;
        if (!fiber || !parents.has(fiber)) return [];
    }
    const props: unknown[] = [];
    for (let ancestor = 0; fiber && ancestor < maxAncestors; ancestor++) {
        props.push(fiber.memoizedProps);
        fiber = parents ? parents.get(fiber) || undefined : fiber.return;
    }
    return props;
}

export function findAugmentIdentity(element: Element, knownIds: Set<string>, schema: AugmentSchema): { id: string; baseItemId?: string } | null {
    for (let node: Element | null = element, level = 0; node && level < 6; node = node.parentElement, level++) {
        for (const props of closestReactProps(node)) {
            const found = new Map<string, string | undefined>();
            const seen = new Set<object>();
            let budget = 150;
            function visit(value: unknown, depth: number): void {
                if (!value || typeof value !== 'object' || seen.has(value) || depth > 4 || budget-- <= 0) return;
                seen.add(value);
                const fields = Object.getOwnPropertyDescriptors(value);
                for (const [name, descriptor] of Object.entries(fields).slice(0, 40)) {
                    if (!('value' in descriptor) || ['children', 'return', '_owner', 'ref'].includes(name)) continue;
                    const child = descriptor.value;
                    const id = longId(child);
                    if (id && knownIds.has(id)) {
                        const base = schema.baseItemId ? longId(fields[schema.baseItemId]?.value) : null;
                        found.set(id, base || undefined);
                    } else visit(child, depth + 1);
                }
            }
            try { visit(props, 0); } catch { continue; }
            if (found.size === 1) {
                const [id, baseItemId] = [...found][0];
                return { id, baseItemId };
            }
            if (found.size > 1) break;
        }
    }
    return null;
}

export function isAugmentPreviewUrl(value: unknown): value is string {
    if (typeof value !== 'string' || value.length > 2000) return false;
    try {
        const url = new URL(value.startsWith('blob:') ? value.slice(5) : value);
        return url.protocol === 'https:' && /(^|\.)tankionline\.com$/.test(url.hostname) && !/\/unavailable\.[^/]+\.svg$/.test(url.pathname);
    } catch { return false; }
}

export function findAugmentPreview(element: Element, id: string, schema: AugmentSchema): string | undefined {
    return findAugmentCardAppearance(element, id, schema).previewIcon;
}

export function readGarageCosmeticCard(element: Element): {
    id: string; name: string; isMounted: boolean; isSelected: boolean;
    isOwned: boolean; isUnknown: boolean; isStandard: boolean;
} | null {
    for (let node: Element | null = element, level = 0; node && level < 3; node = node.parentElement, level++) {
        const candidates = new Map<string, NonNullable<ReturnType<typeof readGarageCosmeticCard>>>();
        for (const props of closestReactProps(node, 16)) {
            if (!props || typeof props !== 'object') continue;
            const fields = Object.getOwnPropertyDescriptors(props);
            const id = longId(fields.id?.value), name = fields.name?.value;
            if (!id || typeof name !== 'string' || !name.trim()
                || typeof fields.isMounted?.value !== 'boolean' || typeof fields.isSelected?.value !== 'boolean') continue;
            candidates.set(id, {
                id, name, isMounted: fields.isMounted.value, isSelected: fields.isSelected.value,
                isOwned: fields.isOwned?.value === true, isUnknown: fields.isUnknown?.value === true,
                isStandard: fields.typeStandardDevice?.value === true,
            });
        }
        if (candidates.size) return candidates.size === 1 ? [...candidates.values()][0] : null;
    }
    return null;
}

export function installGarageSkinCardsBridge(page: Window): void {
    const lifecycle = featureScope('garageSkinCards');
    lifecycle.listen(page, GARAGE_SKIN_CARDS_REQUEST, event => {
        const row = document.querySelector(gameDOM.skins.cards);
        if (!row) return;
        event.preventDefault();
        for (const icon of row.querySelectorAll(gameDOM.skins.cardIcon)) {
            let card: ReturnType<typeof readGarageCosmeticCard> = null;
            try { card = readGarageCosmeticCard(icon); } catch { }
            const value = card ? JSON.stringify(card) : null;
            if (value !== null) {
                if (icon.getAttribute('data-kasp-skin-card') !== value) icon.setAttribute('data-kasp-skin-card', value);
            } else if (icon.hasAttribute('data-kasp-skin-card')) icon.removeAttribute('data-kasp-skin-card');
        }
    });
}

export function findUnavailableCosmetic(element: Element, schema: AugmentSchema): { id: string; name: string; previewIcon: string } | undefined {
    const candidates = new Map<string, { id: string; name: string; previewIcon: string }>();
    for (let node: Element | null = element, level = 0; node && level < 3; node = node.parentElement, level++) {
        for (const props of closestReactProps(node)) {
            if (!props || typeof props !== 'object') continue;
            const fields = Object.getOwnPropertyDescriptors(props);
            if (fields.isUnknown?.value !== true || fields.typeStandardDevice?.value === true) continue;
            const id = longId(fields.id?.value), name = fields.name?.value;
            if (!id || typeof name !== 'string' || !name.trim() || name.length > 500) continue;
            const previewIcon = findAugmentPreview(element, id, schema);
            if (previewIcon) candidates.set(id, { id, name, previewIcon });
        }
        if (candidates.size) break;
    }
    return candidates.size === 1 ? [...candidates.values()][0] : undefined;
}

export function findAugmentCardAppearance(element: Element, id: string, schema: AugmentSchema): { previewIcon?: string; rarity?: string } {
    const urls = new Set<string>();
    const rarities = new Set<string>();
    const seen = new Set<object>();
    let budget = 150;
    function resource(value: unknown): void {
        try {
            if (isAugmentPreviewUrl(value)) { urls.add(value); return; }
            if (!value || typeof value !== 'object' || !schema.imageUrlMethod) return;
            let owner = value, method: unknown;
            for (let depth = 0; owner && depth < 6; depth++, owner = Object.getPrototypeOf(owner)) {
                const descriptor = Object.getOwnPropertyDescriptor(owner, schema.imageUrlMethod);
                if (descriptor) { method = descriptor.value; break; }
            }
            if (typeof method === 'function') {
                const url = method.call(value);
                if (isAugmentPreviewUrl(url)) urls.add(url);
            }
        } catch {}
    }
    function visit(value: unknown, depth: number): void {
        if (!value || typeof value !== 'object' || seen.has(value) || depth > 4 || --budget < 0) return;
        seen.add(value);
        const fields = Object.getOwnPropertyDescriptors(value);
        const directId = longId(fields.id?.value);
        const viewId = schema.viewDeviceId ? longId(fields[schema.viewDeviceId]?.value) : null;
        if (directId === id || viewId === id) {
            const rarity = directId === id ? fields.currentRarity?.value
                : schema.viewRarity ? fields[schema.viewRarity]?.value : undefined;
            try {
                const name = rarity == null ? '' : String(rarity);
                if (/^(COMMON|RARE|EPIC|LEGENDARY)$/.test(name)) rarities.add(name);
            } catch {}
        }
        if (directId === id) { resource(fields.icon?.value); resource(fields.iconUrl?.value); }
        if (viewId === id && schema.viewPreview) {
            const preview = fields[schema.viewPreview]?.value;
            if (Array.isArray(preview)) resource(preview[0]);
            else if (preview && typeof preview.t === 'function') {
                const iterator = preview.t();
                if (iterator.u()) resource(iterator.v());
            }
        }
        for (const [name, descriptor] of Object.entries(fields).slice(0, 40)) {
            if ('value' in descriptor && !['children', 'return', '_owner', 'ref'].includes(name)) visit(descriptor.value, depth + 1);
        }
    }
    for (let node: Element | null = element, level = 0; node && level < 6; node = node.parentElement, level++) {
        for (const props of closestReactProps(node)) {
            try { visit(props, 0); } catch { }
        }
        if (urls.size) break;
    }
    return { previewIcon: urls.size === 1 ? [...urls][0] : undefined,
        rarity: rarities.size === 1 ? [...rarities][0] : undefined };
}

export function installGameAugments(page: Window): void {
    const lifecycle = featureScope('augments');
    let enabled = false;
    let schema: AugmentSchema | null = null;
    let revision = 0;
    let queued = false;
    let pendingTimer: number | undefined;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entries = new Map<string, PendingGameAugment>();
    const equipment = new Map<string, GameEquipmentProperties>();
    function locale(): 'RU' | 'EN' {
        try {
            const language = localStorage.getItem('language_store_key') || document.documentElement.lang;
            return language ? (language.toLowerCase().startsWith('ru') ? 'RU' : 'EN')
                : page.location?.hostname.includes('ru.') ? 'RU' : 'EN';
        }
        catch { return 'EN'; }
    }
    function snapshot(): AugmentSnapshot {
        return { format: 'kasp-augments-v1', session, revision, updatedAt: Date.now(), hooked: !!schema,
            devices: [...entries.values()].filter((entry): entry is GameAugment => entry.properties !== undefined), equipment: [...equipment.values()] };
    }
    function publish(): void { postPageMessage(page, { type: AUGMENTS_MESSAGE, detail: snapshot() }); }
    function schedule(): void {
        if (queued) return;
        queued = true;
        pendingTimer = page.setTimeout(() => {
            pendingTimer = undefined;
            try { lifecycle.run(bindCards); }
            finally { queued = false; publish(); }
        }, 100);
    }
    page.__kaspAugmentConfigure = value => { schema = value; revision++; schedule(); };
    page.__kaspAugmentLink = (rawId, rawBase) => {
        const id = longId(rawId);
        const baseItemId = longId(rawBase);
        const entry = id ? entries.get(id) : null;
        if (entry && baseItemId && entry.baseItemId !== baseItemId) { entry.baseItemId = baseItemId; revision++; schedule(); }
    };
    page.__kaspAugmentData = (object, raw) => {
        if (!schema || !raw || typeof raw !== 'object') return;
        try {
            const data = raw as Record<string, unknown>;
            const isProperties = Object.prototype.hasOwnProperty.call(data, schema.properties);
            const isDescription = Object.prototype.hasOwnProperty.call(data, schema.name) && Object.prototype.hasOwnProperty.call(data, schema.description);
            const isEquipment = schema.upgradeData && Object.prototype.hasOwnProperty.call(data, schema.upgradeData);
            if (!isProperties && !isDescription && !isEquipment) return;
            const method = schema.objectIdMethod ? (object as Record<string, unknown>)[schema.objectIdMethod] : undefined;
            if (typeof method !== 'function') return;
            const id = String(method.call(object));
            if (!/^\d{1,20}$/.test(id) || entries.size >= 20000 && !entries.has(id)) return;
            if (isEquipment) {
                const baseline = readEquipmentProperties(data, schema);
                if (baseline && (equipment.size < 20000 || equipment.has(id))) {
                    const next = { id, ...baseline };
                    if (JSON.stringify(equipment.get(id)) !== JSON.stringify(next)) {
                        equipment.set(id, next); revision++; schedule();
                    }
                } else if (!baseline && equipment.delete(id)) {
                    revision++; schedule();
                }
                if (!isProperties && !isDescription) return;
            }
            const entry: PendingGameAugment = entries.get(id) || { id, locale: locale(), icons: [] };
            const before = JSON.stringify(entry);
            if (isProperties) {
                const properties = readGameProperties(data[schema.properties], schema);
                if (properties) entry.properties = properties;
            }
            if (isDescription) {
                if (typeof data[schema.name] === 'string') entry.name = (data[schema.name] as string).slice(0, 500);
                if (typeof data[schema.description] === 'string') entry.description = (data[schema.description] as string).slice(0, 16000);
                entry.locale = locale();
            }
            entries.set(id, entry);
            if (before !== JSON.stringify(entry)) { revision++; schedule(); }
        } catch {}
    };
    function bindCards(force = false): void {
        if ((!enabled && !force) || !schema || !document.body) return;
        const section = activeGarageCardSection(document);
        const ids = new Set([...entries.values()].filter(entry => entry.properties !== undefined).map(entry => entry.id));
        const elements = document.querySelectorAll<HTMLElement>(`${gameDOM.augments.cardImage}, ${gameDOM.garage.deviceIcon}`);
        for (const element of Array.from(elements)) {
            const cosmetic = (section === 'skins' || section === 'shot-color') && element.closest?.(gameDOM.skins.cards)
                ? findUnavailableCosmetic(element, schema) : undefined;
            for (const [attribute, value] of [
                ['data-kasp-cosmetic-id', cosmetic?.id],
                ['data-kasp-cosmetic-name', cosmetic?.name],
                ['data-kasp-cosmetic-preview', cosmetic?.previewIcon],
                ['data-kasp-cosmetic-section', cosmetic ? section : undefined],
            ] as const) {
                if (value && element.getAttribute(attribute) !== value) {
                    element.setAttribute(attribute, value); revision++; schedule();
                } else if (!value && element.hasAttribute(attribute)) {
                    element.removeAttribute(attribute); revision++; schedule();
                }
            }
            const identity = section === 'skins' || section === 'shot-color' ? null : findAugmentIdentity(element, ids, schema);
            if (!identity) {
                if (element.hasAttribute('data-kasp-augment-id')) {
                    element.removeAttribute('data-kasp-augment-id');
                    revision++; schedule();
                }
                continue;
            }
            let changed = element.getAttribute('data-kasp-augment-id') !== identity.id;
            if (changed) element.setAttribute('data-kasp-augment-id', identity.id);
            const entry = entries.get(identity.id)!;
            const appearance = findAugmentCardAppearance(element, identity.id, schema);
            const preview = appearance.previewIcon;
            if (preview && entry.previewIcon !== preview) { entry.previewIcon = preview; changed = true; }
            if (appearance.rarity && entry.rarity !== appearance.rarity) { entry.rarity = appearance.rarity; changed = true; }
            const url = element instanceof HTMLImageElement ? element.src
                : /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(element).backgroundImage)?.[1];
            if (identity.baseItemId && entry.baseItemId !== identity.baseItemId) { entry.baseItemId = identity.baseItemId; changed = true; }
            if (url && /^https?:\/\//.test(url) && !entry.icons.includes(url) && entry.icons.length < 16) { entry.icons.push(url); changed = true; }
            if (changed) { revision++; schedule(); }
        }
    }
    const observer = typeof MutationObserver === 'undefined' ? null : lifecycle.observer(records => {
            if (!enabled) return;
            const relevant = records.some(record => record.type === 'attributes'
                ? (record.target as Element).matches(`${gameDOM.augments.cardImage}, ${gameDOM.navigation.garageCategory}`)
                : Array.from(record.addedNodes).some(node => node.nodeType === 1 &&
                    ((node as Element).matches(gameDOM.augments.cardImage) || (node as Element).querySelector(gameDOM.augments.cardImage))));
            if (!relevant) return;
            const previous = revision;
            bindCards();
            if (revision !== previous) publish();
            else page.dispatchEvent?.(new Event(AUGMENT_CARDS_UPDATED));
        });
    let scanTimer: number | undefined;
    lifecycle.onCleanup(() => {
        enabled = false; observer?.disconnect();
        if (pendingTimer !== undefined) page.clearTimeout(pendingTimer);
        if (scanTimer !== undefined) page.clearInterval(scanTimer);
        schema = null; entries.clear(); equipment.clear(); publish();
    });
    function syncEnabled(): void {
        let next = false;
        try { next = localStorage.getItem('k_augments') === 'true'; } catch { }
        document.documentElement.toggleAttribute?.('data-kasp-augments-enabled', next);
        if (next === enabled) return;
        enabled = next;
        if (enabled) {
            observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
            scanTimer = page.setInterval(() => lifecycle.run(bindCards), 1000);
            bindCards(); publish();
        } else {
            observer?.disconnect();
            if (scanTimer !== undefined) page.clearInterval(scanTimer);
            scanTimer = undefined;
        }
    }
    lifecycle.listen(page, 'kasp:settings-changed', syncEnabled);
    lifecycle.listen(page, 'storage', syncEnabled);
    syncEnabled();
    lifecycle.listen(page, 'message', event => {
        if (readPageMessage(event, page, AUGMENTS_REQUEST)) publish();
    });
    function pageData() {
        bindCards(true);
        const devices = new Map<string, unknown>();
        const unmatchedCards: Array<{ icon: string | null; reason: string }> = [];
        const elements = document.querySelectorAll<HTMLElement>(gameDOM.augments.cardImage);
        for (const element of Array.from(elements)) {
            if (!element.getClientRects().length) continue;
            const id = element.getAttribute('data-kasp-augment-id');
            const device = id ? entries.get(id) : undefined;
            if (!device || device.properties === undefined) {
                unmatchedCards.push({ icon: element.getAttribute('src'), reason: 'Device identity or captured properties are unavailable.' });
                continue;
            }
            const baseline = device.baseItemId ? equipment.get(device.baseItemId) : undefined;
            devices.set(device.id, { objectId: device.id, baseItemId: device.baseItemId, name: device.name,
                description: device.description, locale: device.locale,
                currentLevel: baseline?.currentLevel,
                properties: device.properties.map(property => ({
                    property: property.property,
                    name: { RU: augmentPropertyLabel(property.property, 'RU'), EN: augmentPropertyLabel(property.property, 'EN') },
                    operation: property.operation, value: property.value, baseValue: baseline?.properties[property.property],
                })),
            });
        }
        return { format: 'kasp-augment-page-v1', capturedAt: Date.now(), devices: [...devices.values()], unmatchedCards,
            note: 'Only currently rendered visible device cards are included. Scroll virtualized lists and export again to inspect more cards.' };
    }
    let hookStatus: AugmentHookStatus | undefined;
    page.__kaspAugmentsDebug = {
        device: id => {
            const device = entries.get(id);
            return device ? { id: device.id, name: device.name, baseItemId: device.baseItemId,
                properties: device.properties?.map(property => ({ ...property })) ?? [] } : null;
        },
        reportHook: status => { hookStatus = { ...status, issues: [...status.issues] }; },
        export: () => JSON.stringify(snapshot(), null, 2),
        page: () => JSON.parse(JSON.stringify(pageData())), exportPage: () => JSON.stringify(pageData(), null, 2),
        status: () => ({ hooked: !!schema, devices: snapshot().devices.length, equipment: equipment.size, revision, mapping: hookStatus && { ...hookStatus, issues: [...hookStatus.issues] } }) };
}
