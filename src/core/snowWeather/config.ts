import type {RainPreset} from '../rainWeather/schedule';
import type {WeatherPalette} from '../rainWeather/appearance';
/** Fixed snowfall defaults, selected automatically for winter map themes. */
export const SNOW_PRESETS=Object.freeze({
  "sunshower": {
    "rain": 0.5,
    "clouds": 0.4,
    "wind": 0.2,
    "storm": 0,
    "sound": 0
  },
  "drizzle": {
    "rain": 0.25,
    "clouds": 0.65,
    "wind": 0.15,
    "storm": 0,
    "sound": 0
  },
  "storm": {
    "rain": 1,
    "clouds": 1,
    "wind": 1,
    "storm": 0.65,
    "sound": 0
  },
  "overcast": {
    "rain": 0,
    "clouds": 0.8,
    "wind": 0.25,
    "storm": 0,
    "sound": 0
  },
  "sunny": {
    "rain": 0,
    "clouds": 0.15,
    "wind": 0.1,
    "storm": 0,
    "sound": 0
  }
});
export const SNOW=Object.freeze({"maxFlakes":20000,"blizzardStreakShare":0.8,"blizzardWindScale":8,"blizzardFallScale":1.8,"blizzardFlutterScale":3.6});
export const SNOW_PALETTES: Record<RainPreset, WeatherPalette> = {
    storm: { low:[.10,.13,.17], high:[.26,.30,.37], haze:[.19,.23,.29], fog:[.20,.25,.31] },
    drizzle: { low:[.30,.35,.41], high:[.60,.65,.71], haze:[.46,.52,.60], fog:[.43,.49,.56] },
    overcast: { low:[.32,.37,.43], high:[.65,.70,.76], haze:[.50,.56,.63], fog:[.46,.52,.59] },
    sunshower: { low:[.48,.54,.61], high:[.87,.91,.96], haze:[.72,.79,.86], fog:[.64,.71,.79] },
    sunny: { low:[.68,.74,.81], high:[.94,.97,1], haze:[.81,.87,.94], fog:[.71,.78,.86] },
};
Object.values(SNOW_PALETTES).forEach(p=>{Object.values(p).forEach(Object.freeze);Object.freeze(p);});Object.freeze(SNOW_PALETTES);
