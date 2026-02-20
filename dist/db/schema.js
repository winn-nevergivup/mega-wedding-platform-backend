import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
/* =========================
   COMMON TIMESTAMPS
========================= */
const timestamps = {
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql `(strftime('%s','now'))`),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql `(strftime('%s','now'))`),
};
/* =========================
   USERS
========================= */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'), // ✅ ganti password → passwordHash
    googleId: text('google_id'), // ✅ untuk OAuth
    name: text('name'),
    phone: text('phone'),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    lastSignedInAt: integer('last_signed_in_at', { mode: 'timestamp' }),
    ...timestamps,
});
/* =========================
   USER SUBSCRIPTIONS
========================= */
export const userSubscriptions = sqliteTable('user_subscriptions', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }), // tambah invId
    productCode: text('product_code').notNull(),
    packageCode: text('package_code').notNull(),
    status: text('status').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    expiredAt: integer('expired_at', { mode: 'timestamp' }),
    autoRenew: integer('auto_renew', { mode: 'boolean' }).notNull().default(false),
    ...timestamps,
}, (t) => ({
    userIdx: index('idx_user_subscriptions_user').on(t.userId),
    invitationIdx: index('idx_user_subscriptions_invitation').on(t.invitationId),
}));
/* =========================
   THEMES
========================= */
export const themes = sqliteTable('themes', {
    id: text('id').primaryKey().notNull(),
    themeCode: text('theme_code').notNull().unique(),
    name: text('name').notNull(),
    description: text('description'),
    previewImage: text('preview_image'),
    isActive: integer('is_active', { mode: 'boolean' })
        .notNull()
        .default(true),
    ...timestamps,
});
/* =========================
   INVITATIONS
========================= */
export const invitations = sqliteTable('invitations', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    themeId: text('theme_id').references(() => themes.id, { onDelete: 'set null' }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    status: text('status').notNull(),
    contentJson: text('content_json', { mode: 'json' }).notNull(),
    pageViews: integer('page_views').notNull().default(0),
    sharedLinkCount: integer('shared_link_count').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    publicHash: text('public_hash').notNull().unique(),
    ...timestamps,
}, (t) => ({
    userIdx: index('idx_invitations_user').on(t.userId),
    slugIdx: index('idx_invitations_slug').on(t.slug),
}));
/* =========================
   GUESTS
========================= */
export const guests = sqliteTable('guests', {
    id: text('id').primaryKey().notNull(),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    group: text('group'),
    category: text('category'),
    phone: text('phone'),
    rsvpStatus: text('rsvp_status'),
    totalBringPeople: integer('total_bring_people').notNull().default(0),
    rsvpAt: integer('rsvp_at', { mode: 'timestamp' }),
    mealPreference: text('meal_preference'),
    dietaryNote: text('dietary_note'),
    isSent: integer('is_sent', { mode: 'boolean' }).notNull().default(false),
    message: text('message'),
    messageAt: integer('message_at', { mode: 'timestamp' }),
    invitationCode: text('invitation_code'),
    checkinStatus: integer('checkin_status', { mode: 'boolean' }).notNull().default(false),
    checkinAt: integer('checkin_at', { mode: 'timestamp' }),
    publicHash: text('public_hash').notNull().unique(),
    ...timestamps,
}, (t) => ({
    invitationIdx: index('idx_guests_invitation').on(t.invitationId),
    nameIdx: index('idx_guests_name').on(t.name),
}));
/* =========================
   articles
========================= */
export const articles = sqliteTable('articles', {
    id: text('id').primaryKey().notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('draft'), // draft / published
    views: integer('views').notNull().default(0),
    ...timestamps,
}, (t) => ({
    titleIdx: index('idx_articles_title').on(t.title),
    slugIdx: index('idx_articles_slug').on(t.slug),
    authorIdx: index('idx_articles_author').on(t.authorId),
}));
/* =========================
   BUDGET PLANNER
========================= */
export const budgetPlanner = sqliteTable('budget_planner', {
    id: text('id').primaryKey().notNull(),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    estimatedAmount: integer('estimated_amount').notNull().default(0),
    actualAmount: integer('actual_amount').default(0),
    status: text('status').notNull(),
    ...timestamps,
});
/* =========================
   WEDDING CHECKLIST
========================= */
export const weddingChecklist = sqliteTable('wedding_checklist', {
    id: text('id').primaryKey().notNull(),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    description: text('description'),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    ...timestamps,
});
/* =========================
   MEDIA (R2)
========================= */
export const media = sqliteTable('media', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    invitationId: text('invitation_id')
        .references(() => invitations.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // image | video | music
    r2Key: text('r2_key').notNull(),
    ...timestamps,
}, (t) => ({
    invitationIdx: index('idx_media_invitation').on(t.invitationId),
}));
/* =========================
   ORDERS
========================= */
export const orders = sqliteTable('orders', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .references(() => users.id, { onDelete: 'set null' }), // awalnya null
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    themeId: text('theme_id').notNull(),
    amount: integer('amount').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    paymentMethod: text('payment_method').notNull().default('manual'),
    paymentStatus: text('payment_status').notNull().default('pending'), // pending | confirmed | cancelled
    invoiceId: text('invoice_id').notNull(),
    proof: text('proof'), // optional, screenshot / transfer proof
    ...timestamps,
}, (t) => ({
    userIdx: index('idx_orders_user').on(t.userId),
}));
/* =========================
   WISHLIST GIFTS
========================= */
export const wishlistGifts = sqliteTable('wishlist_gifts', {
    id: text('id').primaryKey().notNull(),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type'), // item | cash | link
    externalLink: text('external_link'),
    targetAmount: integer('target_amount').default(0),
    currency: text('currency').default('USD'),
    maxClaim: integer('max_claim').default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    sortOrder: integer('sort_order').default(0),
    ...timestamps,
}, (t) => ({
    invitationIdx: index('idx_wishlist_invitation').on(t.invitationId),
}));
/* =========================
   WISHLIST CLAIMS
========================= */
export const wishlistClaims = sqliteTable('wishlist_claims', {
    id: text('id').primaryKey().notNull(),
    wishlistId: text('wishlist_id')
        .notNull()
        .references(() => wishlistGifts.id, { onDelete: 'cascade' }),
    guestId: text('guest_id')
        .notNull()
        .references(() => guests.id, { onDelete: 'cascade' }),
    guestName: text('guest_name'),
    status: text('status').notNull(), // reserved | completed
    ...timestamps,
});
/* =========================
   NOTIFICATIONS
========================= */
export const notifications = sqliteTable('notifications', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    invitationId: text('invitation_id')
        .references(() => invitations.id, { onDelete: 'cascade' }), // optional
    type: text('type'),
    title: text('title'),
    message: text('message'),
    link: text('link'),
    unread: integer('unread', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
}, (t) => ({
    userIdx: index('idx_notifications_user').on(t.userId),
    invitationIdx: index('idx_notifications_invitation').on(t.invitationId),
}));
/* =========================
   LOGIN SESSIONS
========================= */
export const loginSessions = sqliteTable('login_sessions', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    method: text('method'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
});
/* =========================
   PARTNERS
========================= */
export const partners = sqliteTable('partners', {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    logo: text('logo'),
    website: text('website'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
});
/* =========================
   RATINGS
========================= */
export const ratings = sqliteTable('ratings', {
    id: text('id').primaryKey().notNull(),
    guestId: text('guest_id')
        .notNull()
        .references(() => guests.id, { onDelete: 'cascade' }),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    score: integer('score').default(0),
    comment: text('comment'),
    ...timestamps,
});
/* =========================
   SYSTEM LOGS
========================= */
export const systemLogs = sqliteTable('system_logs', {
    id: text('id').primaryKey().notNull(),
    action: text('action'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timestamps,
});
/* =========================
   SETTINGS
========================= */
export const settings = sqliteTable('settings', {
    id: text('id').primaryKey().notNull(),
    key: text('key').unique(),
    value: text('value'),
    description: text('description'),
    ...timestamps,
});
/* =========================
   REVENUE SUMMARY
========================= */
export const revenueSummary = sqliteTable('revenue_summary', {
    id: text('id').primaryKey().notNull(),
    invitationId: text('invitation_id')
        .notNull()
        .references(() => invitations.id, { onDelete: 'cascade' }),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    totalAmount: integer('total_amount').default(0),
    currency: text('currency').default('USD'),
    status: text('status'),
    ...timestamps,
});
export const messageTemplates = sqliteTable('message_templates', {
    id: text('id').primaryKey().notNull(),
    userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    invitationId: text('invitation_id')
        .references(() => invitations.id, { onDelete: 'cascade' }), // <-- tambahkan
    title: text('title').notNull(),
    content: text('content').notNull(),
    type: text('type'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
}, (t) => ({
    userIdx: index('idx_message_templates_user').on(t.userId),
    invitationIdx: index('idx_message_templates_invitation').on(t.invitationId),
}));
