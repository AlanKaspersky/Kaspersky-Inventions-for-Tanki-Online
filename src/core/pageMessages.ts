import type { AccountSnapshot } from './accountId';
import type { BattlePresence } from './battlePresence';
import type { BonusPickup } from './bonusPickup';
import type { AugmentSnapshot } from './gameAugments';
import type { OverdrivePose } from './overdriveDirection';

interface PageMessages {
    'kasp:account-identity': { type: 'kasp:account-identity'; snapshot: AccountSnapshot };
    'kasp:account-identity:request': { type: 'kasp:account-identity:request' };
    'kasp:game-augments': { type: 'kasp:game-augments'; detail: AugmentSnapshot };
    'kasp:game-augments-request': { type: 'kasp:game-augments-request' };
    'kasp:bonus-pickup': { type: 'kasp:bonus-pickup'; detail: BonusPickup | string };
    'kasp:overdrive-direction': { type: 'kasp:overdrive-direction'; pose: OverdrivePose | null; at: number };
    'kasp:battle-kind': { type: 'kasp:battle-kind'; detail: 'MM' | 'PRO' };
    'kasp:battle-mode': { type: 'kasp:battle-mode'; detail: string };
    'kasp:useraction': { type: 'kasp:useraction'; detail: string[] };
    'kasp:battle-presence': { type: 'kasp:battle-presence'; battle: BattlePresence | null; at: number };
    'kasp:discord-presence': { type: 'kasp:discord-presence'; version: 1; presence: {
        details: string; state: string; timestamps?: { end: number }; party?: { size: [number, number] };
    } | null };
}
export type PageMessage = PageMessages[keyof PageMessages];
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const finite = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const modes = /^(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/;
function identity(value: unknown): boolean {
    if (!object(value) || !text(value.userId, 21) || !/^-?[1-9]\d{0,19}$/.test(value.userId)
        || !text(value.nickname, 128)) return false;
    const id = BigInt(value.userId);
    return id >= -(1n << 63n) && id < (1n << 64n);
}
function valid(message: RecordValue): boolean {
    const detail = message.detail;
    switch (message.type) {
        case 'kasp:account-identity:request':
        case 'kasp:game-augments-request': return true;
        case 'kasp:account-identity': {
            const snapshot = message.snapshot;
            return object(snapshot) && (snapshot.account === null || identity(snapshot.account)
                && object(snapshot.account) && typeof snapshot.account.clanTag === 'string' && snapshot.account.clanTag.length <= 128)
                && Array.isArray(snapshot.players) && snapshot.players.length <= 6000 && snapshot.players.every(identity);
        }
        case 'kasp:game-augments': return object(detail) && detail.format === 'kasp-augments-v1'
            && Array.isArray(detail.devices) && detail.devices.length <= 20000;
        case 'kasp:battle-kind': return detail === 'MM' || detail === 'PRO';
        case 'kasp:battle-mode': return typeof detail === 'string' && modes.test(detail);
        case 'kasp:useraction': return Array.isArray(detail) && detail.length >= 3 && detail.length <= 4
            && detail[0] === 'TankUserActionLog' && text(detail[1], 29) && detail[1].trim().length >= 2
            && typeof detail[2] === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(detail[2])
            && (detail.length === 3 || typeof detail[3] === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(detail[3]));
        case 'kasp:bonus-pickup': {
            if (typeof detail === 'string') return /^\d{1,20}$/.test(detail);
            if (!object(detail) || typeof detail.model !== 'string' || !/^\d{1,20}$/.test(detail.model)) return false;
            const position = detail.position;
            return position === null || object(position)
                && ['x', 'y', 'z'].every(axis => finite(position[axis], -1e8, 1e8));
        }
        case 'kasp:battle-presence': {
            const battle = message.battle;
            return finite(message.at, 0, Number.MAX_SAFE_INTEGER) && (battle === null || object(battle)
                && typeof battle.map === 'string' && battle.map.length <= 128
                && (battle.mode === undefined || typeof battle.mode === 'string' && modes.test(battle.mode))
                && (battle.remaining === undefined || finite(battle.remaining, 0, 86400))
                && (battle.players === undefined || Number.isInteger(battle.players) && finite(battle.players, 0, 1000))
                && (battle.maxPlayers === undefined || Number.isInteger(battle.maxPlayers) && finite(battle.maxPlayers, 1, 1000)));
        }
        case 'kasp:overdrive-direction': {
            const pose = message.pose;
            const position = object(pose) ? pose.position : null;
            return finite(message.at, 0, Number.MAX_SAFE_INTEGER) && (pose === null || object(pose)
                && object(position) && ['x', 'y', 'z'].every(axis => finite(position[axis], -1e8, 1e8))
                && finite(pose.yaw, -1e6, 1e6));
        }
        case 'kasp:discord-presence': {
            const presence = message.presence;
            if (message.version !== 1) return false;
            return presence === null || object(presence) && text(presence.details, 128) && text(presence.state, 128)
                && (presence.timestamps === undefined || object(presence.timestamps) && finite(presence.timestamps.end, 0, Number.MAX_SAFE_INTEGER))
                && (presence.party === undefined || object(presence.party) && Array.isArray(presence.party.size)
                    && presence.party.size.length === 2 && presence.party.size.every(n => Number.isInteger(n) && finite(n, 0, 1000))
                    && presence.party.size[1] > 0 && presence.party.size[0] <= presence.party.size[1]);
        }
        default: return false;
    }
}

export function readPageMessage<K extends keyof PageMessages>(event: MessageEvent<unknown>, page: Window, type: K): PageMessages[K] | null {
    if (event.source !== page || event.origin !== page.location.origin || !object(event.data) || event.data.type !== type) return null;
    return valid(event.data) ? event.data as unknown as PageMessages[K] : null;
}

export function postPageMessage(page: Window, message: PageMessage): void {
    if (valid(message as unknown as RecordValue)) page.postMessage(message, page.location.origin);
}
