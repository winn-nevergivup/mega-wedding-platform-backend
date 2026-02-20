export function makeCacheKey(prefix: string, params: Record<string, any>) {
    const sorted = Object.entries(params || {})
        .filter(([_, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join(':')

    return `${prefix}:${sorted}`
}
