export function patchUnavailableGarageItems(code: string): string {
    if (code.includes('function __kaspShowUnavailableGarageItems()')) return code;
    const styleClass = /[\w$]+\(([\w$]+),"GarageItemComponentStyle",/.exec(code)?.[1];
    if (!styleClass) return code;
    const imageStyle = new RegExp(`[\\w$]+\\(${styleClass}\\)\\.([\\w$]+)=function\\(\\)\\{[^{}]{0,250}"mainImg"`).exec(code)?.[1];
    const filterSetter = /\.([\w$]+)\("filter",/.exec(code)?.[1];
    if (!imageStyle || !filterSetter) return code;
    const enabled = '__kaspShowUnavailableGarageItems()';
    let unknownMethod: string | undefined;
    let changed = false;
    let patched = code.replace(/function [\w$]+\(t,n\)\{var [\s\S]{0,2200}?n\.cap\([\w$]+\.c9l\(\)\)\}/g, block => {
        const image = new RegExp(`([\\w$]+)\\.jp8\\([\\w$]+\\(\\)\\.${imageStyle}\\(\\)\\)`).exec(block);
        if (!image) return block;
        const placeholder = /(([\w$]+)\.([\w$]+)\(\)&&!t\.[\w$]+\.[\w$]+\.[\w$]+\.equals\([\w$]+\(\)\))\?([\w$]+):\2\.[\w$]+\.[\w$]+\(\)/.exec(block);
        if (!placeholder) return block;
        unknownMethod = placeholder[3]; changed = true;
        return block.split(placeholder[1]).join(`(${placeholder[1]})&&!${enabled}`)
            .replace(image[0], `${image[0]},${placeholder[2]}.${placeholder[3]}()&&${enabled}&&${image[1]}.${filterSetter}("filter","grayscale(1)")`);
    });
    if (!changed || !unknownMethod) return code;
    const marker = patched.indexOf('setAttribute("garage_item_id"');
    if (marker >= 0) {
        const headers = [...patched.slice(Math.max(0, marker - 1600), marker)
            .matchAll(/([\w$]+)\(([\w$]+)\)\.[\w$]+=function\(t\)\{/g)];
        const header = headers[headers.length - 1];
        if (header) {
            const start = Math.max(0, marker - 1600) + header.index!;
            const end = patched.indexOf(`},${header[1]}(`, marker);
            if (end > start && end - start < 14000) {
                const block = patched.slice(start, end);
                const label = new RegExp(`([\\w$]+)\\.${unknownMethod}\\(\\)\\|\\|t\\.([\\w$]+)\\(\\1\\.([\\w$]+)\\)`, 'g');
                const replacement = block.replace(label, `(!$1.${unknownMethod}()||${enabled})&&t.$2($1.$3)`);
                patched = patched.slice(0, start) + replacement + patched.slice(end);
            }
        }
    }
    return `function __kaspShowUnavailableGarageItems(){try{return localStorage.getItem('k_augments')==='true'}catch(e){return false}}\n${patched}`;
}
