import type { BattleData } from './types';
import { normalizeAccountId } from '../../core/accountId';
import { getBattleIdentity } from './battleIdentity';

const DATABASE_NAME = 'TankiBattlesDB';
const DATABASE_VERSION = 5;
const STORE_NAME = 'battles';
const INDEXES = ['date', 'map', 'mode', 'top', 'userId'] as const;

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            const store = db.objectStoreNames.contains(STORE_NAME)
                ? request.transaction!.objectStore(STORE_NAME)
                : db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            for (const index of INDEXES) {
                if (!store.indexNames.contains(index)) store.createIndex(index, index, { unique: false });
            }
            if (store.indexNames.contains('nickname')) store.deleteIndex('nickname');
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    });
}

async function transaction<T>(
    mode: IDBTransactionMode,
    enqueue: (store: IDBObjectStore, setResult: (result: T) => void) => void,
): Promise<T> {
    const db = await openDatabase();
    try {
        return await new Promise<T>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            let result: T;
            let failure: unknown;
            tx.oncomplete = () => failure ? reject(failure) : resolve(result);
            tx.onerror = () => { failure = tx.error || new Error('Battle history transaction failed'); };
            tx.onabort = () => reject(failure || tx.error || new Error('Battle history transaction aborted'));
            try {
                enqueue(tx.objectStore(STORE_NAME), value => { result = value; });
            } catch (error) {
                failure = error;
                try { tx.abort(); } catch { reject(error); }
            }
        });
    } finally {
        db.close();
    }
}

export function addBattle(battle: BattleData): Promise<IDBValidKey> {
    if (typeof battle.userId !== 'string' || normalizeAccountId(battle.userId) !== battle.userId) return Promise.reject(new Error('account-id-required'));
    return transaction('readwrite', (store, setResult) => {
        const request = store.add({ ...battle, battleId: battle.battleId || crypto.randomUUID() });
        request.onsuccess = () => setResult(request.result);
    });
}

export async function addBattles(battles: BattleData[], userId: string): Promise<number> {
    if (!battles.length) return 0;
    if (normalizeAccountId(userId) !== userId || battles.some(battle => battle.userId !== userId)) throw new Error('history-owner-mismatch');
    if (battles.some(battle => !getBattleIdentity(battle))) throw new Error('battle-id-required');
    return transaction<number>('readwrite', (store, setResult) => {
        const existing = store.index('userId').getAll(userId);
        existing.onsuccess = () => {
            const known = new Set((existing.result as BattleData[]).map(getBattleIdentity));
            let added = 0;
            for (const battle of battles) {
                const battleId = getBattleIdentity(battle)!;
                if (known.has(battleId)) continue;
                known.add(battleId);
                const { id: _sourceKey, ...record } = battle;
                store.add({ ...record, battleId });
                added++;
            }
            setResult(added);
        };
    });
}

export function getAllBattles(userId: string | null): Promise<BattleData[]> {
    if (!userId || normalizeAccountId(userId) !== userId) return Promise.resolve([]);
    return transaction('readonly', (store, setResult) => {
        const request = store.index('userId').getAll(userId);
        request.onsuccess = () => setResult((request.result as BattleData[] || []).map(battle => ({
            ...battle, battleId: getBattleIdentity(battle) || undefined,
        })));
    });
}

export function clearAccountHistory(userId: string): Promise<void> {
    if (normalizeAccountId(userId) !== userId) return Promise.reject(new Error('account-id-required'));
    return transaction('readwrite', store => {
        const request = store.index('userId').getAllKeys(userId);
        request.onsuccess = () => {
            for (const key of request.result) store.delete(key);
        };
    });
}
