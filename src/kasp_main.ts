import { setupElectronZKey } from './core/electron';
import { state } from './core/state';
import { utils } from './core/utils';
import { startBoot } from './boot';
import { setupNicknamePrivacy } from './modules/hideNickname';
import { hideSupplies } from './modules/hideSupplies';
import { setupDiscordPresence } from './modules/discordPresence';
import { setupAccountIdentity } from './core/accountIdentity';
import { featureScope, installFeatureDiagnostics } from './core/featureRuntime';
import { setupBattleGraphics } from './core/battleGraphics';

if (window === window.top) {
  installFeatureDiagnostics(window, 'content');
  featureScope('accountIdentity').run(setupAccountIdentity);
  featureScope('electronNavigation').run(setupElectronZKey);

  const loaderBg = chrome.runtime.getURL('assets/background.png');
  document.documentElement.style.setProperty('--kasp-loader-bg', `url("${loaderBg}")`);

  state.lang = utils.getLang();
  featureScope('battleGraphics').run(()=>setupBattleGraphics(window));
  featureScope('hideNickname').run(setupNicknamePrivacy);
  featureScope('hideSupplies').run(hideSupplies);

  startBoot();
  featureScope('discordPresence').run(setupDiscordPresence);
}
