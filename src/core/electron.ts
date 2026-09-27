export function setupElectronZKey() {
    const isElectronClient = (() => {
        try {
            if (navigator.userAgent && navigator.userAgent.indexOf('Electron') !== -1) return true;
            if ((window as any).process?.type) return true;
        } catch { }
        return false;
    })();;

    if (!isElectronClient) return;
    const dispatchZKey = (type) => {
        const event = new KeyboardEvent(type, {
            key: 'z',
            code: 'KeyZ',
            keyCode: 90,
            which: 90,
            bubbles: true,
            cancelable: true,
            composed: true
        });
        document.dispatchEvent(event);
    };
    document.addEventListener('mousedown', (e) => {
        if (e.button !== 3 && e.button !== 4)
            return;
        const ae = document.activeElement;
        if (ae instanceof HTMLElement &&
            (ae.tagName === 'INPUT' ||
                ae.tagName === 'TEXTAREA' ||
                ae.tagName === 'SELECT' ||
                ae.isContentEditable))
            return;
        e.preventDefault();
        dispatchZKey('keydown');
        dispatchZKey('keyup');
    }, true);
    document.addEventListener('mouseup', (e) => {
        if (e.button === 3 || e.button === 4)
            e.preventDefault();
    }, true);
    document.addEventListener('click', (e) => {
        if (e.button === 3 || e.button === 4)
            e.preventDefault();
    }, true);
}