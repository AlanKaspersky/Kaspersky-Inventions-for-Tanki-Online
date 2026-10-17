export const ACCOUNT_IDENTITY_MESSAGE = 'kasp:account-identity';
export const ACCOUNT_IDENTITY_REQUEST = 'kasp:account-identity:request';
export interface VerifiedAccount { userId: string; nickname: string; clanTag: string; }
export interface PlayerIdentity { userId: string; nickname: string; }
export interface AccountSnapshot { account: VerifiedAccount | null; players: PlayerIdentity[]; }

export function normalizeAccountId(value: unknown): string | null {
    try {
        if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
        if (!['string', 'number', 'bigint', 'object'].includes(typeof value) || value === null) return null;
        const text = String(value);
        if (!/^-?[1-9]\d{0,19}$/.test(text)) return null;
        const id = BigInt(text);
        return id >= -(1n << 63n) && id < (1n << 64n) ? text : null;
    } catch { return null; }
}
