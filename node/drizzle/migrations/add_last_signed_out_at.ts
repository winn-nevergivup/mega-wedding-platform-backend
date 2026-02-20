// node/drizzle/migrations/add_last_signed_out_at.ts
// @ts-nocheck
import { sql } from 'drizzle-orm';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../../db/schema.ts';
import 'dotenv/config';

const url = process.env.TURSO_DB_URL!;
const authToken = process.env.TURSO_DB_AUTH_TOKEN!;
const db = drizzle(createClient({ url, authToken }), { schema });

export const up = async (db: any) => {
    console.log('Checking if last_signed_out_at column exists...');
    const result = await db.all(sql`PRAGMA table_info(users);`);
    const hasColumn = result.some((col: any) => col.name === 'last_signed_out_at');

    if (!hasColumn) {
        await db.run(sql`ALTER TABLE users ADD COLUMN last_signed_out_at INTEGER;`);
        console.log('last_signed_out_at column added successfully.');
    } else {
        console.log('last_signed_out_at column already exists.');
    }
};

export const down = async (db: any) => {
    console.log('Cannot safely drop last_signed_out_at in SQLite, skipping.');
};

// ===== Jalankan otomatis saat file dijalankan =====
(async () => {
    try {
        await up(db);
        console.log('Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
