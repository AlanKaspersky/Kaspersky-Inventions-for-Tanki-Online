import { SNOW_PRESETS } from '../snowWeather/config';
export const WEATHER = Object.freeze({
    chance: .24, // Actual rain probability in random mode, preserving the previous ~24% default.
    fadeIn: 24, fadeOut: 30, cloudLead: 12,
    unknownBattleSeconds: 600, maxBattleSeconds: 86400,
    maxDrops: 25000, cloudWidth: 1024, cloudHeight: 256, cloudHz: 10,
    cloudBase: 11000, cloudThickness: 4200,
    fogDistanceScale: .18, // Bring cloud lightening much closer than native map fog.
});
export const RAIN_PRESETS = Object.freeze({
    sunshower: { rain: .45, clouds: .45, wind: .25, storm: 0, sound: .25 },
    drizzle: { rain: .22, clouds: .65, wind: .15, storm: 0, sound: .20 },
    storm: { rain: 1, clouds: 1, wind: 1, storm: 1, sound: .45 },
    overcast: { rain: 0, clouds: .85, wind: .30, storm: 0, sound: 0 },
    sunny: { rain: 0, clouds: .20, wind: .20, storm: 0, sound: 0 },
});
export type RainPreset = keyof typeof RAIN_PRESETS;
export type Precipitation = 'rain' | 'snow';
export const weatherProfile=(preset:RainPreset,precipitation?:Precipitation)=>(precipitation==='snow'?SNOW_PRESETS:RAIN_PRESETS)[preset];
export type WeatherPresetChoice = 'random' | RainPreset;
export interface WeatherGeneration { chance: number; preset: WeatherPresetChoice; duration: number; precipitation: Precipitation; }
export const DEFAULT_WEATHER_GENERATION: Readonly<WeatherGeneration> = Object.freeze({ chance: WEATHER.chance, preset: 'random', duration: .3, precipitation: 'rain' });
const rainyPresets = (Object.keys(RAIN_PRESETS) as RainPreset[]).filter(name => RAIN_PRESETS[name].rain > 0);
export interface RainEpisode { version: 1; preset: RainPreset | null; start: number; hold: number; seed: number; fadeIn: number; fadeOut: number; continuous?: boolean; precipitation?: Precipitation; }
export const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function planRain(now: number, remaining: number | undefined, random: () => number,
    generation: Readonly<WeatherGeneration> = DEFAULT_WEATHER_GENERATION,
    transitions: {fadeIn:number;fadeOut:number} = WEATHER): RainEpisode {
    const entryFade = Number.isFinite(transitions.fadeIn) ? Math.max(1,Math.min(60,transitions.fadeIn)) : WEATHER.fadeIn;
    const exitFade = Number.isFinite(transitions.fadeOut) ? Math.max(1,Math.min(60,transitions.fadeOut)) : WEATHER.fadeOut;
    const seconds = Number.isFinite(remaining) ? Math.max(0, Math.min(WEATHER.maxBattleSeconds, remaining!)) : WEATHER.unknownBattleSeconds;
    const fraction = Number.isFinite(generation.duration) ? Math.max(0, Math.min(1, generation.duration)) : DEFAULT_WEATHER_GENERATION.duration;
    const empty: RainEpisode = { version: 1, preset: null, start: now, hold: 0, seed: Math.floor(random() * 0xffffff), fadeIn: entryFade, fadeOut: exitFade, precipitation: generation.precipitation==='snow'?'snow':'rain' };
    if (random() >= generation.chance || seconds <= 0 || fraction <= 0) return empty;
    const preset = generation.preset === 'random'
        ? rainyPresets[Math.min(rainyPresets.length - 1, Math.floor(random() * rainyPresets.length))]
        : generation.preset;
    // Full-battle weather must not expire because a WebGL HUD supplied no clock.
    // Its battle-owned plan ends on native battle exit, never an estimated timeout.
    if (fraction === 1) return { ...empty, preset, hold: seconds, continuous: true };
    const total = seconds * fraction;
    const fadeIn = Math.min(entryFade, total * .3), fadeOut = Math.min(exitFade, total * .3);
    const hold = Math.max(0, total - fadeIn - fadeOut);
    const delay = random() * Math.max(0, seconds - total);
    return { ...empty, preset, hold, fadeIn, fadeOut, start: now + delay * 1000 };
}
export function sampleRain(plan: RainEpisode, now: number) {
    const elapsed = (now - plan.start) / 1000, total = plan.fadeIn + plan.hold + plan.fadeOut;
    const profile = plan.preset ? weatherProfile(plan.preset,plan.precipitation) : RAIN_PRESETS.sunny;
    const lead = Math.min(WEATHER.cloudLead, plan.fadeIn * .5), tail = Math.min(5, plan.fadeOut / 6);
    const clouds = plan.preset ? smooth(elapsed / plan.fadeIn) * (plan.continuous ? 1 : 1 - smooth((elapsed - plan.fadeIn - plan.hold) / plan.fadeOut)) : 0;
    const rain = plan.preset ? smooth((elapsed - lead) / Math.max(.001, plan.fadeIn - lead))
        * (plan.continuous ? 1 : 1 - smooth((elapsed - plan.fadeIn - plan.hold + tail) / Math.max(.001, plan.fadeOut - tail))) : 0;
    return { clouds: clouds * profile.clouds, rain: rain * profile.rain, wind: profile.wind,
        sound: rain * profile.sound, storm: clouds * profile.storm, flash: 0, finished: !plan.continuous && elapsed >= total, active: elapsed >= 0 && (plan.continuous === true || elapsed < total) };
}
/** Expose a delayed episode explicitly; zero rendered frames while waiting is normal. */
export function rainTiming(plan: RainEpisode, now: number) {
    const elapsed = (now - plan.start) / 1000;
    const phase = !plan.preset ? 'clear' : elapsed < 0 ? 'waiting'
        : plan.continuous && elapsed >= plan.fadeIn ? 'holding'
        : elapsed >= plan.fadeIn + plan.hold + plan.fadeOut ? 'finished'
        : elapsed < plan.fadeIn ? 'forming' : elapsed < plan.fadeIn + plan.hold ? 'holding' : 'clearing';
    return { phase,
        startsInSeconds: plan.preset && phase !== 'finished' ? Math.max(0, Math.ceil(-elapsed)) : null,
        rainStartsInSeconds: plan.preset && weatherProfile(plan.preset,plan.precipitation).rain > 0 && phase !== 'finished'
            ? Math.max(0, Math.ceil(Math.min(WEATHER.cloudLead, plan.fadeIn * .5) - elapsed)) : null };
}
export function validEpisode(value: unknown): value is RainEpisode {
    if (!value || typeof value !== 'object') return false;
    const p = value as RainEpisode;
    return p.version === 1 && (p.preset === null || Object.prototype.hasOwnProperty.call(RAIN_PRESETS, p.preset))
        && [p.start,p.hold,p.seed,p.fadeIn,p.fadeOut].every(Number.isFinite) && p.hold >= 0 && p.hold <= WEATHER.maxBattleSeconds
        && p.fadeIn > 0 && p.fadeIn <= 60 && p.fadeOut > 0 && p.fadeOut <= 60
        && (p.continuous === undefined || typeof p.continuous === 'boolean')
        && (p.precipitation === undefined || p.precipitation === 'rain' || p.precipitation === 'snow');
}
