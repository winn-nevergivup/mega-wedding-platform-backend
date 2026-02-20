// @ts-nocheck
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./node/db/schema.ts",
    out: './drizzle/migrations', // folder output migration
    driver: 'd1-http',            // Turso pakai SQLite driver

    // ⬇️ INI KUNCINYA
    dialect: "turso",

    dbCredentials: {
        url: process.env.TURSO_DB_URL!,
        authToken: process.env.TURSO_DB_AUTH_TOKEN!,
    },
});
