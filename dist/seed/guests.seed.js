// src/db/seed/guests.seed.ts
import { faker } from '@faker-js/faker';
import { guests } from '../db/schema';
import { uuid, now } from '../db/utils/helpers';
export async function seedGuests(db, invitations) {
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
                createdAt: now(),
                updatedAt: now(),
            });
        }
    }
    await db.insert(guests).values(data);
}
