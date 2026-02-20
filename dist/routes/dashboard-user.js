import { eq, like, and, sql, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbClient, invitations, guests, wishlistGifts, wishlistClaims, messageTemplates, budgetPlanner, weddingChecklist, notifications, userSubscriptions, users, orders } from '../db';
import { cacheHelper } from '../db/utils/cacheHelpers';
import { applySearchAndPagination } from 'db/utils/queryHelpers';
import { authMiddleware } from 'middleware/auth';
const dashboard = new Hono();
dashboard.use('/user/*', authMiddleware);
// =====================
// 1️⃣ Lihat profile sendiri (cache 60 detik)
// =====================
dashboard.get('/user/profile', async (c) => {
    const currentUser = c.get('user');
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const cacheKey = `user:profile:${currentUser.id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const profile = await db.select().from(users).where(sql `id = ${currentUser.id}`).get();
    await cacheHelper.set(c.env.CACHE, cacheKey, { profile }, 60);
    return c.json({ profile });
});
// =====================
// 2️⃣ Update profile (invalidate cache setelah update)
// =====================
dashboard.put('/user/profile', async (c) => {
    const currentUser = c.get('user');
    const body = await c.req.json();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    await db.update(users)
        .set({ ...body, updatedAt: new Date() })
        .where(sql `id = ${currentUser.id}`)
        .run();
    // Hapus cache supaya update terlihat
    await cacheHelper.delete(c.env.CACHE, `user:profile:${currentUser.id}`);
    return c.json({ message: 'Profile updated' });
});
// =====================
// 3️⃣ Lihat orders milik user sendiri (cache per user 60 detik)
// =====================
dashboard.get('/user/orders', async (c) => {
    const currentUser = c.get('user');
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const cacheKey = `user:orders:${currentUser.id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const ordersList = await db.select().from(orders).where(sql `userId = ${currentUser.id}`).all();
    await cacheHelper.set(c.env.CACHE, cacheKey, { data: ordersList }, 60);
    return c.json({ data: ordersList });
});
// GET invitation + modules (Read) with pagination & search
// --------------------
dashboard.get('/user/invitation/:invId', async (c) => {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 20);
    const search = c.req.query('search') || '';
    // ✅ CONSISTENT CACHE KEY
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}:dashboard:${page}:${limit}:${search}`);
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const invitation = await db.select().from(invitations)
        .where(eq(invitations.id, invId))
        .get();
    if (!invitation || invitation.userId !== user.id)
        return c.json({ error: 'Invitation not found' }, 404);
    // Guests
    const guestsList = await applySearchAndPagination(db.select().from(guests), guests.name, search, page, limit, eq(guests.invitationId, invId)).all();
    // Wishlist
    const wishlist = await applySearchAndPagination(db.select().from(wishlistGifts), wishlistGifts.title, search, page, limit, eq(wishlistGifts.invitationId, invId)).all();
    // Wishlist Claims
    const wishlistIds = wishlist.map((w) => w.id);
    const claims = wishlistIds.length > 0
        ? await db.select().from(wishlistClaims)
            .where(inArray(wishlistClaims.wishlistId, wishlistIds))
            .all()
        : [];
    // Message templates
    const messages = await db.select()
        .from(messageTemplates)
        .where(search
        ? and(eq(messageTemplates.invitationId, invId), like(messageTemplates.title, `%${search}%`))
        : eq(messageTemplates.invitationId, invId))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    // Budget planner
    const budgets = await db.select().from(budgetPlanner)
        .where(eq(budgetPlanner.invitationId, invId))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    // Checklist
    const checklist = await db.select().from(weddingChecklist)
        .where(eq(weddingChecklist.invitationId, invId))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    // Billing
    const billings = await db.select().from(userSubscriptions)
        .where(eq(userSubscriptions.invitationId, invId))
        .all();
    // Notifications
    const notificationsList = await db.select().from(notifications)
        .where(eq(notifications.invitationId, invId))
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    const data = {
        invitation,
        guests: guestsList,
        wishlist,
        wishlistClaims: claims,
        messageTemplates: messages,
        budgetPlanner: budgets,
        weddingChecklist: checklist,
        billings,
        notifications: notificationsList,
        profile: {
            name: user.name,
            email: user.email,
            phone: user.phone
        },
        page,
        limit,
    };
    // ✅ CACHE SET
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
});
// --------------------
// CRUD MODULES
// --------------------
// ---------- GET LIST ----------
dashboard.get('/user/invitation/:invId/wishlist', (c) => crudGet(c, wishlistGifts, 'invitationId'));
dashboard.get('/user/invitation/:invId/wishlist-claims', crudGetWishlistClaims);
dashboard.get('/user/invitation/:invId/message', (c) => crudGet(c, messageTemplates, 'invitationId'));
dashboard.get('/user/invitation/:invId/budget', (c) => crudGet(c, budgetPlanner, 'invitationId'));
dashboard.get('/user/invitation/:invId/checklist', (c) => crudGet(c, weddingChecklist, 'invitationId'));
dashboard.get('/user/invitation/:invId/guests', (c) => crudGet(c, guests, 'invitationId'));
// ---------- WISHLIST ----------
dashboard.post('/user/invitation/:invId/wishlist', (c) => crudInsert(c, wishlistGifts, 'invitationId'));
dashboard.put('/user/invitation/:invId/wishlist/:id', (c) => crudUpdate(c, wishlistGifts));
dashboard.delete('/user/invitation/:invId/wishlist/:id', (c) => crudDelete(c, wishlistGifts));
// ---------- MESSAGE TEMPLATES ----------
dashboard.post('/user/invitation/:invId/message', (c) => crudInsert(c, messageTemplates, 'invitationId'));
dashboard.put('/user/invitation/:invId/message/:id', (c) => crudUpdate(c, messageTemplates));
dashboard.delete('/user/invitation/:invId/message/:id', (c) => crudDelete(c, messageTemplates));
// ---------- BUDGET PLANNER ----------
dashboard.post('/user/invitation/:invId/budget', (c) => crudInsert(c, budgetPlanner, 'invitationId'));
dashboard.put('/user/invitation/:invId/budget/:id', (c) => crudUpdate(c, budgetPlanner));
dashboard.delete('/user/invitation/:invId/budget/:id', (c) => crudDelete(c, budgetPlanner));
// ---------- WEDDING CHECKLIST ----------
dashboard.post('/user/invitation/:invId/checklist', (c) => crudInsert(c, weddingChecklist, 'invitationId'));
dashboard.put('/user/invitation/:invId/checklist/:id', (c) => crudUpdate(c, weddingChecklist));
dashboard.delete('/user/invitation/:invId/checklist/:id', (c) => crudDelete(c, weddingChecklist));
// ---------- GUEST MANAGEMENT ----------
dashboard.post('/user/invitation/:invId/guest', (c) => crudInsert(c, guests, 'invitationId'));
dashboard.put('/user/invitation/:invId/guest/:id', (c) => crudUpdate(c, guests));
dashboard.delete('/user/invitation/:invId/guest/:id', (c) => crudDelete(c, guests));
// ---------- DETAIL GET (optional) ----------
dashboard.get('/user/invitation/:invId/wishlist/:id', (c) => crudGetDetail(c, wishlistGifts, 'invitationId'));
dashboard.get('/user/invitation/:invId/message/:id', (c) => crudGetDetail(c, messageTemplates, 'invitationId'));
dashboard.get('/user/invitation/:invId/budget/:id', (c) => crudGetDetail(c, budgetPlanner, 'invitationId'));
dashboard.get('/user/invitation/:invId/checklist/:id', (c) => crudGetDetail(c, weddingChecklist, 'invitationId'));
dashboard.get('/user/invitation/:invId/guest/:id', (c) => crudGetDetail(c, guests, 'invitationId'));
// Guest update (only allowed editable fields)
// dashboard.put('/invitation/:invId/guest/:guestId', async (c) => {
//     const user = c.get('user');
//     const { invId, guestId } = c.req.param();
//     const body = await c.req.json();
//     const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
//     const guest = await db.select().from(guests).where(eq(guests.id, guestId)).get();
//     if (!guest) return c.json({ error: 'Guest not found' }, 404);
//     const invitation = await db.select().from(invitations).where(eq(invitations.id, guest.invitationId)).get();
//     if (!invitation || invitation.userId !== user.id) return c.json({ error: 'Invitation not found' }, 404);
//     await db.update(guests)
//         .set({
//             name: body.name ?? guest.name,
//             group: body.group ?? guest.group,
//             category: body.category ?? guest.category,
//             phone: body.phone ?? guest.phone,
//         })
//         .where(eq(guests.id, guestId))
//         .run();
//     const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}`);
//     await cacheHelper.delete(c.env.CACHE, cacheKey);
//     return c.json({ message: 'Guest updated' });
// });
// QR checkin
dashboard.put('/user/invitation/:invId/guest/:guestId/checkin', async (c) => {
    const user = c.get('user');
    const { invId, guestId } = c.req.param();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    // =========================
    // Validate guest
    // =========================
    const guest = await db
        .select()
        .from(guests)
        .where(eq(guests.id, guestId))
        .get();
    if (!guest) {
        return c.json({ error: 'Guest not found' }, 404);
    }
    // =========================
    // Validate invitation ownership
    // =========================
    const invitation = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, guest.invitationId))
        .get();
    if (!invitation || invitation.userId !== user.id) {
        return c.json({ error: 'Invitation not found' }, 404);
    }
    // =========================
    // Update checkin
    // =========================
    await db.update(guests)
        .set({
        checkinStatus: true,
        checkinAt: new Date(),
    })
        .where(eq(guests.id, guestId))
        .run();
    // =========================
    // Invalidate cache
    // =========================
    await cacheHelper.clearPrefix(c.env.CACHE, `user:${user.id}:inv:${invId}:guests`);
    await cacheHelper.clearPrefix(c.env.CACHE, `user:${user.id}:inv:${invId}:wishlistClaims`);
    return c.json({ message: 'Guest checked in' });
});
// --------------------
// Generic CRUD helpers
// --------------------
//insert
export async function crudInsert(c, table, invField) {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const body = await c.req.json();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = crypto.randomUUID();
    await db.insert(table).values({ ...body, [invField]: invId, id, createdAt: new Date(), updatedAt: new Date() }).run();
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}`);
    await cacheHelper.delete(c.env.CACHE, cacheKey);
    return c.json({ message: 'Created', id });
}
// Update
export async function crudUpdate(c, table) {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    await db.update(table)
        .set({ ...body, updatedAt: new Date() })
        .where(table.id.eq(id)) // TS tidak infer dynamic column → workaround
        .run();
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}`);
    await cacheHelper.delete(c.env.CACHE, cacheKey);
    return c.json({ message: 'Updated', id });
}
// Delete
export async function crudDelete(c, table) {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const id = c.req.param('id');
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    await db.delete(table).where(table.id.eq(id)).run();
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}`);
    await cacheHelper.delete(c.env.CACHE, cacheKey);
    return c.json({ message: 'Deleted', id });
}
//get
export async function crudGet(c, table, invField) {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 20);
    const search = c.req.query('search') || '';
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}:${table.name}:${page}:${search}`);
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(JSON.parse(cached));
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    let query = db.select().from(table).where(table[invField].eq(invId));
    // Search by 'title' or 'name' if exists
    if (search) {
        if (table.title)
            query = query.where(like(table.title, `%${search}%`));
        else if (table.name)
            query = query.where(like(table.name, `%${search}%`));
    }
    const data = await query.limit(limit).offset((page - 1) * limit).all();
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
}
// ===========================
// GET DETAIL
// ===========================
export async function crudGetDetail(c, table, invField // optional, kalau ingin filter by invitation
) {
    const user = c.get('user');
    const id = c.req.param('id');
    const invId = invField ? c.req.param('invId') : null;
    const cacheKey = invId
        ? cacheHelper.getUserKey(user.id, `inv:${invId}:${table.name}:detail:${id}`)
        : cacheHelper.getUserKey(user.id, `(table as any).name}:detail:${id}`);
    // 1️⃣ check KV cache
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    let query = db.select().from(table).where(table.id.eq(id));
    // filter by invitationId kalau perlu
    if (invField && invId) {
        query = query.where(table[invField].eq(invId));
    }
    const data = await query.get(); // ambil single record
    if (!data)
        return c.json({ error: 'Not found' }, 404);
    // simpan ke cache 1 menit
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);
    return c.json(data);
}
export async function crudGetWishlistClaims(c) {
    const user = c.get('user');
    const invId = c.req.param('invId');
    const page = Number(c.req.query('page') || 1);
    const limit = Number(c.req.query('limit') || 20);
    const search = c.req.query('search') || '';
    const cacheKey = cacheHelper.getUserKey(user.id, `inv:${invId}:wishlistClaims:${page}:${search}`);
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    // =========================
    // Ambil semua wishlist invitation
    // =========================
    const wishlistList = await db
        .select()
        .from(wishlistGifts)
        .where(eq(wishlistGifts.invitationId, invId))
        .all();
    const wishlistIds = wishlistList.map(w => w.id);
    // Kalau tidak ada wishlist → tetap cache
    if (wishlistIds.length === 0) {
        const emptyResult = { data: [], page, limit };
        await cacheHelper.set(c.env.CACHE, cacheKey, emptyResult, 300);
        return c.json(emptyResult);
    }
    // =========================
    // Query claims
    // =========================
    let claimsQuery = db
        .select({
        claimId: wishlistClaims.id,
        guestId: wishlistClaims.guestId,
        guestName: wishlistClaims.guestName,
        wishlistId: wishlistClaims.wishlistId,
        status: wishlistClaims.status,
        createdAt: wishlistClaims.createdAt,
        updatedAt: wishlistClaims.updatedAt,
    })
        .from(wishlistClaims)
        .where(inArray(wishlistClaims.wishlistId, wishlistIds));
    // =========================
    // Search guest name
    // =========================
    if (search) {
        const matchingGuests = await db
            .select({ id: guests.id })
            .from(guests)
            .where(like(guests.name, `%${search}%`))
            .all();
        const matchingGuestIds = matchingGuests.map(g => g.id);
        // Kalau tidak ada guest match → return kosong + cache
        if (matchingGuestIds.length === 0) {
            const emptyResult = { data: [], page, limit };
            await cacheHelper.set(c.env.CACHE, cacheKey, emptyResult, 300);
            return c.json(emptyResult);
        }
        claimsQuery = claimsQuery.where(inArray(wishlistClaims.guestId, matchingGuestIds));
    }
    const claims = await claimsQuery
        .limit(limit)
        .offset((page - 1) * limit)
        .all();
    const result = { data: claims, page, limit };
    // cache 5 menit
    await cacheHelper.set(c.env.CACHE, cacheKey, result, 300);
    return c.json(result);
}
export default dashboard;
