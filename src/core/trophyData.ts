export type TrophyProgress = { current: number | null; max: number | null; percent: number | null; complete?: boolean };
export type Trophy = TrophyProgress & { id: string; type: 'turret' | 'hull' };
export type TrophyDictionaryEntry = { id: string; ru: string; en: string; type: 'turret' | 'hull' };

// Native quests can expose a percentage fraction (38/100) beside the real score.
// Never turn rounded percentages into invented reputation points.
export function readTrophyProgress(text: string): TrophyProgress | null {
    const clean = text.trim().replace(/\s+/g, ' ');
    const integer = (value: string) => {
        const trimmed = value.trim();
        return /^(?:\d+|\d{1,3}([ ,.'’])\d{3}(?:\1\d{3})*)$/.test(trimmed)
            ? Number(trimmed.replace(/[ ,.'’]/g, '')) : NaN;
    };
    const fraction = /^(.+?)\/(.+)$/.exec(clean);
    if (fraction) {
        const current = integer(fraction[1]), max = integer(fraction[2]);
        if (!Number.isSafeInteger(current) || !Number.isSafeInteger(max) || max <= 0 || current > max) return null;
        if (max === 100) return { current: null, max: null, percent: current };
        if (max <= 100) return null;
        return { current, max, percent: current / max * 100 };
    }
    if (/^(completed|выполнено)$/i.test(clean)) return { current: null, max: null, percent: 100, complete: true };
    const percentage = /^(\d+(?:[.,]\d+)?)\s*%$/.exec(clean);
    const percent = percentage ? Number(percentage[1].replace(',', '.')) : NaN;
    return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? { current: null, max: null, percent } : null;
}

export function chooseTrophyProgress(values: string[]): TrophyProgress | null {
    const candidates = values.map(readTrophyProgress).filter((value): value is TrophyProgress => value !== null);
    const exact = candidates.filter(value => value.current !== null);
    // Results contain both the score before and after the animation. Use the final
    // total, but skip conflicting targets while a native card is being replaced.
    if (exact.length) {
        if (exact.some(value => value.max !== exact[0].max)) return null;
        return exact.reduce((best, value) => (value.current ?? 0) > (best.current ?? 0) ? value : best);
    }
    return candidates[0] ?? null;
}

export function mergeTrophyProgress(previous: TrophyProgress, next: TrophyProgress): TrophyProgress {
    if (next.current !== null || previous.current === null) return next;
    if (next.complete && previous.max !== null) return { current: previous.max, max: previous.max, percent: 100 };
    return previous;
}

export function normalizeTrophyFavorites(value: unknown): Trophy[] {
    if (!Array.isArray(value)) return [];
    const result: Trophy[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.length || item.id.length > 128
            || !['turret', 'hull'].includes(item.type) || result.some(entry => entry.id === item.id)
            || result.filter(entry => entry.type === item.type).length >= 2) continue;
        const exact = Number.isSafeInteger(item.current) && item.current >= 0 && Number.isSafeInteger(item.max)
            && item.max > 100 && item.current <= item.max;
        const legacyPercent = item.max === 100 && Number.isFinite(item.current) ? item.current : null;
        const percent = exact ? item.current / item.max * 100 : legacyPercent ?? item.percent;
        result.push({ id: item.id, type: item.type, current: exact ? item.current : null, max: exact ? item.max : null,
            percent: typeof percent === 'number' && Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : null });
    }
    return result;
}

export function matchTrophy(text: string, dictionary: Record<string, TrophyDictionaryEntry>): TrophyDictionaryEntry | null {
    const normalize = (value: string) => value.toLowerCase().replace(/ё/g, 'е');
    const normalized = normalize(text);
    const matches = new Map<string, TrophyDictionaryEntry>();
    for (const [alias, entry] of Object.entries(dictionary)) {
        const word = normalize(alias);
        let start = normalized.indexOf(word);
        while (start !== -1) {
            const before = normalized[start - 1] || '', after = normalized[start + word.length] || '';
            // textContent joins adjacent name/progress elements without a space.
            if (!/[\p{L}_]/u.test(before) && !/[\p{L}_]/u.test(after)) matches.set(entry.id, entry);
            start = normalized.indexOf(word, start + word.length);
        }
    }
    return matches.size === 1 ? [...matches.values()][0] : null;
}
