import type { BattleData } from './types';

const DATABASE_NAME = 'TankiBattlesDB';
const DATABASE_VERSION = 4;
const STORE_NAME = 'battles';
const INDEXES = ['date', 'map', 'mode', 'top', 'nickname'] as const;

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
        };
        request.onsuccess = () => {
            const db = request.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };
        request.onerror = () => reject(request.error);
    });
}

/** Requests run synchronously inside a transaction; results become visible only after commit. */
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
    return transaction('readwrite', (store, setResult) => {
        const request = store.add(battle);
        request.onsuccess = () => setResult(request.result);
    });
}

export async function addBattles(battles: BattleData[]): Promise<void> {
    if (!battles.length) return;
    await transaction<void>('readwrite', store => {
        for (const battle of battles) store.add(battle);
    });
}

export function getAllBattles(nickname: string): Promise<BattleData[]> {
    return transaction('readonly', (store, setResult) => {
        const request = nickname && store.indexNames.contains('nickname')
            ? store.index('nickname').getAll(nickname)
            : store.getAll();
        request.onsuccess = () => setResult(request.result || []);
    });
}

export function getNicknameHistory(): Promise<Array<{ nickname: string; count: number }>> {
    return transaction('readonly', (store, setResult) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const counts = new Map<string, number>();
            for (const battle of request.result as BattleData[]) {
                if (battle.nickname) counts.set(battle.nickname, (counts.get(battle.nickname) || 0) + 1);
            }
            setResult(Array.from(counts, ([nickname, count]) => ({ nickname, count }))
                .sort((a, b) => a.nickname.localeCompare(b.nickname)));
        };
    });
}

export function mergeNicknameHistory(source: string, target: string): Promise<number> {
    return transaction('readwrite', (store, setResult) => {
        let count = 0;
        setResult(count);
        const request = store.index('nickname').openCursor(IDBKeyRange.only(source));
        request.onsuccess = () => {
            const cursor = request.result;
            if (!cursor) return;
            const battle = cursor.value as BattleData;
            battle.nickname = target;
            cursor.update(battle);
            setResult(++count);
            cursor.continue();
        };
    });
}

export function clearNicknameHistory(nickname: string): Promise<void> {
    return transaction('readwrite', store => {
        const request = store.index('nickname').getAllKeys(nickname);
        request.onsuccess = () => {
            for (const key of request.result) store.delete(key);
        };
    });
}
