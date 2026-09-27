import { state } from '../core/state';

export const welcomeModal = (() => {
    const CURRENT_VERSION = chrome.runtime.getManifest().version;
    const STORAGE_KEY = 'kasp_last_version';
    let hasChecked = false;

    const t: Record<string, Record<string, string>> = {
        RU: {
            version: `ВЕРСИЯ ${CURRENT_VERSION}`,
            intro: `Огромное спасибо, что пользуетесь Kaspersky's Inventions! Мы ценим ваше внимание к проекту и с каждым обновлением будем радовать вас новыми функциями.`,
            role1: `Идею создал`,
            role2: `В создании участвовали`,
            role3: `Качество оценивали`,
            role4: `Помогали`,
            outro: `Проект выражает им огромную благодарность!`,
            close: `ЗАКРЫТЬ`
        },
        EN: {
            version: `VERSION ${CURRENT_VERSION}`,
            intro: `Thank you so much for using Kaspersky's Inventions! We appreciate your support and will continue to delight you with new features in every update.`,
            role1: `Idea Created By`,
            role2: `Co-created By`,
            role3: `Quality Assessed By`,
            role4: `Helped`,
            outro: `The project expresses huge gratitude to them!`,
            close: `CLOSE`
        }
    };

    async function showWelcomeModal() {
        const lang = state.lang;
        const dict = t[lang] || t['EN'];

        const templateUrl = chrome.runtime.getURL('templates/welcome-modal.html');
        try {
            const response = await fetch(templateUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let html = await response.text();

            html = html
                .replace(/{{version}}/g, dict.version)
                .replace(/{{intro}}/g, dict.intro)
                .replace(/{{role1}}/g, dict.role1)
                .replace(/{{role2}}/g, dict.role2)
                .replace(/{{role3}}/g, dict.role3)
                .replace(/{{role4}}/g, dict.role4)
                .replace(/{{outro}}/g, dict.outro)
                .replace(/{{close}}/g, dict.close);

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
                        background: radial-gradient(100% 100% at 0% 0%, rgb(255 255 255 / 15%) 0%, rgb(0 0 0 / 95%) 100%), rgb(56 56 56);
                        font-family: BaseFont, FallbackFont, sans-serif; color: white;
                    `;

            dialog.innerHTML = html;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const closeBtn = document.getElementById('kasp-welcome-close') as HTMLElement | null;
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    overlay.remove();
                    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
                });
            }
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load welcome modal template:', error);
        }
    }

    return () => {
        if (hasChecked) return;

        const savedVersion = localStorage.getItem(STORAGE_KEY);
        if (savedVersion === CURRENT_VERSION) {
            hasChecked = true;
            return;
        }

        if (state.currentScreen === 'loading') return;

        hasChecked = true;
        showWelcomeModal();
    };
})();