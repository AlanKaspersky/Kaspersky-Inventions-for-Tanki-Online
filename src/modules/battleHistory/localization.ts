export const historyTranslations = {
    RU: {
        title: 'История Битв',
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
        link: 'Связать',
        export: 'Экспорт',
        import: 'Импорт',
        battles: 'Боёв',
        noBattles: 'Пока нет сохранённых боёв',
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
        link: 'Link',
        export: 'Export',
        import: 'Import',
        battles: 'Battles',
        noBattles: 'No saved battles yet',
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

const linkHistoryTranslations = {
    RU: {
        title: 'СВЯЗАТЬ ИСТОРИИ',
        description: 'Выберите ник, историю которого нужно добавить к текущей истории.',
        target: 'Текущая история:',
        select: 'История для добавления',
        placeholder: 'Выберите никнейм',
        empty: 'Других никнеймов с сохранёнными боями нет.',
        cancel: 'Отмена',
        confirm: 'Связать',
        success: (count: number) => `Истории связаны. Добавлено боёв: ${count}.`,
        failed: 'Не удалось связать истории.'
    },
    EN: {
        title: 'LINK HISTORIES',
        description: 'Choose the nickname whose history should be added to the current history.',
        target: 'Current history:',
        select: 'History to add',
        placeholder: 'Select a nickname',
        empty: 'No other nicknames have saved battles.',
        cancel: 'Cancel',
        confirm: 'Link',
        success: (count: number) => `Histories linked. Battles added: ${count}.`,
        failed: 'Could not link the histories.'
    }
};

export function getClearHistoryDictionary(language: string) {
    return language === 'RU' ? clearHistoryTranslations.RU : clearHistoryTranslations.EN;
}

export function getLinkHistoryDictionary(language: string) {
    return language === 'RU' ? linkHistoryTranslations.RU : linkHistoryTranslations.EN;
}

const historyMessages = {
    RU: {
        unknownNickname: 'Не удалось определить текущий ник.',
        listFailed: 'Не удалось загрузить список историй.',
        imported: (count: number) => `Импортировано боёв: ${count}.`,
        importFailed: 'Не удалось импортировать файл. Проверьте, что это JSON-файл истории битв.',
    },
    EN: {
        unknownNickname: 'Could not detect the current nickname.',
        listFailed: 'Could not load the history list.',
        imported: (count: number) => `Imported battles: ${count}.`,
        importFailed: 'Could not import this file. Check that it is a valid battle history JSON file.',
    },
};

export function getHistoryMessages(language: string) {
    return language === 'RU' ? historyMessages.RU : historyMessages.EN;
}
