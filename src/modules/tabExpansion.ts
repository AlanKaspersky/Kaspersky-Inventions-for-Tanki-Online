import type { FeatureScope } from '../core/featureRuntime';

/** Pin the same inline resistance view used by row hover. Geometry is constant. */
export function createTabExpansion(scope: FeatureScope) {
    const setExpanded = (expanded: boolean) => {
        document.body?.classList.toggle('kasp-tab-expanded', expanded);
    };
    scope.onCleanup(() => setExpanded(false));
    return { setExpanded };
}
