// src/types/env.ts
import type { Env } from 'hono';

export interface AppEnv extends Env {
    Bindings: {
        TURSO_DB_URL: string;
        TURSO_DB_AUTH_TOKEN: string;
        JWT_SECRET: string;
        CACHE: KVNamespace;
        RATE_LIMIT_KV: KVNamespace;  // tambahkan ini
        NODE_ENV?: 'development' | 'production'  // tambahkan ini
    };
    Variables: {
        user?: {
            id: string;
            role: 'user' | 'admin';
        };
    };
}
