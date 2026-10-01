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

// Privacy only changes presentation. Read the game's original text, never a
// translated masking label or a nickname cached from another account.
export function getAccountIdentity(): AccountIdentity | null {
    const header = document.querySelector('.UserInfoContainerStyle-userNameRank');
    const identity = parseAccountIdentity(header?.textContent || '');
    if (identity) return identity;

    for (const parameter of document.querySelectorAll('.ClientInfoComponentStyle-parameterText')) {
        const uid = /^UID:\s*(.+)$/i.exec(parameter.textContent?.trim() || '');
        if (uid) return parseAccountIdentity(uid[1]);
    }

    const selfName = document.querySelector('#selfUserBg [class*="BattleKillBoardComponentStyle-col1"] span.-whiteSpaceNoWrap');
    return parseAccountIdentity(selfName?.textContent || '');
}
