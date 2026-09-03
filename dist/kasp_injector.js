"use strict";
(function () {
    'use strict';
    window.__kaspSendAction = function (className, obj) {
        try {
            let res = [className];
            let seen = new Set();
            function safeWalk(o, depth) {
                if (depth > 2 || !o || typeof o !== 'object' || seen.has(o))
                    return;
                seen.add(o);
                let keys = [];
                try {
                    keys = Object.keys(o);
                }
                catch (e) {
                    return;
                }
                for (let i = 0; i < keys.length; i++) {
                    let k = keys[i];
                    let v;
                    try {
                        v = o[k];
                    }
                    catch (e) {
                        continue;
                    }
                    if (v != null) {
                        if (typeof v === 'string' || typeof v === 'number') {
                            let strVal = String(v).trim();
                            if (strVal && strVal.length >= 2 && strVal.length < 30) {
                                res.push(strVal);
                            }
                        }
                        else if (typeof v === 'object' && depth < 2) {
                            safeWalk(v, depth + 1);
                        }
                    }
                }
            }
            safeWalk(obj, 0);
            window.postMessage({ type: 'kasp:useraction', detail: res }, '*');
        }
        catch (e) { }
    };
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of Array.from(m.addedNodes)) {
                if (node instanceof HTMLScriptElement && node.src.includes('/static/js/main.')) {
                    node.type = 'javascript/blocked';
                    node.remove();
                    observer.disconnect();
                    fetch(node.src)
                        .then(res => res.text())
                        .then(code => {
                        const match = /return"TankUserActionLog\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                        if (match) {
                            const propName = match[1];
                            const p = new RegExp(`(function [\\w$]+\\([^)]{1,150}\\)\\{[^{}]{0,800}?this\\.${propName}=[\\w$]+(?:,this\\.[\\w$]+=[\\w$]+){0,30})\\}`);
                            if (p.test(code)) {
                                code = code.replace(p, `$1, window.__kaspSendAction("TankUserActionLog", this)}`);
                            }
                        }
                        const script = document.createElement('script');
                        script.textContent = code;
                        (document.head || document.documentElement).appendChild(script);
                    });
                }
            }
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
