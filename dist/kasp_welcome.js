"use strict";
(function () {
    'use strict';
    const CURRENT_VERSION = '1.5';
    const STORAGE_KEY = 'kasp_last_version';
    function getLang() {
        const htmlLang = document.documentElement.lang || '';
        if (htmlLang.toLowerCase().includes('ru'))
            return 'ru';
        if (window.location.hostname.includes('ru.'))
            return 'ru';
        return 'en';
    }
    const t = {
        ru: {
            version: `ВЕРСИЯ ${CURRENT_VERSION}`,
            intro: `Огромное спасибо, что пользуетесь Kaspersky's Inventions! Мы ценим ваше внимание к проекту и с каждым обновлением будем радовать вас новыми функциями.`,
            role1: `Идею создал`,
            role2: `В создании участвовали`,
            role3: `Качество оценивали`,
            outro: `Проект выражает им огромную благодарность!`,
            close: `ЗАКРЫТЬ`
        },
        en: {
            version: `VERSION ${CURRENT_VERSION}`,
            intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
            role1: `Idea Created By`,
            role2: `Co-created By`,
            role3: `Quality Assessed By`,
            outro: `The project expresses huge gratitude to them!`,
            close: `CLOSE`
        }
    };
    function showWelcomeModal() {
        const lang = getLang();
        const dict = t[lang];
        const overlay = document.createElement('div');
        overlay.id = 'kasp-welcome-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(3px);
        `;
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            display: flex; flex-direction: column; align-items: stretch;
            width: 45em; max-width: 90vw;
            z-index: 60; box-shadow: rgba(0, 0, 0, 0.5) 0px 0.5em 2em 0px;
            outline: rgba(255, 255, 255, 0.25) solid 0.063em;
            padding: 2.5em; border-radius: 0.75em;
            background: radial-gradient(100% 100% at 0% 0%, rgba(118, 255, 51, 0.15) 0%, rgba(0, 25, 38, 0.95) 100%), rgb(10, 15, 20);
            font-family: BaseFont, FallbackFont, sans-serif; color: white;
        `;
        dialog.innerHTML = `
            <div style="text-align: center; margin-bottom: 1.5em;">
                <h1 style="font-family: BaseFontBold, FallbackFontBold, sans-serif; font-size: 2.2em; color: rgb(118, 255, 51); margin: 0 0 0.2em 0; text-transform: uppercase; letter-spacing: 0.5px;">Kaspersky's Inventions</h1>
                <h2 style="font-family: BaseFontMedium, FallbackFontMedium, sans-serif; font-size: 1.1em; color: rgba(255, 255, 255, 0.6); margin: 0; text-transform: uppercase; letter-spacing: 1px;">${dict.version}</h2>
            </div>
            
            <div style="font-size: 1.05em; line-height: 1.4; color: rgb(220, 220, 220); margin-bottom: 2em; text-align: center;">
                <p style="margin-bottom: 1.5em;">${dict.intro}</p>
                
                <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role1}</p>
                <p style="margin: 0.2em 0 1em 0; font-family: BaseFontBold, FallbackFontBold, sans-serif; color: white; font-size: 1.2em;">Kaspersky</p>
                
                <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role2}</p>
                <p style="margin: 0.2em 0 1em 0; color: white; line-height: 1.3;">
                    ChatGPT<br>
                    DeepSeek<br>
                    Claude Sonnet 5<br>
                    Gemini 3.5 Flash-Lite<br>
                    Gemini 3.7 Flash<br>
                    Gemini 3.1 Pro
                </p>
                
                <p style="margin: 0; color: rgba(255, 255, 255, 0.5); font-size: 0.9em; text-transform: uppercase;">${dict.role3}</p>
                <p style="margin: 0.2em 0 1.5em 0; color: white; line-height: 1.3;">
                    Claude Fable 5<br>
                    Claude Opus 5
                </p>
                
                <p style="margin: 0; font-family: BaseFontMedium, FallbackFontMedium, sans-serif; color: rgb(118, 255, 51); font-size: 1.1em; text-transform: uppercase;">${dict.outro}</p>
            </div>
            
            <div style="display: flex; justify-content: center; gap: 1em; flex-wrap: wrap;">
                <a href="https://discord.gg/yNeB7Ah752" target="_blank" style="text-decoration: none;">
                    <div style="height: 3em; border-radius: 0.75em; background-color: #5865F2; display: flex; align-items: center; justify-content: center; color: white; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                        DISCORD
                    </div>
                </a>
                <a href="https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online.git" target="_blank" style="text-decoration: none;">
                    <div style="height: 3em; border-radius: 0.75em; background-color: rgba(255, 255, 255, 0.15); display: flex; align-items: center; justify-content: center; color: white; font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                        GITHUB
                    </div>
                </a>
                <div id="kasp-welcome-close" style="height: 3em; border-radius: 0.75em; background-color: rgb(118, 255, 51); display: flex; align-items: center; justify-content: center; color: rgb(0, 25, 38); font-family: BaseFontBold, FallbackFontBold, sans-serif; font-weight: 500; text-transform: uppercase; padding: 0 1.5em; cursor: pointer; border: 1px solid transparent;" onmouseover="this.style.borderColor='white'; this.style.boxShadow='0 0 0 1px white';" onmouseout="this.style.borderColor='transparent'; this.style.boxShadow='none';">
                    ${dict.close}
                </div>
            </div>
        `;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        const closeBtn = document.getElementById('kasp-welcome-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.remove();
                localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
            });
        }
    }
    function checkVersionAndShow() {
        const savedVersion = localStorage.getItem(STORAGE_KEY);
        if (savedVersion !== CURRENT_VERSION) {
            const checkReady = setInterval(() => {
                const isGameLoaded = document.querySelector('.UserInfoContainerStyle-userNameRank');
                const loader = document.querySelector('.ApplicationLoaderComponentStyle-container');
                let isLoaderHidden = true;
                if (loader) {
                    const style = window.getComputedStyle(loader);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        isLoaderHidden = false;
                    }
                }
                if (isGameLoaded && isLoaderHidden) {
                    clearInterval(checkReady);
                    showWelcomeModal();
                }
            }, 1000);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkVersionAndShow);
    }
    else {
        checkVersionAndShow();
    }
})();
