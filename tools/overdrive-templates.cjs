const { tokenizer } = require('acorn');

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const identifier = '[$A-Z_a-z][$\\w]*';
const fixedNames = new Set(['window', 'Error', 'undefined', 'arguments', 'prototype', 'toString', 'callableName']);

/** Compile small AST-selected functions into templates; Acorn is only used by this build tool. */
function compileTemplate(source, node, edits, roleNames, sharedKeys = new Map()) {
    const original = source.slice(node.start, node.end);
    const tokens = [...tokenizer(original, { ecmaVersion: 'latest' })];
    const bindings = new Map();
    const boundaries = new Map();
    for (const [index, edit] of edits.entries()) {
        for (const [side, offset] of [['start', edit.start], ['end', edit.end]]) {
            const at = offset - node.start;
            if (!boundaries.has(at)) boundaries.set(at, []);
            boundaries.get(at).push(`e${index}${side}`);
        }
    }
    const binding = (kind, name) => {
        const key = `${kind}:${name}`;
        let entry = bindings.get(key);
        if (entry) return `\\k<${entry}>`;
        entry = `s${bindings.size}`;
        bindings.set(key, entry);
        return `(?<${entry}>${identifier})`;
    };
    const emitted = new Set();
    const boundary = at => {
        if (emitted.has(at)) return '';
        emitted.add(at);
        return (boundaries.get(at) || []).map(name => `(?<${name}>)`).join('');
    };
    let pattern = '(?<![$\\w])';
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index], previous = tokens[index - 1], next = tokens[index + 1];
        pattern += '\\s*' + boundary(token.start);
        const property = ['.', '?.'].includes(previous?.type.label) || previous?.type.label === '[' && next?.type.label === ']';
        if (token.type.label === 'name' && !fixedNames.has(token.value)) {
            pattern += binding(property ? 'property' : 'identifier', token.value) + '(?![$\\w])';
        } else if (token.type.label === 'string') {
            if (property && /^[$A-Z_a-z][$\w]*$/.test(token.value) && !fixedNames.has(token.value)) {
                const quote = `q${index}`;
                pattern += `(?<${quote}>["'])${binding('property', token.value)}\\k<${quote}>`;
            } else {
                const single = "'" + token.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
                pattern += `(?:${escape(JSON.stringify(token.value))}|${escape(single)})`;
            }
        } else pattern += escape(original.slice(token.start, token.end)) + (token.type.keyword ? '(?![$\\w])' : '');
        pattern += boundary(token.end);
    }
    if ([...boundaries.keys()].some(at => !emitted.has(at))) throw new Error('AST template edit is not on a token boundary');
    const render = text => {
        const parts = [];
        const generated = [...tokenizer(text, { ecmaVersion: 'latest' })];
        let at = 0;
        for (let index = 0; index < generated.length; index++) {
            const token = generated[index], previous = generated[index - 1];
            // Public extension callbacks keep their names even when native fields share those names.
            if (previous?.type.label === '.' && generated[index - 2]?.value?.startsWith?.('__kasp') && generated[index - 4]?.value === 'window') continue;
            const kind = ['.', '?.'].includes(previous?.type.label) || token.type.label === 'string' ? 'property' : 'identifier';
            const key = `${kind}:${token.value}`, capture = bindings.get(key), role = sharedKeys.get(key);
            if ((!capture && !role) || !['name', 'string'].includes(token.type.label)) continue;
            if (token.start > at) parts.push(text.slice(at, token.start));
            parts.push({ ...(role ? { role } : { capture }), quoted: token.type.label === 'string' });
            at = token.end;
        }
        if (at < text.length) parts.push(text.slice(at));
        return parts;
    };
    const roles = {};
    for (const [role, key] of Object.entries(roleNames)) {
        const capture = bindings.get(key);
        if (!capture) throw new Error(`AST template capture missing: ${role} (${key})`);
        roles[role] = capture;
    }
    const anchors = tokens.filter((t,i) => t.type.label==='string' && t.value.length>=5 && tokens[i-1]?.type.label!=='[' && original.includes(t.value));
    const anchor = anchors.sort((a,b)=>b.value.length-a.value.length)[0];
    return { pattern, roles, count: 1, search: { ...(anchor ? { literal: anchor.value } : {}), margin: original.length*8+256 },
        edits: edits.map((edit, index) => ({ start: `e${index}start`, end: `e${index}end`, parts: render(edit.text) })) };
}

function compileTemplates(source, edits, owners, options = {}) {
    const templates = [];
    for (const [node, roles] of owners) {
        const selected = edits.filter(edit => edit.start >= node.start && edit.end <= node.end && edit.start !== 0);
        if (!selected.length && (!options.evidence || !Object.keys(roles).length)) continue;
        const template = compileTemplate(source, node, selected, roles, options.sharedKeys);
        if (!template) return [];
        const same = templates.find(other => other.pattern === template.pattern && JSON.stringify(other.roles) === JSON.stringify(template.roles) && JSON.stringify(other.edits) === JSON.stringify(template.edits));
        if (same) same.count++;
        else templates.push(template);
    }
    return templates;
}

module.exports = { compileTemplates };
