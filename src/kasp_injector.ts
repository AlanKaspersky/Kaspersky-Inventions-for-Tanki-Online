(function (): void {
    'use strict';

    const KNOWN_MODES = new Set<string>([
        'DM', 'TDM', 'CTF', 'CP', 'SGE',
        'RGB', 'JGR', 'TJR', 'ASL', 'AR'
    ]);

    (window as any).__kaspSendAction = function (className: string, obj: any): void {
        try {
            let res: string[] = [className];
            let seen = new Set<any>();

            function safeWalk(o: any, depth: number) {
                if (depth > 2 || !o || typeof o !== 'object' || seen.has(o)) return;
                seen.add(o);

                let keys: string[] = [];
                try {
                    keys = Object.keys(o);
                } catch (e) {
                    return;
                }

                for (let i = 0; i < keys.length; i++) {
                    let k = keys[i];
                    let v: any;
                    try {
                        v = o[k];
                    } catch (e) {
                        continue;
                    }

                    if (v != null) {
                        if (typeof v === 'string' || typeof v === 'number') {
                            let strVal = String(v).trim();
                            if (strVal && strVal.length >= 2 && strVal.length < 30) {
                                res.push(strVal);
                            }
                        } else if (typeof v === 'object' && depth < 2) {
                            safeWalk(v, depth + 1);
                        }
                    }
                }
            }

            safeWalk(obj, 0);
            window.postMessage({ type: 'kasp:useraction', detail: res }, '*');
        } catch (e) { }
    };

    (window as any).__kaspBattleStats = function (obj: any): void {
        try {
            if (!obj || typeof obj !== 'object') return;

            let keys: string[];
            try {
                keys = Object.keys(obj);
            } catch (e) {
                return;
            }

            let mode: string | null = null;
            let isPro: boolean | null = null;

            for (let i = 0; i < keys.length; i++) {
                let v: any;
                try {
                    v = obj[keys[i]];
                } catch (e) {
                    continue;
                }
                if (typeof v !== 'string') continue;

                const trimmed = v.trim();
                if (!trimmed) continue;
                const upper = trimmed.toUpperCase();

                if (!mode) {
                    if (KNOWN_MODES.has(upper)) {
                        mode = upper;
                    } else {
                        const m = /\s+([A-Z]{2,3})$/.exec(upper);
                        if (m && KNOWN_MODES.has(m[1])) mode = m[1];
                    }
                }

                if (isPro === null) {
                    if (/(^|[\s\-])PRO([\s\-]|$)/.test(trimmed) ||
                        /(^|[\s\-])ПРО([\s\-]|$)/.test(trimmed)) {
                        isPro = true;
                    }
                }
            }

            if (isPro === null) isPro = false;

            if (mode) {
                window.postMessage(
                    { type: 'kasp:battle-mode', detail: mode },
                    '*'
                );
            }
            window.postMessage(
                { type: 'kasp:battle-kind', detail: isPro ? 'PRO' : 'MM' },
                '*'
            );
        } catch (e) { }
    };

    const observer = new MutationObserver((mutations: MutationRecord[]) => {
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

                            const bsMatch = /return"BattleStatistics\(\w+="\+(?:\w+\()?this\.(\w+)/.exec(code);
                            if (bsMatch) {
                                const firstField = bsMatch[1];
                                const ctor = new RegExp(
                                    '(function [\\w$]+\\([^)]{5,400}\\)\\{' +
                                    '[^{}]{0,1200}?this\\.' + firstField + '=[\\w$]+' +
                                    '(?:,this\\.[\\w$]+=[\\w$]+){10,60})\\}'
                                );
                                if (ctor.test(code)) {
                                    code = code.replace(ctor, '$1, window.__kaspBattleStats(this)}');
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