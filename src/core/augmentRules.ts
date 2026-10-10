import { resolveAugmentProperty } from './augmentLabels';

export interface AugmentRule {
    objectId: string;
    property: string;
    status: 'better' | 'lower';
}

export function parseAugmentRules(value: unknown): { rules: AugmentRule[]; errors: string[] } {
    const source = value as { rules?: unknown };
    if (!source || !Array.isArray(source.rules) || source.rules.length > 10000) return { rules: [], errors: ['Expected a rules array with at most 10000 entries.'] };
    const rules = new Map<string, AugmentRule>();
    const errors: string[] = [];
    for (const [index, entry] of source.rules.entries()) {
        const raw = entry as Record<string, unknown>;
        const name = raw?.property ?? raw?.properity;
        const property = typeof name === 'string' ? resolveAugmentProperty(name) : null;
        if (!raw || typeof raw.objectId !== 'string' || !/^\d{1,20}$/.test(raw.objectId) || !property ||
            raw.status !== 'better' && raw.status !== 'lower') {
            errors.push(`Rule ${index + 1}: invalid objectId, property, or status.`);
            continue;
        }
        const key = `${raw.objectId}:${property}`;
        if (rules.has(key)) errors.push(`Rule ${index + 1}: duplicate ${key}; the last entry wins.`);
        rules.set(key, { objectId: raw.objectId, property, status: raw.status });
    }
    return { rules: [...rules.values()], errors };
}
