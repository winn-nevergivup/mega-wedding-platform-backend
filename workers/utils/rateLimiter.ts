// workers/utils/rateLimiterKV.ts
import { Context, Next } from 'hono';

export const rateLimiterKV = (opts: { limit: number; duration: number }) => {
    return async (c: Context, next: Next) => {
        const kv = c.env.RATE_LIMIT_KV; // HARUS ada di wrangler.toml
        if (!kv) return c.json({ error: 'Rate limit KV not configured' }, 500);

        const ip = c.req.header('CF-Connecting-IP') || 'unknown';
        const key = `rate:${ip}`;

        const current = await kv.get(key);
        if (current && Number(current) >= opts.limit) {
            return c.json({ error: 'Too Many Requests' }, 429);
        }

        await kv.put(key, String((Number(current) || 0) + 1), { expirationTtl: opts.duration });

        await next();
    };
};
