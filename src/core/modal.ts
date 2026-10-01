export interface KaspModal {
    overlay: HTMLElement;
    dialog: HTMLElement;
    body: HTMLElement;
    actions: HTMLElement;
    closeButton: HTMLButtonElement;
    close: () => void;
    onClose: (listener: () => void) => void;
}

interface KaspModalOptions {
    id: string;
    title: string;
    closeLabel: string;
}

const pendingModalIds = new Set<string>();

export const createKaspModal = async (options: KaspModalOptions): Promise<KaspModal | null> => {
    if (document.getElementById(options.id) || pendingModalIds.has(options.id)) return null;
    pendingModalIds.add(options.id);

    try {
        const response = await fetch(chrome.runtime.getURL('templates/modal.html'));
        if (!response.ok) throw new Error(`Modal template request failed: ${response.status}`);

        const template = document.createElement('template');
        template.innerHTML = await response.text();
        const overlay = template.content.firstElementChild as HTMLElement | null;
        if (!overlay) throw new Error('Modal template is empty');
        overlay.id = options.id;

        const dialog = overlay.querySelector<HTMLElement>('[data-kasp-modal-dialog]');
        const title = overlay.querySelector<HTMLElement>('[data-kasp-modal-title]');
        const closeButton = overlay.querySelector<HTMLButtonElement>('[data-kasp-modal-close]');
        const body = overlay.querySelector<HTMLElement>('[data-kasp-modal-body]');
        const actions = overlay.querySelector<HTMLElement>('[data-kasp-modal-actions]');
        if (!dialog || !title || !closeButton || !body || !actions) {
            throw new Error('Modal template is missing required elements');
        }

        title.id = `${options.id}-title`;
        dialog.setAttribute('aria-labelledby', title.id);
        title.textContent = options.title;
        closeButton.setAttribute('aria-label', options.closeLabel);

        let isClosing = false;
        let isRemoved = false;
        let removeTimer = 0;
        const closeListeners = new Set<() => void>();

        const cleanup = () => {
            document.removeEventListener('keydown', onKeyDown, true);
            window.removeEventListener('mousedown', onMouseDown, true);
        };

        const removeOverlay = () => {
            if (isRemoved) return;
            isRemoved = true;
            window.clearTimeout(removeTimer);
            dialog.removeEventListener('animationend', onDialogAnimationEnd);
            overlay.remove();
        };

        const onDialogAnimationEnd = (event: AnimationEvent) => {
            if (event.target === dialog) removeOverlay();
        };

        const close = () => {
            if (isClosing) return;
            isClosing = true;
            cleanup();
            overlay.classList.remove('kasp-modal-opening');
            overlay.classList.add('kasp-modal-closing');
            for (const listener of closeListeners) listener();
            closeListeners.clear();
            dialog.addEventListener('animationend', onDialogAnimationEnd);
            removeTimer = window.setTimeout(removeOverlay, 260);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            const isEscape = event.key === 'Escape' || event.key === 'Esc';
            const isZ = event.code === 'KeyZ' || event.key?.toLowerCase() === 'z';
            const activeTag = document.activeElement?.tagName;
            if (isZ && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag || '')) return;
            const isBackKey = isEscape || isZ;
            if (!isBackKey) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            close();
        };

        const blockRemainingBackEvents = () => {
            const block = (event: MouseEvent) => {
                if (event.button !== 3 && event.button !== 4) return;
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            };
            window.addEventListener('mouseup', block, true);
            window.addEventListener('click', block, true);
            window.addEventListener('auxclick', block, true);
            window.setTimeout(() => {
                window.removeEventListener('mouseup', block, true);
                window.removeEventListener('click', block, true);
                window.removeEventListener('auxclick', block, true);
            }, 700);
        };

        const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 3 && event.button !== 4) return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            if (event.button === 3) close();
            blockRemainingBackEvents();
        };

        closeButton.addEventListener('click', event => {
            event.stopPropagation();
            close();
        });
        dialog.addEventListener('mousedown', event => event.stopPropagation());
        dialog.addEventListener('click', event => event.stopPropagation());
        overlay.addEventListener('mousedown', event => {
            if (event.target !== overlay) return;
            event.preventDefault();
            event.stopPropagation();
            close();
        });
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('mousedown', onMouseDown, true);
        (overlay as HTMLElement & { closeDialogMethod?: () => void }).closeDialogMethod = close;
        document.body.appendChild(overlay);

        return {
            overlay,
            dialog,
            body,
            actions,
            closeButton,
            close,
            onClose: listener => {
                if (isClosing) listener();
                else closeListeners.add(listener);
            }
        };
    } finally {
        pendingModalIds.delete(options.id);
    }
};
