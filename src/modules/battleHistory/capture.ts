import { gameDOM } from '../../core/gameDOM';
import { equipmentTracker } from '../equipmentTracker';
import { addBattle } from './repository';
import type { BattleData, PlayerData, HistoryAccount } from './types';
import { stashUnassignedResult, removeUnassignedResult } from './unassigned';

export const parseMapAndMode = (rawMapText: string) => {
    if (!rawMapText) return { map: 'Unknown Map', mode: 'MM' };
    let text = rawMapText.trim();
    const modesList = ['CTF', 'TDM', 'DM', 'CP', 'SGE', 'RGB', 'JGR', 'TJR', 'ASL', 'AR'];
    let foundMode = 'MM';
    const parts = text.split(/\s+/);
    if (parts.length > 0) {
        const lastWord = parts[parts.length - 1].toUpperCase();
        if (modesList.includes(lastWord)) {
            foundMode = parts.pop() || 'MM';
            text = parts.join(' ');
        }
    }
    const cleanMapName = text.replace(/\s+/g, ' ').trim();
    return { map: cleanMapName || 'Unknown', mode: foundMode };
};

function readInteger(row: Element, column: number): number {
    return parseInt((row.querySelector(gameDOM.results.columnPrefix + column)?.textContent || '0').replace(/\s/g, '')) || 0;
}

function readPlayers(tbody: Element | null): PlayerData[] {
    const players: PlayerData[] = [];

    if (tbody) {
        const allRows = Array.from(tbody.children);
        let isEnemyTeam = false;
        for (const row of allRows) {
            if (row.id === gameDOM.ids.spacer) continue;
            if (row.id === gameDOM.ids.teamDivider) {
                isEnemyTeam = true;
                continue;
            }

            const nickEl = row.querySelector(gameDOM.results.playerName);
            if (!nickEl) continue;
            const rawNick = nickEl.textContent || '';
            const rankImg = row.querySelector(gameDOM.results.rankIcon) as HTMLImageElement | null;
            const rankSrc = rankImg ? rankImg.src : '';
            const gsEl = row.querySelector(gameDOM.results.gearScore);
            const gs = gsEl ? gsEl.textContent?.trim().replace(/\s/g, '') : '0';

            const pScore = readInteger(row, 3);
            const pKills = readInteger(row, 4);
            const pDeaths = readInteger(row, 5);
            const pKd = parseFloat(row.querySelector(gameDOM.results.kd)?.textContent || '0') || 0;
            const pCrystals = readInteger(row, 7);
            const pStars = readInteger(row, 8);

            const isMe = row.id === gameDOM.ids.selfRow;

            players.push({
                name: rawNick,
                rank: rankSrc,
                gs: parseInt(gs || '0') || 0,
                score: pScore, kills: pKills, deaths: pDeaths, kd: pKd, crystals: pCrystals, stars: pStars,
                isEnemy: isEnemyTeam,
                isMe: isMe
            });
        }
    }

    return players;
}

function readPlacement(selfRow: Element): { top: string; firstTeam: boolean } {
    let firstTeam = true;
    let topVal = '-';
    if (selfRow.parentElement) {
        const allRows = Array.from(selfRow.parentElement.children);
        const selfIndex = allRows.indexOf(selfRow);
        const teamDividerIndex = allRows.findIndex((r) => r.id === gameDOM.ids.teamDivider);
        firstTeam = teamDividerIndex === -1 || selfIndex <= teamDividerIndex;
        let teamRows: Element[] = [];
        if (teamDividerIndex === -1) teamRows = allRows;
        else if (selfIndex < teamDividerIndex) teamRows = allRows.slice(0, teamDividerIndex);
        else teamRows = allRows.slice(teamDividerIndex + 1);

        const actualPlayers = teamRows.filter((r) => r.id && r.id !== gameDOM.ids.spacer && r.id !== gameDOM.ids.teamDivider);
        const rank = actualPlayers.indexOf(selfRow) + 1;
        if (rank > 0) topVal = rank.toString();
    }

    return { top: topVal, firstTeam };
}

export function readBattleResult(selfRow: Element, nickname: string, userId: string): BattleData | null {
    const scoreEl = selfRow.querySelector(gameDOM.results.score);
    const killsEl = selfRow.querySelector(gameDOM.results.kills);
    const deathsEl = selfRow.querySelector(gameDOM.results.deaths);
    if (!scoreEl || !killsEl || !deathsEl) return null;

    const scoreText = (scoreEl.textContent || '').trim();
    const killsText = (killsEl.textContent || '').trim();
    const deathsText = (deathsEl.textContent || '').trim();
    if (!scoreText || !killsText || !deathsText) return null;

    const players = readPlayers(document.querySelector(gameDOM.results.body));

    const mapEl = document.querySelector(gameDOM.results.mapName);
    const rawMapText = mapEl ? mapEl.textContent?.trim() || '' : 'Unknown Map';
    const parsedMapData = parseMapAndMode(rawMapText);
    const statusEl = document.querySelector(gameDOM.results.status) ||
        document.querySelector(gameDOM.results.statusFallback);
    const isDM = parsedMapData.mode.toUpperCase() === 'DM' || (statusEl && statusEl.textContent?.trim() === '');
    if (isDM) {
        for (const p of players) {
            p.isEnemy = !p.isMe;
        }
    }
    const statusText = isDM ? 'DM' : (statusEl ? statusEl.textContent?.trim() || 'Victory' : 'Victory');

    const { top: topVal, firstTeam } = readPlacement(selfRow);

    let teamScoreMy: number | undefined;
    let teamScoreEnemy: number | undefined;
    if (!isDM) {
        const firstScoreEl = document.querySelector<HTMLElement>(
            gameDOM.results.firstTeamScore
        );
        const secondScoreEl = document.querySelector<HTMLElement>(
            gameDOM.results.secondTeamScore
        );
        const firstScore = firstScoreEl
            ? parseInt((firstScoreEl.textContent || '').replace(/\s/g, ''), 10)
            : NaN;
        const secondScore = secondScoreEl
            ? parseInt((secondScoreEl.textContent || '').replace(/\s/g, ''), 10)
            : NaN;

        if (!isNaN(firstScore) && !isNaN(secondScore)) {
            teamScoreMy = firstTeam ? firstScore : secondScore;
            teamScoreEnemy = firstTeam ? secondScore : firstScore;
        }
    }

    const score = parseInt(scoreText.replace(/\s/g, '')) || 0;
    const kills = parseInt(killsText.replace(/\s/g, '')) || 0;
    const deaths = parseInt(deathsText.replace(/\s/g, '')) || 0;
    const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
    const crystals = readInteger(selfRow, 7);
    const stars = parseInt(selfRow.querySelector(gameDOM.results.stars)?.textContent || '0') || 0;
    const eq = equipmentTracker.get();

    return {
        userId,
        nickname,
        date: Date.now(),
        status: statusText,
        map: parsedMapData.map,
        mode: parsedMapData.mode,
        kind: (window.__kaspBattleKind as 'MM' | 'PRO') ?? 'MM',
        top: topVal,
        reputation: score,
        kills,
        deaths,
        kd,
        crystals,
        stars,
        turretIcon: eq?.turret ?? '',
        turretAugmentIcon: eq?.turretAugment ?? '',
        hullIcon: eq?.hull ?? '',
        hullAugmentIcon: eq?.hullAugment ?? '',
        teamScoreMy,
        teamScoreEnemy,
        players,
    };
}

export function createResultCapture(account: HistoryAccount) {
    let processedFor: string | null = null;
    let resultGeneration = 0;
    let saveAttempt = 0;
    let unassignedId: string | null = null;

    const capture = async () => {
        account.updateIdentity();
        const userId = account.getUserId();
        const selfRow = document.querySelector(gameDOM.results.selfRow);
        if (!selfRow || (userId !== null && processedFor === userId)) return;
        const resultNickname = selfRow.querySelector(gameDOM.results.nicknameCell)?.textContent?.trim().replace(/^\[.*?\]\s*/, '').trim();
        if (!userId) {
            if (processedFor !== null) return;
            if (!unassignedId) {
                const battle = readBattleResult(selfRow, resultNickname || 'Unknown', '');
                if (battle) unassignedId = stashUnassignedResult(battle);
            }
            return;
        }
        if (resultNickname && resultNickname !== account.getNickname()) return;
        const generation = resultGeneration;
        const attempt = ++saveAttempt;
        try {
            const battle = readBattleResult(selfRow, account.getNickname(), userId);
            if (!battle) return;
            processedFor = userId;
            await addBattle(battle);
            if (generation === resultGeneration && unassignedId) { removeUnassignedResult(unassignedId); unassignedId = null; }
        } catch (error) {
            console.error('[Tanki Battle History] Error saving battle result:', error);
            if (generation === resultGeneration && attempt === saveAttempt) processedFor = null;
        }
    };

    return {
        capture,
        reset() {
            resultGeneration++;
            processedFor = null;
            unassignedId = null;
        },
    };
}
