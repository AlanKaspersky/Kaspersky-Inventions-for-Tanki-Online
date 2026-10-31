import { readSurfaceTuning, SURFACE_CONTROLS, WEATHER_TUNING_KEY } from './rainWeather/tuning';
import { readWeatherGeneration, readWeatherVolumes, WEATHER_GENERATION_KEYS, WEATHER_VOLUME_KEYS } from './rainWeather/preferences';
import { readSunIntensity } from './sunRays/config';

export const GRAPHICS_TUNING_KEY = 'k_graphics_tuning_v1';
type Language = 'RU' | 'EN';
export type GraphicsGroup = 'weather' | 'rain' | 'snow' | 'clouds' | 'lightning' | 'sun' | 'boxes';
const control = <K extends string>(key: K, group: GraphicsGroup, ru: string, en: string,
    value: number, min: number, max: number, step: number, unit = '', options?: readonly number[]) =>
    ({ key, group, label: { RU: ru, EN: en }, value, min, max, step, unit, options });
export const GRAPHICS_CONTROLS = [
    control('fadeIn', 'weather', 'Плавное начало', 'Fade in', 24, 1, 60, 1, 's'),
    control('fadeOut', 'weather', 'Плавное завершение', 'Fade out', 30, 1, 60, 1, 's'),
    control('wind', 'weather', 'Сила ветра', 'Wind strength', 1, 0, 2, .05, '×'),
    control('darkness', 'weather', 'Затемнение карты и неба', 'Map and sky darkening', 1, 0, 1.5, .05, '×'),
    control('fogRemoval', 'weather', 'Подавление игрового тумана', 'Native fog suppression', 1, 0, 1, .05, '×'),
    control('rainDrops', 'rain', 'Максимум капель', 'Maximum raindrops', 25000, 0, 60000, 1000),
    control('rainSpeed', 'rain', 'Скорость падения', 'Fall speed', 1, .25, 3, .05, '×'),
    control('rainSize', 'rain', 'Толщина капель', 'Drop width', 1, .25, 3, .05, '×'),
    control('rainLength', 'rain', 'Длина капель', 'Drop length', 1, .25, 3, .05, '×'),
    control('rainOpacity', 'rain', 'Видимость капель', 'Drop opacity', 1, 0, 2, .05, '×'),
    control('snowFlakes', 'snow', 'Максимум снежинок', 'Maximum snowflakes', 20000, 0, 40000, 1000),
    control('snowSpeed', 'snow', 'Скорость снегопада', 'Snowfall speed', 1, .25, 3, .05, '×'),
    control('snowSize', 'snow', 'Размер снежинок', 'Flake size', 1, .25, 3, .05, '×'),
    control('snowOpacity', 'snow', 'Видимость снежинок', 'Flake opacity', 1, 0, 2, .05, '×'),
    control('snowWind', 'snow', 'Усиление ветра метели', 'Blizzard wind multiplier', 1, 0, 3, .05, '×'),
    control('snowFlutter', 'snow', 'Кружение снежинок', 'Flake flutter', 1, 0, 3, .05, '×'),
    control('snowStreaks', 'snow', 'Доля снежных полос в метель', 'Blizzard streak share', .8, 0, 1, .05, '×'),
    control('snowFaces', 'snow', 'Плоскостей у снежинки', 'Faces per snowflake', 2, 1, 3, 1),
    control('snowBranches', 'snow', 'Детализация кристалла', 'Crystal branches', 3, 0, 8, 1),
    control('cloudAmount', 'clouds', 'Плотность облаков', 'Cloud coverage', 1, 0, 1.5, .05, '×'),
    control('cloudBrightness', 'clouds', 'Яркость облаков', 'Cloud brightness', 1, .25, 2, .05, '×'),
    control('cloudHeight', 'clouds', 'Высота облаков', 'Cloud base height', 110, 60, 250, 5, 'm'),
    control('cloudThickness', 'clouds', 'Толщина облачного слоя', 'Cloud layer thickness', 42, 10, 100, 2, 'm'),
    control('cloudResolution', 'clouds', 'Разрешение облаков', 'Cloud resolution', 1024, 256, 1536, 256, 'px', [256, 512, 1024, 1536]),
    control('cloudHz', 'clouds', 'Обновлений облаков в секунду', 'Cloud updates per second', 10, 2, 30, 1),
    control('lightningFrequency', 'lightning', 'Частота молний', 'Lightning frequency', 1, 0, 3, .1, '×'),
    control('lightningBrightness', 'lightning', 'Яркость молнии', 'Bolt brightness', 1, 0, 2, .05, '×'),
    control('lightningFlash', 'lightning', 'Вспышка освещения', 'Lighting flash', 1, 0, 1, .05, '×'),
    control('lightningDistance', 'lightning', 'Расстояние до молний', 'Lightning distance', 1, .5, 2, .05, '×'),
    control('sunDistance', 'sun', 'Дальность рассеяния', 'Scattering distance', 500, 50, 1500, 10, 'm'),
    control('sunDensity', 'sun', 'Плотность светящегося воздуха', 'Air scattering density', 0.45, 0, 3, .05, '×'),
    control('sunAnisotropy', 'sun', 'Направленность рассеяния', 'Forward scattering', 0.55, 0, .9, .01),
    control('sunSurface', 'sun', 'Усиление света на поверхностях', 'Surface light gain', 0.6, 0, 1, .01, '×'),
    control('sunHighlight', 'sun', 'Предел свечения воздуха', 'Air highlight limit', 0.18, .01, .5, .01),
    control('sunSky', 'sun', 'Предел свечения неба', 'Sky highlight limit', 0.03, 0, .2, .01),
    control('sunSteps', 'sun', 'Шагов расчёта света', 'Light sampling steps', 40, 12, 96, 4),
    control('sunResolution', 'sun', 'Разрешение объёмного света', 'Volumetric light resolution', 640, 320, 1280, 160, 'px'),
    control('sunShadow', 'sun', 'Разрешение теней карты', 'Map shadow resolution', 2048, 512, 4096, 512, 'px', [512, 1024, 2048, 4096]),
    control('sunFade', 'sun', 'Плавность появления света', 'Light fade in', 2, .1, 10, .1, 's'),
    control('sunTemperature', 'sun', 'Температура солнечного света', 'Sunlight temperature', 5200, 2500, 10000, 100, 'K'),
    control('sunDiskSize', 'sun', 'Размер солнечного диска', 'Sun disk diameter', .65, .1, 3, .05, '°'),
    control('sunDiskBrightness', 'sun', 'Яркость солнечного диска', 'Sun disk brightness', 1, 0, 3, .05),
    control('sunHalo', 'sun', 'Свечение вокруг солнца', 'Sun halo', 0.55, 0, 2, .05),
    control('sunHaze', 'sun', 'Плотность атмосферной дымки', 'Atmospheric haze density', 0.24, 0, 1, .01),
    control('sunHazeTemperature', 'sun', 'Температура дымки', 'Haze temperature', 5500, 2500, 10000, 100, 'K'),
    control('sunHazeStart', 'sun', 'Начало дымки', 'Haze start distance', 70, 0, 1000, 10, 'm'),
    control('sunHazeDistance', 'sun', 'Дальность сгущения дымки', 'Haze buildup distance', 600, 50, 1500, 10, 'm'),
    control('sunSkyWarmth', 'sun', 'Тонирование неба светом', 'Sky light tint', 0.2, 0, 1, .01),
    control('sunExposure', 'sun', 'Экспозиция', 'Exposure', 0.1, -2, 2, .05, 'EV'),
    control('sunContrast', 'sun', 'Контраст', 'Contrast', 1.02, .5, 1.5, .01),
    control('sunSaturation', 'sun', 'Насыщенность', 'Saturation', 0.96, 0, 1.5, .01),
    control('sunBloom', 'sun', 'Мягкое свечение ярких участков', 'Bloom strength', .22, 0, 1, .01),
    control('sunBloomThreshold', 'sun', 'Порог свечения', 'Bloom threshold', .72, .3, 1, .01),
    control('sunBloomRadius', 'sun', 'Радиус свечения', 'Bloom radius', 1.5, .5, 3, .1),
    control('sunShadowSoftness', 'sun', 'Мягкость теней добавленного света', 'Added-light shadow softness', 1.5, 0, 4, .1),
    control('sunShadowFill', 'sun', 'Прохладный свет в тенях', 'Cool shadow fill', .12, 0, .4, .01),
    control('sunToneCurve', 'sun', 'Кинематографичный тон', 'Cinematic tone curve', .25, 0, 1, .01),
    control('boxCount', 'boxes', 'Осколков от одной коробки', 'Shards per box', 14, 0, 40, 1),
    control('boxLimit', 'boxes', 'Максимум осколков на карте', 'Maximum active shards', 140, 10, 280, 10),
    control('boxFadeStart', 'boxes', 'Время до исчезновения', 'Time before fading', 2.2, 0, 10, .1, 's'),
    control('boxFadeDuration', 'boxes', 'Длительность исчезновения', 'Fade duration', .8, .1, 5, .1, 's'),
    control('boxGravity', 'boxes', 'Гравитация осколков', 'Shard gravity', 2400, 0, 5000, 100),
    control('boxSpeedH', 'boxes', 'Горизонтальная скорость', 'Horizontal launch speed', 1, 0, 3, .05, '×'),
    control('boxSpeedV', 'boxes', 'Вертикальная скорость', 'Vertical launch speed', 1, 0, 3, .05, '×'),
    control('boxSize', 'boxes', 'Размер осколков', 'Shard size', 1, .25, 2, .05, '×'),
    control('boxSpin', 'boxes', 'Вращение осколков', 'Shard spin', 1, 0, 3, .05, '×'),
    control('boxFlash', 'boxes', 'Длительность вспышки', 'Flash duration', .22, .05, 2, .01, 's'),
    control('boxGlow', 'boxes', 'Длительность свечения', 'Glow duration', .7, .1, 3, .05, 's'),
    control('boxBounce', 'boxes', 'Сила отскока', 'Bounce strength', .36, 0, .9, .01),
] as const;
export type GraphicsKey = typeof GRAPHICS_CONTROLS[number]['key'];
export type GraphicsTuning = Record<GraphicsKey, number>;
export const DEFAULT_GRAPHICS_TUNING = Object.freeze(Object.fromEntries(GRAPHICS_CONTROLS.map(c => [c.key, c.value])) as GraphicsTuning);
export function sanitizeGraphicsTuning(input: unknown): GraphicsTuning {
    const result = { ...DEFAULT_GRAPHICS_TUNING };
    for (const c of GRAPHICS_CONTROLS) {
        const value = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, c.key)?.value : undefined;
        if (typeof value === 'number' && Number.isFinite(value)) {
            const bounded = Math.max(c.min, Math.min(c.max, value));
            result[c.key] = c.options ? c.options.reduce((a, b) => Math.abs(b - bounded) < Math.abs(a - bounded) ? b : a) : bounded;
        }
    }
    for (const key of ['rainDrops','snowFlakes','snowFaces','snowBranches','sunSteps','boxCount','boxLimit'] as const) result[key] = Math.round(result[key]);
    return result;
}
export function readGraphicsTuning(storage: Pick<Storage, 'getItem'>): GraphicsTuning {
    try { return sanitizeGraphicsTuning(JSON.parse(storage.getItem(GRAPHICS_TUNING_KEY) || 'null')); }
    catch { return { ...DEFAULT_GRAPHICS_TUNING }; }
}
export const GRAPHICS_FLAGS = { weather: 'k_rain_weather', puddles: 'k_rain_puddles', sunlight: 'k_sun_rays', boxes: 'k_box_pickup' } as const;
export function readGraphicsProfile(storage: Pick<Storage, 'getItem'>) {
    const enabled = Object.fromEntries(Object.entries(GRAPHICS_FLAGS).map(([name, key]) => [name, storage.getItem(key) === 'true'])) as Record<keyof typeof GRAPHICS_FLAGS, boolean>;
    const { chance, duration, preset } = readWeatherGeneration(storage);
    return { format: 'ki-graphics-settings' as const, version: 1 as const, settings: {
        enabled, generation: { chance, duration, preset }, volumes: readWeatherVolumes(storage),
        surface: readSurfaceTuning(storage), tuning: readGraphicsTuning(storage), sunIntensity: readSunIntensity(storage),
    } };
}
export type GraphicsProfile = ReturnType<typeof readGraphicsProfile>;
export type SunLook='original'|'cinematic'|'warm-evening';
const ORIGINAL_SUN:Partial<GraphicsTuning>={sunDistance:300,sunDensity:1,sunAnisotropy:.62,sunSurface:.55,
    sunHighlight:.22,sunSky:.06,sunTemperature:6500,sunHalo:.35,sunHaze:0,sunHazeTemperature:6500,
    sunHazeStart:60,sunHazeDistance:600,sunSkyWarmth:0,sunExposure:0,sunContrast:1,sunSaturation:1,
    sunBloom:0,sunShadowSoftness:0,sunShadowFill:0,sunToneCurve:0};
/** A look changes sunlight only, retaining the user's enable switch and other features. */
export function applySunLook(profile:GraphicsProfile,look:SunLook):GraphicsProfile{
    if(look!=='original'&&look!=='cinematic'&&look!=='warm-evening')throw Error('unknown-sun-look');
    const next=structuredClone(profile),s=next.settings;
    for(const c of GRAPHICS_CONTROLS)if(c.group==='sun')s.tuning[c.key]=look==='cinematic'?c.value:ORIGINAL_SUN[c.key]??c.value;
    s.sunIntensity=look==='original'?1:look==='cinematic'?4:8;
    if(look==='warm-evening')Object.assign(s.tuning,{
        sunDistance:600,sunDensity:.55,sunAnisotropy:.45,sunSurface:.45,sunHighlight:.18,sunSky:.03,
        sunSteps:64,sunResolution:960,sunTemperature:4500,sunHaze:.42,sunHazeTemperature:4800,
        sunHazeStart:40,sunHazeDistance:500,sunSkyWarmth:.45,sunExposure:.2,sunContrast:.94,sunSaturation:.94,
        sunBloom:.2,sunBloomRadius:1.5,sunShadowSoftness:2,sunShadowFill:.12,sunToneCurve:.2,
    });
    return next;
}
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid-object');
    return value as Record<string, unknown>;
};
/** Validate everything before the first storage write. Unknown keys never become storage keys. */
export function parseGraphicsProfile(text: string, storage: Pick<Storage, 'getItem'>): GraphicsProfile {
    if (text.length > 262144) throw Error('file-too-large');
    const input = object(JSON.parse(text));
    if (input.format !== 'ki-graphics-settings' || input.version !== 1) throw Error('unsupported-format');
    const src = object(input.settings), result = readGraphicsProfile(storage), dst = result.settings;
    const read = (value: unknown, min: number, max: number): number => {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error('invalid-number');
        return value;
    };
    if (src.enabled !== undefined) for (const [key, value] of Object.entries(object(src.enabled))) {
        if (!Object.prototype.hasOwnProperty.call(GRAPHICS_FLAGS, key)) continue;
        if (typeof value !== 'boolean') throw Error('invalid-boolean');
        dst.enabled[key as keyof typeof GRAPHICS_FLAGS] = value;
    }
    if (src.generation !== undefined) {
        const g = object(src.generation);
        if (g.chance !== undefined) dst.generation.chance = read(g.chance, 0, 1);
        if (g.duration !== undefined) dst.generation.duration = read(g.duration, 0, 1);
        if (g.preset !== undefined) {
            if (!['random','sunny','overcast','drizzle','sunshower','storm'].includes(String(g.preset))) throw Error('invalid-preset');
            dst.generation.preset = g.preset as typeof dst.generation.preset;
        }
    }
    if (src.volumes !== undefined) for (const key of ['rain','thunder'] as const) {
        const v = object(src.volumes); if (v[key] !== undefined) dst.volumes[key] = read(v[key], 0, 1);
    }
    if (src.sunIntensity !== undefined) dst.sunIntensity = read(src.sunIntensity, 0, Number.MAX_VALUE);
    if (src.surface !== undefined) {
        const values = object(src.surface);
        for (const c of SURFACE_CONTROLS) if (values[c.key] !== undefined) dst.surface[c.key] = read(values[c.key], c.min, c.max);
    }
    if (src.tuning !== undefined) {
        const values = object(src.tuning);
        for (const c of GRAPHICS_CONTROLS) if (values[c.key] !== undefined) {
            const value = read(values[c.key], c.min, c.max);
            if (c.options && !c.options.some(n => n === value)) throw Error('invalid-option');
            if (['rainDrops','snowFlakes','snowFaces','snowBranches','sunSteps','boxCount','boxLimit'].includes(c.key) && !Number.isInteger(value)) throw Error('invalid-integer');
            dst.tuning[c.key] = value;
        }
    }
    return result;
}
export function saveGraphicsProfile(profile: GraphicsProfile, storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): void {
    // Re-validate programmatic callers, too; never trust the TypeScript type at runtime.
    const s = parseGraphicsProfile(JSON.stringify(profile), storage).settings;
    const entries: [string, string][] = [
        ...Object.entries(GRAPHICS_FLAGS).map(([name, key]): [string, string] => [key, String(s.enabled[name as keyof typeof GRAPHICS_FLAGS])]),
        [WEATHER_GENERATION_KEYS.chance, String(s.generation.chance)], [WEATHER_GENERATION_KEYS.duration, String(s.generation.duration)],
        [WEATHER_GENERATION_KEYS.preset, s.generation.preset], [WEATHER_VOLUME_KEYS.rain, String(s.volumes.rain)],
        [WEATHER_VOLUME_KEYS.thunder, String(s.volumes.thunder)], [WEATHER_TUNING_KEY, JSON.stringify(s.surface)],
        [GRAPHICS_TUNING_KEY, JSON.stringify(s.tuning)], ['k_sun_rays_intensity', String(s.sunIntensity)],
    ];
    const changes = entries.map(([key,value]) => ({key,value,previous:storage.getItem(key)})).filter(e=>e.previous!==e.value);
    let written = 0;
    try { for (const {key,value} of changes) { storage.setItem(key, value); written++; } }
    catch (error) {
        for (let i = written - 1; i >= 0; i--) try { const c=changes[i];if(c.previous===null)storage.removeItem(c.key);else storage.setItem(c.key,c.previous); } catch { /* Preserve the original storage error. */ }
        throw error;
    }
}
export function defaultGraphicsProfile(): GraphicsProfile { return readGraphicsProfile({ getItem: () => null }); }
export type GraphicsLanguage = Language;
