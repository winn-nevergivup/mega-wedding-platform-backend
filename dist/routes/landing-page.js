import { Hono } from 'hono';
import { eq, like } from 'drizzle-orm';
import { createDbClient, themes, partners, articles, ratings } from '../db';
import { cacheHelper } from '../db/utils/cacheHelpers';
const landing = new Hono();
// ===========================
// Generic GET with Cache
// ===========================
async function crudGet(c, table, cachePrefix, searchField = 'name', extraFilter) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const search = c.req.query('search') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const cacheKey = `${cachePrefix}:page:${page}:limit:${limit}:search:${search}`;
    // 1️⃣ Edge cache
    const edgeCached = await cacheHelper.getEdge(cacheKey);
    if (edgeCached)
        return c.json(edgeCached);
    // 2️⃣ KV cache
    const kvCached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (kvCached) {
        // Update Edge in background
        cacheHelper.setEdge(cacheKey, kvCached, 60).catch(console.error);
        return c.json(kvCached);
    }
    // 3️⃣ DB fetch
    let query = db.select().from(table);
    if (extraFilter)
        query = query.where(extraFilter);
    if (search)
        query = query.where(like(table[searchField], `%${search}%`));
    const result = await query.limit(limit).offset((page - 1) * limit).all();
    const response = { data: result, page, limit };
    // Set both caches
    await cacheHelper.set(c.env.CACHE, cacheKey, response, 300); // KV 5 menit
    await cacheHelper.setEdge(cacheKey, response, 60); // Edge 1 menit
    return c.json(response);
}
async function crudCreate(c, table, cachePrefix, extraValues = {}) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const body = await c.req.json();
    const id = crypto.randomUUID();
    await db.insert(table).values({ id, ...body, ...extraValues, createdAt: new Date(), updatedAt: new Date() }).run();
    // Invalidate caches
    await cacheHelper.clearPrefix(c.env.CACHE, cachePrefix);
    await cacheHelper.deleteEdge(`${cachePrefix}:*`);
    return c.json({ message: 'Created', id });
}
async function crudUpdate(c, table, cachePrefix) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const body = await c.req.json();
    await db.update(table).set({ ...body, updatedAt: new Date() }).where(eq(table.id, id)).run();
    await cacheHelper.clearPrefix(c.env.CACHE, cachePrefix);
    await cacheHelper.deleteEdge(`${cachePrefix}:*`);
    return c.json({ message: 'Updated', id });
}
async function crudDelete(c, table, cachePrefix) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    await db.delete(table).where(eq(table.id, id)).run();
    await cacheHelper.clearPrefix(c.env.CACHE, cachePrefix);
    await cacheHelper.deleteEdge(`${cachePrefix}:*`);
    return c.json({ message: 'Deleted', id });
}
// ===========================
// Routes
// ===========================
// PARTNERS
// ===========================
// PARTNERS
// ===========================
landing.get('/partners', (c) => crudGet(c, partners, 'landing:partners', 'name'));
// Get partner detail
landing.get('/partners/:id', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    // cache key untuk detail
    const cacheKey = `landing:partners:detail:${id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const partner = await db.select().from(partners).where(eq(partners.id, id)).get();
    if (!partner)
        return c.json({ error: 'Partner not found' }, 404);
    // set cache 5 menit
    await cacheHelper.set(c.env.CACHE, cacheKey, partner, 300);
    return c.json(partner);
});
// Visitor submit partner form
landing.post('/partners', async (c) => crudCreate(c, partners, 'landing:partners'));
landing.put('/partners/:id', async (c) => crudUpdate(c, partners, 'landing:partners'));
landing.delete('/partners/:id', async (c) => crudDelete(c, partners, 'landing:partners'));
// ===========================
// THEMES
// ===========================
landing.get('/themes', (c) => crudGet(c, themes, 'themes:', 'name'));
// Get theme detail
landing.get('/themes/:id', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const cacheKey = `themes:detail:${id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const theme = await db.select().from(themes).where(eq(themes.id, id)).get();
    if (!theme)
        return c.json({ error: 'Theme not found' }, 404);
    await cacheHelper.set(c.env.CACHE, cacheKey, theme, 300);
    return c.json(theme);
});
// ===========================
// ARTICLES
// ===========================
landing.get('/articles', (c) => crudGet(c, articles, 'articles:', 'title'));
// Get article detail
landing.get('/articles/:id', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const cacheKey = `articles:detail:${id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const article = await db.select().from(articles).where(eq(articles.id, id)).get();
    if (!article)
        return c.json({ error: 'Article not found' }, 404);
    await cacheHelper.set(c.env.CACHE, cacheKey, article, 300);
    return c.json(article);
});
// ===========================
// RATINGS
// ===========================
landing.get('/ratings', (c) => crudGet(c, ratings, 'ratings:', 'title'));
// Get rating detail
landing.get('/ratings/:id', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');
    const cacheKey = `ratings:detail:${id}`;
    const cached = await cacheHelper.get(c.env.CACHE, cacheKey);
    if (cached)
        return c.json(cached);
    const rating = await db.select().from(ratings).where(eq(ratings.id, id)).get();
    if (!rating)
        return c.json({ error: 'Rating not found' }, 404);
    await cacheHelper.set(c.env.CACHE, cacheKey, rating, 300);
    return c.json(rating);
});
landing.post('/ratings', (c) => crudCreate(c, ratings, 'ratings:'));
landing.put('/ratings/:id', (c) => crudUpdate(c, ratings, 'ratings:'));
landing.delete('/ratings/:id', (c) => crudDelete(c, ratings, 'ratings:'));
export default landing;
