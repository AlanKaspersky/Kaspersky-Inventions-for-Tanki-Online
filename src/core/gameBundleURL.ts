/** Query-bearing URLs are left native, including the explicit recovery bypass. */
export function isGameBundleURL(value: string, allowQuery = false): boolean {
    try {
        const url = new URL(value);
        return /^(?:https?:)$/.test(url.protocol) && /(?:^|\.)tankionline\.com$/i.test(url.hostname)
            && /^\/(?:browser-public\/)?static\/js\/main\.[\w-]+\.js$/.test(url.pathname)
            && (allowQuery || !url.search);
    } catch { return false; }
}

export function nativeGameBundleURL(value: string): string {
    const url = new URL(value);
    url.searchParams.set('ki_native', '1');
    return url.href;
}
