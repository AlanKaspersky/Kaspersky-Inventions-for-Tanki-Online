import { getHistoryImageUrl } from '../../core/historyMarkup';
import type { BattleData, PlayerData } from './types';

export const validateImportedBattle = (value: unknown): BattleData | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const battle = value as Record<string, unknown>;
    const requiredStrings = ['nickname', 'status', 'map', 'mode', 'top'];
    const requiredNumbers = ['date', 'reputation', 'kills', 'deaths', 'kd', 'crystals', 'stars'];

    if (requiredStrings.some(key => typeof battle[key] !== 'string')) return null;
    if (requiredNumbers.some(key => typeof battle[key] !== 'number' || !Number.isFinite(battle[key] as number))) return null;
    if (typeof battle.date !== 'number' || (battle.date as number) <= 0) return null;
    if (battle.kind !== undefined && battle.kind !== 'MM' && battle.kind !== 'PRO') return null;

    const iconFields = ['turretIcon', 'turretAugmentIcon', 'hullIcon', 'hullAugmentIcon'];
    if (iconFields.some(key => battle[key] !== undefined && typeof battle[key] !== 'string')) return null;
    const teamFields = ['teamScoreMy', 'teamScoreEnemy'];
    if (teamFields.some(key => battle[key] !== undefined && (typeof battle[key] !== 'number' || !Number.isFinite(battle[key] as number)))) return null;

    let players: PlayerData[] = [];
    if (battle.players !== undefined) {
        if (!Array.isArray(battle.players)) return null;
        for (const value of battle.players) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            const player = value as Record<string, unknown>;
            if (typeof player.name !== 'string' || typeof player.rank !== 'string') return null;
            const numericFields = ['gs', 'score', 'kills', 'deaths', 'kd', 'crystals', 'stars'];
            if (numericFields.some(key => typeof player[key] !== 'number' || !Number.isFinite(player[key] as number))) return null;
            if (typeof player.isEnemy !== 'boolean' || typeof player.isMe !== 'boolean') return null;
            players.push({
                name: player.name,
                rank: getHistoryImageUrl(player.rank),
                gs: player.gs as number,
                score: player.score as number,
                kills: player.kills as number,
                deaths: player.deaths as number,
                kd: player.kd as number,
                crystals: player.crystals as number,
                stars: player.stars as number,
                isEnemy: player.isEnemy,
                isMe: player.isMe,
            });
        }
    }

    return {
        nickname: battle.nickname as string,
        date: battle.date as number,
        status: battle.status as string,
        map: battle.map as string,
        mode: battle.mode as string,
        kind: battle.kind as 'MM' | 'PRO' | undefined,
        top: battle.top as string,
        reputation: battle.reputation as number,
        kills: battle.kills as number,
        deaths: battle.deaths as number,
        kd: battle.kd as number,
        crystals: battle.crystals as number,
        stars: battle.stars as number,
        turretIcon: getHistoryImageUrl(battle.turretIcon),
        turretAugmentIcon: getHistoryImageUrl(battle.turretAugmentIcon),
        hullIcon: getHistoryImageUrl(battle.hullIcon),
        hullAugmentIcon: getHistoryImageUrl(battle.hullAugmentIcon),
        teamScoreMy: battle.teamScoreMy as number | undefined,
        teamScoreEnemy: battle.teamScoreEnemy as number | undefined,
        players,
    };
};

/** Validate every record before starting the single import transaction. */
export function parseHistoryImport(text: string): BattleData[] {
    const data: unknown = JSON.parse(text);
    if (!Array.isArray(data) || data.length === 0) throw new Error('empty-or-invalid-list');
    return data.map(value => {
        const battle = validateImportedBattle(value);
        if (!battle) throw new Error('invalid-battle-record');
        return battle;
    });
}
