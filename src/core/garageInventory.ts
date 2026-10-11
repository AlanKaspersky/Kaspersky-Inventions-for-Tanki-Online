type InventorySchema = Record<string, string>;

const escapePattern = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function patchGarageInventoryDiagnostics(code: string): string {
    if (code.includes('window.__kaspGarageInventoryCapture(')) return code;
    const state = /([\w$]+)\(([\w$]+)\)\.toString=function\(\)\{return\s*"GarageItemsState\(/.exec(code);
    const item = /[\w$]+\(([\w$]+)\)\.toString=function\(\)\{return\s*"GarageItem\(/.exec(code);
    if (!state || !item) return code;
    const statePrefix = `${escapePattern(state[1])}\\(${escapePattern(state[2])}\\)`;
    const flat = new RegExp(`${statePrefix}\\.[\\w$]+=function\\(\\)\\{return this\\.([\\w$]+)\\.b3\\(\\)\\}`).exec(code)?.[1];
    if (!flat) return code;
    const body = code.slice(item.index, code.indexOf('}', item.index));
    const schema: InventorySchema = {};
    for (const label of ['id', 'name', 'category', 'viewCategory', 'description', 'preview', 'owned', 'buyable', 'visible', 'secret']) {
        const field = new RegExp(`"[^"\\r\\n]*\\b${label}="\\+\\s*(?:[\\w$]+\\()?this\\.([\\w$]+)`).exec(body)?.[1];
        if (field) schema[label] = field;
    }
    if (!['id', 'name', 'owned', 'visible', 'secret'].every(label => schema[label])) return code;
    if (schema.preview) {
        const imageMethod = new RegExp(`:[\\w$]+\\.${escapePattern(schema.preview)}\\.([\\w$]+)\\(\\)`).exec(code)?.[1];
        if (imageMethod) schema.imageMethod = imageMethod;
    }
    const constructor = new RegExp(`function ${escapePattern(state[2])}\\(t\\)\\{[\\s\\S]{0,6000}?\\}function `).exec(code);
    if (!constructor) return code;
    const assignment = new RegExp(`this\\.${escapePattern(flat)}=[\\w$]+;`).exec(constructor[0]);
    if (!assignment) return code;
    const offset = constructor.index + assignment.index + assignment[0].length;
    const hook = `try{window.__kaspGarageInventoryCapture(this.${flat},${JSON.stringify(schema)})}catch(__kaspIgnored){};`;
    return code.slice(0, offset) + hook + code.slice(offset);
}

export function installGarageInventoryDiagnostics(target: Window): void {
    let inventory: { b3(): { t(): { u(): boolean; v(): Record<string, unknown> } } } | null = null;
    let schema: InventorySchema = {};
    const bridge = target as Window & {
        __kaspGarageInventoryCapture?: (value: typeof inventory, fields: InventorySchema) => void;
        __kaspGarageInventoryDebug?: () => object;
    };
    bridge.__kaspGarageInventoryCapture = (value, fields) => { inventory = value; schema = fields; };
    bridge.__kaspGarageInventoryDebug = () => {
        if (!inventory) return { captured: false, reason: 'Native garage inventory has not been captured.' };
        const items: Record<string, unknown>[] = [];
        try {
            const rendered = new Set(Array.from(target.document.querySelectorAll('[garage_item_id]'))
                .map(element => element.getAttribute('garage_item_id')));
            const iterator = inventory.b3().t();
            while (iterator.u()) {
                if (items.length >= 20000) throw new Error('Inventory exceeds diagnostic limit.');
                const source = iterator.v();
                const row: Record<string, unknown> = {};
                for (const label of ['id', 'name', 'category', 'viewCategory', 'description', 'owned', 'buyable', 'visible', 'secret']) {
                    const value = source[schema[label]];
                    row[label] = value == null ? null : typeof value === 'object' ? String(value) : value;
                }
                const preview = source[schema.preview] as Record<string, unknown> | null;
                const getter = preview?.[schema.imageMethod];
                row.preview = typeof getter === 'function' ? getter.call(preview) : null;
                row.renderedInDOM = rendered.has(String(row.id));
                items.push(row);
            }
            return { captured: true, total: items.length,
                hidden: items.filter(item => item.visible === false).length,
                secret: items.filter(item => item.secret === true).length,
                unowned: items.filter(item => item.owned === false).length,
                note: 'renderedInDOM describes mounted cards only; scrolling and category selection can change it.', items };
        } catch (error) {
            return { captured: true, error: String(error), partial: true, items };
        }
    };
}
