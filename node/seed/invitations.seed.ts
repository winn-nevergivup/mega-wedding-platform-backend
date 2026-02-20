// src/db/seed/invitations.seed.ts
import { faker } from '@faker-js/faker';
import { uuid } from '../../workers/utils/helpers.ts';
import { invitations } from '../db/schema.ts';

export async function seedInvitations(db: any, users: any[], themes: any[]) {
    const data = [];

    for (const user of users.filter(u => u.role === 'user')) {
        const theme = faker.helpers.arrayElement(themes);

        data.push({
            id: uuid(),
            userId: user.id,
            themeId: theme.id,
            slug: faker.helpers.slugify(`${user.name}-${Date.now()}`),
            title: `${user.name} Wedding`,
            status: 'active',
            contentJson: JSON.stringify({}),
            pageViews: faker.number.int({ min: 0, max: 500 }),
            sharedLinkCount: faker.number.int({ min: 0, max: 50 }),
            publicHash: uuid(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    await db.insert(invitations).values(data);
    return data;
}
