// workers/utils/withValidation.ts
import { Context } from 'hono';
import { ZodSchema } from 'zod';
import { sendResponse } from './responseHelper';
import { makeCacheKey } from './makeCacheKey';

type Schemas = {
    body?: ZodSchema<any>;
    query?: ZodSchema<any>;
    params?: ZodSchema<any>;
};

type Options = {
    cachePrefix?: string;
    requireQuery?: boolean;
    requireBody?: boolean;
};

export function withValidation(
    schemas: Schemas,
    handler: (
        c: Context,
        data: { body?: any; query?: any; params?: any; cacheKey?: string }
    ) => Promise<Response> | Response,
    options?: Options
) {
    return async (c: Context) => {
        let validatedBody, validatedQuery, validatedParams;

        // ===== BODY =====
        if (schemas.body) {
            try {
                const json = await c.req.json();
                const parsed = schemas.body.safeParse(json);
                if (!parsed.success) {
                    return sendResponse.error('Invalid body', 400, parsed.error.flatten());
                }
                validatedBody = parsed.data;
            } catch {
                if (options?.requireBody) return sendResponse.error('Body required', 400);
            }
        }

        // ===== QUERY =====
        if (schemas.query) {
            const rawQuery = Object.fromEntries(new URL(c.req.url).searchParams.entries());
            if (options?.requireQuery && Object.keys(rawQuery).length === 0) {
                return sendResponse.error('Query required', 400);
            }
            const parsed = schemas.query.safeParse(rawQuery);
            if (!parsed.success) return sendResponse.error('Invalid query', 400, parsed.error.flatten());
            validatedQuery = parsed.data;
        }

        // ===== PARAMS =====
        if (schemas.params) {
            const parsed = schemas.params.safeParse(c.req.param());
            if (!parsed.success) return sendResponse.error('Invalid params', 400, parsed.error.flatten());
            validatedParams = parsed.data;
        }

        // ===== CACHE KEY =====
        let cacheKey: string | undefined;
        if (options?.cachePrefix) {
            cacheKey = makeCacheKey(options.cachePrefix, { ...validatedQuery, ...validatedParams });
        }

        try {
            return await handler(c, { body: validatedBody, query: validatedQuery, params: validatedParams, cacheKey });
        } catch (err: any) {
            console.error(err);
            return sendResponse.error(err.message || 'Internal server error', 500);
        }
    };
}
