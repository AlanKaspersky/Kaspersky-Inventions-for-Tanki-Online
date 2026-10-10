import { isElectronClient } from '../core/electron';
import { getAccountIdentity } from '../core/accountIdentity';
import { state } from '../core/state';
import { DataLoader } from '../core/dataLoader';
import { BATTLE_PRESENCE_MESSAGE } from '../core/battlePresence';
import type { BattlePresence } from '../core/battlePresence';

export function setupDiscordPresence(): void {
    if (!isElectronClient()) return;
    const labels = { loading: 'Loading the game', lobby: 'In the lobby', garage: 'In the garage',
        battle: 'In a battle', match_results: 'Battle results' };
    let battle: BattlePresence | null = null, receivedAt = 0, end: number | undefined;
    window.addEventListener('message', event => {
        if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== BATTLE_PRESENCE_MESSAGE) return;
        const next = event.data.battle;
        if (next !== null && (!next || typeof next.map !== 'string' || next.map.length > 128 ||
            next.mode !== undefined && (typeof next.mode !== 'string' || !/^(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/.test(next.mode)) ||
            next.remaining !== undefined && (!Number.isFinite(next.remaining) || next.remaining < 0 || next.remaining > 86400) ||
            next.players !== undefined && (!Number.isInteger(next.players) || next.players < 0 || next.players > 1000) ||
            next.maxPlayers !== undefined && (!Number.isInteger(next.maxPlayers) || next.maxPlayers <= 0 || next.maxPlayers > 1000))) return;
        const now = Date.now();
        const candidate = next?.remaining === undefined ? undefined : Math.floor(now / 1000) + Math.ceil(next.remaining);
        if (next?.map !== battle?.map || candidate === undefined || end === undefined || Math.abs(candidate - end) > 3) end = candidate;
        battle = next;
        receivedAt = now;
    });
    const send = () => {
        const account = getAccountIdentity();
        const active = state.currentScreen === 'battle' && battle && Date.now() - receivedAt < 5000 ? battle : null;
        const rawMap = active?.map.replace(/\s+(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i, '').trim();
        const translated = rawMap ? DataLoader.translateMap(rawMap, 'EN') : null;
        const mode = active?.mode || /\s+(TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i.exec(active?.map || '')?.[1]?.toUpperCase();
        const details = translated && !/[\u0400-\u04ff]/.test(translated)
            ? `${translated}${mode ? ` ${mode}` : ''}` : labels[state.currentScreen] || labels.lobby;
        window.postMessage({ type: 'kasp:discord-presence', version: 1,
            presence: { details, state: account?.nickname || 'Signing in',
                ...(active && end !== undefined ? { timestamps: { end } } : {}),
                ...(active && active.players !== undefined && active.maxPlayers !== undefined && active.players <= active.maxPlayers
                    ? { party: { size: [active.players, active.maxPlayers] } } : {}) } }, window.location.origin);
    };
    let timer: number | undefined;
    const start = () => {
        if (timer !== undefined) return;
        send();
        timer = window.setInterval(send, 3000);
    };
    start();
    window.addEventListener('pageshow', start);
    window.addEventListener('pagehide', () => {
        window.clearInterval(timer);
        timer = undefined;
        window.postMessage({ type: 'kasp:discord-presence', version: 1, presence: null }, window.location.origin);
    });
}
