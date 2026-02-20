// src/db/client.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
export function createDbClient(url, authToken) {
    const client = createClient({
        url,
        authToken,
    });
    return drizzle(client, { schema });
}
