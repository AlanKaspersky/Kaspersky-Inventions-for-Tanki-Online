export function getBattleIdentity(battle: { battleId?: unknown; id?: unknown }): string | null {
    if (battle.battleId !== undefined) {
        return typeof battle.battleId === 'string' && /^[A-Za-z0-9:_-]{1,128}$/.test(battle.battleId) ? battle.battleId : null;
    }
    return typeof battle.id === 'number' && Number.isSafeInteger(battle.id) && battle.id > 0 ? `legacy:${battle.id}` : null;
}
