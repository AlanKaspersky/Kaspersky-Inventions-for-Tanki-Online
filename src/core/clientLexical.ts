/** A lexical filter, not a runtime AST parser. Control parentheses and block endings
 * distinguish regular expressions from division; template substitutions remain code. */
export function createCodeOffsetGuard(code: string): (offset: number) => boolean {
    const ranges: Array<[number, number]> = [];
    const parens: Array<{ control: boolean; body?: boolean }> = [];
    const braces: Array<{ template?: boolean; after: boolean }> = [];
    const controls = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
    const expressions = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'of', 'instanceof', 'yield', 'await', 'else', 'do']);
    const spaces = new Set([0xA0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006,
        0x2007, 0x2008, 0x2009, 0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]);
    const word = (n: number) => n === 36 || n === 95 || n >= 48 && n <= 57 || n >= 65 && n <= 90 || n >= 97 && n <= 122 || n >= 128 && !spaces.has(n);
    const lineEnd = (n: number) => n === 10 || n === 13 || n === 0x2028 || n === 0x2029;
    const cases: Array<{ braces: number; parens: number; questions: number }> = [];
    let at = 0, expression = true, statement = true, previous = '', lineBreak = false;
    let label = false;
    let functionBody: boolean | undefined, classBody: boolean | undefined, pendingBody: boolean | undefined;
    let forAwait = false;
    const block = (start: number, end: number) => {
        const last = ranges[ranges.length - 1];
        if (last && last[1] === start) last[1] = end; else ranges.push([start, end]);
    };
    const template = (start: number) => {
        for (; at < code.length; at++) {
            if (code[at] === '\\') at++;
            else if (code[at] === '`') {
                block(start, ++at); expression = false; statement = false; previous = 'literal'; return;
            } else if (code[at] === '$' && code[at + 1] === '{') {
                at += 2; block(start, at); braces.push({ template: true, after: false });
                expression = true; statement = false; previous = '${'; return;
            }
        }
        block(start, code.length);
    };
    while (at < code.length) {
        const start = at, char = code[at], next = code[at + 1];
        const value = code.charCodeAt(at);
        if (value <= 32 || value > 127 && spaces.has(value)) {
            lineBreak ||= char === '\n' || char === '\r' || char === '\u2028' || char === '\u2029'; at++; continue;
        }
        if (char === '/' && (next === '/' || next === '*')) {
            if (next === '/') { for (at += 2; at < code.length && !lineEnd(code.charCodeAt(at)); at++); }
            else {
                const end = code.indexOf('*/', at + 2); at = end < 0 ? code.length : end + 2;
                lineBreak ||= /[\r\n\u2028\u2029]/.test(code.slice(start, at));
            }
            block(start, at); continue;
        }
        if (lineBreak && ['return', 'break', 'continue'].includes(previous)) expression = statement = true;
        lineBreak = false;
        if (char === '"' || char === "'") {
            for (at++; at < code.length; at++) {
                if (code[at] === '\\') at++;
                else if (code[at] === char) { at++; break; }
            }
            block(start, at); expression = false; statement = false; previous = 'literal'; continue;
        }
        if (char === '`') { at++; template(start); continue; }
        if (char === '/' && expression) {
            let bracket = false;
            for (at++; at < code.length; at++) {
                const current = code[at];
                if (current === '\\') at++;
                else if (current === '[') bracket = true;
                else if (current === ']') bracket = false;
                else if (current === '/' && !bracket) { at++; break; }
            }
            while (word(code.charCodeAt(at))) at++;
            block(start, at); expression = false; statement = false; previous = 'literal'; continue;
        }
        if (char >= '0' && char <= '9' || char === '.' && next >= '0' && next <= '9') {
            for (at++; at < code.length; at++) {
                const n = code[at];
                if (word(code.charCodeAt(at)) || n === '.' || (n === '+' || n === '-') && /[eE]/.test(code[at - 1])) continue;
                break;
            }
            expression = false; statement = false; previous = 'literal'; continue;
        }
        if (word(code.charCodeAt(at))) {
            for (at++; word(code.charCodeAt(at)); at++);
            const value = code.slice(start, at), property = previous === '.' || previous === '?.';
            label = statement && !property && !controls.has(value) && !expressions.has(value) &&
                !['function', 'class', 'var', 'let', 'const', 'export', 'default', 'async', 'try', 'finally', 'break', 'continue'].includes(value);
            if (!property && (value === 'case' || value === 'default' && previous !== 'export' && braces[braces.length - 1]?.after)) {
                cases.push({ braces: braces.length, parens: parens.length, questions: 0 });
            }
            forAwait = !property && value === 'await' && previous === 'for';
            if (!property && value === 'function') functionBody = statement;
            if (!property && value === 'class') classBody = statement;
            expression = !property && expressions.has(value);
            if (value !== 'async' && value !== 'export' && value !== 'default') statement = false;
            previous = property ? 'identifier' : ['break', 'continue'].includes(previous) ? previous : value; continue;
        }
        at++;
        if (char === '(') {
            parens.push({ control: controls.has(previous) || forAwait, body: functionBody }); functionBody = undefined; forAwait = false;
            expression = true; statement = false;
        } else if (char === ')') {
            const context = parens.pop(); pendingBody = context?.body;
            expression = !!context?.control; statement = expression;
        } else if (char === '{') {
            const body: boolean = pendingBody !== undefined || classBody !== undefined || previous === '=>' ||
                statement || previous === ')' || ['else', 'try', 'finally', 'do', 'catch'].includes(previous);
            const after = pendingBody ?? classBody ?? (previous === '=>' ? false : body);
            braces.push({ after }); pendingBody = classBody = undefined;
            expression = true; statement = body;
        } else if (char === '}') {
            const context = braces.pop();
            while (cases.length && cases[cases.length - 1].braces > braces.length) cases.pop();
            if (context?.template) { block(start, at); template(at); continue; }
            expression = context?.after ?? true; statement = expression;
        } else if (char === ':') {
            const head = cases[cases.length - 1];
            const atCase = head && head.braces === braces.length && head.parens === parens.length;
            if (atCase && head.questions) { head.questions--; statement = false; }
            else { statement = label || !!atCase; if (atCase) cases.pop(); }
            expression = true;
        } else if (char === ';') { expression = true; statement = true; }
        else if (char === '[') { expression = true; statement = false; }
        else if (char === ']') { expression = false; statement = false; }
        else if (char === '.' || char === '?' && next === '.') {
            if (char === '?') at++;
            expression = false; statement = false;
        } else if ((char === '+' || char === '-') && next === char) { at++; statement = false; }
        else {
            const head = cases[cases.length - 1];
            if (char === '?' && next !== '?' && previous !== '?' && head?.braces === braces.length && head.parens === parens.length) head.questions++;
            if (char === '=' && next === '>') at++;
            expression = true; statement = false;
        }
        previous = code.slice(start, at);
        label = false;
    }
    return offset => {
        if (!Number.isSafeInteger(offset) || offset < 0 || offset >= code.length) return false;
        let low = 0, high = ranges.length;
        while (low < high) { const mid = (low + high) >>> 1; if (ranges[mid][0] <= offset) low = mid + 1; else high = mid; }
        return low === 0 || ranges[low - 1][1] <= offset;
    };
}
