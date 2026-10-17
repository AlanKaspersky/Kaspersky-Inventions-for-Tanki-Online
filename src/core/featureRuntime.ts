export interface FeatureStatus {
    id: string; disabled: boolean; reason: string | null; error: string | null;
    calls: number; failures: number; slowCalls: number; lastMs: number; maxMs: number;
    cleanupErrors: number; resources: number;
}

export function createFeatureScope(id: string, options: { now?: () => number; budgetMs?: number; failureLimit?: number } = {}) {
    const now = options.now || (() => performance.now());
    const budget = options.budgetMs ?? 16;
    const status: FeatureStatus = { id, disabled: false, reason: null, error: null,
        calls: 0, failures: 0, slowCalls: 0, lastMs: 0, maxMs: 0, cleanupErrors: 0, resources: 0 };
    const cleanups = new Set<() => void>();
    const failuresAt: number[] = [];
    const dispose = (reason = 'manual') => {
        if (status.disabled) return;
        status.disabled = true; status.reason = reason;
        for (const cleanup of [...cleanups].reverse()) {
            try { cleanup(); } catch { status.cleanupErrors++; }
        }
        cleanups.clear(); status.resources = 0;
    };
    const onCleanup = (cleanup: () => void) => {
        if (status.disabled) { try { cleanup(); } catch { status.cleanupErrors++; } return () => {}; }
        cleanups.add(cleanup); status.resources = cleanups.size;
        return () => { cleanups.delete(cleanup); status.resources = cleanups.size; };
    };
    const fail = (error: unknown) => {
        status.failures++;
        const time = now();
        while (failuresAt.length && time - failuresAt[0] > 10000) failuresAt.shift();
        failuresAt.push(time);
        status.error = error instanceof Error ? error.message : String(error);
        if (failuresAt.length >= (options.failureLimit ?? 3)) dispose('repeated-error');
    };
    const run = <T>(callback: () => T): T | undefined => {
        if (status.disabled) return;
        const start = now(); status.calls++;
        try {
            const value = callback();
            if (value && typeof (value as unknown as PromiseLike<unknown>).then === 'function') {
                return Promise.resolve(value).then(result => {
                    return status.disabled ? undefined : result;
                }, error => { fail(error); return undefined; }) as T;
            }
            return value;
        } catch (error) { fail(error); return undefined; }
        finally {
            status.lastMs = Math.max(0, now() - start); status.maxMs = Math.max(status.maxMs, status.lastMs);
            if (status.lastMs > budget) status.slowCalls++;
        }
    };
    const guard = <A extends unknown[], R>(callback: (...args: A) => R) =>
        (...args: A) => run(() => callback(...args));
    const initialize = <T>(callback: () => T, fallback: unknown): T => {
        try { return callback(); }
        catch (error) { fail(error); dispose('initialization-error'); return fallback as T; }
    };
    const listeners = new Set<{ target: EventTarget; type: string; original: unknown; wrapped: EventListener; options?: boolean | AddEventListenerOptions; since: number; release(): void }>();
    let lastPrune = 0;
    const unlisten = (target: EventTarget | null | undefined, type: string, listener: unknown, options?: boolean | EventListenerOptions) => {
        if (!target) return;
        const capture = typeof options === 'boolean' ? options : !!options?.capture;
        for (const entry of listeners) if (entry.target === target && entry.type === type && entry.original === listener
            && (typeof entry.options === 'boolean' ? entry.options : !!entry.options?.capture) === capture) {
            target.removeEventListener?.(type, entry.wrapped, entry.options); entry.release(); listeners.delete(entry);
        }
    };
    const listen = <K extends string>(target: EventTarget | null | undefined, type: K,
        listener: (event: K extends keyof WindowEventMap ? WindowEventMap[K] : Event) => unknown,
        options?: boolean | AddEventListenerOptions) => {
        if (!target || status.disabled) return;
        const time = now();
        if (time - lastPrune > 1000) {
            lastPrune = time;
            for (const entry of listeners) if (time - entry.since > 1000 && 'isConnected' in entry.target && entry.target.isConnected === false) {
                entry.target.removeEventListener(entry.type, entry.wrapped, entry.options); entry.release(); listeners.delete(entry);
            }
        }
        if (listeners.size >= 4096) { dispose('listener-limit'); return; }
        const wrapped: EventListener = event => { if (typeof options === 'object' && options.once) unlisten(target, type, listener, options);
            return run(() => listener.call(target, event as K extends keyof WindowEventMap ? WindowEventMap[K] : Event)); };
        target.addEventListener(type, wrapped, options);
        const entry = { target, type, original: listener, wrapped, options, since: time, release: () => {} };
        entry.release = onCleanup(() => { target.removeEventListener(type, wrapped, options); listeners.delete(entry); });
        listeners.add(entry);
    };
    const timeouts = new Map<number, () => void>(), intervals = new Map<number, () => void>(), frames = new Map<number, () => void>();
    const cancelTimeout = (handle: number) => { window.clearTimeout(handle); timeouts.get(handle)?.(); timeouts.delete(handle); };
    const cancelInterval = (handle: number | undefined) => { if (handle === undefined) return; window.clearInterval(handle); intervals.get(handle)?.(); intervals.delete(handle); };
    const cancelFrame = (handle: number) => { window.cancelAnimationFrame(handle); frames.get(handle)?.(); frames.delete(handle); };
    const timeout = (callback: () => void, delay = 0): number => {
        if (status.disabled) return 0;
        let release = () => {};
        let handle = 0, fired = false;
        handle = window.setTimeout(() => { fired = true; release(); timeouts.delete(handle); run(callback); }, delay);
        if (!fired) { release = onCleanup(() => { window.clearTimeout(handle); timeouts.delete(handle); }); timeouts.set(handle, release); }
        return handle;
    };
    const interval = (callback: () => void, delay: number): number => {
        if (status.disabled) return 0;
        const handle = window.setInterval(() => run(callback), delay);
        const release = onCleanup(() => { window.clearInterval(handle); intervals.delete(handle); }); intervals.set(handle, release); return handle;
    };
    const frame = (callback: FrameRequestCallback): number => {
        if (status.disabled) return 0;
        let release = () => {};
        const handle = window.requestAnimationFrame(time => { release(); frames.delete(handle); run(() => callback(time)); });
        release = onCleanup(() => { window.cancelAnimationFrame(handle); frames.delete(handle); }); frames.set(handle, release); return handle;
    };
    const microtask = (callback: () => void) => { if (!status.disabled) queueMicrotask(() => run(callback)); };
    const observer = (callback: MutationCallback): MutationObserver => {
        const instance = new MutationObserver((records, observer) => { run(() => callback(records, observer)); });
        onCleanup(() => instance.disconnect()); return instance;
    };
    const presentations = new WeakMap<HTMLElement, { styles: Map<string, { before: string; priority: string; after: string; afterPriority: string }>;
        classes: Map<string, { before: boolean; after: boolean }> }>();
    const preserve = (element: HTMLElement, styles: string[] = [], classes: string[] = []) => {
        let saved = presentations.get(element);
        if (!saved) {
            saved = { styles: new Map(), classes: new Map() }; presentations.set(element, saved);
            const entry = saved;
            onCleanup(() => {
                for (const [key, value] of entry.styles) if (element.style.getPropertyValue(key) === value.after
                    && element.style.getPropertyPriority(key) === value.afterPriority) {
                    if (value.before) element.style.setProperty(key, value.before, value.priority); else element.style.removeProperty(key);
                }
                for (const [key, value] of entry.classes) if (element.classList.contains(key) === value.after) element.classList.toggle(key, value.before);
            });
        }
        for (const key of styles) if (!saved.styles.has(key)) saved.styles.set(key, { before: element.style.getPropertyValue(key),
            priority: element.style.getPropertyPriority(key), after: element.style.getPropertyValue(key), afterPriority: element.style.getPropertyPriority(key) });
        for (const key of classes) if (!saved.classes.has(key)) saved.classes.set(key, { before: element.classList.contains(key), after: element.classList.contains(key) });
        return () => {
            for (const key of styles) { const value = saved!.styles.get(key)!; value.after = element.style.getPropertyValue(key); value.afterPriority = element.style.getPropertyPriority(key); }
            for (const key of classes) saved!.classes.get(key)!.after = element.classList.contains(key);
        };
    };
    return { run, guard, initialize, fail, dispose, onCleanup, listen, unlisten, timeout, interval, frame, microtask, observer,
        cancelTimeout, cancelInterval, cancelFrame, preserve,
        get disabled() { return status.disabled; }, status: (): FeatureStatus => ({ ...status }) };
}

export type FeatureScope = ReturnType<typeof createFeatureScope>;
const scopes = new Map<string, FeatureScope>();
export function featureScope(id: string, options?: Parameters<typeof createFeatureScope>[1]): FeatureScope {
    let scope = scopes.get(id);
    if (!scope) { scope = createFeatureScope(id, options); scopes.set(id, scope); }
    return scope;
}
export function installFeatureDiagnostics(page: Window, world: 'page' | 'content'): void {
    const target = page as Window & { __kaspModulesDebug?: unknown; __kaspPageModulesDebug?: unknown };
    const debug = { status: () => [...scopes.values()].map(scope => scope.status()),
        disable(id: string) { scopes.get(id)?.dispose('manual'); } };
    if (world === 'page') target.__kaspPageModulesDebug = debug; else target.__kaspModulesDebug = debug;
}
