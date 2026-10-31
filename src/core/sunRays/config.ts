import type { MapTheme } from '../rainWeather/environment';
export const DEFAULT_SUN_INTENSITY=4;
/** Bounded prototype budgets. Native distances are centimetres. */
export const SUN_RAYS = Object.freeze({
    steps: 40,                 // Samples of lit air along each camera ray.
    maxWidth: 640,             // Maximum integration-buffer width; composite stays full resolution.
    resolutionScale: .5,       // Half-size on smaller displays, capped by maxWidth on larger ones.
    shadowSize: 2048,          // Static collision shadow map, rebuilt only for a new map/light direction.
    maxShadowTriangles: 120000,
    distance: 30000,           // Softly bounded 300 m atmospheric integration, not a visible cone end.
    extinction: .000018,       // Light absorbed/scattered per centimetre of air.
    anisotropy: .62,           // Forward scattering: shafts brighten naturally when looking toward the sun.
    fadeSeconds: 2,            // Smooth entry/enable transition.
});

export function mapAllowsSun(theme: MapTheme | undefined, name?: unknown): boolean {
    if (theme) return theme !== 'SPACE' && theme !== 'SUMMER_NIGHT' && theme !== 'WINTER_NIGHT';
    if (typeof name !== 'string') return true;
    const words = name.normalize('NFKC').toLowerCase().split(/[^a-zа-яё]+/u);
    return !words.some(word => ['space','космос','космический','космическая','night','ночь','ночной','ночная','ночное','ночные'].includes(word));
}

export function readSunIntensity(storage: Pick<Storage, 'getItem'>): number {
    try {
        const raw = storage.getItem('k_sun_rays_intensity');
        if (raw === null || !raw.trim() || !Number.isFinite(Number(raw))) return DEFAULT_SUN_INTENSITY;
        return Math.max(0, Number(raw));
    } catch { return DEFAULT_SUN_INTENSITY; }
}
