import { createCodeOffsetGuard } from './clientLexical';

export interface PatchEdit { start: number; end: number; expected: string; text: string; before: string; after: string; }
export interface PatchTemplate {
    pattern: string; roles: Record<string, string | undefined>; count: number;
    search?: { literal?: string; margin: number };
    edits: Array<{ start: string; end: string; parts: Array<string | { capture?: string; role?: string; quoted: boolean }> }>;
}
export interface PreparedPatchPlan {
    format: string; sha256: string; sourceLength: number; edits: PatchEdit[]; templates?: PatchTemplate[]; temporaries?: string[];
}

export function validatePatchEdits(code: string, plan: PreparedPatchPlan): boolean {
    if (plan.sourceLength !== code.length) return false;
    let previousEnd = 0;
    for (const edit of plan.edits) {
        if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end) || edit.start < previousEnd || edit.end < edit.start || edit.end > code.length ||
            code.slice(edit.start, edit.end) !== edit.expected || code.slice(Math.max(0, edit.start - 24), edit.start) !== edit.before ||
            code.slice(edit.end, edit.end + 24) !== edit.after) return false;
        previousEnd = edit.end;
    }
    return true;
}

export function mergeClientPatchPlans(code: string, plans: PreparedPatchPlan[]): { code: string; rejected: PreparedPatchPlan[] } {
    const edits: PatchEdit[] = [], rejected: PreparedPatchPlan[] = [];
    for (const plan of plans) {
        if (!validatePatchEdits(code, plan) || plan.edits.some(edit => edits.some(other =>
            edit.start < other.end && other.start < edit.end || edit.start > other.start && edit.start < other.end || other.start > edit.start && other.start < edit.end))) {
            rejected.push(plan);
        } else edits.push(...plan.edits);
    }
    let patched = code;
    for (const edit of edits.sort((a, b) => b.start - a.start || b.end - a.end)) patched = patched.slice(0, edit.start) + edit.text + patched.slice(edit.end);
    return { code: patched, rejected };
}

type TemplateMatch = RegExpExecArray & { indices: { groups: Record<string, [number, number]> } };

type SourceContext = {
    code: string;
    valid?: (offset: number) => boolean;
    hash?: Promise<string>;
    anchors: Map<string, number[]>;
};
let sourceContext: SourceContext | undefined;
function contextFor(code: string): SourceContext {
    if (!sourceContext || sourceContext.code !== code) sourceContext = { code, anchors: new Map() };
    return sourceContext;
}
export function releaseClientPatchContext(code: string): void {
    if (sourceContext?.code === code) sourceContext = undefined;
}
export function clientSourceHash(code: string): Promise<string> {
    const context = contextFor(code);
    return context.hash ??= (async () => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
        return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    })();
}
function anchorOffsets(context: SourceContext, anchor: string): number[] {
    const cached = context.anchors.get(anchor);
    if (cached) return cached;
    const offsets: number[] = [];
    for (let at = context.code.indexOf(anchor); at >= 0; at = context.code.indexOf(anchor, at + anchor.length)) {
        offsets.push(at);
        if (offsets.length > 4096) break;
    }
    if (context.anchors.size >= 256) context.anchors.delete(context.anchors.keys().next().value!);
    context.anchors.set(anchor, offsets);
    return offsets;
}

export function clientPatchHeader(code: string, marker: string, status: unknown, setup: string): string {
    let at = 0, strict = false;
    const trivia = /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n\u2028\u2029]*(?:\r\n|[\r\n\u2028\u2029]|$))*/;
    for (;;) {
        at += trivia.exec(code.slice(at))![0].length;
        const directive = /^("(?:\\[\s\S]|[^"\\\r\n\u2028\u2029])*"|'(?:\\[\s\S]|[^'\\\r\n\u2028\u2029])*')/.exec(code.slice(at));
        if (!directive) break;
        at += directive[0].length;
        const gap = trivia.exec(code.slice(at))![0];
        at += gap.length;
        const next = code.slice(at);
        const continues = /^(?:[([.`*/%<>=&|^?]|[+\-](?![+\-])|!=|in\b|instanceof\b)/.test(next);
        if (next[0] !== ';' && next.length && (!/[\r\n\u2028\u2029]/.test(gap) || continues)) break;
        strict ||= directive[1] === '"use strict"' || directive[1] === "'use strict'";
        if (next[0] === ';') at++;
    }
    return marker + JSON.stringify(status) + '*/\n' + (strict ? '"use strict";\n' : '') + setup + '\n';
}

export function codeOffsets(code: string, offsets: Set<number>): Set<number> {
    const context = contextFor(code);
    const valid = context.valid ??= createCodeOffsetGuard(code);
    return new Set([...offsets].filter(valid));
}

export function resolveTemplateEdits(code: string, plan: PreparedPatchPlan): { edits: PatchEdit[]; roles: Map<string, string> } | undefined {
    if (!plan.templates?.length) return undefined;
    const context = contextFor(code);
    const valid = context.valid ??= createCodeOffsetGuard(code);
    const roles = new Map<string, string>();
    const edits: PatchEdit[] = [];
    const selected: Array<{ template: PatchTemplate; match: TemplateMatch }> = [];
    const temporaries = new Map<string, string>();
    for (const name of ['_kaspBonusResult', ...(plan.temporaries || [])]) {
        if (!/^[$A-Z_a-z][$\w]*$/.test(name)) return undefined;
        let replacement = name;
        while (code.includes(replacement)) replacement += '_';
        temporaries.set(name, replacement);
    }
    const temporaryPattern = new RegExp('(?<![$\\w])(' + [...temporaries.keys()].map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![$\\w])', 'g');
    for (const template of plan.templates) {
        const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let expression = template.pattern;
        for (const [role, capture] of Object.entries(template.roles)) {
            const value = roles.get(role);
            if (capture && value) expression = expression.replace(`(?<${capture}>[$A-Z_a-z][$\\w]*)`, `(?<${capture}>${escape(value)})`);
        }
        const pattern = new RegExp(expression, 'gd');
        const anchor = template.search?.literal || Object.keys(template.roles).map(role => roles.get(role)).filter((value): value is string => !!value && value.length >= 3).sort((a,b)=>b.length-a.length)[0];
        const windows: Array<[number,number]> = [];
        if (anchor && template.search) {
            const offsets = anchorOffsets(context, anchor);
            for (const at of offsets) {
                const start = Math.max(0, at-template.search.margin), end = Math.min(code.length, at+anchor.length+template.search.margin);
                const last = windows[windows.length-1];
                if (last && start <= last[1]) last[1] = Math.max(last[1],end); else windows.push([start,end]);
            }
            if (offsets.length > 4096) windows.splice(0,windows.length,[0,code.length]);
        } else windows.push([0,code.length]);
        const matches: TemplateMatch[] = [];
        for (const [from,to] of windows) {
            pattern.lastIndex = 0;
            const segment = code.slice(from,to);
            let match: TemplateMatch | null;
            while ((match = pattern.exec(segment) as TemplateMatch | null)) {
                if (!match[0].length) return undefined;
                match.index += from;
                if (!valid(match.index) || !Object.entries(template.roles).every(([role,capture]) => !!capture &&
                    !!match!.groups?.[capture] && (!roles.has(role) || roles.get(role) === match!.groups![capture]))) continue;
                for (const bounds of Object.values(match.indices.groups)) if (bounds) { bounds[0]+=from;bounds[1]+=from; }
                matches.push(match);
                if (matches.length>template.count) return undefined;
            }
        }
        if (matches.length !== template.count) return undefined;
        for (const match of matches) {
            for (const [role, capture] of Object.entries(template.roles)) {
                if (!capture) return undefined;
                roles.set(role, match.groups![capture]);
            }
            selected.push({ template, match });
        }
    }
    for (const { template, match } of selected) {
        for (const edit of template.edits) {
            const start = match.indices.groups[edit.start]?.[0], end = match.indices.groups[edit.end]?.[0];
            if (start === undefined || end === undefined || end < start) return undefined;
            const text = edit.parts.map(part => {
                if (typeof part === 'string') return part.replace(temporaryPattern, name => temporaries.get(name)!);
                const value = part.role ? roles.get(part.role) : part.capture ? match.groups?.[part.capture] : undefined;
                if (!value || !/^[$A-Z_a-z][$\w]*$/.test(value)) throw new Error('Invalid template capture');
                return part.quoted ? JSON.stringify(value) : value;
            }).join('');
            edits.push({ start, end, text, expected: code.slice(start, end),
                before: code.slice(Math.max(0, start - 24), start), after: code.slice(end, end + 24) });
        }
    }
    if (edits.length !== plan.edits.filter(edit => edit.start !== 0).length) return undefined;
    edits.sort((a, b) => a.start - b.start || a.end - b.end);
    if (edits.some((edit, index) => index > 0 && edits[index - 1].end > edit.start)) return undefined;
    return { edits, roles };
}
