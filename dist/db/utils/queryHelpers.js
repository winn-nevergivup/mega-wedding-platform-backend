// db/utils/queryHelpers.ts
import { like, and } from 'drizzle-orm';
/**
 * Apply search + pagination + optional filter
 * @param baseQuery db.select().from(table) builder
 * @param searchField column untuk search (opsional)
 * @param searchTerm string search (opsional)
 * @param page halaman (default 1)
 * @param limit jumlah per halaman (default 20)
 * @param extraCondition kondisi wajib (opsional)
 * @returns builder siap dijalankan dengan .all() atau .get()
 */
export const applySearchAndPagination = (baseQuery, searchField, searchTerm, page = 1, limit = 20, extraCondition) => {
    let conditions = extraCondition;
    if (searchField && searchTerm) {
        const searchCond = like(searchField, `%${searchTerm}%`);
        conditions = conditions ? and(conditions, searchCond) : searchCond;
    }
    let query = baseQuery;
    if (conditions)
        query = query.where(conditions);
    query = query.limit(limit).offset((page - 1) * limit);
    return query;
};
