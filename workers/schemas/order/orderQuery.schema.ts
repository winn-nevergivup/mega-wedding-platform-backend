import { z } from 'zod'

export const orderQuerySchema = z.object({
    status: z.string().default('all'),
    search: z.string().default('all'),
    page: z.coerce.number().default(1),
    limit: z.coerce.number().default(20),
})
