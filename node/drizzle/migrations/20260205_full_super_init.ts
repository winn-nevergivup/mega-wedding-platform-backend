import { sql } from 'drizzle-orm';

export const up = async (db: any) => {
    console.log('Running super full migration up...');

    // =========================
    // USERS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT,
      name TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      last_signed_in_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // THEMES
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY NOT NULL,
      theme_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      preview_image TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // INVITATIONS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme_id TEXT REFERENCES themes(id) ON DELETE SET NULL,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      content_json TEXT NOT NULL,
      page_views INTEGER NOT NULL DEFAULT 0,
      shared_link_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      public_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invitations_user ON invitations(user_id);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_invitations_slug ON invitations(slug);`);

    // =========================
    // GUESTS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY NOT NULL,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      group TEXT,
      category TEXT,
      phone TEXT,
      rsvp_status TEXT,
      total_bring_people INTEGER NOT NULL DEFAULT 0,
      rsvp_at INTEGER,
      meal_preference TEXT,
      dietary_note TEXT,
      is_sent INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      message_at INTEGER,
      invitation_code TEXT,
      checkin_status INTEGER NOT NULL DEFAULT 0,
      checkin_at INTEGER,
      public_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_guests_invitation ON guests(invitation_id);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);`);

    // =========================
    // ORDERS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      theme_id TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_method TEXT NOT NULL DEFAULT 'manual',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      invoice_id TEXT NOT NULL,
      proof TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);`);

    // =========================
    // USER SUBSCRIPTIONS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      product_code TEXT NOT NULL,
      package_code TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at INTEGER,
      expired_at INTEGER,
      auto_renew INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user ON user_subscriptions(user_id);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_user_subscriptions_invitation ON user_subscriptions(invitation_id);`);

    // =========================
    // ARTICLES
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      views INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);`);

    // =========================
    // WISHLIST GIFTS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS wishlist_gifts (
      id TEXT PRIMARY KEY NOT NULL,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      external_link TEXT,
      target_amount INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      max_claim INTEGER DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_wishlist_invitation ON wishlist_gifts(invitation_id);`);

    // =========================
    // WISHLIST CLAIMS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS wishlist_claims (
      id TEXT PRIMARY KEY NOT NULL,
      wishlist_id TEXT NOT NULL REFERENCES wishlist_gifts(id) ON DELETE CASCADE,
      guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
      guest_name TEXT,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // NOTIFICATIONS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitation_id TEXT REFERENCES invitations(id) ON DELETE CASCADE,
      type TEXT,
      title TEXT,
      message TEXT,
      link TEXT,
      unread INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_notifications_invitation ON notifications(invitation_id);`);

    // =========================
    // BUDGET PLANNER
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS budget_planner (
      id TEXT PRIMARY KEY NOT NULL,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      estimated_amount INTEGER NOT NULL DEFAULT 0,
      actual_amount INTEGER DEFAULT 0,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // WEDDING CHECKLIST
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS wedding_checklist (
      id TEXT PRIMARY KEY NOT NULL,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category TEXT,
      due_date INTEGER,
      description TEXT,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // MEDIA
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitation_id TEXT REFERENCES invitations(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_media_invitation ON media(invitation_id);`);

    // =========================
    // RATINGS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY NOT NULL,
      guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      score INTEGER DEFAULT 0,
      comment TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // LOGIN SESSIONS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS login_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // PARTNERS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      logo TEXT,
      website TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // SYSTEM LOGS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // SETTINGS
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY NOT NULL,
      key TEXT UNIQUE,
      value TEXT,
      description TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // REVENUE SUMMARY
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS revenue_summary (
      id TEXT PRIMARY KEY NOT NULL,
      invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_amount INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'USD',
      status TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);

    // =========================
    // MESSAGE TEMPLATES
    // =========================
    await db.run(sql`
    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invitation_id TEXT REFERENCES invitations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    );
  `);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_message_templates_user ON message_templates(user_id);`);
    await db.run(sql`CREATE INDEX IF NOT EXISTS idx_message_templates_invitation ON message_templates(invitation_id);`);

    console.log('Super full migration up completed!');
};

export const down = async (db: any) => {
    console.log('Running super full migration down...');

    // Drop tables in reverse dependency order
    const tables = [
        'message_templates',
        'revenue_summary',
        'settings',
        'system_logs',
        'partners',
        'login_sessions',
        'ratings',
        'media',
        'wedding_checklist',
        'budget_planner',
        'notifications',
        'wishlist_claims',
        'wishlist_gifts',
        'articles',
        'user_subscriptions',
        'orders',
        'guests',
        'invitations',
        'themes',
        'users',
    ];

    for (const table of tables) {
        await db.run(sql`DROP TABLE IF EXISTS ${sql.raw(table)};`);
    }

    console.log('Super full migration down completed!');
};
