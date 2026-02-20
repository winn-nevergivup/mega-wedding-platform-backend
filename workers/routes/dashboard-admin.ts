import { and, eq, gt, like,  count } from 'drizzle-orm';
import { Context, Hono } from 'hono';
import { hashPassword } from 'workers/core/auth';
import { authMiddleware } from 'workers/middleware/auth';
import { roleMiddleware } from 'workers/middleware/roles';
import {
    articles,
    createDbClient,
    invitations,
    orders,
    partners,
    ratings,
    themes,
    users,
} from '../../node/db';
import { cacheHelper } from '../utils/cacheHelpers';
import { rateLimiterKV } from 'workers/utils/rateLimiter';
import { withValidation } from 'workers/utils/withValidation';
import { orderQuerySchema } from 'workers/schemas/order/orderQuery.schema';


type Bindings = {
    TURSO_DB_URL: string;
    TURSO_DB_AUTH_TOKEN: string;
    JWT_SECRET: string;
    CACHE: KVNamespace;
    ENV: string
};

type Variables = {
    user: {
        id: string;
        role: 'user' | 'admin';
    };
};

const dashboard = new Hono<{
    Bindings: Bindings;
    Variables: Variables;
}>();

dashboard.use('*', 
    rateLimiterKV({
        limit: 100,          // 100 req
        duration: 60,        // per 60 detik
    })
) // KV diambil dari c.env
dashboard.use('*', authMiddleware)       // wajib login
dashboard.use('*', roleMiddleware('admin')) // wajib role admin

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
// ===== GET ORDERS =====
dashboard.get(
    '/admin/orders',
    withValidation(
        { query: orderQuerySchema },
        async (c, { query }) => {
            const IS_DEV = (c.env.ENV || 'development') === 'development'
            const db = createDbClient(
                c.env.TURSO_DB_URL,
                c.env.TURSO_DB_AUTH_TOKEN
            )

            const AREA = 'admin'
            const RESOURCE = 'orders'
            const IDENTIFIER = 'all'

            // =============================
            // HARD LIMIT CAP (ANTI ABUSE)
            // =============================
            const limit = Math.min(query.limit || 10, 50)
            const page = Math.max(query.page || 1, 1)

            const rawSearch = query.search?.trim() || ''

            const isSearch =
                rawSearch &&
                rawSearch !== 'all' &&
                rawSearch.length >= 3

            // =============================
            // SEARCH THROTTLE
            // =============================
            if (rawSearch && rawSearch !== 'all') {
                if (rawSearch.length < 3) {
                    return c.json(
                        { success: false, message: 'Search minimal 3 karakter' },
                        400
                    )
                }

                if (page > 5) {
                    return c.json(
                        { success: false, message: 'Search maksimal page 5' },
                        400
                    )
                }
            }

            const params = {
                status: query.status || 'all',
                search: isSearch ? rawSearch : 'all',
                page,
                limit,
            }

            // =============================
            // 🔥 AUTO INIT VERSION (BUMPERS)
            // =============================
            let version = await cacheHelper.getVersion(
                c.env.CACHE,
                RESOURCE
            )

            if (!version) {
                await cacheHelper.bumpVersion(c.env.CACHE, RESOURCE)
                version = await cacheHelper.getVersion(
                    c.env.CACHE,
                    RESOURCE
                )
            }

            const cacheKey = cacheHelper.makeKey(
                AREA,
                RESOURCE,
                IDENTIFIER,
                version,
                params
            )

            let cacheSource: 'edge' | 'kv' | 'db' = 'db'

            const debugInfo: any = {
                cacheKey,
                version,
                edge: { exists: false },
                kv: { exists: false },
                storedInKV: false,
                storedInEdge: false,
                cacheSource: null,
            }

            // =============================
            // 1️⃣ EDGE CHECK
            // =============================
            const edgeCached = await cacheHelper.getEdge(cacheKey)

            if (edgeCached) {
                cacheSource = 'edge'
                debugInfo.edge.exists = true
                debugInfo.cacheSource = cacheSource

                return c.json({
                    success: true,
                    data: edgeCached,
                    debug: IS_DEV ? debugInfo : undefined,
                })
            }

            // =============================
            // 2️⃣ KV CHECK
            // =============================
            const kvCached = await cacheHelper.get(
                c.env.CACHE,
                cacheKey
            )

            if (kvCached) {
                cacheSource = 'kv'
                debugInfo.kv.exists = true

                // Warm edge
                await cacheHelper.setEdge(cacheKey, kvCached, 300)

                debugInfo.storedInEdge = true
                debugInfo.cacheSource = cacheSource

                return c.json({
                    success: true,
                    data: kvCached,
                    debug: IS_DEV ? debugInfo : undefined,
                })
            }

            // =============================
            // 3️⃣ BUILD WHERE
            // =============================
            const conditions: any[] = []

            if (query.status && query.status !== 'all')
                conditions.push(eq(orders.paymentStatus, query.status))

            if (isSearch)
                conditions.push(like(orders.name, `%${rawSearch}%`))

            const whereCondition = conditions.length
                ? and(...conditions)
                : undefined

            // =============================
            // 4️⃣ TOTAL COUNT
            // =============================
            const totalCountResult = await db
                .select({ total: count(orders.id) })
                .from(orders)
                .where(whereCondition)
                .all()

            const totalCount = totalCountResult[0]?.total ?? 0
            const totalPages = Math.ceil(totalCount / limit)

            if (page > totalPages && totalPages > 0) {
                return c.json(
                    {
                        success: false,
                        message: `Page ${page} tidak tersedia`,
                    },
                    400
                )
            }

            // =============================
            // 5️⃣ DB QUERY
            // =============================
            const result = await db
                .select()
                .from(orders)
                .where(whereCondition)
                .limit(limit)
                .offset((page - 1) * limit)
                .all()

            const data = {
                data: result,
                meta: {
                    page,
                    limit,
                    totalPages,
                    totalCount,
                },
            }

            // =============================
            // 6️⃣ ADAPTIVE TTL
            // =============================
            let KV_TTL = cacheHelper.getOrdersTTL(params)

            // 🔥 SEARCH TTL LEBIH PENDEK
            if (isSearch) KV_TTL = 60

            const EDGE_TTL = 300

            // =============================
            // 7️⃣ CACHE RESULT (TERM EMPTY)
            // =============================
            await cacheHelper.set(
                c.env.CACHE,
                cacheKey,
                data,
                KV_TTL
            )

            await cacheHelper.setEdge(
                cacheKey,
                data,
                EDGE_TTL
            )

            debugInfo.storedInKV = true
            debugInfo.storedInEdge = true
            debugInfo.cacheSource = 'db'

            return c.json({
                success: true,
                data,
                debug: IS_DEV ? debugInfo : undefined,
            })
        }
    )
)


// ======================================
// 3️⃣ Confirm Payment → Create User + Invitation
// ======================================
dashboard.post('/admin/orders/:id/confirm', async (c) => {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const orderId = c.req.param('id');

    const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
    if (!order) return c.json({ error: 'Order not found' }, 404);
    if (order.paymentStatus === 'confirmed') return c.json({ error: 'Already confirmed' }, 400);

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
    }).run();

    await db.update(orders)
        .set({ userId, paymentStatus: 'confirmed'})
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

async function crudCreate(
    c: Context<{ Bindings: Bindings; Variables: Variables }>,
    table: any,
    module: string,
    extraValues = {},
    validationSchema?: any
) {
    const IS_DEV = (c.env.ENV || 'development') === 'development';
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);

    // ==================================================
    // 1️⃣ VALIDATE BODY
    // ==================================================
    const body = await c.req.json();
    if (validationSchema) {
        const valid = validationSchema.safeParse(body);
        if (!valid.success) {
            return c.json({ success: false, errors: valid.error.format() }, 400);
        }
    }

    // ==================================================
    // 2️⃣ GENERATE ID
    // ==================================================
    const id = crypto.randomUUID();

    // ==================================================
    // 3️⃣ INSERT TO DB
    // ==================================================
    await db.insert(table).values({
        id,
        ...body,
        ...extraValues,
        createdAt: new Date(),
        updatedAt: new Date(),
    }).run();

    // ==================================================
    // 4️⃣ BUMP VERSION (INVALIDATE CACHE LOGICALLY)
    // ==================================================
    await cacheHelper.bumpVersion(c.env.CACHE, module);

    const debug = IS_DEV ? { bumpedModule: module } : undefined;

    // ==================================================
    // 5️⃣ RETURN RESPONSE
    // ==================================================
    return c.json({ success: true, message: 'Created', id, debug });
}

async function crudUpdate(
    c: Context<{
        Bindings: Bindings;
        Variables: Variables;
    }>,
    table: any,
    module: string
) {
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


async function crudDelete(
    c: Context<{
        Bindings: Bindings;
        Variables: Variables;
    }>,
    table: any,
    module: string
) {
    const db = createDbClient(c.env.TURSO_DB_URL, c.env.TURSO_DB_AUTH_TOKEN);
    const id = c.req.param('id');

    await db.delete(table)
        .where(eq(table.id, id))
        .run();

    await cacheHelper.clearPrefix(c.env.CACHE, `admin:${module}`);

    return c.json({ message: 'Deleted', id });
}

async function crudGet(
    c: Context<{ Bindings: Bindings; Variables: Variables }>,
    table: any,
    module: string,
    searchField = "name",
    extraFilter?: any
) {
    const IS_DEV = (c.env.ENV || "development") === "development";
    const db = createDbClient(
        c.env.TURSO_DB_URL,
        c.env.TURSO_DB_AUTH_TOKEN
    );

    const AREA = "admin";
    const RESOURCE = module;
    const IDENTIFIER = "all";

    // ==================================================
    // 🔹 SAFE QUERY PARSING
    // ==================================================
    const rawSearch = (c.req.query("search") || "").trim();

    const parsedPage = Number(c.req.query("page"));
    const parsedLimit = Number(c.req.query("limit"));

    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    // 🔥 HARD LIMIT CAP (ANTI ABUSE)
    const limitRaw =
        Number.isFinite(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : 10;

    const limit = Math.min(limitRaw, 50); // max 50

    // ==================================================
    // 🔥 SEARCH THROTTLE
    // ==================================================
    if (rawSearch && rawSearch !== "all") {
        if (rawSearch.length < 2) {
            return c.json(
                { success: false, message: "Search minimal 2 karakter" },
                400
            );
        }

        if (page > 5) {
            return c.json(
                { success: false, message: "Search maksimal page 5" },
                400
            );
        }
    }

    const isSearch =
        rawSearch &&
        rawSearch !== "all" &&
        rawSearch.length >= 2;

    const search = isSearch ? rawSearch : "all";

    const params = { search, page, limit };

    // ==================================================
    // 🔹 AUTO INIT VERSION
    // ==================================================
    let version = await cacheHelper.getVersion(c.env.CACHE, RESOURCE);

    if (!version) {
        await cacheHelper.bumpVersion(c.env.CACHE, RESOURCE);
        version = await cacheHelper.getVersion(c.env.CACHE, RESOURCE);
    }

    const cacheKey = cacheHelper.makeKey(
        AREA,
        RESOURCE,
        IDENTIFIER,
        version,
        params
    );

    const debug: any = {
        cacheKey,
        version,
        edge: { exists: false },
        kv: { exists: false },
        cacheSource: "db",
    };

    // ==================================================
    // 1️⃣ EDGE CACHE
    // ==================================================
    const edgeCached = await cacheHelper.getEdge(cacheKey);

    if (edgeCached) {
        debug.edge.exists = true;
        debug.cacheSource = "edge";

        return c.json({
            success: true,
            data: edgeCached,
            debug: IS_DEV ? debug : undefined,
        });
    }

    // ==================================================
    // 2️⃣ KV CACHE
    // ==================================================
    const kvCached = await cacheHelper.get(c.env.CACHE, cacheKey);

    if (kvCached) {
        debug.kv.exists = true;
        debug.cacheSource = "kv";

        // Warm edge
        await cacheHelper.setEdge(cacheKey, kvCached, 300);

        return c.json({
            success: true,
            data: kvCached,
            debug: IS_DEV ? debug : undefined,
        });
    }

    // ==================================================
    // 3️⃣ BUILD WHERE
    // ==================================================
    const conditions: any[] = [];

    if (isSearch) {
        conditions.push(
            like(table[searchField], `%${rawSearch}%`)
        );
    }

    if (extraFilter) {
        conditions.push(extraFilter);
    }

    const whereCondition =
        conditions.length > 0 ? and(...conditions) : undefined;

    // ==================================================
    // 4️⃣ TOTAL COUNT
    // ==================================================
    const totalCountResult = await db
        .select({ total: count(table.id) })
        .from(table)
        .where(whereCondition)
        .all();

    const totalCount = totalCountResult[0]?.total ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    if (page > totalPages && totalPages > 0) {
        return c.json(
            { success: false, message: `Page ${page} tidak tersedia` },
            400
        );
    }

    // ==================================================
    // 5️⃣ DB QUERY
    // ==================================================
    const result = await db
        .select()
        .from(table)
        .where(whereCondition)
        .limit(limit)
        .offset((page - 1) * limit)
        .all();

    const data = {
        data: result,
        meta: {
            page,
            limit,
            totalPages,
            totalCount,
        },
    };

    // ==================================================
    // 6️⃣ ADAPTIVE TTL (SMART)
    // ==================================================
    let KV_TTL = 86400; // default 1 day

    if (isSearch) {
        KV_TTL = 60; // search short cache
    } else if (page === 1) {
        KV_TTL = 86400; // first page long
    } else {
        KV_TTL = 3600; // other pages medium
    }

    const EDGE_TTL = 300;

    // ==================================================
    // 7️⃣ STORE CACHE (TERM EMPTY)
    // ==================================================
    await cacheHelper.set(c.env.CACHE, cacheKey, data, KV_TTL);
    await cacheHelper.setEdge(cacheKey, data, EDGE_TTL);

    debug.cacheSource = "db";

    return c.json({
        success: true,
        data,
        debug: IS_DEV ? debug : undefined,
    });
}


async function crudGetDetail(
    c: Context<{ Bindings: Bindings; Variables: Variables }>,
    table: any,
    module: string
) {
    const IS_DEV = (c.env.ENV || "development") === "development";

    const db = createDbClient(
        c.env.TURSO_DB_URL,
        c.env.TURSO_DB_AUTH_TOKEN
    );

    const AREA = "admin";
    const RESOURCE = module;

    // ==================================================
    // 🔹 SAFE QUERY PARSING
    // ==================================================
    const id = (c.req.param("id") || "").trim();
    const rawSearch = (c.req.query("search") || "").trim();
    const parsedLimit = Number(c.req.query("limit"));

    if (!id) {
        return c.json(
            { success: false, message: "ID tidak valid" },
            400
        );
    }

    const limitRaw =
        Number.isFinite(parsedLimit) && parsedLimit > 0
            ? parsedLimit
            : 1;

    const limit = Math.min(limitRaw, 50);

    // ==================================================
    // 🔥 SEARCH THROTTLE
    // ==================================================
    if (rawSearch && rawSearch !== "all") {
        if (rawSearch.length < 2) {
            return c.json(
                { success: false, message: "Search minimal 2 karakter" },
                400
            );
        }
    }

    const isSearch =
        rawSearch &&
        rawSearch !== "all" &&
        rawSearch.length >= 2;

    const search = isSearch ? rawSearch : "all";

    const params = { search, limit };
    const IDENTIFIER = id;

    // ==================================================
    // 🔹 AUTO INIT VERSION
    // ==================================================
    let version = await cacheHelper.getVersion(c.env.CACHE, RESOURCE);

    if (!version) {
        await cacheHelper.bumpVersion(c.env.CACHE, RESOURCE);
        version = await cacheHelper.getVersion(c.env.CACHE, RESOURCE);
    }

    const cacheKey = cacheHelper.makeKey(
        AREA,
        RESOURCE,
        IDENTIFIER,
        version,
        params
    );

    const debug: any = {
        cacheKey,
        version,
        edge: { exists: false },
        kv: { exists: false },
        cacheSource: "db",
    };

    // ==================================================
    // 1️⃣ EDGE CACHE
    // ==================================================
    const edgeCached = await cacheHelper.getEdge(cacheKey);

    if (edgeCached) {
        debug.edge.exists = true;
        debug.cacheSource = "edge";

        return c.json({
            success: true,
            data: edgeCached,
            debug: IS_DEV ? debug : undefined,
        });
    }

    // ==================================================
    // 2️⃣ KV CACHE
    // ==================================================
    const kvCached = await cacheHelper.get(c.env.CACHE, cacheKey);

    if (kvCached) {
        debug.kv.exists = true;
        debug.cacheSource = "kv";

        // Warm edge
        await cacheHelper.setEdge(cacheKey, kvCached, 300);

        return c.json({
            success: true,
            data: kvCached,
            debug: IS_DEV ? debug : undefined,
        });
    }

    // ==================================================
    // 3️⃣ DB QUERY
    // ==================================================
    const result = await db
        .select()
        .from(table)
        .where(eq(table.id, id))
        .limit(limit)
        .all();

    if (!result || result.length === 0) {
        return c.json(
            { success: false, message: "Data tidak ditemukan" },
            404
        );
    }

    const data = result[0];

    // ==================================================
    // 4️⃣ ADAPTIVE KV TTL (ONLY KV ADAPTIVE)
    // ==================================================
    const KV_TTL = cacheHelper.getAdaptiveTTL({
        type: "detail"
    });

    const EDGE_TTL = 300; // fixed

    // ==================================================
    // 5️⃣ STORE CACHE
    // ==================================================
    await cacheHelper.set(c.env.CACHE, cacheKey, data, KV_TTL);
    await cacheHelper.setEdge(cacheKey, data, EDGE_TTL);

    debug.cacheSource = "db";

    // ==================================================
    // 6️⃣ RETURN RESPONSE
    // ==================================================
    return c.json({
        success: true,
        data,
        debug: IS_DEV ? debug : undefined,
    });
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
dashboard.get('/admin/ratings', (c) => crudGet(c, ratings, 'ratings', 'invitationId'));
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
    if (cached) return c.json(cached);

    let result;

    if (status && startDate && endDate) {
        result = await db
            .select()
            .from(orders)
            .where(gt(orders.createdAt, Math.floor(Date.now() / 1000)))
            .all();

    } else if (status) {
        result = await db
            .select()
            .from(orders)
            .where(eq(orders.paymentStatus, status))
            .all();

    } else if (startDate && endDate) {
        result = await db
            .select()
            .from(orders)
            .where(gt(orders.createdAt, Math.floor(Date.now() / 1000)))
            .all();

    } else {
        result = await db.select().from(orders).all();
    }

    const data = { data: result };

    // ⭐ cache 60 detik
    await cacheHelper.set(c.env.CACHE, cacheKey, data, 60);

    return c.json(data);
});

export default dashboard;
