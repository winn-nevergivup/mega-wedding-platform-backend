import 'dotenv/config';
import { createDbClient } from './index.ts';

const db = createDbClient(
    process.env.TURSO_DB_URL!,
    process.env.TURSO_DB_AUTH_TOKEN!
);

const result = await db.all(`PRAGMA table_info(users);`);

// Type assertion
console.table(
    (result as { name: string; type: string }[]).map(r => ({
        name: r.name,
        type: r.type,
    }))
);
