import { ipcRenderer } from 'electron';

// A narrow message bridge works with extension content scripts in their isolated world.
const isGame = () => window.location.protocol === 'https:' &&
    /(^|\.)tankionline\.com$/.test(window.location.hostname) &&
    (window.location.pathname === '/play' || window.location.pathname.startsWith('/play/'));
window.addEventListener('message', event => {
    if (!isGame() || event.source !== window || event.origin !== window.location.origin ||
        event.data?.type !== 'kasp:discord-presence' || event.data.version !== 1) return;
    const value = event.data.presence;
    if (value !== null && (!value || typeof value.details !== 'string' || typeof value.state !== 'string' ||
        value.details.length > 128 || value.state.length > 128)) return;
    if (value?.timestamps !== undefined && (!value.timestamps || !Number.isSafeInteger(value.timestamps.end) ||
        value.timestamps.end <= 0 || value.timestamps.end >= 1e11)) return;
    if (value?.party !== undefined && (!value.party || !Array.isArray(value.party.size) || value.party.size.length !== 2 ||
        !value.party.size.every((count: unknown) => typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= 1000) ||
        value.party.size[1] <= 0 || value.party.size[0] > value.party.size[1])) return;
    ipcRenderer.send('ki:discord-presence', value === null ? null : { details: value.details, state: value.state,
        ...(value.timestamps ? { timestamps: { end: value.timestamps.end } } : {}),
        ...(value.party ? { party: { size: [value.party.size[0], value.party.size[1]] } } : {}) });
});
