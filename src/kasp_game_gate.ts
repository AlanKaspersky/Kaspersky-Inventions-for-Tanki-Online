import { isGameBundleURL, nativeGameBundleURL } from './core/gameBundleURL';

// This packaged response runs instead of the requested game bundle, not after it.
(() => {
    const current = document.currentScript;
    const script = current instanceof HTMLScriptElement ? current
        : [...document.querySelectorAll<HTMLScriptElement>('script[src]')].find(node => node.type.trim().toLowerCase() === 'module' && isGameBundleURL(node.src));
    if (!script || !isGameBundleURL(script.src)) return;
    if (window.__kaspGameLoader) { window.__kaspGameLoader.load(script); return; }
    if (window.__kaspNativeGateStarted) return;
    window.__kaspNativeGateStarted = true;
    const native = document.createElement('script');
    for (const attr of Array.from(script.attributes)) native.setAttribute(attr.name, attr.value);
    native.src = nativeGameBundleURL(script.src);
    native.async = script.async;
    native.nonce = script.nonce;
    (document.head || document.documentElement).appendChild(native);
})();
