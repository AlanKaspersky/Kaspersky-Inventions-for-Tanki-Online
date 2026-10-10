import { gameDOM } from './gameDOM';
import { augmentPropertyLabel } from './augmentLabels';

export const AUGMENTS_MESSAGE = 'kasp:game-augments';
export const AUGMENTS_REQUEST = 'kasp:game-augments-request';
export type GarageCardSection = 'augments' | 'skins' | 'shot-color';

/** The menu order is the same in Russian and English; generated ksc classes are irrelevant. */
export function activeGarageCardSection(root: Pick<Document, 'querySelectorAll'>): GarageCardSection | null {
    const tabs = Array.from(root.querySelectorAll('.MenuComponentStyle-blockButtonsQECommunity .MenuComponentStyle-mainMenuItem'));
    // Some turrets and hulls have no shot-color tab.
    if (tabs.length < 2 || tabs.length > 3) return null;
    const active = tabs.findIndex(tab => tab.classList.contains('-activeMenu'));
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
    properties?: GameAugmentProperty[];
    icons: string[];
    previewIcon?: string;
    rarity?: string;
}
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

/** The model cache follows the object-context stack and its model-ID getter. */
function discoverModelCache(code: string) {
    const writer = /([\w$]+)\(([\w$]+)\)\.([\w$]+)\s*=\s*function\s*\(\s*([\w$]+)\s*,\s*([\w$]+)\s*\)\s*\{\s*this\.([\w$]+)\.([\w$]+)\.set\(\s*\4\s*,\s*\5\s*\)\s*;?\s*\}/g;
    const candidates = [...code.matchAll(writer)];
    const semantic = candidates.flatMap(match => {
        const before = code.slice(Math.max(0, match.index - 1000), match.index);
        if (!before.includes('"No objects in stack"')) return [];
        const getter = /([\w$]+)\(([\w$]+)\)\.([\w$]+)\s*=\s*function\s*\(\s*\)\s*\{\s*return\s+this\.[\w$]+\s*;?\s*\}\s*[,;]?\s*$/.exec(before);
        if (!getter || getter[1] !== match[1] || getter[2] !== match[2]) return [];
        return [{ match, objectIdMethod: getter[3] }];
    });
    if (semantic.length) return semantic.length === 1 ? semantic[0] : null;
    // Compatibility with older bundles lacking the context-stack signature.
    const legacy = candidates.filter(match => match[3] === 'r7i');
    return legacy.length === 1 ? { match: legacy[0], objectIdMethod: 'p57' } : null;
}

/** Discover generated fields by their stable diagnostic labels, never by obfuscated class names. */
export function discoverAugmentSchema(code: string): AugmentSchema | null {
    function field(type: string, label: string): string | undefined {
        const marker = code.indexOf(`"${type}`);
        if (marker < 0) return undefined;
        const before = code.slice(Math.max(0, marker - 500), marker);
        const headers = [...before.matchAll(/([\w$]+)\(([\w$]+)\)\.toString\s*=\s*function\s*\([^)]*\)\s*\{/g)];
        const header = headers[headers.length - 1];
        if (!header) return undefined;
        const body = code.slice(marker, code.indexOf('}', marker));
        const match = new RegExp(`"[^"\\r\\n]*\\b${label}\\s*=\\s*"\\s*\\+\\s*(?:[\\w$]+\\()?this\\.([\\w$]+)(\\(\\))?`).exec(body);
        if (!match) return undefined;
        if (!match[2]) return match[1];
        const area = code.slice(Math.max(0, marker - 20000), marker + 1000);
        const getter = new RegExp(`${header[1]}\\(${header[2]}\\)\\.${match[1]}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{\\s*(?:var\\s+[\\w$]+\\s*=\\s*|return\\s+)this\\.([\\w$]+)`).exec(area);
        return getter?.[1];
    }
    const schema: AugmentSchema = {
        objectIdMethod: discoverModelCache(code)?.objectIdMethod,
        viewDeviceId: field('GarageDevice(id=', 'id'),
        viewPreview: field('GarageDevice(id=', 'previewImage'),
        viewRarity: field('GarageDevice(id=', 'rarity'),
        imageUrlMethod: /props\.icon\s*;[^{}]{0,120}?\b[\w$]+\.([\w$]+)\(\)/.exec(code)?.[1],
        properties: field('DevicePropertiesCC [', 'properties'),
        operation: field('DevicePropertyEntity [', 'operation'),
        property: field('DevicePropertyEntity [', 'property'),
        value: field('DevicePropertyEntity [', 'value'),
        name: field('DescriptionModelCC [', 'name'),
        description: field('DescriptionModelCC [', 'description'),
        deviceId: field('GarageDeviceObject(id=', 'id'),
        baseItemId: field('GarageDeviceObject(id=', 'baseItemId'),
        upgradeLevel: field('UpgradeParamsCC [', 'currentLevel'),
        upgradeData: field('UpgradeParamsCC [', 'itemData'),
        upgradeGroups: field('UpgradeParamsData [', 'properties'),
        upgradeLevels: field('UpgradeParamsData [', 'upgradeLevelsCount'),
        groupProperties: field('GaragePropertyParams [', 'properties'),
        baseProperty: field('PropertyData [', 'property'),
        baseInitial: field('PropertyData [', 'initialValue'),
        baseFinal: field('PropertyData [', 'finalValue'),
    };
    return ['properties', 'operation', 'property', 'value', 'name', 'description']
        .every(key => !!schema[key]) ? schema : null;
}

export function patchGameAugments(code: string): string {
    const schema = discoverAugmentSchema(code);
    if (!schema) return code;
    // The original cache write executes first. Observer errors cannot alter model loading.
    const cache = discoverModelCache(code);
    if (!cache) return code;
    const { match } = cache;
    const replacement = match[0].replace(/\s*\}$/, `;try{window.__kaspAugmentData(${match[4]},${match[5]})}catch(__kaspIgnored){} }`);
    let patched = code.slice(0, match.index) + replacement + code.slice(match.index + match[0].length);
    if (schema.deviceId && schema.baseItemId) {
        const constructor = new RegExp(`function\\s+[\\w$]+\\([^)]{1,400}\\)\\s*\\{\\s*this\\.${schema.deviceId}\\s*=\\s*[\\w$]+\\s*[,;]\\s*this\\.${schema.baseItemId}\\s*=\\s*[\\w$]+[^{}]*\\}`, 'g');
        patched = patched.replace(constructor, whole => whole.replace(/\s*\}$/, `;try{window.__kaspAugmentLink(this.${schema.deviceId},this.${schema.baseItemId})}catch(__kaspIgnored){} }`));
    }
    const directive = /^\s*(["'])use strict\1\s*;/.exec(patched)?.[0] || '';
    return `${directive}\ntry{window.__kaspAugmentConfigure(${JSON.stringify(schema)})}catch(__kaspIgnored){}\n${patched.slice(directive.length)}`;
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

/** The game's raw-property calculator is initial + (final - initial) / levels * currentLevel. */
export function readEquipmentProperties(raw: unknown, schema: AugmentSchema): Omit<GameEquipmentProperties, 'id'> | null {
    if (!['upgradeLevel', 'upgradeData', 'upgradeGroups', 'upgradeLevels', 'groupProperties', 'baseProperty', 'baseInitial', 'baseFinal'].every(key => !!schema[key])) return null;
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

/** A host DOM node can retain its old fiber after React switches to the alternate tree. */
function closestReactProps(node: Element): unknown[] {
    const key = Object.keys(node).find(name => name.startsWith('__reactFiber$') || name.startsWith('__reactInternalInstance$'));
    let fiber = key ? node[key] as CardFiber : undefined;
    if (!fiber) return [];
    let root = fiber;
    for (let depth = 0; root.return && depth < 100; depth++) root = root.return;
    const current = root.stateNode?.current;
    let parents: Map<CardFiber, CardFiber | null> | undefined;
    if (current) {
        let tree = committedTrees.get(root.stateNode);
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
            committedTrees.set(root.stateNode, tree);
        }
        parents = tree.parents;
        if (!parents.has(fiber)) fiber = fiber.alternate;
        if (!fiber || !parents.has(fiber)) return [];
    }
    const props: unknown[] = [];
    for (let ancestor = 0; fiber && ancestor < 4; ancestor++) {
        props.push(fiber.memoizedProps);
        fiber = parents ? parents.get(fiber) || undefined : fiber.return;
    }
    return props;
}

/** Resolve only unambiguous identities from the closest React props; names are never identity keys. */
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

/** Read only icon resources belonging to the exact device, never adjacent card artwork. */
export function findAugmentPreview(element: Element, id: string, schema: AugmentSchema): string | undefined {
    return findAugmentCardAppearance(element, id, schema).previewIcon;
}

/** Skins and shot colors use the same cell props, but have no device modifiers. */
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

/** Appearance metadata is accepted only from props with the same exact device ID. */
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
        } catch { /* An unavailable resource leaves the native placeholder intact. */ }
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
            } catch { /* Missing rarity must not prevent icon binding. */ }
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
    let enabled = false;
    let schema: AugmentSchema | null = null;
    let revision = 0;
    let queued = false;
    const session = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entries = new Map<string, GameAugment>();
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
            devices: [...entries.values()].filter(entry => entry.properties !== undefined), equipment: [...equipment.values()] };
    }
    function publish(): void { page.postMessage({ type: AUGMENTS_MESSAGE, detail: snapshot() }, '*'); }
    function schedule(): void {
        if (queued) return;
        queued = true;
        page.setTimeout(() => { queued = false; publish(); }, 100);
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
            const method = (object as Record<string, unknown>)[schema.objectIdMethod || 'p57'];
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
            const entry = entries.get(id) || { id, locale: locale(), icons: [] };
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
        } catch { /* A diagnostic bridge must never interrupt the game. */ }
    };
    // MAIN-world React properties cannot be read from the extension's isolated world.
    function bindCards(force = false): void {
        if ((!enabled && !force) || !schema || !document.body) return;
        const section = activeGarageCardSection(document);
        const ids = new Set([...entries.values()].filter(entry => entry.properties !== undefined).map(entry => entry.id));
        const elements = document.querySelectorAll<HTMLElement>(`${gameDOM.augments.cardImage}, ${gameDOM.garage.deviceIcon}, ${gameDOM.augments.rewardImageBlock} ${gameDOM.common.backgroundDiv}`);
        for (const element of Array.from(elements)) {
            const cosmetic = (section === 'skins' || section === 'shot-color') && element.closest?.('.SkinsAndAlterationsStyle-SkinsVerticalComponent')
                ? findUnavailableCosmetic(element, schema) : undefined;
            for (const [attribute, value] of [
                ['data-kasp-cosmetic-id', cosmetic?.id],
                ['data-kasp-cosmetic-name', cosmetic?.name],
                ['data-kasp-cosmetic-preview', cosmetic?.previewIcon],
                ['data-kasp-cosmetic-section', cosmetic ? section : undefined],
            ]) {
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
    // Bind newly rendered cards before waiting for the periodic recovery scan.
    const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(records => {
            if (!enabled) return;
            const relevant = records.some(record => record.type === 'attributes'
                ? (record.target as Element).matches(`${gameDOM.augments.cardImage}, .MenuComponentStyle-mainMenuItem`)
                : Array.from(record.addedNodes).some(node => node.nodeType === 1 &&
                    ((node as Element).matches(gameDOM.augments.cardImage) || (node as Element).querySelector(gameDOM.augments.cardImage))));
            if (!relevant) return;
            const previous = revision;
            bindCards();
            if (revision !== previous) publish();
        });
    let scanTimer: number | undefined;
    function syncEnabled(): void {
        let next = false;
        try { next = localStorage.getItem('k_augments') === 'true'; } catch { }
        document.documentElement.toggleAttribute?.('data-kasp-augments-enabled', next);
        if (next === enabled) return;
        enabled = next;
        if (enabled) {
            observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class'] });
            scanTimer = page.setInterval(bindCards, 1000);
            bindCards(); publish();
        } else {
            observer?.disconnect();
            if (scanTimer !== undefined) page.clearInterval(scanTimer);
            scanTimer = undefined;
        }
    }
    page.addEventListener('kasp:settings-changed', syncEnabled);
    page.addEventListener('storage', syncEnabled);
    syncEnabled();
    page.addEventListener('message', event => {
        if (event.source === page && event.data?.type === AUGMENTS_REQUEST) publish();
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
    page.__kaspAugmentsDebug = { export: () => JSON.stringify(snapshot(), null, 2),
        page: () => JSON.parse(JSON.stringify(pageData())), exportPage: () => JSON.stringify(pageData(), null, 2),
        status: () => ({ hooked: !!schema, devices: snapshot().devices.length, equipment: equipment.size, revision }) };
}
