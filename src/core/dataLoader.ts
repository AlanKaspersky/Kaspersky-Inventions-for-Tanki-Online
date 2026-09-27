export const DataLoader = (() => {
    const state = {
            paints: null,
            augments: null,
            maps: null,
            skins: null,
            shared: null,
            ready: false,
            error: null,
        };

        const readyPromise = (async () => {
            try {
                const [paintsRes, augmentsRes, mapsRes, skinsRes] = await Promise.all([
                    fetch(chrome.runtime.getURL('database/paints.json')),
                    fetch(chrome.runtime.getURL('database/augments.json')),
                    fetch(chrome.runtime.getURL('database/maps.json')),
                    fetch(chrome.runtime.getURL('database/skins.json')),
                ]);
                if (!paintsRes.ok)
                    throw new Error('paints.json: HTTP ' + paintsRes.status);
                if (!augmentsRes.ok)
                    throw new Error('augments.json: HTTP ' + augmentsRes.status);
                if (!mapsRes.ok)
                    throw new Error('maps.json: HTTP ' + mapsRes.status);
                if (!skinsRes.ok)
                    throw new Error('skins.json: HTTP ' + skinsRes.status);


                state.paints = await paintsRes.json();

                const augRaw = await augmentsRes.json();
                state.shared = augRaw._shared || {};
                const devices = augRaw.devices || {};
                for (const url in devices) {
                    const entry = devices[url];
                    if (entry && typeof entry === 'object' && entry.$shared) {
                        devices[url] = state.shared[entry.$shared] || entry;
                    }
                }
                state.augments = devices;

                const mapsRaw = await mapsRes.json();
                const byRu = new Map();
                const byEn = new Map();
                for (const entry of mapsRaw) {
                    if (entry.ru) byRu.set(entry.ru.toLowerCase(), entry);
                    if (entry.en) byEn.set(entry.en.toLowerCase(), entry);
                }
                state.maps = { list: mapsRaw, byRu, byEn };
                state.skins = await skinsRes.json();
                state.ready = true;
                console.log(
                    `[KI] DB loaded: paints=${Object.keys(state.paints).length}, ` +
                    `augments=${Object.keys(state.augments).length}, ` +
                    `maps=${mapsRaw.length}`,
                    `skins=${Object.keys(state.skins.database).length}`
                );
            }
            catch (e) {
                state.error = e;
                console.error('[KI] DB load failed:', e);
            }
        })();;

        return {
            readyPromise,
            isReady: () => state.ready,
            getPaint: (url) => state.paints ? state.paints[url] : undefined,
            getDevice: (url) => state.augments ? state.augments[url] : undefined,
            hasDevice: (url) => !!state.augments && url in state.augments,

            translateMap: (rawName, targetLang) => {
                if (!state.maps || !rawName) return rawName;
                const key = String(rawName).trim().toLowerCase();
                const entry = state.maps.byRu.get(key) || state.maps.byEn.get(key);
                if (!entry) return rawName;
                return targetLang === 'RU' ? entry.ru : entry.en;
            },

            getMapInfo: (rawName) => {
                if (!state.maps || !rawName) return null;
                const key = String(rawName).trim().toLowerCase();
                return state.maps.byRu.get(key) || state.maps.byEn.get(key) || null;
            },
            getSkinsData: () => state.skins,
        };
    })();;