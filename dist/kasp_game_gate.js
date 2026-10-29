"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/core/gameBundleURL.ts
  function isGameBundleURL(value, allowQuery = false) {
    try {
      const url = new URL(value);
      return /^(?:https?:)$/.test(url.protocol) && /(?:^|\.)tankionline\.com$/i.test(url.hostname) && /^\/(?:browser-public\/)?static\/js\/main\.[\w-]+\.js$/.test(url.pathname) && (allowQuery || !url.search);
    } catch {
      return false;
    }
  }
  function nativeGameBundleURL(value) {
    const url = new URL(value);
    url.searchParams.set("ki_native", "1");
    return url.href;
  }
  var init_gameBundleURL = __esm({
    "src/core/gameBundleURL.ts"() {
      "use strict";
    }
  });

  // src/kasp_game_gate.ts
  var require_kasp_game_gate = __commonJS({
    "src/kasp_game_gate.ts"() {
      init_gameBundleURL();
      (() => {
        const current = document.currentScript;
        const script = current instanceof HTMLScriptElement ? current : [...document.querySelectorAll("script[src]")].find((node) => node.type.trim().toLowerCase() === "module" && isGameBundleURL(node.src));
        if (!script || !isGameBundleURL(script.src)) return;
        if (window.__kaspGameLoader) {
          window.__kaspGameLoader.load(script);
          return;
        }
        if (window.__kaspNativeGateStarted) return;
        window.__kaspNativeGateStarted = true;
        const native = document.createElement("script");
        for (const attr of Array.from(script.attributes)) native.setAttribute(attr.name, attr.value);
        native.src = nativeGameBundleURL(script.src);
        native.async = script.async;
        native.nonce = script.nonce;
        (document.head || document.documentElement).appendChild(native);
      })();
    }
  });
  require_kasp_game_gate();
})();
