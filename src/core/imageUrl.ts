export function getTankiImageUrl(value: unknown): string {
    if (typeof value !== 'string' || !value || value.length > 2048 || /[\s"'<>\\]/.test(value)) return '';
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
        if (url.hostname !== 'tankionline.com' && !url.hostname.endsWith('.tankionline.com')) return '';
        if (!/\.(svg|webp|png|jpe?g|gif|avif|ico)$/i.test(url.pathname)) return '';
        return url.href;
    } catch { return ''; }
}
