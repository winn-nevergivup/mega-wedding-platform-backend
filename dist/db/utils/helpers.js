// src/db/seed/helpers.ts
export const uuid = () => crypto.randomUUID();
export const now = () => Math.floor(Date.now() / 1000);
