/**
 * =========================
 * Cache Helper
 * =========================
 */
const edgeCache = caches.default;
export const cacheHelper = {
    /**
     * Generate cache key untuk public invitation
     * @param slug invitation slug
     * @param guestId guest UUID atau identifier
     */
    getInvitationKey: (slug, guestId) => {
        const version = 'v1';
        return `invitation:${slug}:guest:${guestId}:${version}`;
    },
    /**
     * Generate cache key untuk dashboard user
     * @param userId user UUID
     * @param suffix modul atau page (ex: invitations, wishlist, guests)
     */
    getUserKey: (userId, suffix) => {
        const version = 'v1';
        return `user:${userId}:${suffix}:${version}`;
    },
    // KV helpers
    get: async (env, key) => {
        const cached = await env.get(key);
        if (!cached)
            return null;
        try {
            return JSON.parse(cached);
        }
        catch {
            return null;
        }
    },
    set: async (env, key, data, ttl = 60) => {
        await env.put(key, JSON.stringify(data), { expirationTtl: ttl });
    },
    delete: async (env, key) => {
        await env.delete(key);
    },
    clearPrefix: async (env, prefix) => {
        const list = await env.list({ prefix });
        for (const k of list.keys)
            await env.delete(k.name);
    },
    // Edge helpers
    getEdge: async (key) => {
        const res = await edgeCache.match(new Request(key));
        if (!res)
            return null;
        return await res.json();
    },
    setEdge: async (key, data, ttl = 60) => {
        await edgeCache.put(new Request(key), new Response(JSON.stringify(data), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=30`
            }
        }));
    },
    deleteEdge: async (key) => {
        await edgeCache.delete(new Request(key));
    }
};
