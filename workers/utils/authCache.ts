// akses cache default Cloudflare Worker
const edgeCache = (caches as any).default;

// contoh helper
export async function setCache(key: string, data: any, ttl = 60) {
    await edgeCache.put(
        new Request(`https://example.com/${key}`),
        new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=30`,
            },
        })
    );
}

export async function getCache(key: string) {
    const res = await edgeCache.match(new Request(`https://example.com/${key}`));
    if (!res) return null;
    return await res.json();
}

export async function deleteCache(key: string) {
    await edgeCache.delete(new Request(`https://example.com/${key}`));
}
