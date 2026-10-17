import { getHistoryDictionary } from './localization';

export const historyContext = {
    invalidated: false,
    handle(error: unknown, language: string): boolean {
        const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);
        if (!/extension context invalidated/i.test(message)) return false;
        if (!this.invalidated) {
            this.invalidated = true;
            const message = getHistoryDictionary(language).contextExpired;
            document.querySelector('.bh-detailed-view')?.remove();
            const panel = document.querySelector<HTMLElement>('.bh-left-panel');
            if (panel) panel.style.display = 'flex';
            const list = document.querySelector('.bh-list');
            if (list) {
                const notice = document.createElement('div');
                notice.className = 'bh-empty';
                notice.textContent = message;
                list.innerHTML = '';
                list.appendChild(notice);
            }
            document.querySelectorAll<HTMLButtonElement>('.bh-control-btn').forEach(button => { button.disabled = true; });
            const entry = document.querySelector<HTMLElement>('.custom-history-button');
            if (entry) entry.title = message;
        }
        return true;
    },
};
