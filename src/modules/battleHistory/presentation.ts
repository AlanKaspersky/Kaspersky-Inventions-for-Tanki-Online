import { DataLoader } from '../../core/dataLoader';
import { escapeHistoryHtml, getHistoryImageUrl, renderHistoryTemplate } from '../../core/historyMarkup';
import type { HistoryDictionary } from './localization';
import type { BattleData } from './types';

const MODE_ICONS: Record<string, string> = {
    TDM: 'https://s.eu.tankionline.com/static/images/tdm_mode.ef239dba.svg',
    CP: 'https://s.eu.tankionline.com/static/images/cp_mode.9d327fbc.svg',
    CTF: 'https://s.eu.tankionline.com/static/images/ctf_mode.fba37902.svg',
    SGE: 'https://s.eu.tankionline.com/static/images/sge_mode.4a6035e8.svg',
    JGR: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg',
    TJR: 'https://s.eu.tankionline.com/static/images/jg_mode.025a9047.svg',
    RGB: 'https://s.eu.tankionline.com/static/images/rgb_mode.66312ba3.svg',
    ASL: 'https://s.eu.tankionline.com/static/images/asl_mode.42f836ca.svg',
    AR: 'https://ru.tankiwiki.com/images/ru/thumb/6/6c/AR_Icon.png/25px-AR_Icon.png',
};

const DM_SCORE_ICON = 'https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg';
const DM_KD_ICON = 'https://s.eu.tankionline.com/static/images/qb_mode.71a6ec19.svg';

const MAP_ICON_URL = chrome.runtime.getURL('assets/map-icon.png');
const translateMapName = (rawMapWithMode: string, targetLang: string): string => {
    const cleanText = (rawMapWithMode || '').trim();
    if (!cleanText) return 'Unknown';
    const translated = DataLoader.translateMap(cleanText, targetLang);
    return translated || cleanText;
};

const getGsClass = (gs: number): string => {
    if (gs >= 9999) return 'gs-best';
    if (gs >= 9001) return 'gs-9000';
    if (gs >= 8001) return 'gs-8000';
    if (gs >= 7001) return 'gs-7000';
    if (gs >= 6001) return 'gs-6000';
    if (gs >= 5001) return 'gs-5000';
    if (gs >= 4001) return 'gs-4000';
    if (gs >= 3001) return 'gs-3000';
    if (gs >= 2001) return 'gs-2000';
    if (gs >= 1001) return 'gs-1000';
    return 'gs-0';
};

function playersWord(n: number, lang: string) {
    if (lang === 'RU') {
        const mod10 = n % 10, mod100 = n % 100;
        if (mod10 === 1 && mod100 !== 11) return 'игрок';
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'игрока';
        return 'игроков';
    }
    return n === 1 ? 'player' : 'players';
}

function classifyResult(battle: BattleData) {
    const status = (battle.status || '').toLowerCase();
    return {
        isWin: status.includes('victory') || status.includes('победа'),
        isDraw: status.includes('draw') || status.includes('ничья'),
        isDM: status === 'dm' || status.includes('каждый сам за себя') || String(battle.mode).toUpperCase() === 'DM',
    };
}

function formatNumber(value: number): string {
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

function formatBattleDate(timestamp: number) {
    const date = new Date(timestamp);
    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
}

export function buildDetailedMarkup(b: BattleData, dict: HistoryDictionary, lang: string, template: string): string {
    const { isWin, isDraw, isDM } = classifyResult(b);
    let myTeamHtml = '';
    let enemyTeamHtml = '';
    let myTeamCount = 0;
    let enemyTeamCount = 0;

    (b.players || []).forEach(p => {
        const isMeClass = p.isMe ? 'current-player' : (isDM ? 'enemy-player' : '');
        const gsClass = getGsClass(p.gs);

        const gsFormatted = formatNumber(p.gs);
        const scoreFormatted = formatNumber(p.score);
        const crystalsFormatted = formatNumber(p.crystals);
        const rankUrl = getHistoryImageUrl(p.rank);

        const rowHtml = `
                    <tr class="${isMeClass}">
                        <td class="player-cell">
                            <div class="player-icons">
                                ${rankUrl ? `<img class="player-icon" src="${escapeHistoryHtml(rankUrl)}" style="width: 24px; height: 24px; border: none; background: transparent; padding: 0;">` : ''}
                            </div>
                            <span class="player-name">${escapeHistoryHtml(p.name)}</span>
                        </td>
                        <td class="gs ${gsClass}">${escapeHistoryHtml(gsFormatted)}</td>
                        <td>${escapeHistoryHtml(scoreFormatted)}</td>
                        <td>${escapeHistoryHtml(p.kills)}</td>
                        <td>${escapeHistoryHtml(p.deaths)}</td>
                        <td>${escapeHistoryHtml(p.kd.toFixed(2))}</td>
                        <td class="reward">${escapeHistoryHtml(crystalsFormatted)}</td>
                        <td class="stars">${escapeHistoryHtml(p.stars)}</td>
                    </tr>
                `;
        if (!isDM && p.isEnemy) {
            enemyTeamHtml += rowHtml;
            enemyTeamCount++;
        } else {
            myTeamHtml += rowHtml;
            myTeamCount++;
        }
    });

    let resultClass = isWin ? 'victory' : (isDraw ? 'draw' : 'defeat');
    let resultText = isWin ? dict.win : (isDraw ? dict.draw : dict.lose);

    if (isDM) {
        resultClass = 'draw';
        const place = b.top && b.top !== '-' ? b.top : null;
        resultText = place
            ? (lang === 'RU' ? `#${place} МЕСТО` : `#${place} PLACE`)
            : dict.dm;
    }

    const hasTeamScores =
        !isDM
        && typeof b.teamScoreMy === 'number'
        && typeof b.teamScoreEnemy === 'number';

    const leftLabel = hasTeamScores ? dict.myTeam : dict.yourScore;
    const leftValue = hasTeamScores
        ? formatNumber(b.teamScoreMy!)
        : formatNumber(b.reputation || 0);

    const rightLabel = hasTeamScores ? dict.enemyTeam : dict.yourKd;
    const rightValue = hasTeamScores
        ? formatNumber(b.teamScoreEnemy!)
        : (b.kd || 0).toFixed(2);

    const modeUpperKey = String(b.mode || 'MM').toUpperCase();

    const teamIcon = hasTeamScores ? (MODE_ICONS[modeUpperKey] || MODE_ICONS.TDM) : null;
    const leftIconUrl = teamIcon || DM_SCORE_ICON;
    const rightIconUrl = teamIcon || DM_KD_ICON;

    const mapInfo = DataLoader.getMapInfo(b.map);
    const localizedMap = (mapInfo ? (lang === 'RU' ? mapInfo.ru : mapInfo.en) : translateMapName(b.map, lang)) || 'Unknown';

    const { date: dateStr, time: timeStr } = formatBattleDate(b.date);

    const replacements: Record<string, string> = {
        backLabel: dict.allBattles,
        leftScoreClass: isDM ? 'dm' : '',
        leftIconUrl,
        leftLabel,
        leftValue,
        mode: b.mode || 'MM',
        date: dateStr,
        time: timeStr,
        playerCount: String((b.players || []).length),
        playersLabel: dict.playersCount,
        map: localizedMap,
        resultClass,
        resultText,
        rightScoreClass: isDM ? 'dm' : '',
        rightIconUrl,
        rightLabel,
        rightValue,
        statsClass: isDM ? 'solo-mode dm-mode' : enemyTeamCount === 0 ? 'solo-mode' : '',
        playerLabel: dict.player,
        gsLabel: dict.gs,
        scoreLabel: dict.score,
        myTeamClass: myTeamCount > 0 ? '' : 'bh-hidden',
        myTeamTitle: isDM ? dict.dm : dict.myTeam,
        myTeamCount: `${myTeamCount}\u00A0${playersWord(myTeamCount, lang)}`,
        myTeamRows: myTeamHtml,
        enemyTeamClass: enemyTeamCount > 0 ? '' : 'bh-hidden',
        enemyTeamTitle: dict.enemyTeam,
        enemyTeamCount: `${enemyTeamCount}\u00A0${playersWord(enemyTeamCount, lang)}`,
        enemyTeamRows: enemyTeamHtml,
    };
    return renderHistoryTemplate(template, replacements, ['myTeamRows', 'enemyTeamRows']);
}

export function buildCardMarkup(b: BattleData, dict: HistoryDictionary, lang: string, template: string): string {
    const { date: dateStr, time: timeStr } = formatBattleDate(b.date);
    const { isWin, isDraw, isDM } = classifyResult(b);
    let statusClass = 'bh-card-result--loss';
    let statusLocalized = dict.lose;
    if (isDM) {
        statusClass = 'bh-card-result--dm';
        statusLocalized = dict.dm;
    }
    else if (isWin) {
        statusClass = 'bh-card-result--win';
        statusLocalized = dict.win;
    }
    else if (isDraw) {
        statusClass = 'bh-card-result--draw';
        statusLocalized = dict.draw;
    }
    const mapInfo = DataLoader.getMapInfo(b.map);
    const localizedMap = (mapInfo
        ? (lang === 'RU' ? mapInfo.ru : mapInfo.en)
        : translateMapName(b.map, lang)) || 'Unknown';
    const mapUpper = String(localizedMap).toUpperCase();
    const mapImage = getHistoryImageUrl(mapInfo?.image);
    const modeUpper = String(b.mode || 'MM').toUpperCase();
    const topDisplay = b.top && b.top !== '-' ? `#${b.top}` : '—';
    const hasTeamScore = !isDM && typeof b.teamScoreMy === 'number' && typeof b.teamScoreEnemy === 'number';
    const teamScoreStat = hasTeamScore
        ? `<div class="bh-stat"><span class="bh-stat-value">${escapeHistoryHtml(b.teamScoreMy)}<span class="bh-stat-sep">/</span>${escapeHistoryHtml(b.teamScoreEnemy)}</span><span class="bh-stat-label bh-stat-label--team-score">${escapeHistoryHtml(dict.teamScore)}</span></div>`
        : '';

    const turretUrl = getHistoryImageUrl(b.turretIcon);
    const turretAugUrl = getHistoryImageUrl(b.turretAugmentIcon);
    const hullUrl = getHistoryImageUrl(b.hullIcon);
    const hullAugUrl = getHistoryImageUrl(b.hullAugmentIcon);
    const turretIcon = turretUrl
        ? `<img class="bh-equip-img" src="${escapeHistoryHtml(turretUrl)}" alt="">`
        : `<div class="bh-equip-placeholder">▰</div>`;
    const turretAugIcon = turretAugUrl
        ? `<img class="bh-equip-img" src="${escapeHistoryHtml(turretAugUrl)}" alt="">`
        : `<div class="bh-equip-placeholder">◇</div>`;
    const hullIcon = hullUrl
        ? `<img class="bh-equip-img" src="${escapeHistoryHtml(hullUrl)}" alt="">`
        : `<div class="bh-equip-placeholder">▱</div>`;
    const hullAugIcon = hullAugUrl
        ? `<img class="bh-equip-img" src="${escapeHistoryHtml(hullAugUrl)}" alt="">`
        : `<div class="bh-equip-placeholder">◇</div>`;

    const replacements: Record<string, string> = {
        cardClass: `${statusClass} ${turretAugUrl || hullAugUrl ? '' : 'bh-card--no-aug'}`,
        combatStatsClass: hasTeamScore ? 'bh-combat-stats--with-team-score' : '',
        mapStyle: mapImage ? `style="background-image: linear-gradient(90deg, rgba(10,10,10,0.15), rgba(10,10,10,0.75)), url('${escapeHistoryHtml(mapImage)}'); background-size: cover; background-position: center;"` : '',
        mapIconUrl: MAP_ICON_URL,
        mapUpper,
        mapLabel: dict.map,
        statusLocalized,
        scoreValue: String(b.reputation ?? 0),
        scoreLabel: dict.score,
        killsValue: String(b.kills ?? 0),
        deathsValue: String(b.deaths ?? 0),
        killsLabel: dict.kills,
        deathsLabel: dict.deaths,
        teamScoreStat,
        topDisplay,
        topLabel: dict.top,
        turretIcon,
        turretLabel: dict.turret,
        turretAugIcon,
        augmentLabel: dict.augment,
        hullIcon,
        hullLabel: dict.hull,
        hullAugIcon,
        modeIcon: b.kind === 'PRO' ? 'PRO' : 'MM',
        modeIconClass: b.kind === 'PRO' ? 'bh-mode-icon--pro' : 'bh-mode-icon--mm',
        modeUpper,
        crystalsValue: (b.crystals ?? 0).toLocaleString(),
        starsValue: String(b.stars ?? 0),
        dateTime: `${dateStr} · ${timeStr}`
    };

    return renderHistoryTemplate(template, replacements,
        ['mapStyle', 'teamScoreStat', 'turretIcon', 'turretAugIcon', 'hullIcon', 'hullAugIcon']);
}
