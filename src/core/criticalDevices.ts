import type { GameAugment } from './gameAugments';

export type CriticalDevice = Pick<GameAugment, 'id' | 'name' | 'baseItemId' | 'properties'>;

const profiles = [
    ['1931009774129', '920009631123', 'Strict Ammunition Load', 1, -1],
    ['921009712832', '920009630969', 'Sorted Ammunition', 1, -2],
    ['1931009803197', '920009631046', 'Revolver', -1, -1],
] as const;
const known = new Map<string, CriticalDevice>(profiles.map(([id, baseItemId, name, start, after]) => [id, {
    id, baseItemId, name,
    properties: Object.entries({ START_CRITICAL_HIT_CHANCE: start, AFTER_CRIT_CRITICAL_HIT_CHANCE: after,
        MAX_CRITICAL_HIT_CHANCE: 1, CRITICAL_CHANCE_DELTA: 1 }).map(([property, value]) => ({
        property, value, operation: 'OVERRIDE_VALUE' as const,
    })),
}]));

export function knownCriticalDevice(id: string): CriticalDevice | null {
    const value = known.get(id);
    return value ? { ...value, properties: value.properties.map(property => ({ ...property })) } : null;
}
