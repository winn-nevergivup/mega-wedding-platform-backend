// src/db/seed/orders.seed.ts
import { faker } from '@faker-js/faker';
import { orders } from '../db/schema';
import { uuid, now } from '../db/utils/helpers';
export async function seedOrders(db, users) {
    const data = users
        .filter(u => u.role === 'user')
        .map(user => ({
        id: uuid(),
        userId: user.id,
        name: user.name,
        email: user.email,
        themeId: faker.word.noun(),
        amount: faker.number.int({ min: 20, max: 300 }),
        currency: 'USD',
        paymentStatus: faker.helpers.arrayElement(['pending', 'confirmed']),
        invoiceId: faker.string.uuid(),
        createdAt: now(),
        updatedAt: now(),
    }));
    await db.insert(orders).values(data);
}
