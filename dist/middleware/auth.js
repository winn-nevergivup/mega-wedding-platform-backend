import { verifySessionToken } from '../core/auth';
import { getCookie } from 'hono/cookie';
export async function authMiddleware(c, next) {
    const token = getCookie(c, 'accessToken');
    if (!token) {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const payload = await verifySessionToken(token, c.env.JWT_SECRET);
    if (!payload) {
        return c.json({ error: 'Invalid token' }, 401);
    }
    c.set('user', payload);
    await next();
}
