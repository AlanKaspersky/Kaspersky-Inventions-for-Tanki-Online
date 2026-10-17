import { featureScope } from '../../core/featureRuntime';
const lifecycle = featureScope('battleHistory');
import { state } from '../../core/state';
import { createKaspModal } from '../../core/modal';
import { addBattles, getAllBattles, clearAccountHistory } from './repository';
import { parseHistoryImport } from './validation';
import { getClearHistoryDictionary, getHistoryMessages } from './localization';
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
            lifecycle.listen(cancelButton, 'click', modal.close);
            lifecycle.listen(confirmButton, 'click', () => {
                if (confirmed) return;
                confirmed = true;
                modal.close();
                onConfirm();
            });
        } catch (error) {
            console.error('[Kaspersky Inventions] Failed to load clear history modal template:', error);
        }
    }

    const clearHistoryDb = () => {
        account.updateIdentity();
        const userId = account.getUserId();
        if (!userId) return;
        void showClearConfirmModal(async () => {
            try {
                account.updateIdentity();
                if (lifecycle.disabled || userId !== account.getUserId()) return;
                await clearAccountHistory(userId);
                await renderBattleList(1);
            } catch (error) {
                console.error('[Tanki Battle History] Error clearing DB:', error);
            }
        });
    };

    const exportHistoryData = async () => {
        account.updateIdentity();
        const userId = account.getUserId();
        if (!userId) return;
        try {
            const battles = await getAllBattles(userId);
            account.updateIdentity();
            if (lifecycle.disabled || userId !== account.getUserId() || battles.length === 0) return;
            const blob = new Blob([JSON.stringify(battles, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = `Tanki_BattleHistory_${userId}_${new Date().toISOString().slice(0, 10)}.json`;
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
        account.updateIdentity();
        const userId = account.getUserId();
        if (!userId) return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = lifecycle.guard((e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = lifecycle.guard(async (ev: ProgressEvent<FileReader>) => {
                try {
                    account.updateIdentity();
                    if (lifecycle.disabled || userId !== account.getUserId()) return;
                    const battles = parseHistoryImport(String(ev.target?.result ?? ''), userId);
                    const added = await addBattles(battles, userId);
                    if (lifecycle.disabled) return;
                    await renderBattleList(1);
                    if (lifecycle.disabled) return;
                    window.alert(getHistoryMessages(state.lang).imported(added));
                } catch (err) {
                    showImportError(err);
                }
            });
            reader.onerror = lifecycle.guard(() => showImportError(reader.error));
            reader.readAsText(file);
        });
        input.click();
    };

    return { clearHistoryDb, exportHistoryData, importHistoryData };
}
