// src/db/seed/index.ts
import { createDbClient } from '../db/client';
import { seedUsers } from './users.seed';
import { seedThemes } from './themes.seed';
import { seedInvitations } from './invitations.seed';
import { seedGuests } from './guests.seed';
import { seedOrders } from './orders.seed';
async function run() {
    const db = createDbClient(process.env.TURSO_DB_URL, process.env.TURSO_DB_AUTH_TOKEN);
    console.log('🌱 Seeding...');
    const users = await seedUsers(db);
    const themes = await seedThemes(db);
    const invitations = await seedInvitations(db, users, themes);
    await seedGuests(db, invitations);
    await seedOrders(db, users);
    console.log('✅ Seed complete');
    process.exit(0);
}
run();
