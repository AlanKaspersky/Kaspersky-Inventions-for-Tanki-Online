export const WEATHER = Object.freeze({
    chance: .4, // Five equally likely presets; three contain rain: ~24% of battles get rain.
    fadeIn: 24, fadeOut: 30, cloudLead: 12,
    minHold: 45, maxHold: 135, unknownBattleSeconds: 600,
    maxDrops: 14000, cloudWidth: 1024, cloudHeight: 256, cloudHz: 10,
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
export interface RainEpisode { version: 1; preset: RainPreset | null; start: number; hold: number; seed: number; fadeIn: number; fadeOut: number; }
export const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function planRain(now: number, remaining: number | undefined, random: () => number): RainEpisode {
    const seconds = Number.isFinite(remaining) ? Math.max(0, remaining!) : WEATHER.unknownBattleSeconds;
    const empty: RainEpisode = { version: 1, preset: null, start: now, hold: 0, seed: Math.floor(random() * 0xffffff), fadeIn: WEATHER.fadeIn, fadeOut: WEATHER.fadeOut };
    if (random() >= WEATHER.chance || seconds < 75) return empty;
    const names = Object.keys(RAIN_PRESETS) as RainPreset[];
    const preset = names[Math.min(names.length - 1, Math.floor(random() * names.length))];
    const hold = Math.min(WEATHER.minHold + random() * (WEATHER.maxHold - WEATHER.minHold), seconds - WEATHER.fadeIn - WEATHER.fadeOut - 10);
    if (hold < 15) return empty;
    const available = Math.max(0, seconds - hold - WEATHER.fadeIn - WEATHER.fadeOut - 10);
    // Some episodes start on arrival; others can begin near the end of a long battle.
    const delay = random() < .15 ? 0 : random() * available;
    return { ...empty, preset, hold, start: now + delay * 1000 };
}
export function sampleRain(plan: RainEpisode, now: number) {
    const elapsed = (now - plan.start) / 1000, total = plan.fadeIn + plan.hold + plan.fadeOut;
    const profile = plan.preset ? RAIN_PRESETS[plan.preset] : RAIN_PRESETS.sunny;
    const clouds = plan.preset ? smooth(elapsed / plan.fadeIn) * (1 - smooth((elapsed - plan.fadeIn - plan.hold) / plan.fadeOut)) : 0;
    const rain = plan.preset ? smooth((elapsed - WEATHER.cloudLead) / Math.max(1, plan.fadeIn - WEATHER.cloudLead))
        * (1 - smooth((elapsed - plan.fadeIn - plan.hold + 5) / Math.max(1, plan.fadeOut - 5))) : 0;
    return { clouds: clouds * profile.clouds, rain: rain * profile.rain, wind: profile.wind,
        sound: rain * profile.sound, storm: clouds * profile.storm, flash: 0, finished: elapsed >= total, active: elapsed >= 0 && elapsed < total };
}
export function validEpisode(value: unknown): value is RainEpisode {
    if (!value || typeof value !== 'object') return false;
    const p = value as RainEpisode;
    return p.version === 1 && (p.preset === null || Object.prototype.hasOwnProperty.call(RAIN_PRESETS, p.preset))
        && [p.start,p.hold,p.seed,p.fadeIn,p.fadeOut].every(Number.isFinite) && p.hold >= 0 && p.hold <= 180
        && p.fadeIn >= 10 && p.fadeIn <= 60 && p.fadeOut >= 10 && p.fadeOut <= 60;
}
