import { Hono } from 'hono';
import { eq, like, and, gt, lt } from 'drizzle-orm';
import { createDbClient, orders, users, invitations, themes, articles, ratings, partners, } from '../db';
import { cacheHelper } from '../db/utils/cacheHelpers';
import { hashPassword } from 'core/auth';
import { authMiddleware } from 'middleware/auth';
import { roleMiddleware } from 'middleware/roles';
const dashboard = new Hono();
dashboard.use('/admin/*', authMiddleware); // wajib login
dashboard.use('/admin/*', roleMiddleware('admin')); // wajib role admin
// ======================================
// 1️⃣ Tambah Order Manual (Admin)
// ======================================
// Tambah order manual (admin)
dashboard.post('/admin/orders', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const body = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(orders).values({
        id,
        ...body,
        paymentStatus: body.paymentStatus || 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
    }).run();
    // invalidate KV cache
    await cacheHelper.clearPrefix(c.env.CACHE, 'admin:orders');
    // invalidate Edge cache (hapus key spesifik atau seluruh prefix manual)
    const keysToDelete = [
        `admin:orders:status=all:search=all:page=1:limit=20`,
        // bisa tambah key lain kalau mau hapus beberapa kombinasi
    ];
    for (const key of keysToDelete) {
        await cacheHelper.deleteEdge(key);
    }
    return c.json({ message: 'Order created', id });
});
// ======================================
// 2️⃣ Lihat Orders (Filter / Search / Pagination)
// ======================================
dashboard.get('/admin/orders', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const status = c.req.query('status') || 'all';
    const search = c.req.query('search') || 'all';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    // ⭐ cache key admin pattern
    const cacheKey = `admin:orders:status=${status}:search=${search}:page=${page}:limit=${limit}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const result = await db
        .select()
        .from(orders)
        .where((o) => {
        const filters = [];
        if (status !== 'all')
            filters.push(eq(o.paymentStatus, status));
        if (search !== 'all')
            filters.push(like(o.name, `%${search}%`));
        if (filters.length === 0)
            return undefined;
        if (filters.length === 1)
            return filters[0];
        return filters;
    })
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    const data = { data: result, page, limit };
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
});
// ======================================
// 3️⃣ Confirm Payment → Create User + Invitation
// ======================================
dashboard.post('/admin/orders/:id/confirm', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const orderId = c.req.param('id');
    const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order)
        return c.json({ error: 'Order not found' }, 404);
    if (order.paymentStatus === 'confirmed')
        return c.json({ error: 'Already confirmed' }, 400);
    const userId = crypto.randomUUID();
    const password = crypto.randomUUID();
    await db.insert(users).values({
        id: crypto.randomUUID(),
        name: order.name,
        email: order.email,
        passwordHash: await hashPassword(password),
        phone: order.phone || '',
        role: 'user',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    }).run();
    const invitationId = crypto.randomUUID();
    await db.insert(invitations).values({
        id: invitationId,
        userId,
        themeId: order.themeId,
        title: `${order.name}'s Invitation`,
        slug: `${order.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        status: 'draft',
        contentJson: '{}',
        pageViews: 0,
        sharedLinkCount: 0,
        publicHash: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
    }).run();
    await db.update(orders)
        .set({ userId, paymentStatus: 'confirmed', updatedAt: new Date() })
        .where(eq(orders.id, orderId))
        .run();
    // ⭐ INVALIDATE CACHE ADMIN
    await cacheHelper.clearPrefix(c.env.CACHE, 'admin:orders');
    await cacheHelper.clearPrefix(c.env.CACHE, 'admin:revenue');
    return c.json({
        message: 'Payment confirmed, user & invitation created',
        userId,
        invitationId
    });
});
/* =======================================================
   🔹 Generic CRUD Helpers
======================================================= */
async function crudCreate(c, table, module, extraValues = {}) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const body = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(table).values({
        id,
        ...body,
        ...extraValues,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).run();
    // ⭐ clear cache module
    await cacheHelper.clearPrefix(c.env.CACHE, `admin:${module}`);
    return c.json({ message: 'Created', id });
}
async function crudUpdate(c, table, module) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(table)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(table.id, id))
        .run();
    await cacheHelper.clearPrefix(c.env.CACHE, `admin:${module}`);
    return c.json({ message: 'Updated', id });
}
async function crudDelete(c, table, module) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    await db.delete(table)
        .where(eq(table.id, id))
        .run();
    await cacheHelper.clearPrefix(c.env.CACHE, `admin:${module}`);
    return c.json({ message: 'Deleted', id });
}
async function crudGet(c, table, module, searchField = 'name', extraFilter) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const search = c.req.query('search') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const cacheKey = `admin:${module}:${page}:${limit}:${search}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    let result;
    if (search && extraFilter) {
        result = await db.select().from(table)
            .where(and(extraFilter, like(table[searchField], `%${search}%`)))
            .limit(limit)
            .offset((page - 1) * limit)
            .all();
    }
    else if (search) {
        result = await db.select().from(table)
            .where(like(table[searchField], `%${search}%`))
            .limit(limit)
            .offset((page - 1) * limit)
            .all();
    }
    else if (extraFilter) {
        result = await db.select().from(table)
            .where(extraFilter)
            .limit(limit)
            .offset((page - 1) * limit)
            .all();
    }
    else {
        result = await db.select().from(table)
            .limit(limit)
            .offset((page - 1) * limit)
            .all();
    }
    const data = { data: result, page, limit };
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
}
async function crudGetDetail(c, table, module) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const cacheKey = `admin:${module}:detail:${id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const data = await db.select()
        .from(table)
        .where(eq(table.id, id))
        .get();
    if (!data) {
        return c.json({ error: 'Not found' }, 404);
    }
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 120);
    return c.json(data);
}
/* =======================================================
   🔹 Users CRUD
======================================================= */
dashboard.get('/admin/users', (c) => crudGet(c, users, 'users', 'name'));
dashboard.post('/admin/users', (c) => crudCreate(c, users, 'users'));
dashboard.put('/admin/users/:id', (c) => crudUpdate(c, users, 'users'));
dashboard.delete('/admin/users/:id', (c) => crudDelete(c, users, 'users'));
dashboard.get('/admin/users/:id', (c) => crudGetDetail(c, users, 'users'));
/* =======================================================
   🔹 Themes CRUD
======================================================= */
dashboard.get('/admin/themes', (c) => crudGet(c, themes, 'themes', 'name'));
dashboard.post('/admin/themes', (c) => crudCreate(c, themes, 'themes'));
dashboard.put('/admin/themes/:id', (c) => crudUpdate(c, themes, 'themes'));
dashboard.delete('/admin/themes/:id', (c) => crudDelete(c, themes, 'themes'));
dashboard.get('/admin/themes/:id', (c) => crudGetDetail(c, themes, 'themes'));
/* =======================================================
   🔹 Articles CRUD
======================================================= */
dashboard.get('/admin/articles', (c) => crudGet(c, articles, 'articles', 'title'));
dashboard.post('/admin/articles', (c) => crudCreate(c, articles, 'articles'));
dashboard.put('/admin/articles/:id', (c) => crudUpdate(c, articles, 'articles'));
dashboard.delete('/admin/articles/:id', (c) => crudDelete(c, articles, 'articles'));
dashboard.get('/admin/articles/:id', (c) => crudGetDetail(c, articles, 'articles'));
/* =======================================================
   🔹 Ratings CRUD
======================================================= */
dashboard.get('/admin/ratings', (c) => crudGet(c, ratings, 'ratings', 'title'));
dashboard.post('/admin/ratings', (c) => crudCreate(c, ratings, 'ratings'));
dashboard.put('/admin/ratings/:id', (c) => crudUpdate(c, ratings, 'ratings'));
dashboard.delete('/admin/ratings/:id', (c) => crudDelete(c, ratings, 'ratings'));
dashboard.get('/admin/ratings/:id', (c) => crudGetDetail(c, ratings, 'ratings'));
/* =======================================================
   🔹 Partners CRUD
======================================================= */
dashboard.get('/admin/partners', (c) => crudGet(c, partners, 'partners', 'name'));
dashboard.post('/admin/partners', (c) => crudCreate(c, partners, 'partners'));
dashboard.put('/admin/partners/:id', (c) => crudUpdate(c, partners, 'partners'));
dashboard.delete('/admin/partners/:id', (c) => crudDelete(c, partners, 'partners'));
dashboard.get('/admin/partners/:id', (c) => crudGetDetail(c, partners, 'partners'));
// ======================================
// 7️⃣ Revenue → Filter Orders
// ======================================
dashboard.get('/admin/revenue', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const status = c.req.query('status') || '';
    const startStr = c.req.query('start') || '';
    const endStr = c.req.query('end') || '';
    const startDate = startStr ? new Date(startStr) : undefined;
    const endDate = endStr ? new Date(endStr) : undefined;
    // ⭐ cache key admin pattern
    const cacheKey = `admin:revenue:${status}:${startStr}:${endStr}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    let result;
    if (status && startDate && endDate) {
        result = await db
            .select()
            .from(orders)
            .where(and(eq(orders.paymentStatus, status), gt(orders.createdAt, startDate), lt(orders.createdAt, endDate)))
            .all();
    }
    else if (status) {
        result = await db
            .select()
            .from(orders)
            .where(eq(orders.paymentStatus, status))
            .all();
    }
    else if (startDate && endDate) {
        result = await db
            .select()
            .from(orders)
            .where(and(gt(orders.createdAt, startDate), lt(orders.createdAt, endDate)))
            .all();
    }
    else {
        result = await db.select().from(orders).all();
    }
    const data = { data: result };
    // ⭐ cache 60 detik
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
});
export default dashboard;
