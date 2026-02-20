import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifySessionToken } from '../core/auth';
import { createDbClient, users } from 'node/db';
import { eq } from 'drizzle-orm';

export async function authMiddleware(c: Context, next: Next) {
    const token = getCookie(c, 'accessToken');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);

    const payload = await verifySessionToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: 'Invalid token' }, 401);

    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const user = await db.select().from(users).where(eq(users.id, payload.id as string)).get();
    if (!user) return c.json({ error: 'User not found' }, 401);

    // cek lastSignedOutAt → token lama jadi invalid
    if (
        user.lastSignedOutAt &&
        payload.iat &&
        payload.iat * 1000 < new Date(user.lastSignedOutAt).getTime()
    ) {
        return c.json({ error: 'Session expired, please login again' }, 401);
    }

    c.set('user', user);
    await next();
}