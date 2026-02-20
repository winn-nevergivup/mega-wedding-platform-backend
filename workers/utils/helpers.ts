import { cacheHelper } from "./cacheHelpers";

// src/db/seed/helpers.ts
export const uuid = () => crypto.randomUUID();
export const now = () => Math.floor(Date.now() / 1000);

export const withAutoBump = (
    resource: string,
    handler: (c: any) => Promise<Response>
) =>{
    return async (c: any) => {
        const res = await handler(c)

        // Kalau sukses (2xx), bump version
        if (res.status >= 200 && res.status < 300) {
            await cacheHelper.bumpVersion(c.env.CACHE, resource)
        }

        return res
    }
}