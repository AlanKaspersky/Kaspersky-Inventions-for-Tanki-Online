import { state } from '../../core/state';
import { createKaspModal } from '../../core/modal';
import { addBattles, getAllBattles, getNicknameHistory, mergeNicknameHistory, clearNicknameHistory } from './repository';
import { parseHistoryImport } from './validation';
import { getClearHistoryDictionary, getLinkHistoryDictionary, getHistoryMessages } from './localization';
import type { HistoryAccount, RenderBattleList } from './types';

function createActionButton(label: string, secondary = false): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kasp-modal-button' + (secondary ? ' kasp-modal-button--secondary' : '');
    const text = document.createElement('span');
    text.textContent = label;
    button.appendChild(text);
    return button;
}

export function createHistoryActions(account: HistoryAccount, renderBattleList: RenderBattleList) {
    async function showClearConfirmModal(onConfirm: () => void) {
        if (document.getElementById('clear-confirm-overlay')) return;

        const dict = getClearHistoryDictionary(state.lang);

        try {
            const modal = await createKaspModal({ id: 'clear-confirm-overlay', title: dict.title, closeLabel: dict.cancel });
            if (!modal) return;
            modal.actions.classList.add('kasp-modal-actions--center');
            const message = document.createElement('p');
            message.className = 'kasp-modal-copy kasp-modal-copy--center';
            message.textContent = dict.text;
            modal.body.appendChild(message);

            const cancelButton = createActionButton(dict.cancel, true);

            const confirmButton = createActionButton(dict.confirm);
            modal.actions.append(cancelButton, confirmButton);

            let confirmed = false;
            cancelButton.addEventListener('click', modal.close);
            confirmButton.addEventListener('click', () => {
                if (confirmed) return;
                confirmed = true;
                modal.close();
                onConfirm();
            });
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load clear history modal template:', error);
        }
    }

    const openLinkHistoryDialog = async () => {
        account.updateNickname();
        const nickname = account.getNickname();
        if (nickname === 'Unknown') {
            window.alert(getHistoryMessages(state.lang).unknownNickname);
            return;
        }

        const existing = document.getElementById('link-history-overlay');
        if (existing) return;

        try {
            const dict = getLinkHistoryDictionary(state.lang);
            const nicknames = (await getNicknameHistory()).filter(item => item.nickname !== nickname && item.nickname !== 'Unknown');
            if (nickname !== account.getNickname()) return;
            const modal = await createKaspModal({ id: 'link-history-overlay', title: dict.title, closeLabel: dict.cancel });
            if (!modal) return;
            if (nickname !== account.getNickname()) { modal.close(); return; }
            const { body, actions, close } = modal;

            const description = document.createElement('p');
            description.className = 'kasp-modal-copy';
            description.textContent = dict.description;
            const target = document.createElement('p');
            target.className = 'kasp-modal-copy';
            const targetLabel = document.createElement('span');
            targetLabel.textContent = `${dict.target} `;
            const targetNickname = document.createElement('strong');
            targetNickname.className = 'bh-link-target';
            targetNickname.textContent = nickname;
            target.append(targetLabel, targetNickname);

            const selectLabel = document.createElement('label');
            selectLabel.className = 'bh-link-select-label';
            const selectLabelText = document.createElement('span');
            selectLabelText.textContent = dict.select;
            const select = document.createElement('select');
            select.className = 'bh-link-select';
            select.setAttribute('aria-label', dict.select);
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = dict.placeholder;
            select.appendChild(placeholder);
            for (const item of nicknames) {
                const option = document.createElement('option');
                option.value = item.nickname;
                option.textContent = `${item.nickname} (${item.count})`;
                select.appendChild(option);
            }
            selectLabel.append(selectLabelText, select);

            const empty = document.createElement('p');
            empty.className = 'bh-link-empty';
            empty.textContent = dict.empty;
            empty.hidden = nicknames.length > 0;
            selectLabel.hidden = nicknames.length === 0;

            const cancelButton = createActionButton(dict.cancel, true);
            const confirmButton = createActionButton(dict.confirm);
            confirmButton.disabled = true;
            confirmButton.hidden = nicknames.length === 0;
            actions.append(cancelButton, confirmButton);
            body.append(description, target, selectLabel, empty);

            let isLinking = false;
            cancelButton.addEventListener('click', close);
            select.addEventListener('change', () => {
                confirmButton.disabled = select.value === '';
            });
            confirmButton.addEventListener('click', async () => {
                const sourceNickname = select.value;
                if (!sourceNickname || isLinking || nickname !== account.getNickname()) return;
                isLinking = true;
                confirmButton.disabled = true;
                cancelButton.disabled = true;
                try {
                    const moved = await mergeNicknameHistory(sourceNickname, nickname);
                    close();
                    await renderBattleList(1);
                    window.setTimeout(() => window.alert(dict.success(moved)), 220);
                } catch (error) {
                    console.error('[Tanki Battle History] Error linking histories:', error);
                    isLinking = false;
                    confirmButton.disabled = false;
                    cancelButton.disabled = false;
                    window.alert(dict.failed);
                }
            });

            modal.closeButton.focus();
        } catch (error) {
            console.error('[Tanki Battle History] Failed to open link history dialog:', error);
            window.alert(getHistoryMessages(state.lang).listFailed);
        }
    };

    const clearHistoryDb = () => {
        void showClearConfirmModal(async () => {
            try {
                await clearNicknameHistory(account.getNickname());
                await renderBattleList(1);
            } catch (error) {
                console.error('[Tanki Battle History] Error clearing DB:', error);
            }
        });
    };

    const exportHistoryData = async () => {
        account.updateNickname();
        const nickname = account.getNickname();
        try {
            const battles = await getAllBattles(nickname);
            if (battles.length === 0) return;
            const blob = new Blob([JSON.stringify(battles, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = `Tanki_BattleHistory_${nickname}_${new Date().toISOString().slice(0, 10)}.json`;
                link.click();
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('[Tanki Battle History] Export error:', error);
        }
    };

    const showImportError = (error: unknown) => {
        console.error('[Tanki Battle History] Import error:', error);
        window.alert(getHistoryMessages(state.lang).importFailed);
    };

    const importHistoryData = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (ev: ProgressEvent<FileReader>) => {
                try {
                    const battles = parseHistoryImport(String(ev.target?.result ?? ''));
                    await addBattles(battles);
                    await renderBattleList(1);
                    window.alert(getHistoryMessages(state.lang).imported(battles.length));
                } catch (err) {
                    showImportError(err);
                }
            };
            reader.onerror = () => showImportError(reader.error);
            reader.readAsText(file);
        };
        input.click();
    };

    return { clearHistoryDb, openLinkHistoryDialog, exportHistoryData, importHistoryData };
}
