"use strict";
(function () {
    'use strict';
    if (localStorage.getItem('k_history') === 'false')
        return;
    let battleProcessed = false;
    let currentNickname = 'Unknown';
    let currentPage = 1;
    const ROWS_PER_PAGE = 25;
    const updateNickname = () => {
        const nameEl = document.querySelector('.UserInfoContainerStyle-userNameRank');
        if (nameEl) {
            const text = nameEl.textContent?.trim() || '';
            const cleanName = text.replace(/^\[.*?\]\s*/, '').trim();
            if (cleanName) {
                currentNickname = cleanName;
            }
        }
    };
    const openDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TankiBattlesDB', 4);
            request.onupgradeneeded = (event) => {
                const target = event.target;
                const db = target.result;
                let store;
                if (!db.objectStoreNames.contains('battles')) {
                    store = db.createObjectStore('battles', { keyPath: 'id', autoIncrement: true });
                }
                else {
                    store = target.transaction.objectStore('battles');
                }
                if (!store.indexNames.contains('date'))
                    store.createIndex('date', 'date', { unique: false });
                if (!store.indexNames.contains('map'))
                    store.createIndex('map', 'map', { unique: false });
                if (!store.indexNames.contains('mode'))
                    store.createIndex('mode', 'mode', { unique: false });
                if (!store.indexNames.contains('top'))
                    store.createIndex('top', 'top', { unique: false });
                if (!store.indexNames.contains('nickname'))
                    store.createIndex('nickname', 'nickname', { unique: false });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };
    const addBattle = async (battleData) => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('battles', 'readwrite');
            const store = transaction.objectStore('battles');
            const request = store.add(battleData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    };
    const getAllBattles = async (nickname) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('battles', 'readonly');
                const store = transaction.objectStore('battles');
                let request;
                if (nickname && store.indexNames.contains('nickname')) {
                    const index = store.index('nickname');
                    request = index.getAll(nickname);
                }
                else {
                    request = store.getAll();
                }
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        }
        catch (e) {
            console.error('[Tanki Battle History] Error reading DB:', e);
            return [];
        }
    };
    const removeDuplicateBattles = async (nickname) => {
        try {
            const battles = await getAllBattles(nickname);
            if (battles.length === 0)
                return;
            const uniqueMap = new Map();
            const idsToDelete = [];
            battles.forEach(b => {
                const signature = `${Math.floor(b.date / 60000)}_${b.map}_${b.kills}_${b.deaths}_${b.crystals}`;
                if (uniqueMap.has(signature)) {
                    idsToDelete.push(b.id);
                }
                else {
                    uniqueMap.set(signature, b.id);
                }
            });
            if (idsToDelete.length > 0) {
                const db = await openDB();
                const transaction = db.transaction('battles', 'readwrite');
                const store = transaction.objectStore('battles');
                idsToDelete.forEach(id => store.delete(id));
            }
        }
        catch (e) {
            console.error('[Tanki Battle History] Error cleaning duplicates:', e);
        }
    };
    function getLang() {
        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().includes('ru'))
            return 'RU';
        if (window.location.hostname.includes('ru.'))
            return 'RU';
        return 'EN';
    }
    const mapTranslations = {
        'Александровск': 'Alexandrovsk', 'Арена': 'Arena', 'Архипелаг': 'Archipelago', 'Атра': 'Atra', 'Барда': 'Barda', 'Безумие': 'Madness',
        'Берлин': 'Berlin', 'Бобруйск': 'Bobruisk', 'Бойня': 'Massacre', 'Брест': 'Brest', 'Будущее': 'Future', 'Бумбокс': 'Boombox',
        'Волна': 'Wave', 'Вольфенштейн': 'Wolfenstein', 'Гардер': 'Garder', 'Гравити': 'Gravity', 'Год 2042': 'Year 2042', 'Губаха': 'Gubakha',
        'Долина': 'Valley', 'Дуалити': 'Duality', 'Дуэль': 'Duel', 'Дюссельдорф': 'Dusseldorf', 'Жаворонки': 'Zhavoronki', 'Зона': 'Zone',
        'Иран': 'Iran', 'Йоркшир': 'Yorkshire', 'Каньон': 'Canyon', 'Колхоз': 'Kolkhoz', 'Кунгур': 'Kungur', 'Кураж': 'Courage', 'Кёльн': 'Cologne',
        'Лагерь': 'Camp', 'Магадан': 'Magadan', 'Магистраль': 'Magistral', 'Молотов': 'Molotov', 'Монте-Карло': 'Monte Carlo', 'Мостик': 'Short Bridge',
        'Мосты': 'Bridges', 'Небоскрёбы': 'Skyscrapers', 'Новэл': 'Novel', 'Овраг': 'Ravine', 'Оса': 'Osa', 'Осада': 'Siege', 'Остров': 'Island',
        'Палуба 9': 'Deck-9', 'Парма': 'Parma', 'Перевал': 'Pass', 'Перекрёсток': 'Cross', 'Песочница': 'Sandbox', 'Пинг-Понг': 'Ping-Pong',
        'Плато': 'Highland', 'Подземка': 'Subway', 'Полигон': 'Polygon', 'Промзона': 'Industrial Zone', 'Простор': 'Space', 'Противостояние': 'Confrontation',
        'Пустыня': 'Desert', 'Ред Алерт': 'Red Alert', 'Рио': 'Rio', 'Сандал': 'Sandal', 'Серпухов': 'Serpukhov', 'Соликамск': 'Solikamsk',
        'Стадион': 'Stadium', 'Станция': 'Station', 'Тишина': 'Silence', 'Трек': 'Track', 'Трибьют': 'Tribute', 'Тэмпл': 'Temple',
        'Ущелье': 'Rift', 'Фабрика': 'Factory', 'Ферма': 'Farm', 'Форэст': 'Forest', 'Форест': 'Forest', 'Форт Нокс': 'Fort Knox',
        'Холм': 'Hill', 'Чернобыль': 'Chernobyl', 'Чернушка': 'Chernushka', 'Шоссе': 'Highways', 'Шум': 'Noise', 'Эдинбург': 'Edinburgh',
        'Эспланада': 'Esplanade', 'Парма REMASTER': 'Parma REMASTER', 'Перекрёсток REMASTER': 'Cross REMASTER', 'Песочница REMASTER': 'Sandbox REMASTER',
        'Плато REMASTER': 'Highland REMASTER', 'Сандал REMASTER': 'Sandal REMASTER', 'Форест REMASTER': 'Forest REMASTER',
        'Барда eSports': 'Barada eSports', 'Барда MM eSports': 'Barada MM eSports', 'Бобруйск eSports': 'Bobruisk eSports', 'Губаха eSports': 'Gubakha eSports',
        'Иран eSports': 'Iran eSports', 'Кёльн eSports': 'Cologne eSports', 'Кунгур eSports': 'Kungur eSports', 'Мосты MM eSports': 'Bridges MM eSports',
        'Парма eSports': 'Parma eSports', 'Ред Алерт eSports': 'Red Alert eSports', 'Ред Алерт MM eSports': 'Red Alert MM eSports',
        'Трибьют MM eSports': 'Tribute MM eSports', 'Форест eSports': 'Forest eSports'
    };
    const translateMapName = (rawMapWithMode, targetLang) => {
        let cleanText = rawMapWithMode.trim();
        if (targetLang === 'EN') {
            if (mapTranslations[cleanText]) {
                return mapTranslations[cleanText];
            }
        }
        else {
            const invertedMap = Object.fromEntries(Object.entries(mapTranslations).map(([k, v]) => [v, k]));
            if (invertedMap[cleanText]) {
                return invertedMap[cleanText];
            }
        }
        return cleanText;
    };
    function showClearConfirmDialog(callback) {
        const existing = document.getElementById('clear-confirm-overlay');
        if (existing)
            existing.remove();
        const getLang = () => document.documentElement.lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
        const lang = getLang();
        const t = {
            ru: { title: 'ПОДТВЕРЖДЕНИЕ', text: 'Вы действительно хотите выполнить очистку?', cancel: 'ОТМЕНА', confirm: 'ОЧИСТИТЬ' },
            en: { title: 'CONFIRMATION', text: 'Are you sure you want to clear the data?', cancel: 'CANCEL', confirm: 'CLEAR' }
        };
        const overlay = document.createElement('div');
        overlay.id = 'clear-confirm-overlay';
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;`;
        const dialog = document.createElement('div');
        dialog.id = 'clear-confirm-dialog';
        dialog.style.cssText = `display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; pointer-events: auto; min-width: 31.625em; max-width: 31.625em; width: auto; min-height: 14.125em; z-index: 60; box-shadow: rgba(0, 0, 0, 0.25) 0px 0.313em 1.25em 0px; outline: rgba(255, 255, 255, 0.25) solid 0.063em; padding: 2em; background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.75) 0%, rgba(119, 255, 51, 0) 100%), rgba(0, 25, 38, 0.75);`;
        const header = document.createElement('div');
        header.style.cssText = `display: flex; align-items: center; justify-content: space-between; background-color: transparent; width: 100%; position: relative; margin-bottom: 1.5em;`;
        const title = document.createElement('h1');
        title.textContent = t[lang].title;
        title.style.cssText = `font-size: 1.5em; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; margin: 0; padding: 0; line-height: 1.2; flex: 1;`;
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `width: 1.5em; height: 1.5em; cursor: pointer; background-image: url(/browser-public/static/images/iconDelete.b879b0ab.svg); background-repeat: no-repeat; background-size: contain; background-position: center center; flex-shrink: 0; margin-left: 0.5em;`;
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundImage = 'url(/browser-public/static/images/deleteHoverModal.3aceb055.svg)'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundImage = 'url(/browser-public/static/images/iconDelete.b879b0ab.svg)'; });
        header.appendChild(title);
        header.appendChild(closeBtn);
        const content = document.createElement('div');
        content.style.cssText = `display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; flex: 1; margin-bottom: 1.5em; text-align: center;`;
        const textSpan = document.createElement('span');
        textSpan.textContent = t[lang].text;
        textSpan.style.cssText = `font-size: 1em; color: rgb(255, 255, 255); font-family: BaseFont, FallbackFont, sans-serif; line-height: 1.4;`;
        content.appendChild(textSpan);
        const footer = document.createElement('div');
        footer.style.cssText = `background-color: transparent; width: 100%; display: flex; align-items: center; justify-content: center; gap: 1.25em;`;
        const cancelBtn = document.createElement('div');
        cancelBtn.textContent = t[lang].cancel;
        cancelBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgba(255, 255, 255, 0.15); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(255, 255, 255); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
        cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.borderColor = 'rgb(255, 255, 255)'; cancelBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
        cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.borderColor = 'transparent'; cancelBtn.style.boxShadow = 'none'; });
        const confirmBtn = document.createElement('div');
        confirmBtn.textContent = t[lang].confirm;
        confirmBtn.style.cssText = `width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; background-color: rgb(118, 255, 51); border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; color: rgb(0, 25, 38); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0;`;
        confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.borderColor = 'rgb(255, 255, 255)'; confirmBtn.style.boxShadow = '0 0 0 1px rgb(255, 255, 255)'; });
        confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.borderColor = 'transparent'; confirmBtn.style.boxShadow = 'none'; });
        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(footer);
        overlay.appendChild(dialog);
        overlay.closeDialogMethod = closeDialog;
        document.body.appendChild(overlay);
        function closeDialog() {
            if (!overlay.parentNode)
                return;
            overlay.remove();
            document.removeEventListener('keydown', onKeyDown, true);
        }
        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
            if (callback)
                callback();
        });
        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
        });
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeDialog();
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });
        function onKeyDown(e) {
            if (!document.getElementById('clear-confirm-overlay')) {
                document.removeEventListener('keydown', onKeyDown, true);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                closeDialog();
                if (callback)
                    callback();
                return;
            }
        }
        document.addEventListener('keydown', onKeyDown, true);
    }
    const t = {
        RU: { title: 'История Битв', date: 'Дата', map: 'Карта', status: 'Статус', top: 'ТОП', mode: 'Режим', score: 'Очки', kd: 'У/П', turret: 'Пушка', hull: 'Корпус', crystals: 'Кристаллы', stars: 'Звезды', win: 'Победа', lose: 'Поражение', draw: 'Ничья', dm: 'DM', clear: 'Очистить', export: 'Экспорт', import: 'Импорт', confirmClear: 'Вы уверены, что хотите удалить ВСЮ историю битв?', noDataExport: 'Нет данных для экспорта.', importSuccess: 'История битв успешно импортирована!', importError: 'Произошла ошибка при чтении файла.' },
        EN: { title: 'Battle History', date: 'Date', map: 'Map', status: 'Status', top: 'TOP', mode: 'Mode', score: 'Score', kd: 'K/D', turret: 'Turret', hull: 'Hull', crystals: 'Crystals', stars: 'Stars', win: 'Victory', lose: 'Defeat', draw: 'Draw', dm: 'DM', clear: 'Clear', export: 'Export', import: 'Import', confirmClear: 'Are you sure you want to delete ALL battle history?', noDataExport: 'No data available to export.', importSuccess: 'Battle history imported successfully!', importError: 'Error reading the file.' }
    };
    const addHistoryStyles = () => {
        const style = document.createElement('style');
        style.innerHTML = `
            .custom-history-button { user-select: none; font-size: max(min(1.48148vh, 1vw), 3px); font-family: BaseFontRegular, FallbackFontRegular, sans-serif; white-space: nowrap; pointer-events: auto; -webkit-tap-highlight-color: transparent; text-align: left; list-style-type: none; height: 3.5em; display: flex; align-items: center; justify-content: flex-start; flex-shrink: 1; flex-grow: 1; width: 27em; max-height: 4.5em; position: relative; margin-top: 0px; z-index: 4; cursor: pointer; border-radius: 0.5rem; color: rgb(191, 213, 255); }
            .custom-history-button:hover { box-shadow: rgb(255, 255, 255) 0em 0em 0em 0.125em; color: rgb(255, 255, 255); }
            .custom-history-icon { width: 3.5em; height: 3.5em; margin-left: 0.625em; background-color: rgb(191, 213, 255); -webkit-mask: url(https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg) no-repeat center / 68%; mask: url(https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg) no-repeat center / 68%; }
            .custom-history-button:hover .custom-history-icon { background-color: rgb(255, 255, 255); }
            .custom-history-name { font-size: 2em; text-transform: uppercase; margin-left: 0.5625em; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; }
            .custom-history-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: radial-gradient(rgb(32, 48, 64) 0%, rgb(3, 8, 13) 100%); z-index: 9999; display: none; flex-direction: column; color: white; }
            .custom-history-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.25); height: 6rem; flex-shrink: 0; }
            .custom-history-title { font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-style: normal; font-weight: 500; font-size: 2.2em; text-transform: uppercase; line-height: 2.5em; margin: 0; }
            .custom-history-close { cursor: pointer; display: flex; align-items: center; justify-content: center; width: 6rem; height: 6rem; background: transparent; border: none; border-left: 1px solid rgba(255, 255, 255, 0.25); }
            .custom-history-close:hover { background-color: rgba(255, 255, 255, 0.05); }
            .custom-history-close:hover .custom-history-logout-icon { background-color: rgb(255, 255, 255); }
            .custom-history-logout-icon { background-color: rgb(191, 213, 255); height: 1.5rem; width: 1.5rem; -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/logOut.29b47580.svg); mask-image: url(https://s.eu.tankionline.com/static/images/logOut.29b47580.svg); -webkit-mask-position: center center; mask-position: center center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; }
            .custom-history-content { padding: 0em 3em; flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
            .bh-table-wrapper { position: relative; width: 100%; flex-grow: 1; display: flex; flex-direction: column; align-items: center; min-height: 0; }
            .bh-controls-container { width: 80em; justify-content: space-between; z-index: 5; display: flex; margin-bottom: 1.5em; }
            .bh-controls-left { display: flex; gap: 1em; justify-content: flex-start; }
            .bh-controls-right { justify-content: flex-end; display: flex; gap: 1em; }
            .bh-control-btn { width: 12.375em; height: 3em; text-align: center; border-radius: 0.75em; cursor: pointer; border: 0.063em solid transparent; display: flex; align-items: center; justify-content: center; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-style: normal; font-weight: 500; font-size: 1em; line-height: 1.2; text-transform: uppercase; white-space: nowrap; padding: 0.2em 1.8em; box-sizing: border-box; flex-shrink: 0; }
            .bh-control-btn:hover { border-color: rgb(255, 255, 255); box-shadow: 0 0 0 1px rgb(255, 255, 255); }
            .bh-btn-clear { background-color: rgba(255, 255, 255, 0.15); color: rgb(255, 255, 255); }
            .bh-btn-export { background-color: rgb(255, 102, 102); color: rgb(0, 25, 38); }
            .bh-btn-import { background-color: rgb(118, 255, 51); color: rgb(0, 25, 38); }
            .bh-table { display: flex; flex-direction: column; flex-grow: 1; min-height: 0; margin-top: 1.5em; font-family: BaseFontRegular, FallbackFontRegular, sans-serif; font-style: normal; font-weight: normal; font-size: 0.9375em; line-height: normal; }
            .bh-thead { display: grid; grid-template-columns: 7.5em 20em 8em 3.5em 6em 5em 7em 5em 5em 6em 4em; column-gap: 0.3em; margin-bottom: 0.32em; user-select: none; }
            .bh-th { display: flex; align-items: center; justify-content: center; cursor: default; height: 2.5em; background-color: rgba(255, 255, 255, 0.1); padding: 0 0.4em; box-sizing: border-box; }
            .bh-th-title { cursor: default; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; font-size: 1.125em; color: rgba(255, 255, 255, 0.5); text-transform: uppercase; margin: 0; }
            .bh-icon-mask { width: 2em; height: 1.4em; background-color: rgba(255, 255, 255, 0.5); -webkit-mask-position: center; mask-position: center; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-size: contain; mask-size: contain; display: inline-block; }
            .bh-icon-score { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg); mask-image: url(https://s.eu.tankionline.com/static/images/score.b3ca71b2.svg); }
            .bh-icon-kills { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/kills.f9b82d9f.svg); mask-image: url(https://s.eu.tankionline.com/static/images/kills.f9b82d9f.svg); }
            .bh-icon-turrets { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/turrets.20be27f5.svg); mask-image: url(https://s.eu.tankionline.com/static/images/turrets.20be27f5.svg); }
            .bh-icon-hulls { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/hulls.b316ae80.svg); mask-image: url(https://s.eu.tankionline.com/static/images/hulls.b316ae80.svg); }
            .bh-icon-crystals { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/crystalSmall.242e6c15.svg); mask-image: url(https://s.eu.tankionline.com/static/images/crystalSmall.242e6c15.svg); background-color: rgb(0, 215, 255); }
            .bh-icon-stars { -webkit-mask-image: url(https://s.eu.tankionline.com/static/images/Star.5a891709.svg); mask-image: url(https://s.eu.tankionline.com/static/images/Star.5a891709.svg); background-color: rgb(255, 221, 44); }
            .bh-tbody { display: flex; flex-direction: column; flex-grow: 1; min-height: 0; overflow: hidden auto; scrollbar-color: rgba(255, 255, 255, 0.15) rgba(255, 255, 255, 0); scrollbar-width: thin; }
            .bh-row { background-color: rgba(255, 255, 255, 0.1); height: 2.5em; margin-left: 0px; margin-bottom: 0.313em; display: grid; grid-template-columns: 7.5em 20em 8em 3.5em 6em 5em 7em 5em 5em 6em 4em; column-gap: 0.3em; align-items: center; justify-content: flex-start; color: white; flex-shrink: 0; }
            .bh-row-empty { user-select: none; font-size: max(min(1.48148vh, 1vw), 3px); font-family: BaseFontRegular, FallbackFontRegular, sans-serif; border-spacing: 0.313em; background-color: rgba(255, 255, 255, 0.1); height: 2.5em; margin-left: 0px; margin-bottom: 0.313em; display: flex; align-items: center; justify-content: flex-start; opacity: 0.2; cursor: default; flex-shrink: 0; }
            .bh-cell { display: flex; align-items: center; justify-content: center; height: 100%; padding: 0 0.4em; font-size: 1.1em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; }
            .bh-cell-crystals { color: rgb(0, 215, 255); }
            .bh-cell-stars { color: rgb(255, 221, 44); }
            .bh-cell-map { text-transform: uppercase; }
            .bh-status-defeat { font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-weight: 500; text-transform: uppercase; text-align: center; color: rgb(254, 102, 102); }
            .bh-status-draw { font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-weight: 500; text-transform: uppercase; text-align: center; color: rgb(191, 213, 255); }
            .bh-status-victory { font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-weight: 500; text-transform: uppercase; font-size: 1.1em; text-align: center; color: rgb(0, 212, 255); }
            .bh-status-dm { font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-weight: 500; text-transform: uppercase; text-align: center; color: rgb(255, 180, 50); }
            .bh-kd-wrap { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; width: 100%; }
            .bh-kd-kills { text-align: right; padding-right: 0.2em; }
            .bh-kd-slash { text-align: center; color: rgba(255, 255, 255, 0.5); }
            .bh-kd-deaths { text-align: left; padding-left: 0.2em; }
            .bh-equip-container { display: flex; align-items: center; justify-content: center; gap: 0.4em; }
            .bh-equip-icon { width: 1.1em; height: 1.1em; object-fit: contain; vertical-align: middle; }
            .bh-pagination { display: flex; justify-content: center; align-items: center; gap: 1.5em; margin-top: 1em; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 1.2em; color: rgba(255, 255, 255, 0.7); user-select: none; }
            .bh-page-btn { background: transparent; border: none; color: white; cursor: pointer; font-size: 1.2em; transition: color 0.2s, opacity 0.2s; padding: 0.5em; display: flex; align-items: center; justify-content: center; }
            .bh-page-btn:hover { color: rgb(0, 212, 255); }
            .bh-page-btn:disabled { opacity: 0.2; pointer-events: none; color: white; }
        `;
        if (document.head) {
            document.head.appendChild(style);
        }
        else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
            });
        }
    };
    const parseMapAndMode = (rawMapText) => {
        if (!rawMapText)
            return { map: 'Unknown Map', mode: 'MM' };
        let text = rawMapText.trim();
        let modesList = ['CTF', 'TDM', 'DM', 'CP', 'SGE', 'RGB', 'JGR'];
        let foundMode = 'MM';
        let parts = text.split(/\s+/);
        if (parts.length > 0) {
            let lastWord = parts[parts.length - 1].toUpperCase();
            if (modesList.includes(lastWord)) {
                foundMode = parts.pop() || 'MM';
                text = parts.join(' ');
            }
        }
        let cleanMapName = text.replace(/\s+/g, ' ').trim();
        if (!cleanMapName)
            cleanMapName = 'Unknown';
        return { map: cleanMapName, mode: foundMode };
    };
    const extractBackgroundUrl = (element) => {
        if (!element)
            return '';
        const el = element;
        const bg = el.style.backgroundImage || window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
            const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1])
                return match[1];
        }
        return '';
    };
    const extractEquipmentAndAugments = (selfRow) => {
        const getBg = (selector) => extractBackgroundUrl(selfRow.querySelector(selector));
        return {
            turretIcon: getBg('.tt-icon.tt-turret'),
            turretAugmentIcon: getBg('.tt-icon.tt-turret-augment'),
            hullIcon: getBg('.tt-icon.tt-hull'),
            hullAugmentIcon: getBg('.tt-icon.tt-hull-augment')
        };
    };
    const extractAndSaveBattleResult = async () => {
        updateNickname();
        const selfRow = document.querySelector('#selfUserBg');
        if (!selfRow)
            return;
        if (battleProcessed)
            return;
        const equipCell = selfRow.querySelector('.tt-equipment-cell');
        if (!equipCell && !selfRow.dataset.equipTimeout) {
            return;
        }
        battleProcessed = true;
        try {
            const mapEl = document.querySelector('.BattleResultHeaderComponentStyle-mapName');
            const rawMapText = mapEl ? mapEl.textContent?.trim() || '' : 'Unknown Map';
            const parsedMapData = parseMapAndMode(rawMapText);
            const statusEl = document.querySelector('.BattleResultHeaderComponentStyle-resultText') ||
                document.querySelector('[class*="descriptionVictory"], [class*="descriptionDefeat"], [class*="descriptionDraw"]');
            const isDM = parsedMapData.mode.toUpperCase() === 'DM' || (statusEl && statusEl.textContent?.trim() === '');
            const statusText = isDM ? 'DM' : (statusEl ? statusEl.textContent?.trim() || 'Victory' : 'Victory');
            let topVal = '-';
            if (selfRow.parentElement) {
                const allRows = Array.from(selfRow.parentElement.children);
                const selfIndex = allRows.indexOf(selfRow);
                const teamDividerIndex = allRows.findIndex(r => r.id === 'teamRowSpace');
                let teamRows = [];
                if (teamDividerIndex === -1) {
                    teamRows = allRows;
                }
                else if (selfIndex < teamDividerIndex) {
                    teamRows = allRows.slice(0, teamDividerIndex);
                }
                else {
                    teamRows = allRows.slice(teamDividerIndex + 1);
                }
                const actualPlayers = teamRows.filter(r => r.id && r.id !== 'rowSpace' && r.id !== 'teamRowSpace');
                const rank = actualPlayers.indexOf(selfRow) + 1;
                if (rank > 0)
                    topVal = rank.toString();
            }
            const score = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col3')?.textContent || '0') || 0;
            const kills = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col4')?.textContent || '0') || 0;
            const deaths = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col5')?.textContent || '0') || 0;
            const kd = deaths > 0 ? parseFloat((kills / deaths).toFixed(2)) : kills;
            const crystals = parseInt((selfRow.querySelector('.BattleKillBoardComponentStyle-col7')?.textContent || '0').replace(/\s/g, '')) || 0;
            const stars = parseInt(selfRow.querySelector('.BattleKillBoardComponentStyle-col8')?.textContent || '0') || 0;
            const equipment = extractEquipmentAndAugments(selfRow);
            const battleData = {
                nickname: currentNickname,
                date: Date.now(),
                status: statusText,
                map: parsedMapData.map,
                mode: parsedMapData.mode,
                top: topVal,
                reputation: score,
                kills: kills,
                deaths: deaths,
                kd: kd,
                crystals: crystals,
                stars: stars,
                turretIcon: equipment.turretIcon,
                turretAugmentIcon: equipment.turretAugmentIcon,
                hullIcon: equipment.hullIcon,
                hullAugmentIcon: equipment.hullAugmentIcon
            };
            await addBattle(battleData);
        }
        catch (err) {
            console.error('[Tanki Battle History] Error saving battle result:', err);
            battleProcessed = false;
        }
    };
    const renderBattleTable = async (page = 1) => {
        updateNickname();
        const tbody = document.querySelector('.bh-tbody');
        if (!tbody)
            return;
        await removeDuplicateBattles(currentNickname);
        const lang = getLang();
        const dict = t[lang];
        let battles = await getAllBattles(currentNickname);
        battles.sort((a, b) => b.date - a.date);
        const totalPages = Math.max(1, Math.ceil(battles.length / ROWS_PER_PAGE));
        if (page > totalPages)
            page = totalPages;
        if (page < 1)
            page = 1;
        currentPage = page;
        const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
        const pageBattles = battles.slice(startIndex, startIndex + ROWS_PER_PAGE);
        tbody.innerHTML = '';
        pageBattles.forEach(b => {
            const dateStr = new Date(b.date).toLocaleDateString();
            const statusLower = (b.status || '').toLowerCase();
            const isWin = statusLower.includes('victory') || statusLower.includes('победа');
            const isDraw = statusLower.includes('draw') || statusLower.includes('ничья');
            const isDM = statusLower === 'dm' || statusLower.includes('каждый сам за себя');
            let statusClass = 'bh-status-defeat';
            let statusLocalized = dict.lose;
            if (isDM) {
                statusClass = 'bh-status-dm';
                statusLocalized = dict.dm;
            }
            else if (isWin) {
                statusClass = 'bh-status-victory';
                statusLocalized = dict.win;
            }
            else if (isDraw) {
                statusClass = 'bh-status-draw';
                statusLocalized = dict.draw;
            }
            const turretHtml = b.turretIcon ? `<img src="${b.turretIcon}" class="bh-equip-icon" />` : '-';
            const turretAugHtml = b.turretAugmentIcon ? `<img src="${b.turretAugmentIcon}" class="bh-equip-icon" />` : '';
            const hullHtml = b.hullIcon ? `<img src="${b.hullIcon}" class="bh-equip-icon" />` : '-';
            const hullAugHtml = b.hullAugmentIcon ? `<img src="${b.hullAugmentIcon}" class="bh-equip-icon" />` : '';
            const localizedMap = translateMapName(b.map, lang);
            const row = document.createElement('div');
            row.className = 'bh-row';
            row.innerHTML = `
                <div class="bh-cell">${dateStr}</div>
                <div class="bh-cell bh-cell-map">${localizedMap}</div>
                <div class="bh-cell ${statusClass}">${statusLocalized}</div>
                <div class="bh-cell">${b.top || '-'}</div>
                <div class="bh-cell">${b.mode || 'MM'}</div>
                <div class="bh-cell">${b.reputation}</div>
                <div class="bh-cell">
                    <div class="bh-kd-wrap">
                        <span class="bh-kd-kills">${b.kills}</span>
                        <span class="bh-kd-slash">/</span>
                        <span class="bh-kd-deaths">${b.deaths}</span>
                    </div>
                </div>
                <div class="bh-cell"><div class="bh-equip-container">${turretHtml}${turretAugHtml}</div></div>
                <div class="bh-cell"><div class="bh-equip-container">${hullHtml}${hullAugHtml}</div></div>
                <div class="bh-cell bh-cell-crystals">${b.crystals.toLocaleString()}</div>
                <div class="bh-cell bh-cell-stars">${b.stars}</div>
            `;
            tbody.appendChild(row);
        });
        const emptyRowsCount = ROWS_PER_PAGE - pageBattles.length;
        for (let i = 0; i < emptyRowsCount; i++) {
            const emptyRow = document.createElement('div');
            emptyRow.className = 'bh-row-empty';
            tbody.appendChild(emptyRow);
        }
        const pageInfo = document.getElementById('bh-page-info');
        if (pageInfo)
            pageInfo.textContent = `${currentPage} / ${totalPages}`;
        const prevBtn = document.getElementById('bh-prev-page');
        if (prevBtn)
            prevBtn.disabled = currentPage === 1;
        const nextBtn = document.getElementById('bh-next-page');
        if (nextBtn)
            nextBtn.disabled = currentPage === totalPages;
    };
    const clearHistoryDb = () => {
        showClearConfirmDialog(async () => {
            try {
                const db = await openDB();
                const transaction = db.transaction('battles', 'readwrite');
                const store = transaction.objectStore('battles');
                const index = store.index('nickname');
                const request = index.getAllKeys(currentNickname);
                request.onsuccess = () => {
                    const keys = request.result;
                    keys.forEach(key => store.delete(key));
                    renderBattleTable(1);
                };
            }
            catch (e) {
                console.error('[Tanki Battle History] Error clearing DB:', e);
            }
        });
    };
    const exportHistoryData = async () => {
        const lang = getLang();
        const battles = await getAllBattles(currentNickname);
        if (battles.length === 0) {
            alert(t[lang].noDataExport);
            return;
        }
        const dataStr = JSON.stringify(battles, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateString = new Date().toISOString().slice(0, 10);
        a.download = `Tanki_BattleHistory_${currentNickname}_${dateString}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    const importHistoryData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        const lang = getLang();
        input.onchange = (e) => {
            const target = e.target;
            const file = target.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const targetResult = ev.target?.result;
                    if (!targetResult)
                        return;
                    const data = JSON.parse(targetResult);
                    if (Array.isArray(data)) {
                        for (const battle of data) {
                            delete battle.id;
                            await addBattle(battle);
                        }
                        await removeDuplicateBattles(currentNickname);
                        renderBattleTable(1);
                        alert(t[lang].importSuccess);
                    }
                }
                catch (err) {
                    console.error('[Tanki Battle History] Import error:', err);
                    alert(t[lang].importError);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    const createHistoryPage = () => {
        updateNickname();
        const lang = getLang();
        const dict = t[lang];
        const overlay = document.createElement('div');
        overlay.className = 'custom-history-overlay';
        overlay.innerHTML = `
            <div class="custom-history-header">
                <div style="width: 6rem;"></div>
                <h1 class="custom-history-title">${dict.title}</h1>
                <button class="custom-history-close" title="${lang === 'RU' ? 'Закрыть' : 'Close'}">
                    <div class="custom-history-logout-icon"></div>
                </button>
            </div>
            <div class="custom-history-content">
                <div class="bh-table-wrapper">
                    <div class="bh-table">
                        <div class="bh-controls-container">
                        <div class="bh-controls-left">
                            <button class="bh-control-btn bh-btn-clear" id="bh-clear-btn">${dict.clear}</button>
                        </div>
                        <div class="bh-controls-right">
                            <button class="bh-control-btn bh-btn-export" id="bh-export-btn">${dict.export}</button>
                            <button class="bh-control-btn bh-btn-import" id="bh-import-btn">${dict.import}</button>
                        </div>
                    </div>
                        <div class="bh-thead">
                            <div class="bh-th"><h2 class="bh-th-title">${dict.date}</h2></div>
                            <div class="bh-th"><h2 class="bh-th-title">${dict.map}</h2></div>
                            <div class="bh-th"><h2 class="bh-th-title">${dict.status}</h2></div>
                            <div class="bh-th"><h2 class="bh-th-title">${dict.top}</h2></div>
                            <div class="bh-th"><h2 class="bh-th-title">${dict.mode}</h2></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-score" title="${dict.score}"></div></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-kills" title="${dict.kd}"></div></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-turrets" title="${dict.turret}"></div></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-hulls" title="${dict.hull}"></div></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-crystals" title="${dict.crystals}"></div></div>
                            <div class="bh-th"><div class="bh-icon-mask bh-icon-stars" title="${dict.stars}"></div></div>
                        </div>
                        <div class="bh-tbody"></div>
                    </div>
                </div>
                <div class="bh-pagination">
                    <button class="bh-page-btn" id="bh-prev-page">◄</button>
                    <span class="bh-page-info" id="bh-page-info">1 / 1</span>
                    <button class="bh-page-btn" id="bh-next-page">►</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.custom-history-close')?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        document.getElementById('bh-clear-btn')?.addEventListener('click', clearHistoryDb);
        document.getElementById('bh-export-btn')?.addEventListener('click', exportHistoryData);
        document.getElementById('bh-import-btn')?.addEventListener('click', importHistoryData);
        document.getElementById('bh-prev-page')?.addEventListener('click', () => renderBattleTable(currentPage - 1));
        document.getElementById('bh-next-page')?.addEventListener('click', () => renderBattleTable(currentPage + 1));
    };
    const injectMenuButton = () => {
        const menuList = document.querySelector('.MainScreenComponentStyle-blockMainMenu ul');
        if (!menuList)
            return;
        if (menuList.querySelector('.custom-history-button'))
            return;
        const lang = getLang();
        const dict = t[lang];
        const garageDiv = menuList.querySelector('.PrimaryMenuItemComponentStyle-itemLiGarage');
        if (!garageDiv)
            return;
        const garageLi = garageDiv.closest('li');
        if (!garageLi)
            return;
        const historyBtn = document.createElement('li');
        historyBtn.className = 'PrimaryMenuItemComponentStyle-itemCommonLi PrimaryMenuItemComponentStyle-menuItemContainer custom-history-button';
        historyBtn.innerHTML = `
            <div class="custom-history-icon"></div>
            <span class="custom-history-name">${dict.title}</span>
        `;
        historyBtn.addEventListener('click', async () => {
            let overlay = document.querySelector('.custom-history-overlay');
            if (!overlay) {
                createHistoryPage();
                overlay = document.querySelector('.custom-history-overlay');
            }
            if (!overlay)
                return;
            await renderBattleTable(1);
            overlay.style.display = 'flex';
        });
        garageLi.after(historyBtn);
    };
    const initNavigationListeners = () => {
        window.addEventListener('keydown', (e) => {
            const overlay = document.querySelector('.custom-history-overlay');
            if (overlay && overlay.style.display === 'flex') {
                if (e.code === 'Escape' || e.key === 'Escape' || e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
                    if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName))
                        return;
                    overlay.style.display = 'none';
                    e.preventDefault();
                }
            }
        });
        window.addEventListener('mousedown', (e) => {
            const overlay = document.querySelector('.custom-history-overlay');
            if (overlay && overlay.style.display === 'flex' && e.button === 3) {
                overlay.style.display = 'none';
                e.preventDefault();
            }
        });
    };
    const initObserver = () => {
        const observer = new MutationObserver(() => {
            updateNickname();
            injectMenuButton();
            const loader = document.querySelector('.ApplicationLoaderComponentStyle-container');
            if (loader) {
                const overlay = document.querySelector('.custom-history-overlay');
                if (overlay && overlay.style.display === 'flex') {
                    overlay.style.display = 'none';
                }
                const confirmOverlay = document.querySelector('#clear-confirm-overlay');
                if (confirmOverlay) {
                    if (confirmOverlay.closeDialogMethod) {
                        confirmOverlay.closeDialogMethod();
                    }
                    else {
                        confirmOverlay.remove();
                    }
                }
            }
            const selfRow = document.querySelector('#selfUserBg');
            if (selfRow) {
                if (!selfRow.dataset.timerStarted) {
                    selfRow.dataset.timerStarted = "true";
                    setTimeout(() => {
                        const row = document.querySelector('#selfUserBg');
                        if (row && !battleProcessed) {
                            row.dataset.equipTimeout = "true";
                            extractAndSaveBattleResult();
                        }
                    }, 2500);
                }
                extractAndSaveBattleResult();
            }
            else {
                battleProcessed = false;
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
        else {
            document.addEventListener('DOMContentLoaded', () => {
                observer.observe(document.body, { childList: true, subtree: true });
            });
        }
    };
    addHistoryStyles();
    initNavigationListeners();
    initObserver();
    setTimeout(() => {
        if (currentNickname !== 'Unknown') {
            removeDuplicateBattles(currentNickname);
        }
    }, 5000);
})();
