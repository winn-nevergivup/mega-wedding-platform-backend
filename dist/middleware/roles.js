export function roleMiddleware(requiredRole) {
    return async (c, next) => {
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
