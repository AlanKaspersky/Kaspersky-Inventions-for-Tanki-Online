export interface FeatureStatus {
    id: string; disabled: boolean; reason: string | null; error: string | null;
    calls: number; failures: number; slowCalls: number; lastMs: number; maxMs: number;
    cleanupErrors: number; resources: number; domNodes: number; listeners: number;
}

// One timer per execution world, only while scopes own removable DOM resources.
// It runs independently of feature ticks, so leaving a screen releases its nodes
// even if that feature is no longer called by the screen dispatcher.
const domSweepers = new Set<() => void>();
let domSweepTimer: number | undefined;
function scheduleDOMSweep(): void {
    if (domSweepTimer !== undefined || !domSweepers.size) return;
    domSweepTimer = window.setTimeout(() => {
        domSweepTimer = undefined;
        for (const sweep of [...domSweepers]) sweep();
        scheduleDOMSweep();
    }, 1000);
}
function stopDOMSweep(sweep: () => void): void {
    domSweepers.delete(sweep);
    if (!domSweepers.size && domSweepTimer !== undefined) {
        window.clearTimeout(domSweepTimer); domSweepTimer = undefined;
    }
}

export function createFeatureScope(id: string, options: { now?: () => number; budgetMs?: number; failureLimit?: number } = {}) {
    const now = options.now || (() => performance.now());
    const budget = options.budgetMs ?? 16;
    const status: FeatureStatus = { id, disabled: false, reason: null, error: null,
        calls: 0, failures: 0, slowCalls: 0, lastMs: 0, maxMs: 0, cleanupErrors: 0, resources: 0, domNodes: 0, listeners: 0 };
    const cleanups = new Set<() => void>();
    const failuresAt: number[] = [];
    const dispose = (reason = 'manual') => {
        if (status.disabled) return;
        status.disabled = true; status.reason = reason;
        for (const cleanup of [...cleanups].reverse()) {
            try { cleanup(); } catch { status.cleanupErrors++; }
        }
        cleanups.clear(); status.resources = 0;
        stopDOMSweep(pruneDOM);
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
    type ListenerEntry = { target: EventTarget; type: string; original: unknown; wrapped: EventListener; options?: boolean | AddEventListenerOptions; disconnectedAt?: number; release(): void };
    const listeners = new Set<ListenerEntry>();
    // The weak index deduplicates registrations; it does not extend their lifetime.
    // Cached fragments must recreate their scoped controls after detachment expires.
    const listenerIndex = new WeakMap<EventTarget, Set<ListenerEntry>>();
    const domEntries = new Map<Node, { callbacks: Map<unknown, () => void>; disconnectedAt?: number }>();
    let releaseDOMCleanup: (() => void) | undefined;
    const removable = (target: EventTarget) => 'isConnected' in target && (!('nodeType' in target) || target.nodeType !== 9);
    const watchDOM = () => {
        let needed = domEntries.size > 0;
        if (!needed) for (const entry of listeners) if (removable(entry.target)) { needed = true; break; }
        if (!status.disabled && needed) {
            domSweepers.add(pruneDOM); scheduleDOMSweep();
        } else stopDOMSweep(pruneDOM);
    };
    const releaseDOM = (element: Node) => {
        const entry = domEntries.get(element); if (!entry) return;
        domEntries.delete(element);
        for (const cleanup of entry.callbacks.values()) {
            try { cleanup(); } catch { status.cleanupErrors++; }
        }
        entry.callbacks.clear();
        if (!domEntries.size) { releaseDOMCleanup?.(); releaseDOMCleanup = undefined; }
        watchDOM();
    };
    const ownDOM = <T extends Node>(element: T, cleanup: (element: T) => void) => {
        if (status.disabled) return () => {};
        let entry = domEntries.get(element);
        if (!entry) { entry = { callbacks: new Map() }; domEntries.set(element, entry); }
        if (!entry.callbacks.has(cleanup)) entry.callbacks.set(cleanup, () => cleanup(element));
        if (!releaseDOMCleanup) releaseDOMCleanup = onCleanup(() => { for (const node of [...domEntries.keys()]) releaseDOM(node); });
        watchDOM();
        return () => {
            entry!.callbacks.delete(cleanup);
            if (!entry!.callbacks.size && domEntries.get(element) === entry) domEntries.delete(element);
            if (!domEntries.size) { releaseDOMCleanup?.(); releaseDOMCleanup = undefined; }
            watchDOM();
        };
    };
    function pruneDOM(): void {
        const time = now();
        const expired = (node: object, entry: { disconnectedAt?: number }) => {
            if (!('isConnected' in node) || node.isConnected !== false) { entry.disconnectedAt = undefined; return false; }
            entry.disconnectedAt ??= time;
            return time - entry.disconnectedAt >= 1000;
        };
        for (const [node, entry] of domEntries) if (expired(node, entry)) releaseDOM(node);
        for (const entry of listeners) if (removable(entry.target) && expired(entry.target, entry)) {
            unlisten(entry.target, entry.type, entry.original, entry.options);
        }
        watchDOM();
    }
    const unlisten = (target: EventTarget | null | undefined, type: string, listener: unknown, options?: boolean | EventListenerOptions) => {
        if (!target) return;
        const capture = typeof options === 'boolean' ? options : !!options?.capture;
        const indexed = listenerIndex.get(target);
        if (!indexed) return;
        for (const entry of indexed) if (entry.type === type && entry.original === listener
            && (typeof entry.options === 'boolean' ? entry.options : !!entry.options?.capture) === capture) {
            target.removeEventListener?.(type, entry.wrapped, entry.options); entry.release(); listeners.delete(entry); indexed.delete(entry);
        }
        if (!indexed.size) listenerIndex.delete(target);
        watchDOM();
    };
    const listen = <K extends string>(target: EventTarget | null | undefined, type: K,
        listener: (event: K extends keyof WindowEventMap ? WindowEventMap[K] : Event) => unknown,
        options?: boolean | AddEventListenerOptions) => {
        if (!target || status.disabled) return;
        unlisten(target, type, listener, options);
        if (listeners.size >= 4096) { dispose('listener-limit'); return; }
        const wrapped: EventListener = event => { if (typeof options === 'object' && options.once) unlisten(target, type, listener, options);
            return run(() => listener.call(target, event as K extends keyof WindowEventMap ? WindowEventMap[K] : Event)); };
        target.addEventListener(type, wrapped, options);
        const entry: ListenerEntry = { target, type, original: listener, wrapped, options, release: () => {} };
        let indexed = listenerIndex.get(target);
        if (!indexed) { indexed = new Set(); listenerIndex.set(target, indexed); }
        indexed.add(entry);
        entry.release = onCleanup(() => { target.removeEventListener(type, wrapped, options); listeners.delete(entry); indexed.delete(entry); watchDOM(); });
        listeners.add(entry); watchDOM();
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
        if (status.disabled) return () => {};
        let saved = presentations.get(element);
        if (!saved) {
            saved = { styles: new Map(), classes: new Map() }; presentations.set(element, saved);
            const entry = saved;
            ownDOM(element, () => {
                presentations.delete(element);
                for (const [key, value] of entry.styles) if (element.style.getPropertyValue(key) === value.after
                    && element.style.getPropertyPriority(key) === value.afterPriority) {
                    if (value.before) element.style.setProperty(key, value.before, value.priority); else element.style.removeProperty(key);
                }
                for (const [key, value] of entry.classes) if (element.classList.contains(key) === value.after) element.classList.toggle(key, value.before);
            });
        }
        for (const key of styles) {
            const current = element.style.getPropertyValue(key), priority = element.style.getPropertyPriority(key), previous = saved.styles.get(key);
            if (!previous || current !== previous.after || priority !== previous.afterPriority) saved.styles.set(key,
                { before: current, priority, after: current, afterPriority: priority });
        }
        for (const key of classes) {
            const current = element.classList.contains(key), previous = saved.classes.get(key);
            if (!previous || current !== previous.after) saved.classes.set(key, { before: current, after: current });
        }
        return () => {
            if (status.disabled || presentations.get(element) !== saved) return;
            for (const key of styles) { const value = saved!.styles.get(key)!; value.after = element.style.getPropertyValue(key); value.afterPriority = element.style.getPropertyPriority(key); }
            for (const key of classes) saved!.classes.get(key)!.after = element.classList.contains(key);
        };
    };
    return { run, guard, initialize, fail, dispose, onCleanup, listen, unlisten, timeout, interval, frame, microtask, observer,
        cancelTimeout, cancelInterval, cancelFrame, preserve, ownDOM, releaseDOM, pruneDOM,
        get disabled() { return status.disabled; }, status: (): FeatureStatus => ({ ...status, domNodes: domEntries.size, listeners: listeners.size }) };
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
