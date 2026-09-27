import { state } from './state';
import { getSettingRaw, setSettingRaw } from './settings';

export const utils = {
  getLang: (): 'RU' | 'EN' => {
    try {
      const stored = (localStorage.getItem('language_store_key') || '').toLowerCase();
      if (stored.startsWith('ru')) return 'RU';
      if (stored.startsWith('en')) return 'EN';
    } catch {}
    const htmlLang = (document.documentElement.lang || '').toLowerCase();
    if (htmlLang.includes('ru')) return 'RU';
    if (htmlLang.includes('en')) return 'EN';
    if (window.location.hostname.includes('ru.')) return 'RU';
    return 'EN';
  },
  getSetting: getSettingRaw,
  setSetting: setSettingRaw,
  injectStyle: (css: string, id: string) => {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  },
};