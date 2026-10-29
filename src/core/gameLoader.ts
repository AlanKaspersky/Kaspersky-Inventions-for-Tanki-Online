import { clientPatchHeader } from './clientPatches';
import { readGameBundle } from './gameBundleRequest';
import { isGameBundleURL, nativeGameBundleURL } from './gameBundleURL';

type Phase = 'waiting' | 'fetching' | 'preparing' | 'executing' | 'running' | 'native' | 'failed';
export interface GameLoaderStatus {
    phase: Phase; source: string | null; reason: string | null;
    entered: boolean; completed: boolean; nativeFallback: boolean;
}
export interface GameLoader {
    load(script: HTMLScriptElement): void;
    enter(token: string): boolean;
    complete(token: string): void;
    status(): GameLoaderStatus;
}

/** Only the network gate may call load: the original response contains no game
 * code. Observing an arbitrary inserted script must never authorize a replay. */
export function installGameLoader(page: Window, prepare: (source: string, signal: AbortSignal) => Promise<string>,
    report: (status: GameLoaderStatus) => void = () => {}): GameLoader {
    if (page.__kaspGameLoader) return page.__kaspGameLoader;
    const doc = page.document;
    const state: GameLoaderStatus = { phase: page.__kaspNativeGateStarted ? 'native' : 'waiting', source: null,
        reason: null, entered: false, completed: false, nativeFallback: !!page.__kaspNativeGateStarted };
    const token = Math.random().toString(36).slice(2);
    const controller = new AbortController();
    const forwarded = new WeakSet<Event>();
    const seen = new WeakSet<HTMLScriptElement>();
    const pendingEvents = new Set<HTMLScriptElement>();
    let original: HTMLScriptElement | undefined;
    let timer: number | undefined;
    let sourceURL = '';
    let nativeSource = '';
    const notify = () => { try { report({ ...state }); } catch { } };
    const set = (phase: Phase, reason: string | null = null) => { state.phase = phase; state.reason = reason; notify(); };
    const clearDeadline = () => { if (timer !== undefined) page.clearTimeout(timer); timer = undefined; };
    const forward = (type: string) => {
        for (const script of pendingEvents) {
            pendingEvents.delete(script);
            const event = new Event(type); forwarded.add(event); script.dispatchEvent(event);
        }
    };
    const fail = (reason: string) => {
        clearDeadline(); set('failed', reason);
        console.error('[KI Loader]', reason);
        forward('error');
    };
    const native = (script: HTMLScriptElement, reason: string) => {
        if (state.entered || state.nativeFallback) return;
        clearDeadline(); controller.abort(); original = script;
        state.source = script.src; state.nativeFallback = true;
        set('native', reason);
        console.warn('[KI Loader] Loading the native game:', reason);
        try {
            const fallback = doc.createElement('script');
            for (const attr of Array.from(script.attributes)) fallback.setAttribute(attr.name, attr.value);
            fallback.src = nativeGameBundleURL(script.src);
            nativeSource = fallback.src;
            fallback.async = script.async; fallback.nonce = script.nonce;
            fallback.addEventListener('load', () => { if (state.phase === 'failed') return; state.completed = true; notify(); forward('load'); }, { once: true });
            fallback.addEventListener('error', () => fail('native-load-failed'), { once: true });
            (doc.head || doc.documentElement).appendChild(fallback);
        }
        catch (error) { fail(`native-insertion-failed: ${String(error)}`); }
    };
    const api: GameLoader = {
        status: () => ({ ...state }),
        enter(value) {
            if (value !== token || controller.signal.aborted || state.nativeFallback || state.entered) return false;
            state.entered = true; set('executing'); return true;
        },
        complete(value) {
            if (value !== token || !state.entered || state.phase !== 'executing') return;
            state.completed = true; clearDeadline(); set('running');
        },
        load(script) {
            if (!isGameBundleURL(script.src) || seen.has(script)) return;
            seen.add(script); pendingEvents.add(script);
            if (state.phase !== 'waiting') {
                if (state.completed) forward('load');
                else if (state.phase === 'failed') forward('error');
                return;
            }
            original = script; state.source = script.src;
            const type = script.type.trim().toLowerCase();
            if (type === 'module' || script.noModule || script.integrity) {
                native(script, 'native-script-contract'); return;
            }
            if (type && !/^(?:text|application)\/(?:java|ecma)script$/.test(type)) { native(script, 'unsupported-script-type'); return; }
            set('fetching');
            void (async () => {
                try {
                    // A game's NetworkFirst worker fetches the main script as XHR.
                    // Read the real source through the same query bypass as native
                    // recovery, so our own fetch cannot be redirected to the gate.
                    const source = await readGameBundle(nativeGameBundleURL(script.src));
                    if (controller.signal.aborted) return;
                    set('preparing');
                    const deadline = new Promise<never>((_, reject) => {
                        timer = page.setTimeout(() => { reject(new Error('patch-preparation-timeout')); controller.abort(); }, 15000);
                    });
                    const code = await Promise.race([prepare(source, controller.signal), deadline]);
                    clearDeadline(); if (controller.signal.aborted || state.nativeFallback) return;
                    if (!code.trim()) throw new Error('empty-patched-source');
                    // Classic inline scripts execute synchronously on insertion. Keep
                    // strict mode and lexical scope; do not wrap arbitrary game code.
                    sourceURL = `ki-game-bundle-${token}.js`;
                    const setup = `if(!window.__kaspGameLoader.enter(${JSON.stringify(token)}))throw new Error("Cancelled game startup");`;
                    const replacement = doc.createElement('script');
                    replacement.type = script.type; replacement.nonce = script.nonce;
                    replacement.textContent = clientPatchHeader(code, '/*ki-game-loader:', {}, setup) + code
                        + `\n;window.__kaspGameLoader.complete(${JSON.stringify(token)});\n//# sourceURL=${sourceURL}`;
                    (doc.head || doc.documentElement).appendChild(replacement);
                    if (!state.entered) native(script, 'patched-script-not-executed');
                    else if (!state.completed) { if (state.phase !== 'failed') fail('game-runtime-error-after-start'); }
                    else forward('load');
                } catch (error) {
                    if (state.entered) { if (state.phase !== 'failed') fail(`game-error-after-start: ${String(error)}`); }
                    else native(script, String(error));
                } finally { clearDeadline(); }
            })();
        },
    };
    page.__kaspGameLoader = api;
    doc.addEventListener('load', event => {
        if (forwarded.has(event) || !(event.target instanceof HTMLScriptElement) || !isGameBundleURL(event.target.src, true)) return;
        if (original && isGameBundleURL(event.target.src)) event.stopImmediatePropagation();
        else if (state.phase === 'waiting') { state.source = event.target.src; state.completed = true; set('native', 'network-gate-unavailable'); }
    }, true);
    doc.addEventListener('error', event => {
        if (forwarded.has(event) || !(event.target instanceof HTMLScriptElement) || !isGameBundleURL(event.target.src)) return;
        if (state.phase === 'waiting') {
            event.stopImmediatePropagation(); seen.add(event.target); pendingEvents.add(event.target); native(event.target, 'gate-resource-error');
        }
    }, true);
    page.addEventListener('error', event => {
        if (state.entered && !state.completed && event.filename?.endsWith(sourceURL) && state.phase !== 'failed') fail('game-runtime-error-after-start');
        else if (state.nativeFallback && nativeSource && event.filename === nativeSource && state.phase !== 'failed') fail('native-runtime-error');
    });
    return api;
}
