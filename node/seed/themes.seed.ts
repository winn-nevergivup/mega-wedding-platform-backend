// src/db/seed/themes.seed.ts
import { faker } from '@faker-js/faker';
import { uuid } from '../../workers/utils/helpers.ts';
import { themes } from '../db/schema.ts';

export async function seedThemes(db: any) {
    const data = Array.from({ length: 8 }).map(() => ({
        id: uuid(),
        themeCode: faker.word.noun(),
        name: faker.commerce.productName(),
        description: faker.lorem.sentence(),
        previewImage: faker.image.url(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    }));

    await db.insert(themes).values(data);
    return data;
}
