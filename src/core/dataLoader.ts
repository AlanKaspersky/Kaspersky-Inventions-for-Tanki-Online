import { AugmentCatalog } from './augmentCatalog';

interface PaintInfo { ru: string; en: string; }
interface MapInfo extends PaintInfo { image: string; }
interface SkinsDatabase { names: Record<string, string>; defaults: Record<string, string>; }
interface LoaderState {
    paints: Record<string, PaintInfo> | null;
    maps: { list: MapInfo[]; byRu: Map<string, MapInfo>; byEn: Map<string, MapInfo> } | null;
    skins: SkinsDatabase | null;
    ready: boolean;
    error: unknown;
}

export const DataLoader = (() => {
    const state: LoaderState = {
        paints: null,
        maps: null,
        skins: null,
        ready: false,
        error: null,
    };

    const readyPromise = (async () => {
        try {
            const [paintsRes, mapsRes, skinsRes] = await Promise.all([
                fetch(chrome.runtime.getURL('database/paints.json')),
                fetch(chrome.runtime.getURL('database/maps.json')),
                fetch(chrome.runtime.getURL('database/skins.json')),
            ]);
            if (!paintsRes.ok)
                throw new Error('paints.json: HTTP ' + paintsRes.status);
            if (!mapsRes.ok)
                throw new Error('maps.json: HTTP ' + mapsRes.status);
            if (!skinsRes.ok)
                throw new Error('skins.json: HTTP ' + skinsRes.status);
            state.paints = await paintsRes.json() as Record<string, PaintInfo>;
            const mapsRaw = await mapsRes.json() as MapInfo[];
            const byRu = new Map<string, MapInfo>();
            const byEn = new Map<string, MapInfo>();
            for (const entry of mapsRaw) {
                if (entry.ru) byRu.set(entry.ru.toLowerCase(), entry);
                if (entry.en) byEn.set(entry.en.toLowerCase(), entry);
            }
            state.maps = { list: mapsRaw, byRu, byEn };
            state.skins = await skinsRes.json() as SkinsDatabase;
            state.ready = true;
            console.log(
                `[KI] DB loaded: paints=${Object.keys(state.paints).length}, ` +
                `maps=${mapsRaw.length}, ` +
                `skins=${Object.keys(state.skins?.names ?? {}).length}`
            );
        }
        catch (e) {
            state.error = e;
            console.error('[KI] DB load failed:', e);
        }
    })();

    return {
        readyPromise,
        isReady: () => state.ready,
        getPaint: (url: string) => state.paints ? state.paints[url] : undefined,
        getDevice: (url: string, element?: Element | null) => AugmentCatalog.getDevice(url, element),
        hasDevice: (url: string, element?: Element | null) => !!AugmentCatalog.getDevice(url, element),

        translateMap: (rawName: string, targetLang: string) => {
            if (!state.maps || !rawName) return rawName;
            const key = String(rawName).trim().toLowerCase();
            const entry = state.maps.byRu.get(key) || state.maps.byEn.get(key);
            if (!entry) return rawName;
            return targetLang === 'RU' ? entry.ru : entry.en;
        },

        getMapInfo: (rawName: string) => {
            if (!state.maps || !rawName) return null;
            const key = String(rawName).trim().toLowerCase();
            return state.maps.byRu.get(key) || state.maps.byEn.get(key) || null;
        },
        getSkinsData: () => state.skins,
    };
})();
