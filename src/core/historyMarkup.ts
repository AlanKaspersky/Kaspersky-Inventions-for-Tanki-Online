export function escapeHistoryHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]!);
}

export function getHistoryImageUrl(value: unknown): string {
    if (typeof value !== 'string' || !value || /[\s"'<>\\]/.test(value)) return '';
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
        if (url.hostname !== 'tankionline.com' && !url.hostname.endsWith('.tankionline.com')) return '';
        if (!/\.(svg|webp|png|jpe?g|gif|avif|ico)$/i.test(url.pathname)) return '';
        return url.href;
    } catch {
        return '';
    }
}

export function renderHistoryTemplate(
    template: string,
    values: Record<string, unknown>,
    markupKeys: readonly string[] = [],
): string {
    const markup = new Set(markupKeys);
    return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
        if (!Object.prototype.hasOwnProperty.call(values, key)) return placeholder;
        return markup.has(key) ? String(values[key] ?? '') : escapeHistoryHtml(values[key]);
    });
}
