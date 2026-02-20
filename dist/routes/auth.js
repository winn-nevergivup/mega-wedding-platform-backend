import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import { createSessionToken, verifySessionToken, hashPassword, verifyPassword } from '../core/auth/index';
import { createDbClient, users } from '../db';
import { authMiddleware } from '../middleware/auth';
const auth = new Hono();
// =====================
// REGISTER
// =====================
auth.post('/register', async (c) => {
    const { email, password } = await c.req.json();
    if (!email || !password)
        return c.json({ error: 'Email & password required' }, 400);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const exist = await db
        .select()
        .from(users)
        .where(sql `email = ${email}`)
        .get();
    if (exist)
        return c.json({ error: 'Email already used' }, 409);
    await db.insert(users).values({
        id: crypto.randomUUID(),
        email,
        passwordHash: await hashPassword(password),
        role: 'user',
        status: 'active'
    }).run();
    return c.json({ message: 'Registered' });
});
// =====================
// LOGIN
// =====================
auth.post('/login', async (c) => {
    const { email, password, remember } = await c.req.json();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const user = await db
        .select()
        .from(users)
        .where(sql `email = ${email}`)
        .get();
    if (!user || !user.passwordHash)
        return c.json({ error: 'Invalid credentials' }, 401);
    if (!(await verifyPassword(password, user.passwordHash)))
        return c.json({ error: 'Invalid credentials' }, 401);
    const exp = remember
        ? 60 * 60 * 24 * 30
        : 60 * 60 * 24 * 7;
    const token = await createSessionToken({
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + exp
    }, c.env.JWT_SECRET);
    c.header('Set-Cookie', `accessToken=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${exp}`);
    return c.json({ message: 'Logged in' });
});
// =====================
// RESET PASSWORD (MAGIC LINK)
// =====================
auth.post('/reset', async (c) => {
    const { email } = await c.req.json();
    const token = await createSessionToken({
        email,
        type: 'reset',
        exp: Math.floor(Date.now() / 1000) + 600
    }, c.env.JWT_SECRET);
    const link = `${new URL(c.req.url).origin}/auth/reset/verify?token=${token}`;
    console.log('RESET LINK:', link);
    return c.json({ message: 'Reset link (dev)', link });
});
auth.post('/reset/verify', async (c) => {
    const { token, newPassword } = await c.req.json();
    const payload = await verifySessionToken(token, c.env.JWT_SECRET);
    if (!payload || payload.type !== 'reset')
        return c.json({ error: 'Invalid token' }, 401);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    await db.update(users)
        .set({ passwordHash: await hashPassword(newPassword) })
        .where(sql `email = ${payload.email}`)
        .run();
    return c.json({ message: 'Password updated' });
});
// =====================
// GOOGLE OAUTH (CUSTOM)
// =====================
auth.post('/oauth/google', async (c) => {
    const { email, name, googleId } = await c.req.json();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    let user = await db
        .select()
        .from(users)
        .where(sql `email = ${email}`)
        .get();
    if (!user) {
        await db.insert(users).values({
            id: crypto.randomUUID(),
            email,
            name,
            googleId,
            role: 'user',
            status: 'active'
        }).run();
        user = await db
            .select()
            .from(users)
            .where(sql `email = ${email}`)
            .get();
    }
    const token = await createSessionToken({
        id: user.id,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }, c.env.JWT_SECRET);
    c.header('Set-Cookie', `accessToken=${token}; HttpOnly; Path=/; SameSite=Lax`);
    return c.json({ message: 'Logged in with Google' });
});
// =====================
// ME
// =====================
auth.get('/me', authMiddleware, (c) => {
    return c.json({ user: c.get('user') });
});
export default auth;
