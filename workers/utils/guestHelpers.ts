import { InferModel } from 'drizzle-orm';
import { guests } from '../../node/db/index';

type GuestInsert = InferModel<typeof guests, 'insert'>;

export function createGuest(data: Omit<GuestInsert, 'id' | 'publicHash'>): GuestInsert {
    return {
        id: crypto.randomUUID(),
        publicHash: crypto.randomUUID(),
        // set default boolean / number
        isSent: false,
        checkinStatus: false,
        totalBringPeople: 0,
        ...data,
    };
}
