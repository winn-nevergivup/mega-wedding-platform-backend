
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.ts';
export * from './schema.ts';

export function createDbClient(url: string, authToken?: string) {
    const client = createClient({
        url,
        authToken,
    });
    return drizzle(client, { schema });
}


