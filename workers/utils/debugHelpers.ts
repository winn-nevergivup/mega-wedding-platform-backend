/**
 * =========================
 * Cache Debug Helper
 * =========================
 */

import { cacheHelper } from 'workers/utils/cacheHelpers'; // pastikan path sesuai

export const debugCache = {
    // List semua keys di KV berdasarkan prefix
    listKVKeys: async (env: KVNamespace, prefix: string) => {
        const list = await env.list({ prefix });
        console.log(`KV Keys for prefix "${prefix}":`);
        list.keys.forEach((k) => console.log(`- ${k.name}`));
        return list.keys.map(k => k.name);
    },

    // Ambil value dari key tertentu di KV
    getKVValue: async (env: KVNamespace, key: string) => {
        const value = await cacheHelper.get(env, key);
        console.log(`KV Value for key "${key}":`, value);
        return value;
    },

    // Cek versi KV untuk prefix tertentu
    getKVVersion: async (env: KVNamespace, prefix: string) => {
        const version = await cacheHelper.getVersion(env, prefix);
        console.log(`Current version for prefix "${prefix}":`, version);
        return version;
    },

    // Cek apakah ada cache di Edge
    checkEdge: async (key: string) => {
        const cached = await cacheHelper.getEdge(key);
        if (cached) {
            console.log(`Edge Cache HIT for key "${key}":`, cached);
        } else {
            console.log(`Edge Cache MISS for key "${key}"`);
        }
        return cached;
    },

    // Debug semua cache: KV + Edge + Version
    debugAll: async (env: KVNamespace, prefix: string, keys: string[]) => {
        console.log('===== DEBUG CACHE =====');
        const version = await debugCache.getKVVersion(env, prefix);

        for (const k of keys) {
            const versionedKey = `${k}:v${version}`;
            await debugCache.getKVValue(env, versionedKey);
            await debugCache.checkEdge(versionedKey);
        }
        console.log('===== END DEBUG =====');
    }
};
