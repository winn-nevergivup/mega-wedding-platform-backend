import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbClient, users } from '../../node/db';
import {
    createSessionToken,
    hashPassword,
    verifyPassword,
    verifySessionToken
} from '../core/auth/index';
import { authMiddleware } from '../middleware/auth';
import { loginSchema } from 'workers/schemas/auth/auth.schema';
import { sendResponse } from 'workers/utils/responseHelper';
import { deleteCookie, setCookie } from 'hono/cookie';
import { withValidation } from 'workers/utils/withValidation';
import type { User } from '../../types/User';
import { rateLimiterKV } from 'workers/utils/rateLimiter';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const auth = new Hono<{
    Bindings: {
        TURSO_DB_URL: string;
        TURSO_DB_AUTH_TOKEN: string;
        JWT_SECRET: string;
        GOOGLE_CLIENT_ID: string;
        NODE_ENV: string;
    };
    Variables: { user: any };
}>();



// =====================
// REGISTER
// =====================
auth.post('/register', async (c) => {
    try {
        const { email, password, name, phone } = await c.req.json();

        if (!email || !password)
            return c.json({ error: 'Email & password required' }, 400);

        const db = createDbClient(
            c.env.TURSO_DB_URL,
            c.env.TURSO_DB_AUTH_TOKEN
        );

        const exist = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .get();

        if (exist)
            return c.json({ error: 'Email already used' }, 409);

        await db.insert(users).values({
            id: crypto.randomUUID(),
            email,
            name,
            phone,
            passwordHash: await hashPassword(password),
            role: 'user',
            status: 'active'
        }).run();

        return c.json({ message: 'Registered successfully' }, 201);


    } catch (err) {
        console.error(err);
        return c.json({ error: 'Internal error', detail: String(err) }, 500);
    }
});



// =====================
// LOGIN
// =====================
auth.post(
    '/login',
    rateLimiterKV({ limit: 5, duration: 60 }),
    withValidation(
        { body: loginSchema },
        async (c, { body }) => {
            const { email, password, remember } = body;

            const db = createDbClient(
                c.env.TURSO_DB_URL,
                c.env.TURSO_DB_AUTH_TOKEN
            );

            const user = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .get() as User | null;

            if (!user) {
                return sendResponse.error('Email atau password salah', 401);
            }

            if (!user.passwordHash) {
                return sendResponse.error(
                    'Akun ini terdaftar via Google. Silakan login dengan Google.',
                    401
                );
            }

            const isValid = await verifyPassword(password, user.passwordHash);
            if (!isValid) {
                return sendResponse.error('Email atau password salah', 401);
            }

            // 🔥 Kalau remember tidak dikirim → otomatis false
            const isRemember = Boolean(remember);

            // ⏱ Expire: 7 hari default, 30 hari kalau remember
            const expSeconds = isRemember
                ? 60 * 60 * 24 * 30
                : 60 * 60 * 24 * 7;

            const token = await createSessionToken(
                {
                    id: user.id,
                    role: user.role,
                    exp: Math.floor(Date.now() / 1000) + expSeconds,
                },
                c.env.JWT_SECRET
            );

            const isProd = (c.env as any).NODE_ENV === 'production';

            setCookie(c, 'accessToken', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'None' : 'Lax',
                path: '/',
                maxAge: expSeconds,
            });

            return sendResponse.success({ message: 'Logged in' }, 200);
        }
    )
);

// =====================
// GOOGLE OAUTH (CUSTOM)
// =====================
auth.post(
    '/oauth/google',
    rateLimiterKV({ limit: 5, duration: 60 }),
    async (c) => {
        const { idToken } = await c.req.json();

        if (!idToken) {
            return c.json({ error: 'Missing idToken' }, 400);
        }

        try {
            // ✅ Verify Google Token
            const googleJWKS = createRemoteJWKSet(
                new URL('https://www.googleapis.com/oauth2/v3/certs')
            );

            const { payload } = await jwtVerify(idToken, googleJWKS, {
                issuer: ['https://accounts.google.com', 'accounts.google.com'],
                audience: c.env.GOOGLE_CLIENT_ID,
            });

            const { email, name, sub, email_verified } = payload as any;

            if (!email || !email_verified) {
                return c.json({ error: 'Email not verified' }, 403);
            }

            const db = createDbClient(
                c.env.TURSO_DB_URL,
                c.env.TURSO_DB_AUTH_TOKEN
            );

            // ✅ Check user
            let user = await db
                .select()
                .from(users)
                .where(eq(users.email, email))
                .get();

            if (user) {
                // Auto link if needed
                if (!user.googleId) {
                    await db
                        .update(users)
                        .set({
                            googleId: sub,
                        })
                        .where(eq(users.id, user.id))
                        .run();
                }
            } else {
                // Create new user
                await db.insert(users).values([{
                    id: crypto.randomUUID(),
                    email,
                    name,
                    googleId: sub,
                    role: 'user',
                    status: 'active'
                }]).run();


                user = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email))
                    .get();
            }

            // ✅ Create internal JWT (7 days)
            const exp = 60 * 60 * 24 * 7;

            const token = await createSessionToken(
                {
                    id: user!.id,
                    role: user!.role,
                    exp: Math.floor(Date.now() / 1000) + exp,
                },
                c.env.JWT_SECRET
            );

            const isProd = c.env.NODE_ENV === 'production';

            setCookie(c, 'accessToken', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'Lax',
                path: '/',
                maxAge: exp,
            });

            return c.json({ message: 'Logged in with Google' });

        } catch {
            return c.json({ error: 'Invalid Google token' }, 401);
        }
    }
);


// =====================
// ME
// =====================
auth.get('/me', authMiddleware, (c) => {
    const user = c.get('user')

    return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
    })
});



// =====================
// RESET PASSWORD (MAGIC LINK)
// =====================
auth.post('/reset', async (c) => {
    const { email } = await c.req.json();

    const token = await createSessionToken(
        {
            email,
            type: 'reset',
            exp: Math.floor(Date.now() / 1000) + 600
        },
        c.env.JWT_SECRET
    );

    const link = `${new URL(c.req.url).origin}/auth/reset/verify?token=${token}`;
    console.log('RESET LINK:', link);

    return c.json({ message: 'Reset link (dev)', link });
});

auth.post('/reset/verify', async (c) => {
    const { token, newPassword } = await c.req.json();

    const payload = await verifySessionToken(
        token,
        c.env.JWT_SECRET
    );

    if (!payload || payload.type !== 'reset')
        return c.json({ error: 'Invalid token' }, 401);

    const db = createDbClient(
        c.env.TURSO_DB_URL,
        c.env.TURSO_DB_AUTH_TOKEN
    );

    await db.update(users)
        .set({ passwordHash: await hashPassword(newPassword) })
        .where(sql`email = ${payload.email}`)
        .run();

    return c.json({ message: 'Password updated' });
});


/* ================================
   LOGOUT
================================ */
auth.post('/logout', authMiddleware, async (c) => {
    const user = c.get('user')

    const db = createDbClient(
        c.env.TURSO_DB_URL,
        c.env.TURSO_DB_AUTH_TOKEN
    )

    await db
        .update(users)
        .set({ lastSignedOutAt: new Date() })
        .where(eq(users.id, user.id))

    deleteCookie(c, 'accessToken')

    return c.json({ message: 'Logged out' })
})

export default auth;
