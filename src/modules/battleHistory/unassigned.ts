import type { BattleData } from './types';

export const UNASSIGNED_HISTORY_KEY = 'kasp_history_unassigned_v1';
type UnassignedResult = { id: string; owner: null; savedAt: number; result: Omit<BattleData, 'userId' | 'id'> };
export function readUnassignedResults(): UnassignedResult[] {
    try {
        const raw = sessionStorage.getItem(UNASSIGNED_HISTORY_KEY);
        if (!raw || raw.length > 2_000_000) return [];
        const entries: unknown = JSON.parse(raw);
        return Array.isArray(entries) ? entries.filter((entry): entry is UnassignedResult =>
            !!entry && entry.owner === null && typeof entry.id === 'string' && typeof entry.savedAt === 'number'
            && Date.now() - entry.savedAt < 86400000 && !!entry.result && typeof entry.result === 'object').slice(-20) : [];
    } catch { return []; }
}
export function stashUnassignedResult(battle: BattleData): string | null {
    try {
        const { userId: _owner, id: _localKey, ...result } = battle;
        const id = crypto.randomUUID();
        const entries = [...readUnassignedResults(), { id, owner: null, savedAt: Date.now(), result }].slice(-20);
        const raw = JSON.stringify(entries);
        if (raw.length > 2_000_000) return null;
        sessionStorage.setItem(UNASSIGNED_HISTORY_KEY, raw); return id;
    } catch { return null; }
}
export function removeUnassignedResult(id: string): void {
    try { sessionStorage.setItem(UNASSIGNED_HISTORY_KEY, JSON.stringify(readUnassignedResults().filter(entry => entry.id !== id))); } catch { }
}
