import { setupElectronZKey } from './core/electron';
import { state } from './core/state';
import { utils } from './core/utils';
import { startBoot } from './boot';
import { setupNicknamePrivacy } from './modules/hideNickname';

if (window === window.top) {
  setupElectronZKey();

  const loaderBg = chrome.runtime.getURL('assets/background.png');
  document.documentElement.style.setProperty('--kasp-loader-bg', `url("${loaderBg}")`);

  state.lang = utils.getLang();
  setupNicknamePrivacy();

  startBoot();
}
