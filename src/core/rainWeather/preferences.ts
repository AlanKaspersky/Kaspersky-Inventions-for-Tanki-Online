import { DEFAULT_WEATHER_GENERATION, RAIN_PRESETS } from './schedule';
import type { WeatherGeneration, WeatherPresetChoice } from './schedule';

export const WEATHER_VOLUME_KEYS = { rain: 'k_rain_volume', thunder: 'k_thunder_volume' } as const;
export const WEATHER_GENERATION_KEYS = { chance: 'k_rain_chance', preset: 'k_rain_preset', duration: 'k_rain_duration' } as const;
export type PuddleDetail = 'low' | 'high';
export type WeatherVolumes = { rain: number; thunder: number };

export function readWeatherGeneration(storage: Pick<Storage, 'getItem'>): WeatherGeneration {
    let chance = DEFAULT_WEATHER_GENERATION.chance, preset = DEFAULT_WEATHER_GENERATION.preset, duration = DEFAULT_WEATHER_GENERATION.duration;
    try {
        const raw = storage.getItem(WEATHER_GENERATION_KEYS.chance);
        const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
        if (Number.isFinite(value)) chance = Math.max(0, Math.min(1, value));
    } catch { /* Keep the default when storage is unavailable. */ }
    try {
        const value = storage.getItem(WEATHER_GENERATION_KEYS.preset);
        if (value === 'random' || value !== null && Object.prototype.hasOwnProperty.call(RAIN_PRESETS, value)) preset = value as WeatherPresetChoice;
    } catch { /* Keep the default when storage is unavailable. */ }
    try {
        const raw = storage.getItem(WEATHER_GENERATION_KEYS.duration);
        const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
        if (Number.isFinite(value)) duration = Math.max(0, Math.min(1, value));
    } catch { /* Keep the default when storage is unavailable. */ }
    return { chance, preset, duration };
}

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
