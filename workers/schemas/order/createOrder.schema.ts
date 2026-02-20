import { z } from 'zod'

export const createOrderSchema = z.object({
    userId: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    themeId: z.string().min(1),
    amount: z.number().default(0),
    currency: z.string().default('USD'),
    paymentMethod: z.string().default('manual'),
    paymentStatus: z.string().optional(),
    invoiceId: z.string().min(1),
    proof: z.string().optional(),
})
