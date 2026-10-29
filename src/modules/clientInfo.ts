import { featureScope } from '../core/featureRuntime';
import { gameDOM } from '../core/gameDOM';

const lifecycle = featureScope('clientInfo');

export const clientInfo = lifecycle.initialize(() => {
    const version = chrome.runtime.getManifest().version;
    lifecycle.onCleanup(() => {
        document.querySelectorAll('[data-kasp-ki-version]').forEach(element => element.removeAttribute('data-kasp-ki-version'));
    });
    return () => {
        document.querySelectorAll(gameDOM.account.clientInfo).forEach(element => {
            if (element.getAttribute('data-kasp-ki-version') !== version) element.setAttribute('data-kasp-ki-version', version);
        });
    };
}, () => {});
