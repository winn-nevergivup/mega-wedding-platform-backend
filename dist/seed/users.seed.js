// src/db/seed/users.seed.ts
import { faker } from '@faker-js/faker';
import { users } from '../db/schema';
import { uuid, now } from '../db/utils/helpers';
import { hashPassword } from '../core/auth';
export async function seedUsers(db) {
    const data = [];
    // ADMIN
    data.push({
        id: uuid(),
        email: 'admin@demo.com',
        passwordHash: await hashPassword('admin123'),
        name: 'Super Admin',
        role: 'admin',
        status: 'active',
        createdAt: now(),
        updatedAt: now(),
    });
    // USERS
    for (let i = 0; i < 20; i++) {
        data.push({
            id: uuid(),
            email: faker.internet.email(),
            passwordHash: await hashPassword('password123'),
            name: faker.person.fullName(),
            phone: faker.phone.number(),
            role: 'user',
            status: 'active',
            lastSignedInAt: now(),
            createdAt: now(),
            updatedAt: now(),
        });
    }
    await db.insert(users).values(data);
    return data;
}
