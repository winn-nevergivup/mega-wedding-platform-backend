import z from "zod";

export const userSchema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    role: z.enum(["admin", "user"]),
});