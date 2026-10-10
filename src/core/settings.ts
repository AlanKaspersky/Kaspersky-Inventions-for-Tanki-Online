import { state } from './state';

export const SETTINGS_KEYS = [
  'k_ext_btn', 'k_augments', 'k_auto_upgrade', 'k_friends',
  'k_paints', 'k_hideCurrency', 'k_hideNicknameXP', 'k_history', 'k_overdrive_timer',
] as const;

export type SettingKey = typeof SETTINGS_KEYS[number];

const settingsCache = new Map<string, boolean>();

function readSetting(id: string, def: boolean): boolean {
  const val = localStorage.getItem(id);
  return val === null ? def : val === 'true';
}

export function invalidateSetting(id?: string) {
  if (id) settingsCache.delete(id);
  else settingsCache.clear();
}

for (const key of SETTINGS_KEYS) {
  settingsCache.set(key, readSetting(key, false));
}

window.addEventListener('storage', (e) => {
  if (e.key && (SETTINGS_KEYS as readonly string[]).includes(e.key))
    invalidateSetting(e.key);
});

export function getSettingRaw(id: string, def: boolean) {
  if (settingsCache.has(id)) {
    const cached = settingsCache.get(id)!;
    if (cached !== undefined) return cached;
  }
  const parsed = readSetting(id, def);
  settingsCache.set(id, parsed);
  return parsed;
}

export function setSettingRaw(id: string, value: boolean) {
  localStorage.setItem(id, value ? 'true' : 'false');
  settingsCache.set(id, value);
  window.dispatchEvent(new Event('kasp:settings-changed'));
}
