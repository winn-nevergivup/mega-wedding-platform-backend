// src/db/seed/orders.seed.ts
import { faker } from '@faker-js/faker';
import {  uuid } from '../../workers/utils/helpers.ts';
import { orders } from '../db/schema.ts';

export async function seedOrders(db: any, users: any[]) {
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
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

    await db.insert(orders).values(data);
}
