export interface PlayerData {
    name: string;
    rank: string;
    gs: number;
    score: number;
    kills: number;
    deaths: number;
    kd: number;
    crystals: number;
    stars: number;
    isEnemy: boolean;
    isMe: boolean;
}

export interface BattleData {
    id?: number;
    nickname: string;
    date: number;
    status: string;
    map: string;
    mode: string;
    kind?: 'MM' | 'PRO';
    top: string;
    reputation: number;
    kills: number;
    deaths: number;
    kd: number;
    crystals: number;
    stars: number;
    turretIcon: string;
    turretAugmentIcon: string;
    hullIcon: string;
    hullAugmentIcon: string;
    teamScoreMy?: number;
    teamScoreEnemy?: number;
    players?: PlayerData[];
}

export interface HistoryAccount {
    getNickname(): string;
    updateNickname(): boolean;
    setNickname(nickname: string): void;
}

export type RenderBattleList = (page?: number, animateNewMatches?: boolean) => Promise<void>;
