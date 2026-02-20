// db/helpers/recordHelpers.ts
/**
 * Helper untuk membuat record baru
 * - Auto-generate id
 * - Auto-set createdAt & updatedAt
 */
export function createRecord<T extends Record<string, any>>(data: Partial<T>): T & { id: string; createdAt: Date; updatedAt: Date } {
    return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
    } as T & { id: string; createdAt: Date; updatedAt: Date };
}
