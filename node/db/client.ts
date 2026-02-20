// // node/db/client.ts
// import { drizzle } from 'drizzle-orm/libsql';
// import { createClient } from '@libsql/client';
// import * as schema from './schema';

// export function createDbClient(
//     url: string,
//     authToken: string
// ) {
//     const client = createClient({
//         url,
//         authToken,
//     });

//     return drizzle(client, { schema });
// }
