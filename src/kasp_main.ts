import { setupElectronZKey } from './core/electron';
import { state } from './core/state';
import { utils } from './core/utils';
import { startBoot } from './boot';
import { setupNicknamePrivacy } from './modules/hideNickname';
import { setupDiscordPresence } from './modules/discordPresence';
import { setupAccountIdentity } from './core/accountIdentity';
import { featureScope, installFeatureDiagnostics } from './core/featureRuntime';

if (window === window.top) {
  installFeatureDiagnostics(window, 'content');
  featureScope('accountIdentity').run(setupAccountIdentity);
  featureScope('electronNavigation').run(setupElectronZKey);

  const loaderBg = chrome.runtime.getURL('assets/background.png');
  document.documentElement.style.setProperty('--kasp-loader-bg', `url("${loaderBg}")`);

  state.lang = utils.getLang();
  featureScope('hideNickname').run(setupNicknamePrivacy);

  startBoot();
  featureScope('discordPresence').run(setupDiscordPresence);
}
