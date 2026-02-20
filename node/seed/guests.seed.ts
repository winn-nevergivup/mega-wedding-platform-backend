// src/db/seed/guests.seed.ts
import { faker } from '@faker-js/faker';
import { uuid } from '../../workers/utils/helpers.ts';
import { guests } from '../db/schema.ts';

const BATCH_SIZE = 100; // bisa disesuaikan

export async function seedGuests(db: any, invitations: any[]) {
    const data = [];

    for (const inv of invitations) {
        const total = faker.number.int({ min: 50, max: 300 });

        for (let i = 0; i < total; i++) {
            data.push({
                id: uuid(),
                invitationId: inv.id,
                name: faker.person.fullName(),
                group: faker.helpers.arrayElement(['family', 'friend', 'office']),
                phone: faker.phone.number(),
                rsvpStatus: faker.helpers.arrayElement(['yes', 'no', 'maybe']),
                totalBringPeople: faker.number.int({ min: 0, max: 4 }),
                isSent: faker.datatype.boolean(),
                checkinStatus: faker.datatype.boolean(),
                publicHash: uuid(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
    }

    // Batch insert
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        await db.insert(guests).values(batch).run();
    }
}
