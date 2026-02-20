// check_users_columns.ts
import 'dotenv/config';
import { createDbClient} from './index';
import { sql } from 'drizzle-orm';

async function checkColumns() {
    const db = createDbClient(
        process.env.TURSO_DB_URL!,
        process.env.TURSO_DB_AUTH_TOKEN!
    );

    const result = await db.all(sql`PRAGMA table_info(users);`);
    console.table(result.map((c: any) => ({ name: c.name, type: c.type })));
}

checkColumns();

