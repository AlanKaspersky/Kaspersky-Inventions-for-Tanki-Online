export type Lang = 'RU' | 'EN';

export const state = {
  lang: 'EN' as Lang,
  currentScreen: 'loading' as string,
  settingsOpen: false,
  friendsMenuOpen: false,
};