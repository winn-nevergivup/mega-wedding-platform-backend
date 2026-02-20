// src/db/seed/themes.seed.ts
import { faker } from '@faker-js/faker';
import { themes } from '../db/schema';
import { uuid, now } from '../db/utils/helpers';
export async function seedThemes(db) {
    const data = Array.from({ length: 8 }).map(() => ({
        id: uuid(),
        themeCode: faker.word.noun(),
        name: faker.commerce.productName(),
        description: faker.lorem.sentence(),
        previewImage: faker.image.url(),
        isActive: true,
        createdAt: now(),
        updatedAt: now(),
    }));
    await db.insert(themes).values(data);
    return data;
}
