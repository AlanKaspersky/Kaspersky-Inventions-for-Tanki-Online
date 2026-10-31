import { state } from './state';
import { gameDOM } from './gameDOM';
import { utils } from './utils';
import { setupNicknamePrivacy } from '../modules/hideNickname';
import { getVerifiedAccount } from './accountIdentity';
import { renderGraphicsSettings, bindGraphicsSettings } from './graphicsSettings';


export const coreSettings = (() => {
    let needsReload = false;
    let active = false;
    let stopArt: (() => void) | null = null;
    let stopGraphics: (() => void) | null = null;
    const liveSettings = new Set(['k_arcade_reload', 'k_critical_indicator', 'k_hideSupplies', 'k_box_pickup', 'k_rain_weather', 'k_rain_puddles', 'k_sun_rays']);
    let initialSettingsState: Record<string, boolean> = {};
    const t = {
        RU: {
            tooltip: 'Требуется перезагрузка', information: 'Информация',
            accountNotice: 'ID аккаунта пока недоступен. История и личное избранное временно недоступны; сохранённые данные остаются на месте.'
        },
        EN: {
            tooltip: 'Requires reload', information: 'Information',
            accountNotice: 'Account ID is unavailable. History and personal favorites are temporarily unavailable; saved data is preserved.'
        }
    };
    const puddleSetting = { id: 'k_rain_puddles', label: { RU: 'Лужи во время дождя', EN: 'Puddles during rain' },
        description: { RU: 'Отражения видимых объектов во время дождя', EN: 'Reflections of visible objects during rain' }, default: false };
    const groups = [
        {
            id: 'normal', title: { RU: 'Функции обычной серьёзности', EN: 'Standard features' },
            description: { RU: 'Интерфейс, друзья, гараж и история', EN: 'Interface, friends, garage and history' },
            settings: [
                { id: 'k_friends', label: { RU: 'Метки друзей', EN: 'Friend tags' },
                    description: { RU: 'Метки и категории в списке друзей', EN: 'Tags and categories in your friends list' }, default: false },
                { id: 'k_augments', label: { RU: 'Характеристики устройств', EN: 'Augment specifications' },
                    description: { RU: 'Включая недоступные предметы', EN: 'Including unavailable items' }, default: false },
                { id: 'k_auto_upgrade', label: { RU: 'Быстрая прокачка', EN: 'Quick upgrades' },
                    description: { RU: 'Последовательное улучшение вооружения', EN: 'Upgrade equipment in sequence' }, default: false },
                { id: 'k_ext_btn', label: { RU: 'Расширенная кнопка «Играть»', EN: 'Enhanced Play button' },
                    description: { RU: 'Выбор режимов прямо в лобби', EN: 'Choose battle modes directly in the lobby' }, default: false },
                { id: 'k_paints', label: { RU: 'Умный поиск красок', EN: 'Smart paint search' },
                    description: { RU: 'Поиск красок в гараже', EN: 'Find paints in the garage' }, default: false },
                { id: 'k_history', label: { RU: 'История битв', EN: 'Battle history' }, default: false }
            ]
        },
        {
            id: 'streamer', title: { RU: 'Режим стримера', EN: 'Streamer mode' },
            description: { RU: 'Личные данные на экране', EN: 'Personal information on screen' },
            settings: [
                { id: 'k_hideNicknameXP', label: { RU: 'Скрыть ник и опыт', EN: 'Hide nickname and XP' }, default: false },
                { id: 'k_hideCurrency', label: { RU: 'Скрыть валюту', EN: 'Hide currency' }, default: false },
                { id: 'k_hideSupplies', label: { RU: 'Скрыть припасы', EN: 'Hide supplies' }, default: false }
            ]
        },
        {
            id: 'advanced', title: { RU: 'Функции повышенной серьёзности', EN: 'Advanced features' },
            description: { RU: 'Показатели в битве', EN: 'In-battle indicators' },
            settings: [
                { id: 'k_overdrive_timer', label: { RU: 'Таймер коробки овердрайва', EN: 'Overdrive box timer' }, default: false },
                { id: 'k_arcade_reload', label: { RU: 'Полоса аркадной перезарядки', EN: 'Arcade reload indicator' }, default: true },
                { id: 'k_critical_indicator', label: { RU: 'Индикатор критического выстрела', EN: 'Critical shot indicator' }, default: true }
            ]
        },
        {
            id: 'graphics', title: { RU: 'Графические изменения', EN: 'Visual changes' },
            description: { RU: 'Визуальные эффекты в игре', EN: 'In-game visual effects' },
            settings: [
                { id: 'k_box_pickup', label: { RU: 'Изменённое поведение коробок в битве при подборе', EN: 'Modified box pickup animation in battle' },
                    description: { RU: 'Вспышка и разлетающиеся осколки', EN: 'A flash and scattering fragments' }, default: false },
                { id: 'k_rain_weather', label: { RU: 'Случайная погода в битве', EN: 'Random battle weather' },
                    description: { RU: 'Дождь или снег с плавной сменой облаков', EN: 'Rain or snow with gradual cloud transitions' }, default: false },
                { id: 'k_sun_rays', label: { RU: 'Шейдер освещения', EN: 'Lighting shader' },
                    description: { RU: 'Готовое оформление света, дымки и неба', EN: 'Ready-made lighting, haze and sky' }, default: false },
            ]
        }
    ];
    const settings = [...groups.flatMap(group => group.settings), puddleSetting];
    const informationLinks = [
        { label: { RU: 'Страница в Chrome Web Store', EN: 'Chrome Web Store' },
            href: 'https://chromewebstore.google.com/detail/tanki-online-kasperskys-i/eemohhfjcdlhmdpflloipmdeeggmofio?authuser=0&hl=ru' },
        { label: { RU: 'Исходный код расширения', EN: 'Extension source code' },
            href: 'https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online' },
        { label: { RU: 'Исходный код клиента', EN: 'Client source code' },
            href: 'https://github.com/AlanKaspersky/Tanki-Online-with-KI' },
        { label: { RU: 'Лицензия и правила использования', EN: 'License and Terms of Use' },
            href: 'https://drive.google.com/file/d/1j6pNdN7SJZAcRsM2WwLQfzQuWYTcG8ZO/view' },
        { label: { RU: 'FAQ — частые вопросы', EN: 'FAQ' },
            href: 'https://drive.google.com/file/d/15xzcltFZiiC9bbiKaZd3-Le6AGvqoTlz/view' }
    ];

    return {
        inject: () => {
            const mainBlock = document.querySelector(gameDOM.settings.root);
            if (!mainBlock) return;
            const ulMenu = mainBlock.querySelector('ul');
            if (!ulMenu || document.getElementById('kaspersky-tab')) return;
            ulMenu.style.setProperty('--kasp-settings-art', `url(${JSON.stringify(chrome.runtime.getURL('assets/art3.jpg'))})`);
            stopArt?.();
            stopArt = null;
            const lang = state.lang;
            const dict = t[lang] || t.EN;
            const settingRow = (setting: typeof settings[number], enabled = true) => {
                const checked = utils.getSetting(setting.id, setting.default);
                // Preserve the baseline if the language changes while settings are open.
                if (!(setting.id in initialSettingsState)) initialSettingsState[setting.id] = checked;
                const description = 'description' in setting ? setting.description : undefined;
                return `<label class="kasp-toggle-row ${checked ? 'kasp-active' : ''}" data-id="${setting.id}">
                    <span class="kasp-toggle-text"><span class="kasp-toggle-label">${setting.label[lang]}</span>
                        ${description ? `<span class="kasp-toggle-description">${description[lang]}</span>` : ''}
                    </span>
                    <input type="checkbox" role="switch" class="kasp-toggle-switch" ${checked ? 'checked' : ''} ${enabled ? '' : 'disabled'} aria-label="${setting.label[lang]}">
                </label>`;
            };
            let tooltip = document.getElementById('kaspersky-reload-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'kaspersky-reload-tooltip';
                tooltip.className = 'kasp-tooltip kasp-hidden';
                document.body.appendChild(tooltip);
            }
            tooltip.textContent = dict.tooltip;

            const kTab = document.createElement('li');
            kTab.id = 'kaspersky-tab';
            kTab.className = gameDOM.classes.settingsTab;
            kTab.innerHTML = '<div class="kasp-fake-highlight"><div class="kasp-fake-line"></div></div><span>KASPERSKY</span>';
            ulMenu.appendChild(kTab);

            const kContent = document.createElement('div');
            kContent.id = 'kaspersky-settings-content';
            kContent.className = 'kasp-hidden';
            kContent.style.setProperty('--kasp-settings-art', `url(${JSON.stringify(chrome.runtime.getURL('assets/art3.jpg'))})`);
            kContent.innerHTML = `
                <div class="kasp-settings-grid">${groups.map(group => `
                    <section class="kasp-settings-panel kasp-settings-${group.id}" aria-labelledby="kasp-settings-${group.id}-title">
                        <span class="kasp-settings-art" aria-hidden="true"></span>
                        <header class="kasp-settings-panel-heading">
                            <h3 id="kasp-settings-${group.id}-title">${group.title[lang]}</h3>
                            <p>${group.description[lang]}</p>
                        </header>
                        <div class="kasp-settings-rows">${group.id === 'graphics' ? renderGraphicsSettings(lang) : group.settings.map(setting => {
                            return settingRow(setting);
                        }).join('')}</div>
                    </section>`).join('')}
                    <section class="kasp-settings-panel kasp-settings-information" aria-labelledby="kasp-settings-information-title">
                        <span class="kasp-settings-art" aria-hidden="true"></span>
                        <header class="kasp-settings-panel-heading"><h3 id="kasp-settings-information-title">${dict.information}</h3></header>
                        <nav class="kasp-settings-links" aria-label="${dict.information}">${informationLinks.map(link => `
                            <a href="${link.href.replace(/&/g, '&amp;')}" target="_blank" rel="noopener noreferrer">
                                <span>${link.label[lang]}</span><span class="kasp-settings-link-arrow" aria-hidden="true">↗</span>
                            </a>`).join('')}
                        </nav>
                    </section>
                </div>`;
            if (!getVerifiedAccount()) {
                const notice = document.createElement('p');
                notice.className = 'kasp-settings-notice';
                notice.textContent = dict.accountNotice;
                kContent.appendChild(notice);
            }
            mainBlock.appendChild(kContent);

            const grid = kContent.querySelector<HTMLElement>('.kasp-settings-grid')!;
            const panels = Array.from(grid.querySelectorAll<HTMLElement>('.kasp-settings-panel'));
            const menuTabs = Array.from(ulMenu.querySelectorAll<HTMLElement>(gameDOM.settings.tab));
            const setArtSize = (target: HTMLElement, values: Record<string, number>, em: number) => {
                for (const [key, value] of Object.entries(values)) {
                    const next = `${(value / em).toFixed(5)}em`;
                    if (target.style.getPropertyValue(key) !== next) target.style.setProperty(key, next);
                }
            };
            const syncArt = () => {
                // Every menu button clips its own slice of one image covering the entire menu.
                // Relative offsets stay the same when the menu scrolls.
                const menuRects = menuTabs.map(tab => tab.getBoundingClientRect());
                if (menuRects.length && ulMenu.clientWidth) {
                    const left = Math.min(...menuRects.map(rect => rect.left));
                    const top = Math.min(...menuRects.map(rect => rect.top));
                    const width = Math.max(...menuRects.map(rect => rect.right)) - left;
                    const height = Math.max(...menuRects.map(rect => rect.bottom)) - top;
                    menuTabs.forEach((tab, index) => {
                        const rect = menuRects[index];
                        setArtSize(tab, {
                            '--kasp-settings-art-x': -(rect.left - left + tab.clientLeft + 3),
                            '--kasp-settings-art-y': -(rect.top - top + tab.clientTop + 3),
                            '--kasp-settings-art-width': width + 6,
                            '--kasp-settings-art-height': height + 6
                        }, parseFloat(getComputedStyle(tab).fontSize) || 16);
                    });
                }
                if (!grid.clientWidth || !grid.clientHeight) return;
                const gridRect = grid.getBoundingClientRect();
                for (const panel of panels) {
                    const layer = panel.querySelector<HTMLElement>('.kasp-settings-art')!;
                    const style = getComputedStyle(panel);
                    const em = parseFloat(style.fontSize) || 16;
                    const rect = panel.getBoundingClientRect();
                    // Preserve fractional grid positions, excluding entrance translation.
                    const transform = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
                    const values = {
                        '--kasp-settings-art-x': -(rect.left - gridRect.left - transform.m41 + panel.clientLeft + 3),
                        '--kasp-settings-art-y': -(rect.top - gridRect.top - transform.m42 + panel.clientTop + 3),
                        '--kasp-settings-art-width': gridRect.width + 6,
                        '--kasp-settings-art-height': gridRect.height + 6
                    };
                    setArtSize(layer, values, em);
                }
            };
            const artObserver = new ResizeObserver(syncArt);
            artObserver.observe(ulMenu);
            menuTabs.forEach(tab => artObserver.observe(tab));
            stopArt = () => artObserver.disconnect();
            syncArt();

            kContent.querySelectorAll<HTMLElement>('.kasp-toggle-row').forEach(row => {
                const id = row.dataset.id!;
                const switchBtn = row.querySelector<HTMLInputElement>('input')!;
                row.addEventListener('mousemove', (event: MouseEvent) => {
                    if (liveSettings.has(id)) {
                        tooltip?.classList.add('kasp-hidden');
                        return;
                    }
                    if (tooltip) {
                        tooltip.style.left = event.clientX + 'px';
                        tooltip.style.top = event.clientY + 'px';
                        tooltip.classList.remove('kasp-hidden');
                    }
                });
                row.addEventListener('mouseleave', () => tooltip?.classList.add('kasp-hidden'));
                switchBtn.addEventListener('change', () => {
                    const checked = switchBtn.checked;
                    row.classList.toggle('kasp-active', checked);
                    utils.setSetting(id, checked);
                    needsReload = settings.some(setting => !liveSettings.has(setting.id)
                        && utils.getSetting(setting.id, setting.default) !== initialSettingsState[setting.id]);
                    if (id === 'k_hideNicknameXP') {
                        if (checked) setupNicknamePrivacy();
                        else document.documentElement.classList.remove('kasp-hide-nickname');
                    }
                });
            });
            stopGraphics?.();
            stopGraphics = bindGraphicsSettings(kContent, lang);

            const show = () => {
                active = true;
                ulMenu.querySelectorAll(gameDOM.settings.nativeTabs).forEach(tab => tab.classList.remove(gameDOM.classes.settingsActive));
                kTab.classList.add(gameDOM.classes.settingsActive);
                ulMenu.classList.add('kasp-hide-native-slider');
                const nativeContent = mainBlock.querySelector<HTMLElement>(gameDOM.settings.content);
                if (nativeContent) nativeContent.style.display = 'none';
                kContent.classList.remove('kasp-hidden');
                artObserver.observe(grid);
                panels.forEach(panel => artObserver.observe(panel));
                syncArt();
            };
            kTab.addEventListener('click', event => { event.stopPropagation(); show(); });
            ulMenu.addEventListener('click', event => {
                const target = event.target as HTMLElement;
                const clickedTab = target.closest(gameDOM.settings.tab);
                if (clickedTab && clickedTab.id !== 'kaspersky-tab' && !clickedTab.classList.contains(gameDOM.classes.settingsSlider)) {
                    active = false;
                    kTab.classList.remove(gameDOM.classes.settingsActive);
                    ulMenu.classList.remove('kasp-hide-native-slider');
                    kContent.classList.add('kasp-hidden');
                    tooltip?.classList.add('kasp-hidden');
                    const nativeContent = mainBlock.querySelector<HTMLElement>(gameDOM.settings.content);
                    if (nativeContent) nativeContent.style.display = '';
                }
            });
            if (active) show();
        },
        onClose: () => {
            stopGraphics?.(); stopGraphics = null;
            stopArt?.();
            stopArt = null;
            document.getElementById('kaspersky-reload-tooltip')?.classList.add('kasp-hidden');
            active = false;
            initialSettingsState = {};
            if (needsReload) window.location.reload();
        }
    };
})();
