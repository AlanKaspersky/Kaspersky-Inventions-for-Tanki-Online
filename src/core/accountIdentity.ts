import { ACCOUNT_IDENTITY_MESSAGE, ACCOUNT_IDENTITY_REQUEST, normalizeAccountId } from './accountId';
import type { VerifiedAccount } from './accountId';
import { featureScope } from './featureRuntime';
import { gameDOM } from './gameDOM';
import { postPageMessage, readPageMessage } from './pageMessages';

export interface AccountIdentity {
    nickname: string;
    clanTag: string;
    displayName: string;
}

export function parseAccountIdentity(text: string): AccountIdentity | null {
    const displayName = text.trim();
    const clanTag = /^\[.*?\]/.exec(displayName)?.[0] || '';
    const nickname = displayName.replace(/^\[.*?\]\s*/, '').trim();
    return nickname ? { nickname, clanTag, displayName } : null;
}

export function getAccountIdentity(): AccountIdentity | null {
    const header = document.querySelector(gameDOM.account.headerName);
    const identity = parseAccountIdentity(header?.textContent || '');
    if (identity) return identity;

    for (const parameter of document.querySelectorAll(gameDOM.account.clientParameter)) {
        const uid = /^UID:\s*(.+)$/i.exec(parameter.textContent?.trim() || '');
        if (uid) return parseAccountIdentity(uid[1]);
    }

    const selfName = document.querySelector(gameDOM.account.resultName);
    return parseAccountIdentity(selfName?.textContent || '');
}
let nativeAccount: VerifiedAccount | null = null;
let receivedAt = 0;
let players = new Map<string, string | null>();
let initialized = false;
let identityRevision = 0;
let identityKey = '';

export function setupAccountIdentity(): void {
    if (initialized) return;
    initialized = true;
    const lifecycle = featureScope('accountIdentity');
    lifecycle.onCleanup(() => { nativeAccount = null; players.clear(); receivedAt = 0; });
    lifecycle.listen(window, 'message', event => {
        const message = readPageMessage(event, window, ACCOUNT_IDENTITY_MESSAGE);
        if (!message) return;
        const snapshot = message.snapshot;
        nativeAccount = null;
        players = new Map();
        receivedAt = Date.now();
        const account = snapshot?.account;
        const userId = typeof account?.userId === 'string' ? normalizeAccountId(account.userId) : null;
        if (!account || !userId || typeof account.nickname !== 'string' || !account.nickname.trim() || typeof account.clanTag !== 'string') return;
        nativeAccount = { userId, nickname: account.nickname, clanTag: account.clanTag };
        if (!Array.isArray(snapshot.players) || snapshot.players.length > 6000) return;
        for (const player of snapshot.players) {
            const id = typeof player?.userId === 'string' ? normalizeAccountId(player.userId) : null;
            if (!id || typeof player.nickname !== 'string' || !player.nickname.trim()) continue;
            const previous = players.get(player.nickname);
            players.set(player.nickname, previous === undefined || previous === id ? id : null);
        }
        const key = JSON.stringify([nativeAccount, [...players]]);
        if (key !== identityKey) { identityKey = key; identityRevision++; }
    });
    postPageMessage(window, { type: ACCOUNT_IDENTITY_REQUEST });
}

export function getVerifiedAccount(): VerifiedAccount | null {
    // Logout reloads the page. Keep the verified owner through delayed background
    // heartbeats; explicit native invalidation and cleanup still clear this cache.
    if (!nativeAccount) return null;
    const visible = getAccountIdentity();
    if (visible && visible.nickname !== nativeAccount.nickname) return null;
    return { ...nativeAccount };
}

export function getPlayerUserId(nickname: string): string | null {
    return getVerifiedAccount() && Date.now() - receivedAt <= 5000 ? players.get(nickname) || null : null;
}

export function getAccountIdentityRevision(): number { return identityRevision; }
