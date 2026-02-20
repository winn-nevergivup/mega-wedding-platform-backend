import 'dotenv/config';
import { createDbClient } from '../db/index.ts';
import { seedGuests } from './guests.seed.ts';
import { seedInvitations } from './invitations.seed.ts';
import { seedOrders } from './orders.seed.ts';
import { seedThemes } from './themes.seed.ts';
import { seedUsers } from './users.seed.ts';
import { users, themes, invitations, guests, orders } from '../db/schema.ts';

async function run() {
    const db = createDbClient(
        process.env.TURSO_DB_URL!,
        process.env.TURSO_DB_AUTH_TOKEN!
    );

    console.log('🌱 Resetting database...');

    // reset semua tabel (development only)
    await db.delete(orders).run();
    await db.delete(guests).run();
    await db.delete(invitations).run();
    await db.delete(themes).run();
    await db.delete(users).run();

    console.log('🌱 Seeding users...');
    const usersData = await seedUsers(db);

    console.log('🌱 Seeding themes...');
    const themesData = await seedThemes(db);

    console.log('🌱 Seeding invitations...');
    const invitationsData = await seedInvitations(db, usersData, themesData);

    console.log('🌱 Seeding guests...');
    await seedGuests(db, invitationsData);

    console.log('🌱 Seeding orders...');
    await seedOrders(db, usersData);

    console.log('✅ Seed complete');
    process.exit(0);
}

run().catch((err) => {
    console.error('❌ Seed failed', err);
    process.exit(1);
});
