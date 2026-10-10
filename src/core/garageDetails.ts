/** Restore only the visual details branches; purchase and mounting guards are untouched. */
export function patchUnavailableGarageDetails(code: string): string {
    const selected = (label: string) => {
        const fields = [...code.matchAll(new RegExp(`", ${label}="\\s*\\+\\s*this\\.([\\w$]+)`, 'g'))].map(match => match[1]);
        const unique = [...new Set(fields)];
        return unique;
    };
    const devices = selected('selectedDevice'), skins = selected('selectedSkin');
    if (!devices.length || skins.length !== 1) return code;
    const skin = skins[0];
    const enabled = '__kaspShowUnavailableDetails()';
    let patched = code;
    let changed = false;
    let unknownMethod: string | undefined, filter: string | undefined;
    for (const field of [...devices, skin]) {
        const start = new RegExp(`var ([\\w$]+)=this\\.[\\w$]+\\.${field},`).exec(patched);
        if (!start) continue;
        const end = patched.indexOf(',function(t,n){', start.index);
        if (end < 0 || end - start.index > 2500) continue;
        const block = patched.slice(start.index, end);
        const item = start[1];
        const unknown = new RegExp(`\\b${item}\\.([\\w$]+)\\(\\)`).exec(block)?.[1];
        if (!unknown) continue;
        let replacement = block;
        if (devices.includes(field)) {
            const invert = /([\w$]+)\(([\w$]+),"invert\(0\.25\)"\)/.exec(block);
            if (!invert || !block.includes(`!${item}.${unknown}()`)) continue;
            filter = invert[1]; unknownMethod = unknown;
            replacement = replacement.replace(invert[0], `${filter}(${invert[2]},${enabled}?"grayscale(1)":"invert(0.25)")`)
                .replace(`!${item}.${unknown}()`, `(!${item}.${unknown}()||${enabled})`);
            // Replace the side-panel placeholder condition, leaving the resource getter intact.
            replacement = replacement.replace(new RegExp(`(\\.${field}\\.${unknown}\\(\\))\\?`), `$1&&!${enabled}?`);
        } else {
            replacement = replacement.replace(new RegExp(`(${item}\\.${unknown}\\(\\))\\)\\{`), `$1&&!${enabled}){`);
        }
        if (replacement !== block) {
            patched = patched.slice(0, start.index) + replacement + patched.slice(end);
            changed = true;
        }
    }
    if (unknownMethod && filter) {
        // The shared skin/shot-color preview function chooses its native large resource.
        const preview = new RegExp(`function ([\\w$]+)\\((t),(n)\\)\\{var ([\\w$]+)=[\\w$]+,([\\w$]+)=[\\w$]+\\.xut\\(\\4\\);[^{}]{0,200}function\\(t\\)\\{var n;if\\(t\\.[\\w$]+\\.${skin}\\.${unknownMethod}\\(\\)`, 'g');
        const match = preview.exec(patched);
        if (match) {
            const tail = `n.cap(${match[5]}.c9l())}`;
            const end = patched.indexOf(tail, match.index);
            if (end >= 0 && end - match.index < 1500) {
                const block = patched.slice(match.index, end + tail.length);
                const unknown = new RegExp(`t\\.([\\w$]+)\\.${skin}\\.${unknownMethod}\\(\\)`);
                const state = unknown.exec(block)?.[1];
                if (state) {
                    const replacement = block.replace(unknown, `$&&&!${enabled}`)
                        .replace(tail, `t.${state}.${skin}.${unknownMethod}()&&${enabled}&&${filter}(${match[5]}.tuv(),"grayscale(1)"),${tail}`);
                    patched = patched.slice(0, match.index) + replacement + patched.slice(end + tail.length);
                }
            }
        }
    }
    if (!changed) return code;
    return `function __kaspShowUnavailableDetails(){try{return localStorage.getItem('k_augments')==='true'}catch(e){return false}}\n${patched}`;
}
