import { featureScope } from '../core/featureRuntime';
const lifecycle = featureScope('discordPresence');
import { isElectronClient } from '../core/electron';
import { getAccountIdentity } from '../core/accountIdentity';
import { state } from '../core/state';
import { utils } from '../core/utils';
import { DataLoader } from '../core/dataLoader';
import { BATTLE_PRESENCE_MESSAGE } from '../core/battlePresence';
import type { BattlePresence } from '../core/battlePresence';
import { postPageMessage, readPageMessage } from '../core/pageMessages';

export function setupDiscordPresence(): void {
    if (!isElectronClient()) return;
    const labels = { loading: 'Loading the game', lobby: 'In the lobby', garage: 'In the garage',
        battle: 'In a battle', match_results: 'Battle results' };
    const screenLabels = new Map(Object.entries(labels));
    let battle: BattlePresence | null = null, receivedAt = 0, end: number | undefined;
    lifecycle.listen(window, 'message', event => {
        const message = readPageMessage(event, window, BATTLE_PRESENCE_MESSAGE);
        if (!message) return;
        const next = message.battle;
        const now = Date.now();
        const candidate = next?.remaining === undefined ? undefined : Math.floor(now / 1000) + Math.ceil(next.remaining);
        if (next?.map !== battle?.map || candidate === undefined || end === undefined || Math.abs(candidate - end) > 3) end = candidate;
        battle = next;
        receivedAt = now;
    });
    const send = () => {
        const hidden = utils.getSetting('k_hideNicknameXP', false);
        const account = hidden ? null : getAccountIdentity();
        const active = state.currentScreen === 'battle' && battle && Date.now() - receivedAt < 5000 ? battle : null;
        const rawMap = active?.map.replace(/\s+(?:TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i, '').trim();
        const translated = rawMap ? DataLoader.translateMap(rawMap, 'EN') : null;
        const mode = active?.mode || /\s+(TDM|DM|CTF|CP|SGE|RGB|JGR|TJR|ASL|AR|AS|RUGBY|SUR|HOLIDAY|TAR|TUTORIAL)$/i.exec(active?.map || '')?.[1]?.toUpperCase();
        const details = translated && !/[\u0400-\u04ff]/.test(translated)
            ? `${translated}${mode ? ` ${mode}` : ''}` : screenLabels.get(state.currentScreen) || labels.lobby;
        postPageMessage(window, { type: 'kasp:discord-presence', version: 1,
            presence: { details, state: hidden ? 'Hidden' : account?.nickname || 'Signing in',
                ...(active && end !== undefined ? { timestamps: { end } } : {}),
                ...(active && active.players !== undefined && active.maxPlayers !== undefined && active.players <= active.maxPlayers
                    ? { party: { size: [active.players, active.maxPlayers] } } : {}) } });
    };
    let timer: number | undefined;
    const start = () => {
        if (timer !== undefined) return;
        send();
        timer = lifecycle.interval(send, 3000);
    };
    lifecycle.onCleanup(() => { postPageMessage(window, { type: 'kasp:discord-presence', version: 1, presence: null }); });
    start();
    const refreshPrivacy = () => { if (timer !== undefined) send(); };
    lifecycle.listen(window, 'kasp:settings-changed', refreshPrivacy);
    lifecycle.listen(window, 'storage', event => {
        if (event.key === 'k_hideNicknameXP') refreshPrivacy();
    });
    lifecycle.listen(window, 'pageshow', start);
    lifecycle.listen(window, 'pagehide', () => {
        lifecycle.cancelInterval(timer);
        timer = undefined;
        postPageMessage(window, { type: 'kasp:discord-presence', version: 1, presence: null });
    });
}
