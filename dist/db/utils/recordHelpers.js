// db/helpers/recordHelpers.ts
/**
 * Helper untuk membuat record baru
 * - Auto-generate id
 * - Auto-set createdAt & updatedAt
 */
export function createRecord(data) {
    return {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
    };
}
