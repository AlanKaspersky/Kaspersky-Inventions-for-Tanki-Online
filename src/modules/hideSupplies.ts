import { featureScope } from '../core/featureRuntime';
import { utils } from '../core/utils';
import { gameDOM } from '../core/gameDOM';

const lifecycle = featureScope('hideSupplies');

export const hideSupplies = lifecycle.initialize(() => {
    let initialized = false;
    let observer: MutationObserver | null = null;
    const marked = new Set<HTMLElement>();
    function restore(): void {
        for (const element of marked) element.classList.remove('kasp-private-supply-value', 'kasp-private-supply-static');
        marked.clear();
    }
    const sync = () => {
        const enabled = utils.getSetting('k_hideSupplies', false);
        document.documentElement.classList.toggle('kasp-hide-supplies', enabled);
        if (!enabled) { observer?.disconnect(); restore(); return; }
        observer ??= lifecycle.observer(changes => {
            if (changes.some(change => change.type !== 'attributes' || marked.has(change.target as HTMLElement))) sync();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        for (const element of marked) if (!element.isConnected || !element.matches(gameDOM.supplyPrivacy.counts)) {
            element.classList.remove('kasp-private-supply-value', 'kasp-private-supply-static'); marked.delete(element);
        }
        document.querySelectorAll<HTMLElement>(gameDOM.supplyPrivacy.counts).forEach(element => {
            if (marked.has(element) && element.classList.contains('kasp-private-supply-value')) return;
            if (getComputedStyle(element).position === 'static') element.classList.add('kasp-private-supply-static');
            element.classList.add('kasp-private-supply-value'); marked.add(element);
        });
    };

    lifecycle.onCleanup(() => { observer?.disconnect(); restore(); document.documentElement.classList.remove('kasp-hide-supplies'); });

    return () => {
        if (!initialized) {
            initialized = true;
            lifecycle.listen(window, 'kasp:settings-changed', sync);
            lifecycle.listen(window, 'storage', sync);
        }
        sync();
    };
}, () => {});
