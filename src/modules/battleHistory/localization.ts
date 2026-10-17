export const historyTranslations = {
    RU: {
        title: 'История Битв',
        loading: 'Загрузка',
        date: 'Дата',
        map: 'Карта',
        status: 'Статус',
        top: 'Место',
        mode: 'Режим',
        score: 'Очки',
        kills: 'К',
        deaths: 'Д',
        kd: 'У/С',
        turret: 'Пушка',
        hull: 'Корпус',
        augment: 'Устройство',
        crystals: 'Кристаллы',
        stars: 'Звёзды',
        win: 'Победа',
        lose: 'Поражение',
        draw: 'Ничья',
        dm: 'Каждый сам за себя',
        teamScore: 'Счёт',
        clear: 'Очистить',
        export: 'Экспорт',
        import: 'Импорт',
        battles: 'Боёв',
        noBattles: 'Пока нет сохранённых боёв',
        accountUnavailable: 'ID аккаунта пока недоступен. Сохранённая история не удалена. Дождитесь загрузки аккаунта или перезагрузите игру.',
        contextExpired: 'Расширение обновлено или отключено. Перезагрузите страницу игры, чтобы открыть историю.',
        player: 'Игрок',
        gs: 'GS',
        diamond: 'DIAMOND',
        myTeam: 'Моя команда',
        enemyTeam: 'Команда противника',
        playersCount: 'игроков',
        allBattles: '‹ \u00A0 Все битвы',
        yourScore: 'Ваш счёт',
        yourKd: 'Ваш К/Д'
    },
    EN: {
        title: 'Battle History',
        loading: 'Loading',
        date: 'Date',
        map: 'Map',
        status: 'Status',
        top: 'Top',
        mode: 'Mode',
        score: 'Score',
        kills: 'Kills',
        deaths: 'Deaths',
        kd: 'K/D',
        turret: 'Turret',
        hull: 'Hull',
        augment: 'Augment',
        crystals: 'Crystals',
        stars: 'Stars',
        win: 'Victory',
        lose: 'Defeat',
        draw: 'Draw',
        dm: 'Deathmatch',
        teamScore: 'Score',
        clear: 'Clear',
        export: 'Export',
        import: 'Import',
        battles: 'Battles',
        noBattles: 'No saved battles yet',
        accountUnavailable: 'Account ID is unavailable. Saved history has not been deleted. Wait for account data or reload the game.',
        contextExpired: 'The extension was updated or disabled. Reload the game page to open battle history.',
        player: 'Player',
        gs: 'GS',
        diamond: 'DIAMOND',
        myTeam: 'My Team',
        enemyTeam: 'Enemy Team',
        playersCount: 'players',
        allBattles: '‹ \u00A0 All battles',
        yourScore: 'Your Score',
        yourKd: 'Your K/D'
    }
};

export type HistoryDictionary = typeof historyTranslations.EN;

export function getHistoryDictionary(language: string): HistoryDictionary {
    return language === 'RU' ? historyTranslations.RU : historyTranslations.EN;
}

const clearHistoryTranslations = {
    RU: { title: 'ОЧИСТКА ИСТОРИИ', text: 'Вы уверены, что хотите удалить всю историю матчей?', cancel: 'Отмена', confirm: 'УДАЛИТЬ' },
    EN: { title: 'CLEAR HISTORY', text: 'Are you sure you want to delete all match history?', cancel: 'Cancel', confirm: 'DELETE' }
};

export function getClearHistoryDictionary(language: string) {
    return language === 'RU' ? clearHistoryTranslations.RU : clearHistoryTranslations.EN;
}

const historyMessages = {
    RU: {
        imported: (count: number) => `Импортировано боёв: ${count}.`,
        importFailed: 'Не удалось импортировать файл. Нужен JSON-файл истории с user ID текущего аккаунта. Старые записи без ID сохранены отдельно.',
    },
    EN: {
        imported: (count: number) => `Imported battles: ${count}.`,
        importFailed: 'Could not import this file. Use a battle history JSON file with the current account user ID. Legacy records without an ID remain separate.',
    },
};

export function getHistoryMessages(language: string) {
    return language === 'RU' ? historyMessages.RU : historyMessages.EN;
}
