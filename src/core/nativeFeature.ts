import { featureScope } from './featureRuntime';

export function createNativeFeature(page: Window, id: string, setting: string) {
    const scope = featureScope(id, { budgetMs: 4 });
    const owners = new Map<object, () => void>();
    let enabled = true;
    const clean = () => { for (const cleanup of owners.values()) { try { cleanup(); } catch (error) { scope.fail(error); } } };
    const sync = () => {
        let next = true;
        try { next = localStorage.getItem(setting) !== 'false'; } catch { next = false; }
        if (enabled && !next) clean(); enabled = next;
    };
    scope.onCleanup(() => { clean(); owners.clear(); });
    page.addEventListener('kasp:settings-changed', sync);
    page.addEventListener('storage', sync);
    const poll = page.setInterval(sync, 1000);
    scope.onCleanup(() => { page.clearInterval(poll); page.removeEventListener('storage', sync); page.removeEventListener('kasp:settings-changed', sync); });
    sync();
    return {
        active: () => enabled && !scope.disabled,
        track(owner: object, cleanup: () => void) {
            if (scope.disabled || owners.has(owner)) return;
            if (owners.size >= 32) { scope.dispose('owner-limit'); return; }
            owners.set(owner, cleanup);
        },
        release(owner: object) { owners.delete(owner); },
        run<T>(callback: () => T) { return enabled ? scope.run(callback) : undefined; },
        observe: scope.run,
        fail: scope.fail,
        disable() { scope.dispose('manual'); },
        status: () => ({ ...scope.status(), enabled, owners: owners.size }),
    };
}
