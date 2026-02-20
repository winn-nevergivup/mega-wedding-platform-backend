/**
 * =========================
 * Cache Helper
 * =========================
 */

const edgeCache = (caches as any).default as Cache;


export const cacheHelper = {

    // =========================
    // VERSIONING
    // =========================
    async getVersion(KV: KVNamespace, resource: string) {
        const v = await KV.get(`version:${resource}`)
        return v || '1'
    },

    async bumpVersion(KV: KVNamespace, resource: string) {
        const newVersion = Date.now().toString()
        await KV.put(`version:${resource}`, newVersion)
        return newVersion
    },

    // ===============================
    // KEY GENERATOR (ANTI EXPLOSION)
    // ===============================
    makeKey(
        area: string,
        resource: string,
        identifier: string,
        version: string,
        params: Record<string, any>
    ) {
        const cleanParams = Object.keys(params)
            .sort()
            .filter(k => params[k] !== undefined && params[k] !== null)
            .map(k => `${k}=${encodeURIComponent(params[k])}`)
            .join('&')

        return `${area}:${resource}:${identifier}:v${version}:${cleanParams}`
    },

    // =========================
    // ADAPTIVE TTL
    // =========================
    getAdaptiveTTL(params: {
        type: "list" | "detail"
        search?: string
        page?: number
    }) {
        const hasSearch =
            params.search &&
            params.search !== "all"

        const page = Number(params.page || 1)

        // 1️⃣ DETAIL
        if (params.type === "detail") {
            return 7200
        }

        // 2️⃣ SEARCH
        if (hasSearch) {
            return 600
        }

        // 3️⃣ PAGINATION
        if (page > 3) {
            return 7200
        }

        if (page > 1) {
            return 1800
        }

        // 4️⃣ PAGE 1
        return 21600
    }

,
    getOrdersTTL(params: {
        status?: string
        search?: string
        page?: number
    }) {
        const page = Number(params.page || 1)
        const hasSearch =
            params.search &&
            params.search !== 'all'

        const status = params.status || 'all'

        // 🔴 1️⃣ SEARCH (paling volatile)
        if (hasSearch) {
            return 60
        }

        // 🔴 2️⃣ STATUS PENDING (sering berubah)
        if (status === 'pending') {
            return 60
        }

        // 🟡 3️⃣ STATUS PAID / PROCESSING
        if (status === 'paid' || status === 'processing') {
            return 300
        }

        // 🟢 4️⃣ STATUS EXPIRED / FAILED (jarang berubah)
        if (status === 'expired' || status === 'failed') {
            return 1800
        }

        // 🟡 5️⃣ PAGE LOGIC (no status filter)
        if (page === 1) {
            return 300
        }

        if (page <= 3) {
            return 600
        }

        return 1800
    }
,
    /**
     * Generate cache key untuk public invitation
     * @param slug invitation slug
     * @param guestId guest UUID atau identifier
     */
    getInvitationKey: (slug: string, guestId: string) => {
        const version = 'v1';
        return `invitation:${slug}:guest:${guestId}:${version}`;
    },

    /**
     * Generate cache key untuk dashboard user
     * @param userId user UUID
     * @param suffix modul atau page (ex: invitations, wishlist, guests)
     */
    getUserKey: (userId: string, suffix: string) => {
        const version = 'v1';
        return `user:${userId}:${suffix}:${version}`;
    },

    // KV helpers
    get: async (env: KVNamespace, key: string) => {
        const cached = await env.get(key);
        if (!cached) return null;
        try { return JSON.parse(cached); } catch { return null; }
    },
    set: async (env: KVNamespace, key: string, data: any, ttl = 60) => {
        await env.put(key, JSON.stringify(data), { expirationTtl: ttl });
    },
    delete: async (env: KVNamespace, key: string) => {
        await env.delete(key);
    },
    clearPrefix: async (env: KVNamespace, prefix: string) => {
        const list = await env.list({ prefix });
        for (const k of list.keys) await env.delete(k.name);
    },

    // Edge helpers
    getEdge: async (key: string) => {
        const url = `https://cache.example.com/${encodeURIComponent(key)}`;
        const res = await edgeCache.match(new Request(url));
        if (!res) return null;
        return await res.json();
        },
    setEdge: async (key: string, data: any, ttl = 60) => {
        const url = `https://cache.example.com/${encodeURIComponent(key)}`;
        await edgeCache.put(
            new Request(url),
            new Response(JSON.stringify(data), {
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=30`,
                },
            })
        );
    },
    deleteEdge: async (key: string) => {
        const url = `https://cache.example.com/${encodeURIComponent(key)}`;
        await edgeCache.delete(new Request(url));
    },
};
