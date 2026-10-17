import { featureScope } from '../core/featureRuntime';
import { customPaints } from './customPaints';
import { augmentSpecs } from './augmentSpecs';
import { customPlayButton } from './customPlayButton';
import { customFriends } from './customFriends';
import { garageButtons } from './garageButtons';
import { welcomeModal } from './welcomeModal';
import { hideNickname } from './hideNickname';
import { hideCurrency } from './hideCurrency';
import { customTrophies } from './customTrophies';
import { autoUpgrade } from './autoUpgrade';
import { changeCounter } from './changeCounter';
import { customGarageSkins } from './customGarageSkins';
import { zeroResists } from './zeroResists';
import { equipmentTracker } from './equipmentTracker';
import { battleHistory } from './battleHistory';
import { overdriveTimer } from './overdriveTimer';
import { cybersport } from './cybersport';

const implementations = {
  customPaints,
  augmentSpecs,
  customPlayButton,
  customFriends,
  garageButtons,
  welcomeModal,
  hideNickname,
  hideCurrency,
  customTrophies,
  autoUpgrade,
  changeCounter,
  customGarageSkins,
  zeroResists,
  equipmentTracker,
  battleHistory,
  overdriveTimer,
  cybersport,
};

function protect<T extends object>(id: string, value: T): T {
  const scope = featureScope(id);
  if (typeof value === 'function') return scope.guard(value as (...args: unknown[]) => unknown) as T;
  return Object.fromEntries(Object.entries(value).map(([key, method]) => [key,
    typeof method === 'function' ? scope.guard(method.bind(value)) : method])) as T;
}
export const modules = Object.fromEntries(Object.entries(implementations).map(([id, value]) =>
  [id, protect(id, value)])) as typeof implementations;
