import { AUGMENTS_MESSAGE, AUGMENTS_REQUEST, isAugmentPreviewUrl } from './gameAugments';
import type { AugmentSnapshot, GameAugment } from './gameAugments';
import { augmentPropertyBenefit, augmentPropertyLabel } from './augmentLabels';
import { parseAugmentRules } from './augmentRules';
import type { AugmentRule } from './augmentRules';

export const AUGMENTS_JSON_FILE = 'kasp-augments.json';
export const AUGMENTS_JSON_KEY = 'kasp_augments_session_json';
export const AUGMENTS_UPDATED = 'kasp:augments-updated';

/** Reject malformed bridge data before indexing or saving it. */
export function validateAugmentSnapshot(value: unknown): AugmentSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as AugmentSnapshot;
    if (source.format !== 'kasp-augments-v1' || typeof source.session !== 'string' || source.session.length > 100 ||
        !Number.isSafeInteger(source.revision) || source.revision < 0 || typeof source.hooked !== 'boolean' ||
        !Number.isFinite(source.updatedAt) || !Array.isArray(source.devices) || source.devices.length > 20000) return null;
    const ids = new Set<string>();
    for (const entry of source.devices) {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !/^\d{1,20}$/.test(entry.id) || ids.has(entry.id) ||
            !['RU', 'EN'].includes(entry.locale) || !Array.isArray(entry.icons) || entry.icons.length > 16 ||
            entry.icons.some(url => typeof url !== 'string' || url.length > 2000 || !/^https?:\/\//.test(url)) ||
            entry.baseItemId !== undefined && (typeof entry.baseItemId !== 'string' || !/^\d{1,20}$/.test(entry.baseItemId)) ||
            entry.name !== undefined && (typeof entry.name !== 'string' || entry.name.length > 500) ||
            entry.description !== undefined && (typeof entry.description !== 'string' || entry.description.length > 16000) ||
            entry.previewIcon !== undefined && !isAugmentPreviewUrl(entry.previewIcon) ||
            entry.rarity !== undefined && !['COMMON', 'RARE', 'EPIC', 'LEGENDARY'].includes(entry.rarity) ||
            !Array.isArray(entry.properties) || entry.properties.length > 512) return null;
        ids.add(entry.id);
        for (const property of entry.properties) {
            if (!property || !['DELTA_PERCENT', 'OVERRIDE_VALUE'].includes(property.operation) ||
                typeof property.property !== 'string' || !/^[A-Z][A-Z0-9_]{0,100}$/.test(property.property) ||
                typeof property.value !== 'number' || !Number.isFinite(property.value)) return null;
        }
    }
    if (source.equipment !== undefined) {
        if (!Array.isArray(source.equipment) || source.equipment.length > 20000) return null;
        const equipmentIds = new Set<string>();
        for (const item of source.equipment) {
            if (!item || typeof item.id !== 'string' || !/^\d{1,20}$/.test(item.id) || equipmentIds.has(item.id) ||
                !Number.isSafeInteger(item.currentLevel) || item.currentLevel < 0 || !item.properties || typeof item.properties !== 'object' || Array.isArray(item.properties)) return null;
            const values = Object.entries(item.properties);
            if (values.length > 512 || values.some(([property, value]) => !/^[A-Z][A-Z0-9_]{0,100}$/.test(property) || typeof value !== 'number' || !Number.isFinite(value))) return null;
            equipmentIds.add(item.id);
        }
    }
    return source;
}

export function normalizeAugmentIcon(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.pathname; // EU/RU asset hosts share the same hashed artwork paths.
    } catch { return url; }
}

const liveTags: Record<string, string[]> = {
    DAMAGE: ['DAMAGE_FIXED', 'DAMAGE_FROM', 'DAMAGE_TO', 'DAMAGE_PER_HIT'],
    DPS: ['DAMAGE_PER_SECOND'], RELOAD: ['WEAPON_RELOAD_TIME'], CHARGE_RATE: ['WEAPON_CHARGE_RATE'],
    TURNING_SPEED: ['TURRET_TURN_SPEED'], RANGE: ['SHOT_RANGE'], CRIT_DAMAGE: ['CRITICAL_HIT_DAMAGE'],
    HEALING: ['ISIS_HEALING_PER_PERIOD'], IMPACT_FORCE: ['IMPACT_FORCE'],
    SNIPING_DAMAGE: ['SHAFT_AIMING_MODE_MIN_DAMAGE', 'SHAFT_AIMING_MODE_MAX_DAMAGE'],
    ARCADE_DAMAGE: ['DAMAGE_FIXED'], ARMOR: ['HULL_ARMOR'], TURN_SPEED: ['HULL_TURN_SPEED'],
    WEIGHT: ['HULL_MASS'], TOP_SPEED: ['HULL_SPEED'],
};

/** Absolute protocol values can have different units; only unambiguous percentage changes adjust native rows. */
export function liveAugmentModifiers(device: GameAugment): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [tag, names] of Object.entries(liveTags)) {
        const properties = device.properties.filter(property => names.includes(property.property));
        if (!properties.length || properties.some(property => property.operation !== 'DELTA_PERCENT') ||
            new Set(properties.map(property => property.property)).size !== properties.length) continue;
        if (tag === 'DAMAGE' && properties.some(property => ['DAMAGE_FROM', 'DAMAGE_TO'].includes(property.property)) &&
            !['DAMAGE_FROM', 'DAMAGE_TO'].every(name => properties.some(property => property.property === name))) continue;
        if (tag === 'SNIPING_DAMAGE' && properties.length !== 2) continue;
        const delta = properties[0].value;
        if (properties.every(property => property.value === delta) && delta >= -100) result[tag] = 1 + delta / 100;
    }
    return result;
}

export function presentGameAugment(device: GameAugment, baseline?: Record<string, number>, rules?: ReadonlyMap<string, AugmentRule['status']>) {
    const advantages: Array<{ RU: string; EN: string }> = [];
    const disadvantages: Array<{ RU: string; EN: string }> = [];
    const neutral: Array<{ RU: string; EN: string }> = [];
    for (const property of device.properties) {
        const initial = baseline?.[property.property];
        const comparable = typeof initial === 'number' &&
            (!/CRITICAL.*CHANCE|CRITICAL_CHANCE_DELTA/.test(property.property) || initial >= 0 && property.value >= 0);
        const delta = property.operation === 'DELTA_PERCENT' ? property.value : comparable ? property.value - initial : 0;
        const unchanged = property.operation === 'OVERRIDE_VALUE' && comparable && Math.abs(delta) <= 1e-6 * Math.max(1, Math.abs(initial), Math.abs(property.value));
        const manual = rules?.get(`${device.id}:${property.property}`);
        if (!manual && (unchanged || property.operation === 'DELTA_PERCENT' && property.value === 0)) continue;
        const benefit = manual ? manual === 'better' ? 'advantage' : 'disadvantage'
            : augmentPropertyBenefit(property.property, unchanged ? 0 : delta);
        const value = Number(property.value.toPrecision(7));
        const probability = /CRITICAL.*CHANCE|CRITICAL_CHANCE_DELTA/.test(property.property) && comparable && initial <= 1 && property.value <= 1;
        const absolute = (number: number) => `${Number((probability ? number * 100 : number).toPrecision(7))}${probability ? '%' : ''}`;
        const suffix = property.operation === 'DELTA_PERCENT' ? `${value > 0 ? '+' : ''}${value}%`
            : comparable ? `${absolute(initial)} → ${absolute(property.value)}` : `= ${value}`;
        const item = { RU: `${augmentPropertyLabel(property.property, 'RU')}: ${suffix}`,
            EN: `${augmentPropertyLabel(property.property, 'EN')}: ${suffix}` };
        (benefit === 'advantage' ? advantages : benefit === 'disadvantage' ? disadvantages : neutral).push(item);
    }
    return { ...device, advantages, disadvantages, neutral, modifiers: liveAugmentModifiers(device) };
}

export function createAugmentCatalog() {
    let current: AugmentSnapshot | null = null;
    const byId = new Map<string, GameAugment>();
    const byIcon = new Map<string, GameAugment[]>();
    const equipment = new Map<string, Record<string, number>>();
    const rules = new Map<string, AugmentRule['status']>();
    const present = (device: GameAugment) => presentGameAugment(device, device.baseItemId ? equipment.get(device.baseItemId) : undefined, rules);
    return {
        setRules(value: unknown): string[] {
            const parsed = parseAugmentRules(value);
            rules.clear();
            parsed.rules.forEach(rule => rules.set(`${rule.objectId}:${rule.property}`, rule.status));
            return parsed.errors;
        },
        accept(value: unknown): boolean {
            const snapshot = validateAugmentSnapshot(value);
            if (!snapshot || current && (snapshot.session !== current.session || snapshot.revision <= current.revision)) return false;
            current = snapshot;
            byId.clear(); byIcon.clear(); equipment.clear();
            for (const item of snapshot.equipment || []) equipment.set(item.id, item.properties);
            for (const device of snapshot.devices) {
                byId.set(device.id, device);
                for (const url of device.icons) {
                    const key = normalizeAugmentIcon(url);
                    const entries = byIcon.get(key) || [];
                    if (!entries.some(entry => entry.id === device.id)) entries.push(device);
                    byIcon.set(key, entries);
                }
            }
            return true;
        },
        get(url: string, id?: string) {
            if (id) {
                const device = byId.get(id);
                // Recycled cards can change their image before the next MAIN-world binding pass.
                if (!device || device.icons.length && !device.icons.some(icon => normalizeAugmentIcon(icon) === normalizeAugmentIcon(url))) return undefined;
                return present(device);
            }
            const candidates = byIcon.get(normalizeAugmentIcon(url)) || [];
            if (!candidates.length) return undefined;
            const fingerprint = (device: GameAugment) => JSON.stringify([device.properties, device.name, device.description, device.locale,
                device.baseItemId ? equipment.get(device.baseItemId) : undefined,
                device.properties.map(property => rules.get(`${device.id}:${property.property}`))]);
            // Empty numeric lists can still describe different conditional effects.
            if (candidates.some(device => fingerprint(device) !== fingerprint(candidates[0]))) return undefined;
            return present(candidates[0]);
        },
        export: () => JSON.stringify(current || { format: 'kasp-augments-v1', devices: [] }, null, 2),
    };
}

const catalog = createAugmentCatalog();
let pendingJson: string | null = null;
let writing = false;
let fileError: string | null = null;

async function persist(json: string): Promise<void> {
    try { sessionStorage.setItem(AUGMENTS_JSON_KEY, json); } catch { /* In-memory lookup still works. */ }
    pendingJson = json;
    if (writing) return;
    writing = true;
    try {
        while (pendingJson !== null) {
            const content = pendingJson;
            pendingJson = null;
            try {
                const root = await navigator.storage.getDirectory();
                const handle = await root.getFileHandle(AUGMENTS_JSON_FILE, { create: true });
                const writer = await handle.createWritable();
                try { await writer.write(content); await writer.close(); }
                catch (error) { await writer.abort().catch(() => {}); throw error; }
                fileError = null;
            } catch (error) {
                fileError = error instanceof Error ? error.message : String(error);
            }
        }
    } finally { writing = false; }
}

if (typeof window !== 'undefined' && window === window.top) {
    // Manual classifications are independent of raw session JSON and are loaded once per page.
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        void (async () => {
            try {
                const response = await fetch(chrome.runtime.getURL('database/augment-rules.json'));
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const errors = catalog.setRules(await response.json());
                if (errors.length) console.warn('[KI] Augment rules:', errors);
                window.dispatchEvent(new CustomEvent(AUGMENTS_UPDATED));
            } catch (error) {
                console.warn('[KI] Augment rules unavailable; automatic classification remains active:', error);
            }
        })();
    }
    // Never hydrate the previous page/account snapshot. Start by replacing its JSON.
    void persist(catalog.export());
    window.addEventListener('message', event => {
        if (event.source !== window || event.data?.type !== AUGMENTS_MESSAGE || !catalog.accept(event.data.detail)) return;
        void persist(catalog.export());
        window.dispatchEvent(new CustomEvent(AUGMENTS_UPDATED));
    });
    window.postMessage({ type: AUGMENTS_REQUEST }, '*');
}

export const AugmentCatalog = {
    getDevice(url: string, element?: Element | null) {
        const id = element?.getAttribute('data-kasp-augment-id') || element?.querySelector('[data-kasp-augment-id]')?.getAttribute('data-kasp-augment-id');
        return catalog.get(url, id || undefined);
    },
    export: catalog.export,
    storageStatus: () => ({ file: AUGMENTS_JSON_FILE, fileError }),
};
