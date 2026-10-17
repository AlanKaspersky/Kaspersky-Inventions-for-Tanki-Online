export function escapeHistoryHtml(value: unknown): string {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]!);
}

export { getTankiImageUrl as getHistoryImageUrl } from './imageUrl';

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
