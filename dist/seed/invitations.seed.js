// src/db/seed/invitations.seed.ts
import { faker } from '@faker-js/faker';
import { invitations } from '../db/schema';
import { uuid, now } from '../db/utils/helpers';
export async function seedInvitations(db, users, themes) {
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
            createdAt: now(),
            updatedAt: now(),
        });
    }
    await db.insert(invitations).values(data);
    return data;
}
