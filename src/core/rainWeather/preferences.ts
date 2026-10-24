export const WEATHER_VOLUME_KEYS = { rain: 'k_rain_volume', thunder: 'k_thunder_volume' } as const;
export type WeatherVolumes = { rain: number; thunder: number };

export function readWeatherVolumes(storage: Pick<Storage, 'getItem'>): WeatherVolumes {
    const read = (key: string) => {
        try {
            const raw = storage.getItem(key);
            if (raw === null || raw.trim() === '') return 1;
            const value = Number(raw);
            return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
        } catch { return 1; }
    };
    return { rain: read(WEATHER_VOLUME_KEYS.rain), thunder: read(WEATHER_VOLUME_KEYS.thunder) };
}
