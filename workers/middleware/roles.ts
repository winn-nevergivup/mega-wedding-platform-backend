
import { Context, Next } from 'hono';

export function roleMiddleware(requiredRole: 'user' | 'admin') {
    return async (c: Context, next: Next) => {
        const user = c.get('user');
        if (!user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Simple role check
        if (user.role !== requiredRole && user.role !== 'admin') {
            return c.json({ error: 'Forbidden' }, 403);
        }

        await next();
    };
}
