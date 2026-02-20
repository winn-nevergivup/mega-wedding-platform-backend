// node/seed/users.seed.ts
import { faker } from '@faker-js/faker';
import { hashPassword } from '../../workers/core/auth/index.ts';
import { uuid } from '../../workers/utils/helpers.ts';
import { users } from '../db/schema.ts';

export async function seedUsers(db: any) {
    const data = [];

    // ADMIN
    data.push({
        id: uuid(),
        email: 'admin@demo.com',
        passwordHash: await hashPassword('admin123'),
        name: 'Super Admin',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    // USERS RANDOM
    const emails = new Set<string>();
    for (let i = 0; i < 20; i++) {
        let email: string;
        do {
            email = faker.internet.email();
        } while (emails.has(email));
        emails.add(email);

        data.push({
            id: uuid(),
            email,
            passwordHash: await hashPassword('password123'),
            name: faker.person.fullName(),
            phone: faker.phone.number(),
            role: 'user',
            status: 'active',
            lastSignedInAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    // Insert dan skip jika email sudah ada
    await db.insert(users).values(data).onConflictDoNothing();

    console.log(`✅ Seeded ${data.length} users (duplicates skipped automatically)`);

    return data;
}
