/** Bounds the response AND its body. Abort alone cannot settle an uncooperative
 * fetch implementation, so the deadline also rejects the awaiting loader. */
export async function readGameBundle(url: string, timeoutMs = 15000): Promise<string> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error('Game bundle request timed out'));
            controller.abort();
        }, timeoutMs);
    });
    try {
        const request = (async () => {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`Game bundle request failed: HTTP ${response.status}`);
            const source = await response.text();
            if (!source.trim()) throw new Error('Game bundle response is empty');
            return source;
        })();
        return await Promise.race([request, deadline]);
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}
