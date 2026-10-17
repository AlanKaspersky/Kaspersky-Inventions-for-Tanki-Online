// Execute the real lifecycle implementation against each test's browser fixtures.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
module.exports = function runFeatureContext(code, context, options) {
    const original = context.require;
    const cache = new Map();
    const browser = context.window || {};
    const runtimeWindow = new Proxy(browser, { get(target, key) {
        if (key in target) return target[key];
        if (key in context) return context[key];
        if (['setTimeout', 'setInterval', 'requestAnimationFrame'].includes(key)) return () => 0;
        if (['clearTimeout', 'clearInterval', 'cancelAnimationFrame', 'addEventListener', 'removeEventListener'].includes(key)) return () => {};
    } });
    const resolve = name => {
        if (!/(?:^|\/)(featureRuntime|nativeFeature|unassigned|imageUrl|pageMessages)$/.test(name)) return original(name);
        const file = name.split('/').pop();
        if (cache.has(file)) return cache.get(file);
        const module = { exports: {} };
        const source = fs.readFileSync(path.join(__dirname, file === 'unassigned' ? '../src/modules/battleHistory' : '../src/core', file + '.ts'), 'utf8');
        vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, {
            URL, ...context, module, window: runtimeWindow, performance: context.performance || { now: () => 0 },
            MutationObserver: context.MutationObserver, queueMicrotask: context.queueMicrotask || queueMicrotask,
            require: resolve,
        });
        cache.set(file, module.exports); return module.exports;
    };
    context.require = resolve;
    return vm.runInNewContext(code, context, options);
};
